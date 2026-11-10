"""Record CPython execution as snapshots for the browser to replay."""
import array
import ast
import asyncio
import builtins
import collections
from contextlib import contextmanager
import dis
import io
import itertools
import json
import math
import sys
import types

MAX_STEPS = 4000
ALLOWED = {
    '__future__', 'abc', 'array', 'asyncio', 'bisect', 'collections',
    'copy', 'dataclasses', 'decimal', 'enum', 'fractions', 'functools',
    'heapq', 'itertools', 'math', 'numbers', 'operator', 'queue', 'random',
    're', 'statistics', 'string', 'typing',
}


def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level or name.split('.')[0] not in ALLOWED:
        raise ImportError(f"import of '{name}' is unavailable in dryrun")
    return builtins.__import__(name, globals, locals, fromlist, level)


SAFE_BUILTINS = {
    key: value for key, value in vars(builtins).items()
    if key not in ('open', 'exec', 'eval', 'compile', 'input', 'breakpoint', 'help')
}
SAFE_BUILTINS['__import__'] = guarded_import
FUNCTIONS = (
    types.FunctionType, types.BuiltinFunctionType, types.MethodType, types.ModuleType, type,
)
SEQUENCES = (
    (list, list.__iter__, 'l'),
    (tuple, tuple.__iter__, 't'),
    (collections.deque, collections.deque.__iter__, 'l'),
    (array.array, array.array.__iter__, 'l'),
    (set, set.__iter__, 's'),
    (frozenset, frozenset.__iter__, 's'),
    (bytes, bytes.__iter__, 'l'),
    (bytearray, bytearray.__iter__, 'l'),
)
OPERATORS = {
    ast.Add: lambda a, b: a + b, ast.Sub: lambda a, b: a - b,
    ast.Mult: lambda a, b: a * b, ast.FloorDiv: lambda a, b: a // b,
    ast.Mod: lambda a, b: a % b, ast.RShift: lambda a, b: a >> b,
}


class TraceLimit(BaseException):
    pass


class Output(io.StringIO):
    def write(self, value):
        remaining = 8000 - self.tell()
        if remaining > 0:
            super().write(value[:remaining])
            if len(value) > remaining:
                super().write('\n… output truncated …')
        return len(value)


def clip(text, size=160):
    return text if len(text) <= size else text[:size - 1] + '…'


def type_name(value):
    return type.__getattribute__(type(value), '__name__')


def summary(value, depth=0):
    kind = type(value)
    if kind is int and value.bit_length() > 1024:
        return f'<int, {value.bit_length()} bits>'
    if kind is str:
        return repr(clip(value, 80))
    if kind in (int, float, complex, bool, type(None)):
        return repr(value)
    if depth < 2 and kind in (list, tuple):
        left, right = ('[', ']') if kind is list else ('(', ')')
        return left + ', '.join(summary(x, depth + 1) for x in value[:5]) + ('…' if len(value) > 5 else '') + right
    return f'<{type_name(value)}>'


def object_fields(value):
    """Read stored fields without running properties or user-defined attribute hooks."""
    fields = {}
    for cls in type.__getattribute__(type(value), '__mro__'):
        for name, descriptor in type.__getattribute__(cls, '__dict__').items():
            kind = type(descriptor)
            try:
                if name == '__dict__' and kind is types.GetSetDescriptorType:
                    stored = descriptor.__get__(value)
                    fields.update((key, field) for key, field in itertools.islice(dict.items(stored), 50) if type(key) is str)
                elif kind is types.MemberDescriptorType and not name.startswith('__'):
                    if name not in fields:
                        fields[name] = descriptor.__get__(value)
            except (AttributeError, TypeError):
                continue
    return fields


def trace_frame(frame):
    return frame.f_code.co_filename == '<user>'


def user_frames(frame):
    result = []
    while frame:
        if trace_frame(frame):
            result.append(frame)
        frame = frame.f_back
    return result


