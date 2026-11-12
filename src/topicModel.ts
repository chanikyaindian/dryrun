import type { Step, Value } from './workspace';

type Scalar = null | string | number | boolean;
export type TopicEvent = { operation: string; label: string; line: number; active?: number[]; related?: number[]; facts?: [string, string][]; prefix?: string;
  changed?: Record<string, number[]>; reads?: Record<string, number[]>; gridCells?: string[]; gridReads?: string[]; nodeLinks?: Record<string, string[]> };
export type TopicView = {
  facts?: [string, string][];
  rows?: { name: string; values: Scalar[]; active?: number[]; related?: number[]; index?: boolean; outside?: [number, number]; decimal?: number;
    pointers?: { name: string; index: number }[]; window?: [number, number]; characters?: boolean }[];
  grid?: { name: string; rows: Scalar[][]; active?: string[]; related?: string[]; reference?: string | number };
  nodePointers?: Record<string, string[]>;
  heap?: Scalar[];
  ranges?: { name: string; pairs: number[][] }[];
  trie?: { prefix: string; parent?: string; letter?: string; word: boolean; active: boolean }[];
};
export type Topic = { name: string; variables: string[]; events: Map<number, TopicEvent>;
  traceCue?: (step: Step, previous: Step) => TopicEvent; view: (step: Step, cue?: TopicEvent) => TopicView };
type Rule = Omit<Topic, 'events'> & { event: (before: Step, after: Step, source: string) => Omit<TopicEvent, 'line'> | undefined };

const scalar = (value: unknown): value is Scalar => value === null || ['string', 'number', 'boolean'].includes(typeof value);
export const display = (value: Scalar | undefined) => value === undefined ? '—' : value === null ? 'None' :
  value === true ? 'True' : value === false ? 'False' : String(value);
function local(step: Step, name: string) {
  for (let i = step.F.length - 1; i >= 0; i--) {
    if (Object.hasOwn(step.F[i].v, name)) return step.F[i].v[name];
  }
}
function heap(step: Step, value: unknown) {
  return value && typeof value === 'object' && 'r' in value ? step.H[String(value.r)] : undefined;
}
const item = (step: Step, name: string) => heap(step, local(step, name));
const list = (step: Step, name: string) => {
  const values = item(step, name);
  return values && /^[lt]$/.test(values.k) && values.v.every(scalar) ? values.v as Scalar[] : undefined;
};
const number = (step: Step, name: string) => {
  const value = local(step, name);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};
const entries = (step: Step, name: string) => {
  const value = item(step, name);
  return value?.k === 'd' ? value.v as [unknown, unknown][] : [];
};
const same = (a: unknown, b: unknown) => Object.is(a, b);
const id = '([\\p{ID_Start}_][\\p{ID_Continue}]*)';
const expr = (pattern: string) => new RegExp(pattern.replaceAll('%', id), 'u');
const nameOf = (value: Value | undefined) => scalar(value) ? display(value) : '—';
const facts = (step: Step, ...pairs: [string, string][]): [string, string][] =>
  pairs.map(([label, key]) => [label, nameOf(local(step, key))]);
const event = (operation: string, label: string, active?: number[], related?: number[], details?: [string, string][]) =>
  ({ operation, label, active, related, facts: details });

