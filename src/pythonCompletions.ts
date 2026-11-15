import { completeFromList, ifNotIn, snippetCompletion, type Completion, type CompletionContext, type CompletionSource } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import { globalCompletion, localCompletionSource } from '@codemirror/lang-python';

const modules = {
  bisect: ['bisect_left', 'bisect_right', 'insort_left', 'insort_right'],
  collections: ['Counter', 'defaultdict', 'deque'],
  functools: ['cache', 'lru_cache', 'reduce'],
  heapq: ['heapify', 'heappop', 'heappush', 'heappushpop', 'heapreplace', 'nlargest', 'nsmallest'],
  itertools: ['accumulate', 'chain', 'combinations', 'permutations', 'product'],
  math: ['ceil', 'floor', 'gcd', 'inf', 'isqrt', 'lcm'],
} satisfies Record<string, string[]>;

const moduleOptions = Object.keys(modules).map(label => ({ label, type: 'namespace' }));
const members = new Map(Object.entries(modules).map(([name, labels]) => [
  name, labels.map(label => ({ label, type: label === 'inf' ? 'constant' : /^[A-Z]|^(deque|defaultdict)$/.test(label) ? 'class' : 'function' })),
]));
const collectionMethods = new Map(Object.entries({
  list: ['append', 'clear', 'copy', 'count', 'extend', 'index', 'insert', 'pop', 'remove', 'reverse', 'sort'],
  dict: ['clear', 'copy', 'get', 'items', 'keys', 'pop', 'setdefault', 'update', 'values'],
  set: ['add', 'difference', 'discard', 'intersection', 'issubset', 'pop', 'remove', 'union', 'update'],
  deque: ['append', 'appendleft', 'clear', 'extend', 'extendleft', 'pop', 'popleft', 'rotate'],
}).map(([name, labels]) => [name, labels.map(label => ({ label, type: 'method', detail: name }))]));

function memberOptions(context: CompletionContext, receiver: string): readonly Completion[] | undefined {
  const { state, pos } = context;
  const cursor = syntaxTree(state).resolveInner(pos, -1);
  for (let scope: typeof cursor | null = cursor; scope; scope = scope.parent) {
    if (scope.name !== 'Script' && scope.name !== 'Body') continue;
    for (let node = scope.childBefore(pos); node; node = node.prevSibling) {
      if (node.to >= pos) continue;
      if (node.name === 'ImportStatement') {
        const alias = /^import\s+(\w+)\s+as\s+(\w+)$/.exec(state.sliceDoc(node.from, node.to));
        if (alias?.[2] === receiver) return members.get(alias[1]);
      }
      if (node.name !== 'AssignStatement' || node.firstChild?.name !== 'VariableName') continue;
      if (state.sliceDoc(node.firstChild.from, node.firstChild.to) !== receiver) continue;
      const value = node.getChild('AssignOp')?.nextSibling;
      if (!value) continue;
      if (value.name === 'ArrayExpression' || value.name === 'ArrayComprehensionExpression') return collectionMethods.get('list');
      if (value.name === 'DictionaryExpression' || value.name === 'DictionaryComprehensionExpression') return collectionMethods.get('dict');
      if (value.name === 'SetExpression' || value.name === 'SetComprehensionExpression') return collectionMethods.get('set');
      if (value.name === 'CallExpression' && value.firstChild?.name === 'VariableName') {
        return collectionMethods.get(state.sliceDoc(value.firstChild.from, value.firstChild.to));
      }
      return;
    }
  }
  return members.get(receiver);
}

const setupSnippets = completeFromList([
  snippetCompletion('from collections import deque\n${queue} = deque([${start}])', { label: 'deque setup', type: 'text', detail: 'Queue' }),
  snippetCompletion('import heapq\n${heap} = list(${values})\nheapq.heapify(${heap})', { label: 'heap setup', type: 'text', detail: 'Min-heap' }),
  snippetCompletion('from collections import Counter\n${counts} = Counter(${values})', { label: 'counter setup', type: 'text', detail: 'Frequency map' }),
  snippetCompletion('from collections import defaultdict\n${graph} = defaultdict(list)', { label: 'adjacency list', type: 'text', detail: 'Graph' }),
]);

function completionLocation(context: CompletionContext) {
  const line = context.state.doc.lineAt(context.pos);
  const before = context.state.sliceDoc(line.from, context.pos);
  return {
    importMember: /^\s*from\s+(\w+)\s+import\s+(?:\w+\s*,\s*)*(\w*)$/.exec(before),
    moduleMember: /(?:^|[^.\w])([a-zA-Z_]\w*)\.(\w*)$/.exec(before),
    importModule: /^\s*(?:from|import)\s+(\w*)$/.exec(before),
  };
}

const completeDSA: CompletionSource = context => {
  const { importMember, moduleMember, importModule } = completionLocation(context);
  let options: readonly Completion[] | undefined;
  let word = '';

  if (importMember) {
    options = members.get(importMember[1]);
    word = importMember[2];
  } else if (moduleMember) {
    options = memberOptions(context, moduleMember[1]);
    word = moduleMember[2];
  } else if (importModule) {
    options = moduleOptions;
    word = importModule[1];
  } else {
    return setupSnippets(context);
  }

  return options ? { from: context.pos - word.length, options, validFor: /^\w*$/ } : null;
};

function codeOnly(source: CompletionSource): CompletionSource {
  return context => {
    const { importMember, moduleMember, importModule } = completionLocation(context);
    return importMember || moduleMember || importModule ? null : source(context);
  };
}

export const pythonCompletions = [
  ifNotIn(['Comment', 'String', 'FormatString'], completeDSA),
  codeOnly(localCompletionSource),
  codeOnly(globalCompletion),
];