class Tracer:
    def __init__(self, tree):
        self.steps, self.events, self.ids, self.keep = [], [], {}, []
        self.out = Output()
        self.reads, self.return_value = [], None
        self.conditions, self.suspended = {}, set()
        self.nodes = {}
        self.handlers = {}
        self.cleanup = set()
        self.try_else = set()
        self.truncated = False
        for node in ast.walk(tree):
            if isinstance(node, (ast.stmt, ast.ExceptHandler)):
                self.nodes.setdefault(node.lineno, node)
            if isinstance(node, ast.ExceptHandler):
                self.handlers[node.body[0].lineno] = node.lineno
            if isinstance(node, (ast.Try, ast.TryStar)):
                if node.finalbody:
                    self.cleanup.add(node.finalbody[0].lineno)
                if node.orelse:
                    self.try_else.add(node.orelse[0].lineno)

    def idof(self, value):
        key = id(value)
        if key not in self.ids:
            self.keep.append(value)
            self.ids[key] = len(self.keep)
        return self.ids[key]

    def encode(self, value, heap, depth=0):
        kind = type(value)
        if kind in (type(None), bool):
            return value
        if kind is int:
            if abs(value) <= 2**53 - 1:
                return value
            return {'p': summary(value)}
        if kind is float:
            return value if math.isfinite(value) else {'$': repr(value)}
        if kind is str:
            return clip(value, 1200)
        if issubclass(kind, FUNCTIONS):
            is_class = issubclass(kind, type)
            name = type.__getattribute__(value, '__name__') if is_class else value.__name__
            return {'f': name, 'c': int(is_class)}
        key = self.idof(value)
        if key in heap:
            return {'r': key}
        if depth >= 18 or self.budget <= 0:
            return {'p': f'<{type_name(value)} …>'}
        self.budget -= 1
        if issubclass(kind, dict):
            heap[key] = None
            entries = itertools.islice(dict.items(value), 60)
            heap[key] = {
                'k': 'd',
                'v': [
                    [k if type(k) in (str, bool, type(None)) or
                        (type(k) is int and abs(k) <= 2**53 - 1) or
                        (type(k) is float and math.isfinite(k)) else summary(k),
                     self.encode(v, heap, depth + 1)]
                    for k, v in entries
                ],
            }
        else:
            for cls, iterate, shape in SEQUENCES:
                if issubclass(kind, cls):
                    heap[key] = None
                    heap[key] = {
                        'k': shape,
                        'v': [self.encode(v, heap, depth + 1) for v in itertools.islice(iterate(value), 80)],
                    }
                    if cls in (collections.deque, array.array, bytes, bytearray):
                        heap[key]['label'] = cls.__name__
                    break
            else:
                fields = object_fields(value)
                if not fields:
                    return {'p': summary(value)}
                heap[key] = None
                heap[key] = {
                    'k': 'o', 'c': type_name(value),
                    'v': [[k, self.encode(v, heap, depth + 1)] for k, v in itertools.islice(fields.items(), 80)],
                }
        return {'r': key}

    def variables(self, scope, heap):
        return {
            name: self.encode(value, heap)
            for name, value in itertools.islice(
                ((k, v) for k, v in scope.items() if type(k) is str and not k.startswith('__') and not issubclass(type(v), types.ModuleType)), 80
            )
        }

    def frame(self, frame, heap):
        code = frame.f_code
        name = code.co_name
        params = code.co_varnames[:code.co_argcount + code.co_kwonlyargcount]
        if params and params[0] == 'self' and 'self' in frame.f_locals:
            name = type_name(frame.f_locals['self']) + '.' + name
        return {'n': name, 'a': params, 'v': self.variables(frame.f_locals, heap)}

    def snapshot(self, frame=None, **event):
        if len(self.steps) >= MAX_STEPS:
            self.truncated = True
            raise TraceLimit()
        heap = {}
        self.budget = 200
        frames = [self.frame(f, heap) for f in user_frames(frame)[:32]]
        if frame:
            outermost = frame
            while outermost.f_back:
                outermost = outermost.f_back
                if outermost.f_code.co_name == '<module>' and trace_frame(outermost):
                    if len(frames) == 32:
                        frames.append(self.frame(outermost, heap))
                    break
        step = {'l': frame.f_lineno if frame else 0, 'out': self.out.getvalue(),
                'F': frames[::-1] or [{'n': '<module>', 'a': [], 'v': {}}],
                'H': heap, 'rd': self.reads, **event}
        self.reads = []
        if self.return_value is not None:
            step['rv'] = self.return_value
            self.return_value = None
        self.steps.append(step)
        return step

    def peek(self, node, frame):
        """Resolve common indices by reading plain built-in values only."""
        if isinstance(node, ast.Name):
            if node.id in frame.f_locals:
                return frame.f_locals[node.id]
            return frame.f_globals[node.id]
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.Attribute):
            return object_fields(self.peek(node.value, frame))[node.attr]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            value = self.peek(node.operand, frame)
            if type(value) is int:
                return -value if isinstance(node.op, ast.USub) else value
        if isinstance(node, ast.BinOp) and type(node.op) in OPERATORS:
            a, b = self.peek(node.left, frame), self.peek(node.right, frame)
            if type(a) is int and type(b) is int and max(abs(a), abs(b)) <= 10**9:
                if not isinstance(node.op, ast.RShift) or 0 <= b <= 64:
                    return OPERATORS[type(node.op)](a, b)
        if isinstance(node, ast.Subscript):
            value, index = self.peek(node.value, frame), self.peek(node.slice, frame)
            if type(value) in (list, tuple, str, bytes, bytearray) and type(index) is int:
                return value[index]
        raise LookupError()

    def track_reads(self, node, frame):
        if isinstance(node, (ast.If, ast.While)):
            roots = [node.test]
        elif isinstance(node, (ast.For, ast.AsyncFor)):
            roots = [node.iter]
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Try, ast.TryStar, ast.ExceptHandler)):
            roots = []
        else:
            roots = [
                child for child in ast.iter_child_nodes(node)
                if isinstance(child, ast.expr)
            ]
        for root in roots:
            for expr in ast.walk(root):
                if isinstance(expr, ast.Subscript) and isinstance(expr.ctx, ast.Load):
                    try:
                        value, index = self.peek(expr.value, frame), self.peek(expr.slice, frame)
                        if type(value) in (list, tuple, array.array, collections.deque, bytes, bytearray):
                            if type(index) is int and -len(value) <= index < len(value):
                                self.reads.append(f'{self.idof(value)}:{index % len(value)}')
                    except (LookupError, ArithmeticError, TypeError):
                        continue

    def line(self, frame):
        previous = self.conditions.pop(frame, None)
        if previous:
            step, node = previous
            if frame.f_lineno == node.body[0].lineno:
                step['c'] = f'{clip(ast.unparse(node.test))} → True'
            elif not node.lineno <= frame.f_lineno <= node.test.end_lineno:
                step['c'] = f'{clip(ast.unparse(node.test))} → False'
            else:
                self.conditions[frame] = previous
        node = self.nodes.get(frame.f_lineno)
        step = self.snapshot(frame, stmt=type(node).__name__ if node else None)
        if frame.f_lineno in self.handlers and sys.exception() is not None:
            step['handled'] = type_name(sys.exception())
        if frame.f_lineno in self.cleanup:
            step['cleanup'] = True
        if frame.f_lineno in self.try_else:
            step['tryElse'] = True
        if isinstance(node, (ast.If, ast.While)) and node.body[0].lineno != node.lineno:
            self.conditions[frame] = (step, node)
        if node:
            self.track_reads(node, frame)

    def trace(self, frame, event, value):
        if not trace_frame(frame):
            return None
        code = frame.f_code
        name = code.co_name
        if event == 'call' and name != '<module>':
            args = [summary(frame.f_locals.get(x)) for x in code.co_varnames[:code.co_argcount]]
            label = f'{name}({",".join(clip(x, 12) for x in args)})'
            if frame in self.suspended:
                self.suspended.remove(frame)
                label = 'resume ' + label
            self.events.append({'t': 'c', 's': len(self.steps), 'lab': label})
        elif event == 'line':
            self.line(frame)
        elif event == 'exception':
            error_type, error, _ = value
            opcode = dis.opname[code.co_code[frame.f_lasti]]
            if not (error_type is StopIteration and opcode in ('FOR_ITER', 'SEND', 'YIELD_FROM')):
                self.conditions.pop(frame, None)
                self.snapshot(frame, exc=describe_exception(error))
        elif event == 'return':
            self.conditions.pop(frame, None)
            if name != '<module>':
                opcode = dis.opname[code.co_code[frame.f_lasti]]
                if opcode.startswith('YIELD'):
                    self.suspended.add(frame)
                    result = 'suspended'
                elif opcode.startswith('RETURN'):
                    result = clip(summary(value))
                else:
                    result = 'exception propagated'
                if opcode.startswith(('RETURN', 'YIELD')):
                    self.return_value = result
                self.events.append({'t': 'r', 's': len(self.steps), 'rv': result})
        return self.trace