function windowRule(source: string): Rule | undefined {
  const add = expr('(?:^|\\n)%\\s*\\+=\\s*%\\[\\s*%\\s*\\](?=\\n|$)').exec(source);
  if (!add) return;
  const [, total, input, right] = add;
  const remove = expr('^%\\s*-=\\s*%\\[\\s*%\\s*\\]$');
  const left = source.split('\n').map(line => remove.exec(line)).find(m => m?.[1] === total && m[2] === input)?.[3];
  const best = expr('(?:^|\\n)%\\s*=\\s*max\\(\\s*\\1\\s*,\\s*%\\s*\\)').exec(source);
  if (!left || left === right || !new RegExp(right + '\\s*-\\s*' + left + '\\s*\\+\\s*1').test(source)) return;
  const bestName = best?.[2] === total ? best[1] : undefined;
  const spans = new WeakMap<Step, [number, number]>();
  let span: [number, number] | undefined;
  return {
    name: 'Sliding window', variables: [input],
    view(step, cue) {
      const values = list(step, input) ?? [];
      const pointers = [left, right].flatMap(name => {
        const index = number(step, name);
        return index !== undefined && Number.isInteger(index) && index >= 0 && index < values.length ? [{ name, index }] : [];
      });
      return { rows: [{ name: 'Input', values, index: true, pointers, related: cue?.related, window: spans.get(step) }],
        facts: facts(step, ['Window sum', total], ...(bestName ? [['Best sum', bestName] as [string, string]] : [])) };
    },
    traceCue(step, previous) {
      const value = local(step, input);
      const id = value && typeof value === 'object' ? value.r : undefined;
      const prefix = id + ':';
      const related = id === undefined ? [] : (step.rd ?? []).filter(read => read.startsWith(prefix)).map(read => Number(read.slice(prefix.length)));
      return { ...event('Execution step', '', undefined, related), line: previous.l };
    },
    event(before, after, line) {
      const data = list(before, input), old = number(before, total), next = number(after, total);
      const lo = number(after, left), hi = number(after, right);
      if (!list(after, input) || lo === undefined || hi === undefined) span = undefined;
      if (span) spans.set(after, span);
      if (!data || old === undefined || next === undefined) return;
      const removal = remove.exec(line);
      const m = add[0].trim() === line ? 'add' : removal?.[1] === total && removal[2] === input ? 'remove' : undefined;
      if (m === 'add') {
        const i = number(before, right), v = i === undefined ? undefined : data[i];
        if (typeof v === 'number' && next === old + v && lo !== undefined && hi !== undefined) {
          span = [lo, hi];
          spans.set(after, span);
          return event('Expand', 'Add ' + v + ' at the right. The sum is ' + next + '.', undefined, [i!]);
        }
      }
      if (m === 'remove' && removal?.[3] === left) {
        const i = number(before, left), v = i === undefined ? undefined : data[i];
        if (typeof v === 'number' && next === old - v && i !== undefined && hi !== undefined) {
          span = [i + 1, hi];
          spans.set(after, span);
          return event('Shrink', 'Remove ' + v + ' from the left. The sum is ' + next + '.', undefined, [i]);
        }
      }
      const oldLeft = number(before, left);
      if (span && lo !== undefined && lo === span[0] && oldLeft !== undefined && lo === oldLeft + 1 &&
          new RegExp('^' + left + '\\s*\\+=\\s*1$').test(line)) {
        return event('Move left pointer', 'Move ' + left + ' to index ' + lo + ' to mark the new start of the window.');
      }
      if (bestName && line === best?.[0].trim()) {
        const oldBest = number(before, bestName), newBest = number(after, bestName);
        if (oldBest !== undefined && newBest === Math.max(oldBest, next)) return event('Compare sums',
          newBest > oldBest ? 'Record a new best sum of ' + newBest + '.' : 'Keep the best sum of ' + newBest + '.');
      }
    },
  };
}

function stackRule(source: string): Rule | undefined {
  const match = expr('while\\s+%\\s+and\\s+%\\[\\s*%\\s*\\]\\s*([<>]=?)\\s*\\2\\[\\s*\\1\\[\\s*-1\\s*\\]\\s*\\]').exec(source);
  if (!match) return;
  const [, stack, input, cursor, operator] = match;
  const pop = expr('^%\\s*=\\s*%\\.pop\\(\\s*\\)$');
  const append = expr('^%\\.append\\(\\s*%\\s*\\)$');
  const out = expr('^%\\[\\s*%\\s*\\]\\s*=\\s*%\\s*-\\s*\\2$');
  const result = source.split('\n').map(line => out.exec(line)).find(m => m?.[3] === cursor)?.[1];
  return {
    name: 'Monotonic stack', variables: [stack, input, ...(result ? [result] : [])],
    view(step, cue) {
      const data = list(step, input) ?? [], pending = list(step, stack) ?? [];
      const rows: NonNullable<TopicView['rows']> = [
        { name: 'Input', values: data, index: true, active: cue?.active, related: cue?.related },
        { name: 'Pending stack · top on right', values: pending.map(i => typeof i === 'number' ? display(data[i]) + ' at ' + i : i) },
      ];
      if (result) rows.push({ name: 'Recorded distances', values: list(step, result) ?? [], index: true, active: cue?.operation === 'Record distance' ? cue.related : undefined });
      return { rows };
    },
    event(before, after, line) {
      const old = list(before, stack), next = list(after, stack), data = list(before, input), i = number(before, cursor);
      if (!old || !next || !data || i === undefined) return;
      const top = old.at(-1), push = append.exec(line);
      if (push?.[1] === stack && push[2] === cursor && next.length === old.length + 1 && next.at(-1) === i) {
        return event('Push', 'Put ' + display(data[i]) + ' on the stack to wait for a match.', [i]);
      }
      if (pop.exec(line)?.[2] === stack && typeof top === 'number' && next.length + 1 === old.length) {
        return event('Pop', display(data[i]) + ' ' + operator + ' ' + display(data[top]) + ', so pop the value at index ' + top + '.', [i], [top]);
      }
      const write = out.exec(line), at = write && number(before, write[2]);
      if (result && write?.[1] === result && typeof at === 'number' && list(after, result)?.[at] === i - at) {
        return event('Record distance', 'Record a distance of ' + (i - at) + ' from index ' + at + ' to ' + i + '.', [i], [at]);
      }
    },
  };
}