def describe_exception(error):
    # Read the built-in args slot instead of invoking a user-defined __str__.
    args = BaseException.args.__get__(error)
    message = ', '.join(x if type(x) is str else summary(x) for x in args[:4])
    if isinstance(error, BaseExceptionGroup):
        members = BaseExceptionGroup.exceptions.__get__(error)
        kinds = ', '.join(type_name(member) for member in members[:6])
        message += f' ({len(members)} exceptions: {kinds})'
    return {'name': type_name(error), 'message': clip(message, 500)}

def features(tree):
    F = set(); calls = lambda n, nm: [c for c in ast.walk(n) if isinstance(c, ast.Call) and isinstance(c.func, ast.Name) and c.func.id == nm]
    meth = lambda n, at: [c.lineno for c in ast.walk(n) if isinstance(c, ast.Call) and isinstance(c.func, ast.Attribute) and c.func.attr == at]
    nodes = list(ast.walk(tree))
    aliases = {}
    for node in nodes:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                aliases[alias.asname or alias.name] = (
                    f'{node.module}.{alias.name}' if isinstance(node, ast.ImportFrom) else alias.name
                )
    api_features = {
        'bisect': '@bisect', 'heapq': '@heap', 'collections.deque': '@deque',
        'queue.Queue': '@deque', 'queue.PriorityQueue': '@heap', 'collections.Counter': '@frequency',
        'itertools.accumulate': '@prefix', 'itertools.product': '@combinatorics',
        'itertools.permutations': '@combinatorics', 'itertools.combinations': '@combinatorics',
        'math.gcd': '@number', 'math.lcm': '@number', 'math.isqrt': '@number',
        're': '@matchtext',
    }
    for fn in (n for n in nodes if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))):
        sl = [c.lineno for c in calls(fn, fn.name)]
        if sl:
            F.add('@rec'); ap, pp = meth(fn, 'append'), meth(fn, 'pop')
            if len(sl) > 1: F.add('@rec2')
            if ap and pp and min(ap) < min(sl) < max(pp): F.add('@choose')
            if any(isinstance(c, ast.Compare) and isinstance(c.ops[0], ast.In) and 'memo' in ast.unparse(c.comparators[0]).lower() for c in ast.walk(fn)): F.add('@memo')
        if any('cache' in ast.unparse(d) for d in fn.decorator_list): F.add('@memo')
    for n in nodes:
        if isinstance(n, ast.Call):
            path = ast.unparse(n.func) if isinstance(n.func, (ast.Name, ast.Attribute)) else ''
            root, dot, suffix = path.partition('.')
            path = aliases.get(root, root) + dot + suffix
            for api, signal in api_features.items():
                if path == api or path.startswith(api + '.'):
                    F.add(signal)
            if path.startswith('heapq.') and n.args and isinstance(n.args[0], ast.Name):
                if path.rsplit('.', 1)[-1] in ('heapify', 'heappush', 'heappop', 'heapreplace', 'heappushpop'):
                    F.add('@heapvar:' + n.args[0].id)
            if path in ('sorted',) or path.endswith('.sort'):
                F.add('@sort')
        if isinstance(n, (ast.Try, ast.TryStar, ast.Raise)):
            F.add('@exception')
        if isinstance(n, ast.BinOp) and isinstance(n.op, ast.BitAnd):
            if isinstance(n.left, ast.Name) and isinstance(n.right, ast.UnaryOp) and isinstance(n.right.op, ast.USub):
                if isinstance(n.right.operand, ast.Name) and n.right.operand.id == n.left.id:
                    F.add('@lowbit')
        if isinstance(n, ast.Attribute) and n.attr in ('appendleft', 'popleft'):
            F.add('@deque')
        if isinstance(n, ast.Assign):
            t = n.targets[0]
            if isinstance(t, ast.Tuple) and isinstance(n.value, ast.Tuple) and len(t.elts) == 2 and [ast.unparse(e) for e in t.elts] == [ast.unparse(e) for e in n.value.elts][::-1]: F.add('@swap')
            if isinstance(t, ast.Name) and isinstance(n.value, ast.Call) and getattr(n.value.func, 'id', '') == 'max' and any(isinstance(a, ast.BinOp) and any(isinstance(x, ast.Name) and x.id == t.id for x in ast.walk(a)) for a in n.value.args): F.add('@kadane')
            if isinstance(t, ast.Subscript):
                subs = [x for x in ast.walk(n.value) if isinstance(x, ast.Subscript) and isinstance(x.slice, ast.BinOp) and isinstance(x.slice.op, ast.Sub)]
                if subs: F.add('@recur2' if isinstance(t.value, ast.Subscript) or isinstance(subs[0].value, ast.Subscript) else '@recur1')
            if isinstance(t, ast.Attribute) and t.attr in ('next', 'prev') and any(isinstance(p, ast.While) and n in ast.walk(p) for p in ast.walk(tree)): F.add('@relink')
        if isinstance(n, ast.While):
            aug = [(m.target.id, type(m.op)) for m in ast.walk(n) if isinstance(m, ast.AugAssign) and isinstance(m.target, ast.Name)]
            if any(o is ast.Add for _, o in aug) and any(o is ast.Sub for _, o in aug): F.add('@converge')
            tn = {x.id for x in ast.walk(n.test) if isinstance(x, ast.Name)}
            mids = {a.targets[0].id for a in ast.walk(n) if isinstance(a, ast.Assign) and isinstance(a.targets[0], ast.Name) and isinstance(a.value, ast.BinOp) and isinstance(a.value.op, (ast.FloorDiv, ast.RShift))}
            if mids and any(isinstance(a, ast.Assign) and isinstance(a.targets[0], ast.Name) and a.targets[0].id in tn and any(isinstance(x, ast.Name) and x.id in mids for x in ast.walk(a.value)) for a in ast.walk(n)): F.add('@binhalf')
        if isinstance(n, ast.For) and isinstance(n.target, ast.Name):
            lv = n.target.id
            if any(isinstance(m, (ast.While, ast.If)) and any(isinstance(a, ast.AugAssign) and isinstance(a.op, ast.Add) and isinstance(a.target, ast.Name) and a.target.id != lv and isinstance(a.value, ast.Constant) and a.value.value == 1 for a in ast.walk(m)) for m in ast.walk(n)): F.add('@window')
    return sorted(F)


EMPTY_FRAME = {'n': '<module>', 'a': [], 'v': {}}


def prepare(source, flags=0):
    try:
        tree = ast.parse(source, '<user>')
        compiled = compile(tree, '<user>', 'exec', flags=flags, dont_inherit=True)
    except SyntaxError as error:
        step = {
            'l': error.lineno or 0, 'out': '', 'F': [EMPTY_FRAME], 'H': {}, 'rd': [],
            'error': f'{type(error).__name__}: {error.msg}',
            'syntax': {'column': error.offset, 'endLine': error.end_lineno, 'endColumn': error.end_offset},
        }
        return None, None, json.dumps({'steps': [step], 'evs': [], 'feat': []})
    return tree, compiled, None


@contextmanager
def execution(tracer):
    module = types.ModuleType('__main__')
    module.__dict__['__builtins__'] = SAFE_BUILTINS.copy()
    main = sys.modules.get('__main__')
    sys.modules['__main__'] = module
    state = {'scope': module.__dict__, 'error': None, 'error_line': None}
    stdout, stderr, limit, previous_trace = sys.stdout, sys.stderr, sys.getrecursionlimit(), sys.gettrace()
    try:
        sys.stdout = sys.stderr = tracer.out
        sys.setrecursionlimit(180)
        sys.settrace(tracer.trace)
        yield state
    except TraceLimit:
        state['error'] = f'Execution stopped after {MAX_STEPS} steps.'
    except BaseException as exc:
        detail = describe_exception(exc)
        state['error'] = detail['name'] + (': ' + detail['message'] if detail['message'] else '')
        tb = BaseException.__traceback__.__get__(exc)
        while tb:
            if trace_frame(tb.tb_frame):
                state['error_line'] = tb.tb_lineno
            tb = tb.tb_next
    finally:
        sys.settrace(previous_trace)
        sys.stdout, sys.stderr = stdout, stderr
        sys.setrecursionlimit(limit)
        if main is None:
            del sys.modules['__main__']
        else:
            sys.modules['__main__'] = main