function lifoRule(source: string): Rule | undefined {
  const append = expr('^%\\.append\\(');
  const pop = expr('\\b%\\.pop\\(\\s*\\)');
  const lines = source.split('\n');
  const popped = new Set(lines.map(line => pop.exec(line)?.[1]).filter(Boolean));
  const stack = lines.map(line => append.exec(line.trim())?.[1]).find(name => name && popped.has(name));
  if (!stack) return;
  return {
    name: 'Stack', variables: [stack],
    view(step, cue) {
      const values = list(step, stack) ?? [];
      return { rows: [{ name: stack + ' · top on right', values, active: cue?.active }],
        facts: [['Stack size', String(values.length)]] };
    },
    event(before, after, line) {
      const old = list(before, stack), next = list(after, stack);
      const oldRef = local(before, stack), nextRef = local(after, stack);
      if (!old || !next || !oldRef || typeof oldRef !== 'object' || !nextRef || typeof nextRef !== 'object' ||
        oldRef.r !== nextRef.r || !old.slice(0, Math.min(old.length, next.length)).every((value, i) => same(value, next[i]))) return;
      if (append.exec(line)?.[1] === stack && next.length === old.length + 1) {
        const value = display(next.at(-1));
        return event('Push', 'Push ' + value + ' onto the stack.', [next.length - 1], undefined, [['Pushed', value]]);
      }
      if (pop.exec(line)?.[1] === stack && old.length === next.length + 1) {
        const value = display(old.at(-1));
        return event('Pop', 'Pop ' + value + ' from the top of the stack.', [], undefined, [['Popped', value]]);
      }
    },
  };
}

function heapRule(source: string): Rule | undefined {
  const push = expr('\\bheappush\\(\\s*%\\s*,');
  const pop = expr('\\bheappop\\(\\s*%\\s*\\)');
  const queue = (push.exec(source) ?? pop.exec(source))?.[1];
  if (!queue) return;
  const output = expr('(?:^|\\n)%\\.append\\(.*\\bheappop\\(').exec(source)?.[1];
  return {
    name: 'Min heap', variables: [queue, ...(output ? [output] : [])],
    view(step) {
      const values = list(step, queue) ?? [];
      return { heap: values, facts: [['Minimum', display(values[0])], ['Size', String(values.length)]],
        rows: output ? [{ name: 'Removed in priority order', values: list(step, output) ?? [] }] : undefined };
    },
    event(before, after, line) {
      const old = list(before, queue), next = list(after, queue);
      if (!old || !next) return;
      if (push.exec(line)?.[1] === queue && next.length === old.length + 1) {
        const counts = new Map<Scalar, number>();
        for (const value of old) counts.set(value, (counts.get(value) ?? 0) + 1);
        const added = next.filter(value => {
          const remaining = counts.get(value) ?? 0;
          if (remaining) counts.set(value, remaining - 1);
          return !remaining;
        });
        if (added.length === 1) {
          const position = next.indexOf(added[0]);
          return event('Push', 'Push ' + display(added[0]) + '. The minimum is ' + display(next[0]) + '.',
            position === next.lastIndexOf(added[0]) ? [position] : undefined);
        }
      }
      if (pop.exec(line)?.[1] === queue && old.length === next.length + 1) {
        return event('Pop minimum', 'Remove the minimum ' + display(old[0]) + '.' + (next.length ? ' The new minimum is ' + display(next[0]) + '.' : ' The heap is empty.'), next.length ? [0] : undefined);
      }
    },
  };
}

function hashRule(source: string): Rule | undefined {
  const match = expr('(?:^|\\n)%\\s*=\\s*%\\s*-\\s*%\\[\\s*%\\s*\\]').exec(source);
  if (!match) return;
  const [, need, target, input, cursor] = match;
  const guard = expr('^if\\s+%\\s+in\\s+%\\s*:$');
  const map = source.split('\n').map(line => guard.exec(line)).find(m => m?.[1] === need)?.[2];
  if (!map) return;
  return {
    name: 'Complement lookup', variables: [input, map],
    view(step, cue) {
      const index = number(step, cursor);
      return { facts: facts(step, ['Target', target], ['Needed value', need]),
        rows: [{ name: 'Input', values: list(step, input) ?? [], index: true, active: index === undefined ? undefined : [index], related: cue?.related },
          { name: 'Remembered value → index', values: entries(step, map).filter(([k, v]) => scalar(k) && scalar(v))
            .map(([k, v]) => display(k as Scalar) + ' → ' + display(v as Scalar)) }] };
    },
    event(before, after, line) {
      const i = number(before, cursor), targetValue = number(before, target), needed = number(before, need);
      if (i === undefined || targetValue === undefined || needed === undefined || item(before, map)?.k !== 'd') return;
      const value = list(before, input)?.[i];
      if (typeof value !== 'number' || targetValue - value !== needed) return;
      const prior = entries(before, map), found = prior.find(([key]) => same(key, needed));
      if (guard.exec(line)?.[1] === need && guard.exec(line)?.[2] === map) {
        return event(found ? 'Match' : 'Look up', found ? 'Find ' + needed + ' at index ' + display(found[1] as Scalar) + '. Together the values make ' + targetValue + '.'
          : 'Look for ' + needed + ' to pair with ' + value + '. It has not been seen yet.', [i], typeof found?.[1] === 'number' ? [found[1]] : undefined);
      }
      const added = entries(after, map).find(([key, index]) => same(key, value) && index === i);
      if (line.startsWith(map + '[') && added && !prior.some(([key, index]) => same(key, value) && index === i)) {
        return event('Remember', 'Remember ' + value + ' at index ' + i + ' for a later lookup.', [i]);
      }
    },
  };
}

function intervals(step: Step, name: string) {
  const value = item(step, name);
  if (!value || !/^[lt]$/.test(value.k)) return;
  const pairs = value.v.map(entry => heap(step, entry)?.v);
  return pairs.every(pair => pair?.length === 2 && pair.every(value => typeof value === 'number' && Number.isFinite(value)) && Number(pair[0]) <= Number(pair[1]))
    ? pairs as number[][] : undefined;
}
const pairLabel = (pair: number[]) => '[' + pair.join(', ') + ']';
function intervalRule(source: string): Rule | undefined {
  const loop = expr('for\\s+%\\s*,\\s*%\\s+in\\s+%\\[\\s*1\\s*:\\s*\\]\\s*:').exec(source);
  if (!loop) return;
  const [, start, end, input] = loop;
  const compare = expr('^if\\s+%\\s*<=\\s*%\\[\\s*-1\\s*\\]\\[\\s*1\\s*\\]\\s*:$');
  const merged = source.split('\n').map(line => compare.exec(line)).find(m => m?.[1] === start)?.[2];
  if (!merged) return;
  return {
    name: 'Merge intervals', variables: [input, merged],
    view(step) {
      const a = number(step, start), b = number(step, end);
      return { ranges: [{ name: 'Working input', pairs: intervals(step, input) ?? [] },
        ...(a !== undefined && b !== undefined ? [{ name: 'Current interval', pairs: [[a, b]] }] : []),
        { name: 'Merged output', pairs: intervals(step, merged) ?? [] }] };
    },
    event(before, after, line) {
      const prior = intervals(before, merged), next = intervals(after, merged);
      const a = number(before, start), b = number(before, end);
      if (line.startsWith(input + '.sort(') && intervals(after, input)?.every((pair, i, pairs) => !i || pairs[i - 1][0] <= pair[0])) {
        return event('Sort', 'Sort the intervals by their starting point.');
      }
      if (!prior || !next || a === undefined || b === undefined) return;
      const tail = prior.at(-1), last = next.at(-1);
      if (!tail || !last) return;
      if (line.startsWith(merged + '.append(') && next.length === prior.length + 1 && last[0] === a && last[1] === b) {
        return event('Keep separate', 'Keep ' + pairLabel(last) + ' separate from ' + pairLabel(tail) + '.');
      }
      if (line.startsWith(merged + '[') && last[0] === tail[0] && last[1] === Math.max(tail[1], b) && a <= tail[1]) {
        return event('Merge', 'Combine ' + pairLabel(tail) + ' and ' + pairLabel([a, b]) + ' into ' + pairLabel(last) + '.');
      }
    },
  };
}

function trieRule(source: string): Rule | undefined {
  const follow = expr('(?:^|\\n)%\\s*=\\s*\\1\\.%\\[\\s*%\\s*\\]').exec(source);
  if (!follow) return;
  const [, cursor, children, letter] = follow;
  const mark = expr('(?:^|\\n)%\\.%\\s*=\\s*True(?:\\n|$)').exec(source);
  if (!mark || mark[1] !== cursor) return;
  const terminal = mark[2];
  const root = source.split('\n').map(line => expr('^%\\s*=\\s*%$').exec(line)).find(m => m?.[1] === cursor)?.[2];
  if (!root) return;
  const scan = (step: Step) => {
    const nodes: NonNullable<TopicView['trie']> = [], seen = new Set<unknown>();
    const active = item(step, cursor);
    function visit(value: ReturnType<typeof item>, prefix: string, parent?: string, edge?: string) {
      if (value?.k !== 'o' || seen.has(value) || nodes.length >= 64) return;
      seen.add(value);
      const fields = new Map(value.v as [string, unknown][]);
      nodes.push({ prefix, parent, letter: edge, word: fields.get(terminal) === true, active: value === active });
      const branches = heap(step, fields.get(children));
      if (branches?.k !== 'd') return;
      for (const [ch, ref] of branches.v as [unknown, unknown][]) {
        if (typeof ch === 'string' && [...ch].length === 1) visit(heap(step, ref), prefix + ch, prefix, ch);
      }
    }
    visit(item(step, root), '');
    return nodes;
  };
  return {
    name: 'Prefix tree', variables: [root, cursor],
    view(step, cue) {
      const trie = scan(step), active = trie.find(node => node.active);
      return { trie: cue?.prefix ? trie.map(node => ({ ...node, active: node.prefix === cue.prefix })) : trie,
        facts: [['Current prefix', active?.prefix || 'Root'], ['Words marked', String(trie.filter(node => node.word).length)]] };
    },
    event(before, after, line) {
      const previous = scan(before), current = scan(after);
      const added = current.find(node => node.parent !== undefined && !previous.some(old => old.prefix === node.prefix));
      if (added && previous.length) return { ...event('Add branch', 'Add the letter ' + added.letter + ' to make the prefix ' + added.prefix + '.'), prefix: added.prefix };
      const completed = current.find(node => node.word && previous.some(old => old.prefix === node.prefix && !old.word));
      if (completed) return event('Mark word', 'Mark ' + completed.prefix + ' as a complete word.');
      if (line === follow[0].trim()) {
        const prefix = current.find(node => node.active)?.prefix, old = previous.find(node => node.active)?.prefix;
        if (prefix && prefix !== old && prefix === (old ?? '') + display(local(before, letter) as Scalar)) return event('Follow branch', 'Follow ' + display(local(before, letter) as Scalar) + ' to prefix ' + prefix + '.');
      }
    },
  };
}