def finish(tree, tracer, state):
    error = f'Execution stopped after {MAX_STEPS} steps.' if tracer.truncated else state['error']
    if error:
        last = tracer.steps[-1] if tracer.steps else {'l': 0, 'F': [EMPTY_FRAME], 'H': {}}
        tracer.steps.append({**last, 'l': state['error_line'] or last['l'], 'out': tracer.out.getvalue(), 'error': error, 'rd': []})
    else:
        tracer.budget = 200
        heap = {}
        tracer.steps.append({'l': 0, 'out': tracer.out.getvalue(), 'done': 1, 'rd': tracer.reads,
                             'F': [{**EMPTY_FRAME, 'v': tracer.variables(state['scope'], heap)}], 'H': heap})
    return json.dumps({'steps': tracer.steps, 'evs': tracer.events, 'feat': features(tree)},
                      separators=(',', ':'), ensure_ascii=True, allow_nan=False)


def run_trace(source):
    tree, compiled, error = prepare(source)
    if error:
        return error
    tracer = Tracer(tree)
    with execution(tracer) as state:
        exec(compiled, state['scope'])
    return finish(tree, tracer, state)


async def run_trace_async(source):
    tree, compiled, error = prepare(source, ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
    if error:
        return error
    tracer = Tracer(tree)
    with execution(tracer) as state:
        existing_tasks = asyncio.all_tasks()
        try:
            coroutine = eval(compiled, state['scope'])
            if coroutine is not None:
                await coroutine
        finally:
            tasks = asyncio.all_tasks() - existing_tasks
            for task in tasks:
                task.cancel()
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
    return finish(tree, tracer, state)