function pointersRule(source: string): Rule | undefined {
  const loop = expr('(?:^|\\n)while\\s+%\\s*<\\s*%\\s*:').exec(source);
  if (!loop) return;
  const [, left, right] = loop;
  const pair = expr('(?:^|\\n)%\\s*=\\s*%\\[\\s*%\\s*\\]\\s*\\+\\s*\\2\\[\\s*%\\s*\\]').exec(source);
  if (!pair || pair[3] !== left || pair[4] !== right) return;
  const [, total, input] = pair;
  const change = expr('^%\\s*([+-])=\\s*1$');
  const moves = source.split('\n').map(line => change.exec(line));
  if (!moves.some(m => m?.[1] === left && m[2] === '+') || !moves.some(m => m?.[1] === right && m[2] === '-')) return;
  return {
    name: 'Two pointers', variables: [input],
    view(step) {
      const a = number(step, left), b = number(step, right);
      return { facts: facts(step, ['Left index', left], ['Right index', right], ['Last tested sum', total]),
        rows: [{ name: 'Input', values: list(step, input) ?? [], index: true,
          active: [a, b].filter(value => value !== undefined), outside: a === undefined || b === undefined ? undefined : [a, b] }] };
    },
    event(before, after, line) {
      const a = number(before, left), b = number(before, right);
      if (a === undefined || b === undefined) return;
      if (line === pair[0].trim()) {
        const data = list(before, input), x = data?.[a], y = data?.[b];
        if (typeof x === 'number' && typeof y === 'number' && number(after, total) === x + y) {
          return event('Test pair', 'The values at the two pointers are ' + x + ' and ' + y + '. Their sum is ' + (x + y) + '.');
        }
      }
      const moved = change.exec(line);
      if (moved?.[1] === left && number(after, left) === a + 1) return event('Move left pointer', 'Move the left pointer to index ' + (a + 1) + '.');
      if (moved?.[1] === right && number(after, right) === b - 1) return event('Move right pointer', 'Move the right pointer to index ' + (b - 1) + '.');
    },
  };
}

function prefixRule(source: string): Rule | undefined {
  const append = expr('(?:^|\\n)%\\.append\\(\\s*\\1\\[\\s*-1\\s*\\]\\s*\\+\\s*%\\s*\\)(?=\\n|$)').exec(source);
  if (!append) return;
  const [, prefix, addend] = append;
  const query = expr('%\\[\\s*%\\s*(\\+\\s*1)?\\s*\\]\\s*-\\s*\\1\\[\\s*%\\s*\\]');
  return {
    name: 'Prefix sums', variables: [prefix],
    view(step, cue) {
      return { rows: [{ name: 'Cumulative totals', values: list(step, prefix) ?? [], index: true, active: cue?.active, related: cue?.related }] };
    },
    event(before, after, line) {
      const old = list(before, prefix), next = list(after, prefix);
      if (!old || !next) return;
      if (line === append[0].trim() && next.length === old.length + 1) {
        const prior = old.at(-1), value = number(before, addend);
        if (typeof prior === 'number' && value !== undefined && next.at(-1) === prior + value) return event('Accumulate',
          'Add ' + value + ' to the previous total ' + prior + '. The new total is ' + (prior + value) + '.', [old.length], [old.length - 1]);
      }
      const match = query.exec(line);
      if (match?.[1] !== prefix) return;
      const hi = number(before, match[2]), lo = number(before, match[4]);
      if (hi === undefined || lo === undefined) return;
      const high = hi + Number(Boolean(match[3])), a = old[high], b = old[lo];
      if (typeof a === 'number' && typeof b === 'number' && after.out !== before.out && after.out.slice(before.out.length).trim() === String(a - b)) {
        return event('Query range', 'Subtract the prefix total ' + b + ' from ' + a + ' to get ' + (a - b) + '.', [high], [lo]);
      }
    },
  };
}

function bitsRule(source: string): Rule | undefined {
  const operation = expr('^%\\s*([|&^])=\\s*(~?)\\(\\s*1\\s*<<\\s*%\\s*\\)$');
  const name = source.split('\n').map(line => operation.exec(line)).find(Boolean)?.[1];
  if (!name) return;
  return {
    name: 'Bit flags', variables: [],
    view(step, cue) {
      const value = number(step, name);
      const binary = value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value.toString(2) : '';
      const width = Math.max(binary.length, (cue?.active?.[0] ?? 0) + 1, 4);
      return { facts: facts(step, ['Decimal value', name]),
        rows: [{ name: 'Bits · least significant first', values: binary ? [...binary.padStart(width, '0')].reverse() : [], index: true, active: cue?.active }] };
    },
    event(before, after, line) {
      const m = operation.exec(line);
      if (!m || m[1] !== name) return;
      const bit = number(before, m[4]), old = number(before, name), next = number(after, name);
      if (bit === undefined || !Number.isInteger(bit) || bit < 0 || bit > 52 || old === undefined || next === undefined ||
          !Number.isSafeInteger(old) || !Number.isSafeInteger(next) || old < 0 || next < 0) return;
      const mask = BigInt(1) << BigInt(bit), operand = m[3] ? ~mask : mask, current = BigInt(old);
      const verified = m[2] === '|' ? current | operand : m[2] === '&' ? current & operand : current ^ operand;
      if (verified !== BigInt(next)) return;
      const action = !m[3] && m[2] === '|' ? 'Set bit' : m[3] && m[2] === '&' ? 'Clear bit' : !m[3] && m[2] === '^' ? 'Toggle bit' : 'Apply mask';
      return event(action, action === 'Apply mask' ? 'Apply the mask at bit ' + bit + '. The value is ' + next + '.' :
        action + ' ' + bit + '. The value is ' + next + '.', [bit]);
    },
  };
}

function distancesRule(source: string): Rule | undefined {
  const compare = expr('^if\\s+%\\s*<\\s*%\\[\\s*%\\s*\\]\\s*:$');
  const write = expr('^%\\[\\s*%\\s*\\]\\s*=\\s*%$');
  const lines = source.split('\n');
  const match = lines.map(line => compare.exec(line)).find(m => m && lines.some(line => {
    const w = write.exec(line);
    return w?.[1] === m[2] && w[2] === m[3] && w[3] === m[1];
  }));
  if (!match || !/\b(?:heappush|heappop|dijkstra|relax|shortest_path)\b/i.test(source)) return;
  const [, candidate, distance, vertex] = match;
  const labels = (step: Step): [Scalar, Scalar][] => {
    const array = list(step, distance);
    if (array) return array.map((value, i) => [i, value]);
    return entries(step, distance).filter(([key, value]) => scalar(key) && scalar(value)) as [Scalar, Scalar][];
  };
  const valueLabel = (value: Scalar | undefined) => value === Infinity ? '∞' : display(value);
  return {
    name: 'Shortest-path distances', variables: [distance],
    view(step, cue) {
      return { rows: [{ name: 'Vertex → best known distance', values: labels(step).map(([key, value]) => display(key) + ' → ' + valueLabel(value)), active: cue?.active }] };
    },
    event(before, after, line) {
      const w = write.exec(line);
      if (w?.[1] !== distance || w[2] !== vertex || w[3] !== candidate) return;
      const v = local(before, vertex), next = number(before, candidate);
      const prior = labels(before).find(([key]) => same(key, v))?.[1];
      const values = labels(after), i = values.findIndex(([key]) => same(key, v));
      if (!scalar(v) || typeof prior !== 'number' || next === undefined || next >= prior || values[i]?.[1] !== next) return;
      return event('Improve distance', 'Improve the distance to ' + display(v) + ' from ' + valueLabel(prior) + ' to ' + next + '.', [i]);
    },
  };
}

function setsRule(source: string): Rule | undefined {
  const lookup = expr('^return\\s*%\\[\\s*%\\s*\\]$');
  const parent = source.split('\n').map(line => lookup.exec(line)).find(Boolean)?.[1];
  if (!parent || !/\bdef\s+find\(/i.test(source) || !/\bdef\s+union\(/i.test(source)) return;
  const write = expr('^%\\[\\s*%\\s*\\]\\s*=\\s*(.*)$');
  return {
    name: 'Disjoint sets', variables: [parent],
    view(step, cue) {
      const pointers = list(step, parent) ?? [];
      return { rows: [{ name: 'Node → parent', values: pointers.map((value, i) => i + ' → ' + display(value)), active: cue?.active, related: cue?.related }],
        facts: [['Set representatives', pointers.flatMap((value, i) => value === i ? [String(i)] : []).join(', ') || '—']] };
    },
    event(before, after, line) {
      const m = write.exec(line);
      if (m?.[1] !== parent) return;
      const i = number(before, m[2]), old = list(before, parent), next = list(after, parent);
      if (i === undefined || !old || !next || old.length !== next.length) return;
      const target = next[i];
      if (typeof target !== 'number' || target === old[i] || old[target] !== target) return;
      const union = old[i] === i;
      return event(union ? 'Join sets' : 'Shorten parent path',
        union ? 'Point representative ' + i + ' to ' + target + ' to join the sets.' :
          'Point ' + i + ' directly to representative ' + target + '.', [i], [target]);
    },
  };
}

function stringBuilderRule(source: string): Rule | undefined {
  const lines = source.split('\n');
  const loop = expr('^for\\s+%\\s+in\\s+%\\s*:$');
  const loops = lines.flatMap(line => {
    const match = loop.exec(line);
    return match ? [{ char: match[1], input: match[2] }] : [];
  });
  if (!loops.length) return;

  const concat = expr('^%\\s*=\\s*%\\s*\\+\\s*%$');
  const append = expr('^%\\s*\\+=\\s*%$');
  type Builder = { char: string; input: string; output: string; prepend: boolean };
  const candidates = new Map<string, Builder[]>();
  for (const line of lines) {
    const binary = concat.exec(line), augmented = append.exec(line);
    const output = binary?.[1] ?? augmented?.[1];
    if (!output) continue;
    const choices = loops.flatMap(({ char, input }) => {
      if (output === input || output === char) return [];
      const prepend = binary?.[2] === char && binary[3] === output;
      return prepend || (binary?.[2] === output && binary[3] === char) || augmented?.[2] === char
        ? [{ char, input, output, prepend }] : [];
    });
    if (choices.length) candidates.set(line, choices);
  }
  if (!candidates.size) return;

  type Snapshot = { input: string; output?: string; cursor?: number };
  const states = new WeakMap<Step, Snapshot>();
  let active: Builder | undefined;
  let scope: string | undefined;
  let latest: Snapshot | undefined;
  const scopeOf = (step: Step) => step.F.length + ':' + step.F.at(-1)?.n;
  function snapshot(step: Step, builder: Builder): Snapshot | undefined {
    const values = step.F.at(-1)?.v;
    const input = values?.[builder.input], output = values?.[builder.output];
    if (typeof input === 'string') return { input, output: typeof output === 'string' ? output : undefined };
  }
  return {
    name: 'String building', variables: [],
    // Expose the same trace view in compact Inspect, even between writes.
    traceCue: (_step, previous) => ({ operation: 'Execution step', label: '', line: previous.l }),
    view(step, cue) {
      if (!active) return {};
      const state = states.get(step) ?? (scopeOf(step) === scope ? snapshot(step, active) : undefined);
      if (!state) return {};
      return { rows: [
        { name: active.input, values: [...state.input], index: true, characters: true, related: cue?.related,
          pointers: state.cursor === undefined ? undefined : [{ name: active.char, index: state.cursor }] },
        ...(state.output === undefined ? [] : [{ name: active.output, values: [...state.output], characters: true, active: cue?.active }]),
      ] };
    },
    event(before, after, line) {
      const frame = scopeOf(before);
      if (frame === scopeOf(after)) {
        for (const builder of candidates.get(line) ?? []) {
          if (active && (builder.input !== active.input || builder.output !== active.output || builder.char !== active.char || frame !== scope)) continue;
          const prior = snapshot(before, builder), next = snapshot(after, builder);
          const char = before.F.at(-1)?.v[builder.char];
          if (!prior || !next || prior.output === undefined || typeof char !== 'string' || [...char].length !== 1 ||
              prior.input !== next.input || next.output !== (builder.prepend ? char + prior.output : prior.output + char)) continue;
          const index = [...prior.output].length;
          if ([...prior.input][index] !== char) continue;
          active = builder;
          scope = frame;
          latest = { ...next, cursor: index };
          states.set(after, latest);
          const added = JSON.stringify(char);
          return event(builder.prepend ? 'Prepend character' : 'Append character',
            'Add ' + added + ' to the ' + (builder.prepend ? 'front' : 'end') + ' of ' + builder.output + '.',
            [builder.prepend ? 0 : index], [index]);
        }
      }
      if (active && scopeOf(after) === scope) {
        const next = snapshot(after, active);
        if (next && (next.input !== latest?.input || next.output !== latest?.output)) latest = next;
      }
      // Keep the final string visible after the function's local frame exits.
      if (latest) states.set(after, latest);
    },
  };
}

export function traceTopic(lines: string[], steps: Step[]): Topic | undefined {
  const statements = lines.map(line => line.replace(/\s+#.*$/, '').trim());
  const source = statements.join('\n');
  const rules = [windowRule, kadaneRule, insertionRule, knapsackRule, stackRule, distancesRule, heapRule, hashRule,
    intervalRule, trieRule, pointersRule, prefixRule, bitsRule, setsRule, lifoRule, stringBuilderRule];
  for (const recognize of rules) {
    const rule = recognize(source);
    if (!rule) continue;
    const events = new Map<number, TopicEvent>();
    for (let i = 1; i < steps.length; i++) {
      const before = steps[i - 1], after = steps[i];
      if (after.error || after.exc || after.handled) continue;
      const cue = rule.event(before, after, statements[before.l - 1] ?? '');
      if (cue) events.set(i, { ...cue, line: before.l });
    }
    if (events.size) return { name: rule.name, variables: rule.variables, view: rule.view, traceCue: rule.traceCue, events };
  }
}

function kadaneRule(source: string): Rule | undefined {
  const update = expr('(?:^|\\n)%\\s*=\\s*max\\(\\s*%\\[\\s*%\\s*\\]\\s*,\\s*\\1\\s*\\+\\s*\\2\\[\\s*\\3\\s*\\]\\s*\\)');
  const m = update.exec(source);
  if (!m) return;
  const [, current, input, cursor] = m;
  const best = expr('(?:^|\\n)%\\s*=\\s*max\\(\\s*\\1\\s*,\\s*%\\s*\\)').exec(source);
  const bestName = best?.[2] === current ? best[1] : undefined;
  return {
    name: 'Maximum subarray', variables: [input],
    view(step, cue) {
      return { rows: [{ name: 'Input', values: list(step, input) ?? [], active: cue?.active, index: true }],
        facts: facts(step, ['Best ending here', current], ...(bestName ? [['Best overall', bestName] as [string, string]] : [])) };
    },
    event(before, after, line) {
      if (line === m[0].trim()) {
        const i = number(before, cursor), value = i === undefined ? undefined : list(before, input)?.[i];
        const old = number(before, current), next = number(after, current);
        if (old === undefined || typeof value !== 'number' || next !== Math.max(value, old + value)) return;
        return event(value > old + value ? 'Restart' : value < old + value ? 'Extend' : 'Tie',
          'Start with ' + value + ' or extend to ' + (old + value) + '. The best ending here is ' + next + '.', [i!]);
      }
      if (bestName && line === best?.[0].trim()) {
        const a = number(before, bestName), b = number(after, bestName), currentValue = number(after, current);
        if (a !== undefined && currentValue !== undefined && b === Math.max(a, currentValue) && a !== b) {
          return event('New best', 'Record ' + b + ' as the best sum so far.', [number(before, cursor)!]);
        }
      }
    },
  };
}

function insertionRule(source: string): Rule | undefined {
  const pick = expr('(?:^|\\n)%\\s*=\\s*%\\[\\s*%\\s*\\](?=\\n|$)');
  const shift = expr('(?:^|\\n)%\\[\\s*%\\s*\\+\\s*1\\s*\\]\\s*=\\s*\\1\\[\\s*\\2\\s*\\]');
  const s = shift.exec(source);
  if (!s) return;
  const m = source.split('\n').map(line => pick.exec(line)).find(match => match?.[2] === s[1]);
  if (!m) return;
  const [, key, input, outer] = m, cursor = s[2];
  const place = expr('^%\\[\\s*%\\s*\\+\\s*1\\s*\\]\\s*=\\s*%$');
  if (!source.split('\n').some(line => { const p = place.exec(line); return p?.[1] === input && p[2] === cursor && p[3] === key; })) return;
  return {
    name: 'Insertion sort', variables: [input],
    view(step, cue) {
      return { rows: [{ name: 'Array', values: list(step, input) ?? [], index: true, active: cue?.active, related: cue?.related }],
        facts: cue?.operation === 'Insert' || step.done ? undefined : facts(step, ['Value held for insertion', key]) };
    },
    event(before, after, line) {
      const old = list(before, input), next = list(after, input);
      if (!old || !next || old.length !== next.length) return;
      if (line === m[0].trim()) {
        const i = number(before, outer), held = local(after, key);
        if (i !== undefined && scalar(held) && same(old[i], held)) return event('Hold', 'Hold ' + display(held) + ' while finding its position.', [i]);
      }
      const j = number(before, cursor);
      if (j === undefined || j + 1 < 0 || j + 1 >= next.length) return;
      if (line === s[0].trim() && same(old[j], next[j + 1])) {
        return event('Shift right', 'Move ' + display(old[j]) + ' from index ' + j + ' to ' + (j + 1) + '.', [j + 1], [j]);
      }
      const p = place.exec(line), held = local(before, key);
      if (p?.[1] === input && p[2] === cursor && p[3] === key && scalar(held) && same(held, next[j + 1])) {
        return event('Insert', 'Place ' + display(held) + ' at index ' + (j + 1) + '.', [j + 1]);
      }
    },
  };
}

function knapsackRule(source: string): Rule | undefined {
  const match = expr('(?:^|\\n)%\\[\\s*%\\s*\\]\\s*=\\s*max\\(\\s*\\1\\[\\s*\\2\\s*\\]\\s*,\\s*\\1\\[\\s*\\2\\s*-\\s*%\\[\\s*%\\s*\\]\\s*\\]\\s*\\+\\s*%\\[\\s*\\4\\s*\\]\\s*\\)').exec(source);
  if (!match) return;
  const [, dp, capacity, weights, cursor, rewards] = match;
  return {
    name: 'Knapsack', variables: [dp, weights, rewards],
    view(step, cue) {
      const i = number(step, cursor);
      return { rows: [{ name: 'Best value by capacity', values: list(step, dp) ?? [], active: cue?.active, related: cue?.related, index: true }],
        facts: i === undefined ? [] : [['Item', String(i + 1)], ['Weight', display(list(step, weights)?.[i])], ['Value', display(list(step, rewards)?.[i])]] };
    },
    event(before, after, line) {
      if (line !== match[0].trim()) return;
      const c = number(before, capacity), i = number(before, cursor), old = list(before, dp), next = list(after, dp);
      if (c === undefined || i === undefined || !old || !next) return;
      const weight = list(before, weights)?.[i], reward = list(before, rewards)?.[i];
      if (typeof weight !== 'number' || typeof reward !== 'number') return;
      const skip = old[c], base = old[c - weight];
      if (typeof skip !== 'number' || typeof base !== 'number') return;
      const take = base + reward;
      if (next[c] !== Math.max(skip, take)) return;
      return event(take > skip ? 'Take item' : take === skip ? 'Tie' : 'Skip item',
        'At capacity ' + c + ', taking gives ' + take + ' and skipping gives ' + skip + '.', [c], [c - weight],
        [['Take', String(take)], ['Skip', String(skip)]]);
    },
  };
}
