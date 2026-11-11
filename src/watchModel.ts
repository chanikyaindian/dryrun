import { buildCallForest, kind, netOf } from '../js/views/structures.js';
import { rp } from '../js/views/basic.js';
import type { DocumentSource, Step, Value } from './workspace';
import { interviewTrace } from './interviewTrace';
import { traceBacktracking, type Backtracking, type Decision } from './backtracking';
import { traceTopic, type Topic, type TopicEvent } from './topicModel';

type Atom = string | number | boolean | null;
export type Network = { N: Atom[]; E: [Atom, Atom, Atom][]; dir: boolean };
export type Scene = {
  kind: 'array' | 'search' | 'queue' | 'graph' | 'grid' | 'linked' | 'recursion' | 'backtracking' | 'topic' | 'value';
  name: string; id?: string; bounds?: [string, string, string]; queue?: string; network?: Network;
  nodeClass?: string;
  target?: string;
  fallback?: boolean;
  shape?: 'points' | 'iv';
};
export type Beat = {
  index: number; label: string;
  kind: 'start' | 'compare' | 'swap' | 'write' | 'link' | 'bounds' | 'probe' | 'dequeue' | 'enqueue' | 'call' | 'return' | 'output' | 'error' | 'finish' | 'topic' | Decision['kind'];
  decision?: Decision;
  topic?: TopicEvent;
  cells?: number[]; entries?: unknown[]; grid?: { read: string[]; written: string[] }; node?: Atom; edge?: [Atom, Atom];
  link?: { from: string; field: string; to?: string };
};
export type CallNode = { id: number; p?: number; k: number[]; born: number; end: number; lab: string; rv?: string };
export type WatchModel = { scene: Scene; beats: Beat[]; currentNodes: Map<number, Atom>; sceneSteps: number[]; calls: CallNode[];
  relevance: Map<string, number>; indexNames: Map<string, Set<string>>; backtracking?: Backtracking; callPaths?: Map<number, string>; topic?: Topic };
type Candidate = { id: string; name: string; reads: number; writes: number; pairs: number; swaps: number; size: number; flat: boolean; grid: boolean; network?: Network };
type HeapItem = Step['H'][string];
const identifier = '[\\p{ID_Start}_][\\p{ID_Continue}]*';
const midpoint = new RegExp('^\\s*(' + identifier + ')\\s*=\\s*\\(\\s*(' + identifier + ')\\s*\\+\\s*(' + identifier + ')\\s*\\)\\s*(?://\\s*2|>>\\s*1)\\b', 'u');
const queueRead = new RegExp('^\\s*(' + identifier + ')\\s*=\\s*(' + identifier + ')\\s*\\.\\s*(?:popleft\\(\\s*\\)|pop\\(\\s*0\\s*\\))', 'u');
const neighbors = new RegExp('^\\s*(?:async\\s+)?for\\s+' + identifier + '\\s+in\\s+(' + identifier + ')\\s*(?:\\[|\\.get\\()\\s*(' + identifier + ')', 'u');
const swapSource = /^\s*[^=]+\]\s*,\s*[^=]+\]\s*=\s*[^=]+\]\s*,\s*[^=]+\]/;
const compareSource = new RegExp('^\\s*(?:if|elif|while)\\s+' + identifier + '\\[[^\\]]+\\]\\s*(?:<=|>=|==|!=|<|>)\\s*' + identifier + '\\[[^\\]]+\\]\\s*:', 'u');
const binaryTarget = new RegExp('^\\s*(?:if|elif)\\s+(' + identifier + ')\\[\\s*(' + identifier + ')\\s*\\]\\s*==\\s*(' + identifier + ')\\s*:', 'u');
const treeCompare = new RegExp('^\\s*(?:if|elif)\\s+(' + identifier + ')\\s*(<|>)\\s*(' + identifier + ')\\.(' + identifier + ')\\s*:', 'u');
const sameValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  return Boolean(a && b && typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));
};
const evidence = (candidate: Candidate) => candidate.reads + candidate.writes * 3 + Number(Boolean(candidate.network));
const byRelevance = (a: Candidate, b: Candidate) => evidence(b) - evidence(a) || b.size - a.size;
const assignment = /^\s*[^#=]+(?:\+=|-=|\*=|\/=|\^=|&=|\|=|=(?!=))/;
export const isAtom = (value: unknown): value is Atom => value === null || ['string', 'number', 'boolean'].includes(typeof value);
export const scopeValue = (step: Step, key: string): Value | undefined => {
  const local = step.F.at(-1)?.v;
  return local && Object.hasOwn(local, key) ? local[key] : step.F[0]?.v[key];
};
const ref = (value: unknown) => value && typeof value === 'object' && 'r' in value ? String(value.r) : undefined;
const sequence = (item: HeapItem | undefined): item is HeapItem => Boolean(item && 'lt'.includes(item.k) && item.v.every(isAtom));
const fields = (item: HeapItem) => item.v as [string, unknown][];
const linkFields = new Set(['next', 'prev', 'left', 'right']);
export function linkedNodes(step: Step, name: string | undefined, includeRandom = false) {
  return Object.entries(step.H).flatMap(([id, item]) => {
    if (item.k !== 'o' || item.c !== name) return [];
    const entries = fields(item);
    const links = entries.flatMap(([key, value]) => {
      const to = ref(value);
      return (linkFields.has(key) || (includeRandom && key === 'random')) && to && step.H[to]?.k === 'o' && step.H[to].c === name ? [{ field: key, to }] : [];
    });
    const value = entries.find(([key, value]) => /^(key|value|val|data)$/.test(key) && isAtom(value))?.[1];
    return [{ id, label: value === undefined ? name ?? 'Node' : String(value), links }];
  });
}
export function matrixRows(item: HeapItem | undefined, step: Step) {
  if (!item || !'lt'.includes(item.k) || !item.v.length || item.v.length > 40) return;
  const rows = item.v.map(row => {
    const id = ref(row), value = id ? step.H[id] : undefined;
    return id && sequence(value) && value.v.length ? { id, values: value.v } : null;
  });
  const width = rows[0]?.values.length;
  if (width && width <= 40 && rows.every(row => row?.values.length === width)) return rows as NonNullable<(typeof rows)[number]>[];
}

function gridDelta(before: ReturnType<typeof matrixRows>, after: ReturnType<typeof matrixRows>, step: Step) {
  const written: string[] = [], read: string[] = [];
  const reads = new Set(step.rd);
  after?.forEach(({ id, values }, row) => {
    values.forEach((value, column) => {
      if (reads.has(id + ':' + column)) read.push(row + ':' + column);
      if (before?.[row] && !Object.is(before[row].values[column], value)) written.push(row + ':' + column);
    });
  });
  return { written, read };
}

export function readIndices(step: Step, id: string) {
  return [...new Set((step.rd ?? []).flatMap(read => {
    const [key, index] = read.split(':');
    return key === id ? [Number(index)] : [];
  }))];
}
function writes(before: HeapItem, after: HeapItem) {
  const length = Math.max(before.v.length, after.v.length);
  const result: number[] = [];
  for (let i = 0; i < length; i++) if (!Object.is(before.v[i], after.v[i])) result.push(i);
  return result;
}
function swap(before: HeapItem, after: HeapItem, cells: number[], line: string) {
  if (cells.length !== 2 || !swapSource.test(line)) return false;
  const [a, b] = cells;
  return before.v.length === after.v.length && Object.is(before.v[a], after.v[b]) && Object.is(before.v[b], after.v[a]);
}
function condition(previous: Step | undefined) {
  return previous?.c?.match(/(True|False)\s*$/)?.[1];
}
export function searchState(step: Step, scene: Scene) {
  return (scene.bounds ?? []).map(name => scopeValue(step, name)).map(value =>
    typeof value === 'number' && Number.isInteger(value) ? value : undefined);
}

export function makeWatch(document: DocumentSource, steps: Step[], calls: { t: string; s: number; lab?: string; rv?: string }[]): WatchModel {
  const source = document.code;
  const lines = source.split('\n');
  const subscript = new RegExp('(' + identifier + ')\\s*\\[([^\\[\\]\\n]+)\\]', 'gu');
  const indexToken = new RegExp(identifier, 'gu');
  const indexedLines = lines.map(line => [...line.matchAll(subscript)].map(([, collection, expression]) =>
    ({ collection, indices: expression.match(indexToken) ?? [] })));
  const indexNames = new Map<string, Set<string>>();
  const bounds = lines.flatMap(line => {
    const match = midpoint.exec(line);
    return match ? [[match[2], match[3], match[1]] as [string, string, string]] : [];
  });
  const queueLines = lines.map(line => queueRead.exec(line));
  const traversalLines = lines.map(line => neighbors.exec(line));
  const graphNames = new Set(traversalLines.flatMap(match => match?.[1] ?? []));
  const traversalVotes = new Map<string, number>();
  const candidates = new Map<string, Candidate>();
  const queueVotes = new Map<string, number>();
  const linkedClasses = new Map<string, { name: string; count: number }>();
  let recursive = false;

  steps.forEach((step, index) => {
    const previous = steps[index - 1];
    const frames = step.F.length > 1 ? [step.F[0], step.F.at(-1)] : step.F;
    recursive ||= new Set(step.F.map(frame => frame.n)).size < step.F.length;
    for (const frame of frames) {
      for (const [name, value] of Object.entries(frame?.v ?? {})) {
        const id = ref(value), item = id && step.H[id];
        if (!id || !item) continue;
        let candidate = candidates.get(id);
        if (!candidate) {
          candidate = { id, name, reads: 0, writes: 0, pairs: 0, swaps: 0, size: 0, flat: false, grid: false };
          candidates.set(id, candidate);
        }
        candidate.size = Math.max(candidate.size, item.v.length);
        candidate.flat ||= sequence(item) && item.v.length > 0;
        if (!candidate.flat) candidate.grid ||= Boolean(matrixRows(item, step));
        if (graphNames.has(name) && (!candidate.network || candidate.network.N.length < item.v.length)) {
          const network = netOf(item, step, 'graph') as Network | null;
          if (network && network.E.length && network.N.length <= 36) {
            candidate.network = network;
            candidate.name = name;
          }
        }
      }
    }
    const traversal = previous && traversalLines[previous.l - 1];
    if (previous && traversal) {
      const id = ref(scopeValue(previous, traversal[1]));
      const node = scopeValue(previous, traversal[2]);
      if (id && candidates.get(id)?.network?.N.some(value => Object.is(value, node))) {
        traversalVotes.set(id, (traversalVotes.get(id) ?? 0) + 1);
      }
    }
    const pop = previous && queueLines[previous.l - 1];
    if (pop) {
      const id = ref(scopeValue(previous, pop[2]));
      const before = id ? previous.H[id] : undefined, after = id ? step.H[id] : undefined;
      if (sequence(before) && sequence(after) && before.v.length === after.v.length + 1 &&
          before.v.slice(1).every((value, i) => Object.is(value, after.v[i]))) {
        if (id) queueVotes.set(id, (queueVotes.get(id) ?? 0) + 1);
      }
    }
    if (!previous) return;
    for (const { collection, indices } of indexedLines[previous.l - 1] ?? []) {
      const id = ref(scopeValue(previous, collection));
      if (!id || !candidates.has(id)) continue;
      let names = indexNames.get(id);
      if (!names) indexNames.set(id, names = new Set());
      for (const name of indices) if (Number.isInteger(scopeValue(previous, name))) names.add(name);
    }
    const visited = new Set<string>();
    for (const read of step.rd ?? []) {
      const [id] = read.split(':');
      if (visited.has(id)) continue;
      visited.add(id);
      const candidate = candidates.get(id);
      if (!candidate) continue;
      const indices = readIndices(step, id);
      candidate.reads += indices.length;
      if (condition(previous) && indices.length === 2 && compareSource.test(lines[previous.l - 1] ?? '')) candidate.pairs++;
    }
    for (const [id, item] of Object.entries(step.H)) {
      const candidate = candidates.get(id), before = previous.H[id];
      if (item.k === 'o' && item.c && before?.k === 'o' && fields(item).some(([key, value]) =>
        linkFields.has(key) && ref(value) && step.H[ref(value)!]?.c === item.c &&
        ref(fields(before).find(([field]) => field === key)?.[1]) !== ref(value))) {
        const entry = linkedClasses.get(item.c);
        linkedClasses.set(item.c, { name: entry?.name ?? candidate?.name ?? item.c, count: (entry?.count ?? 0) + 1 });
      }
      if (!candidate || !before) continue;
      if (sequence(item) && sequence(before)) {
        const cells = writes(before, item);
        if (cells.length) candidate.writes++;
        if (swap(before, item, cells, lines[previous.l - 1] ?? '')) candidate.swaps++;
      } else if (candidate.grid) {
        const delta = gridDelta(matrixRows(before, previous), matrixRows(item, step), step);
        if (delta.written.length) candidate.writes++;
        candidate.reads += delta.read.length;
      } else if (item.v.length !== before.v.length || item.v.some((value, i) => !sameValue(value, before.v[i]))) candidate.writes++;
    }
  });

  const choices = [...candidates.values()];
  const queueId = [...queueVotes].sort((a, b) => b[1] - a[1])[0]?.[0];
  const queue = queueId ? candidates.get(queueId) : undefined;
  const graph = choices.filter(candidate => candidate.network)
    .sort((a, b) => (traversalVotes.get(b.id) ?? 0) - (traversalVotes.get(a.id) ?? 0))[0];
  const sort = choices.filter(candidate => candidate.swaps || candidate.pairs >= 2)
    .sort((a, b) => b.swaps - a.swaps || b.pairs - a.pairs)[0];
  const arrays = choices.filter(candidate => candidate.flat).sort(byRelevance);
  const orderedBounds = bounds.flatMap(([lo, hi, pivot]) => [[lo, hi, pivot], [hi, lo, pivot]] as [string, string, string][]);
  const searchById = new Map<string, [string, string, string]>();
  if (orderedBounds.length) for (const step of steps) {
    for (const address of step.rd ?? []) {
      const [id, offset] = address.split(':');
      if (!candidates.get(id)?.flat || searchById.has(id)) continue;
      const match = orderedBounds.find(([lo, hi, pivot]) => {
        const a = scopeValue(step, lo), b = scopeValue(step, hi), m = scopeValue(step, pivot);
        return typeof a === 'number' && typeof b === 'number' && typeof m === 'number' && a <= b &&
          Math.floor((a + b) / 2) === m && m === Number(offset);
      });
      if (match) searchById.set(id, match);
    }
  }
  const array = arrays.find(candidate => searchById.has(candidate.id));
  const search = array && searchById.get(array.id);
  const generic = choices.filter(candidate => candidate.size).sort(byRelevance)[0];
  const firstMatrix = generic?.grid ? steps.find(step => matrixRows(step.H[generic.id], step)) : undefined;
  const shape = generic && firstMatrix ? kind(firstMatrix.H[generic.id], firstMatrix, generic.name, new Set(), new Set()) : undefined;
  const relevance = new Map(choices.filter(evidence).map(candidate => [candidate.id, evidence(candidate)]));
  const linked = [...linkedClasses].sort((a, b) => b[1].count - a[1].count)[0];
  const lesson = interviewTrace(document, steps);
  const tracedBacktracking = recursive ? traceBacktracking(lines, steps) : undefined;
  const backtracking = lesson ? undefined : tracedBacktracking;
  const topic = lesson ?? (backtracking ? undefined : traceTopic(lines, steps));
  const firstTopicEvent = topic?.events.keys().next().value;
  const scene: Scene = backtracking ? { kind: 'backtracking', name: 'Decision path' }
    : topic ? { kind: 'topic', name: topic.name, nodeClass: document.lessonNodeClass }
    : graph?.network && traversalVotes.has(graph.id) ? { kind: 'graph', id: graph.id, name: graph.name, queue: queue?.name, network: graph.network }
    : queue ? { kind: 'queue', id: queue.id, name: queue.name }
    : search && array ? { kind: 'search', id: array.id, name: array.name, bounds: search,
      target: lines.map(line => binaryTarget.exec(line)).find(match => match?.[1] === array.name && match[2] === search[2])?.[3] }
    : sort?.flat ? { kind: 'array', id: sort.id, name: sort.name }
    : linked ? { kind: 'linked', name: linked[1].name, nodeClass: linked[0] }
    : recursive && calls.length ? { kind: 'recursion', name: 'Call tree' }
    : generic ? { kind: generic.flat ? 'array' : generic.grid ? 'grid' : 'value', id: generic.id, name: generic.name, fallback: true, shape: shape === 'points' || shape === 'iv' ? shape : undefined }
    : { kind: 'value', name: 'Execution' };

  const callForest: CallNode[] = scene.kind === 'recursion' || backtracking || (lesson && recursive) ? buildCallForest(calls) : [];
  const returnLabels = new Map<string, string>();
  for (const node of callForest) if (node.rv) {
    const key = node.end + ':' + node.rv;
    if (!returnLabels.has(key)) returnLabels.set(key, node.lab);
  }
  const beats: Beat[] = [];
  const currentNodes = new Map<number, Atom>();
  const sceneSteps: number[] = [];
  const callAt = new Map<number, (typeof calls)[number]>();
  // Several calls can unwind before the next snapshot. Use the last return
  // so the caption agrees with the state the learner can see at that step.
  for (const call of calls) if (call.t === 'c' || callAt.get(call.s)?.t !== 'c') callAt.set(call.s, call);
  let current: Atom | undefined;
  let started = false;
  let lastScene = -1;
  let priorNodes: ReturnType<typeof linkedNodes> = [];
  steps.forEach((step, index) => {
    const previous = steps[index - 1], line = lines[(previous?.l ?? 0) - 1] ?? '';
    const after = scene.id ? step.H[scene.id] : undefined, before = scene.id ? previous?.H[scene.id] : undefined;
    if (after || !scene.id) lastScene = index;
    sceneSteps.push(lastScene);
    const cells = scene.id ? readIndices(step, scene.id) : [];
    const changed = sequence(before) && sequence(after) ? writes(before, after) : [];
    let action: Omit<Beat, 'index'> | undefined;
    if (scene.kind === 'linked') {
      const nodes = linkedNodes(step, scene.nodeClass);
      if (nodes.length && !started) action = { kind: 'start', label: 'Follow the links between nodes.' };
      for (const node of nodes) {
        const old = priorNodes.find(item => item.id === node.id);
        if (!old) continue;
        for (const field of linkFields) {
          const to = node.links.find(edge => edge.field === field)?.to;
          if (to === old.links.find(edge => edge.field === field)?.to) continue;
          const target = nodes.find(item => item.id === to);
          action = {
            kind: 'link', link: { from: node.id, field, to },
            label: target ? field === 'left' || field === 'right' ? 'Attach ' + target.label + ' as the ' + field + ' child of ' + node.label + '.' :
              'Connect ' + node.label + ' to ' + target.label + ' through ' + field + '.' :
              'Remove the ' + field + ' link from ' + node.label + '.',
          };
          break;
        }
        if (action?.kind === 'link') break;
      }
      const comparison = treeCompare.exec(line);
      if (!action && previous && comparison) {
        const [, key, operator, root, field] = comparison;
        const reference = ref(scopeValue(previous, root)), value = scopeValue(previous, key);
        const treeNode = reference ? previous.H[reference] : undefined;
        const entry = treeNode && fields(treeNode).find(([name]) => name === field)?.[1];
        if (reference && treeNode?.k === 'o' && typeof value === 'number' && typeof entry === 'number') {
          const side = (operator === '<' ? value < entry : value > entry) ? 'left' : 'right';
          const nextLine = lines[step.l - 1] ?? '';
          if (new RegExp('\\.' + side + '\\b').test(nextLine)) {
            action = { kind: 'compare', label: 'Compare ' + value + ' with ' + entry + '. Follow the ' + side + ' branch.',
              link: { from: reference, field: side } };
          }
        }
      }
      priorNodes = nodes;
    }
    if (scene.kind === 'graph' && previous && scene.queue) {
      const queueBefore = ref(scopeValue(previous, scene.queue)), queueAfter = ref(scopeValue(step, scene.queue));
      const a = queueBefore ? previous.H[queueBefore] : undefined, b = queueAfter ? step.H[queueAfter] : undefined;
      if (sequence(a) && sequence(b)) {
        if (queueLines[previous.l - 1]?.[2] === scene.queue && a.v.length === b.v.length + 1 &&
            a.v.slice(1).every((value, i) => Object.is(value, b.v[i])) && isAtom(a.v[0])) {
          current = a.v[0];
          action = { kind: 'dequeue', label: 'Take ' + String(current) + ' from the front of the queue.', node: current };
        } else if (a.v.length + 1 === b.v.length && a.v.every((value, i) => Object.is(value, b.v[i])) && isAtom(b.v.at(-1))) {
          const node = b.v.at(-1) as Atom;
          const network = after ? netOf(after, step, 'graph') as Network | null : null;
          const edge = network?.E.find(([from, to]) => Object.is(from, current) && Object.is(to, node));
          action = { kind: 'enqueue', label: 'Add ' + String(node) + ' to the back of the queue.' +
            (edge ? ' It is a neighbor of ' + String(current) + '.' : ''), node, edge: edge && [edge[0], edge[1]] };
        }
      }
      if (current !== undefined) currentNodes.set(index, current);
    }
    if (scene.kind === 'graph' && !scene.queue && previous) {
      const traversal = traversalLines[previous.l - 1];
      const node = traversal && scopeValue(previous, traversal[2]);
      if (traversal && ref(scopeValue(previous, traversal[1])) === scene.id && isAtom(node) && scene.network?.N.includes(node)) {
        if (!Object.is(current, node)) action = { kind: 'probe', node, label: 'Explore the neighbors of ' + String(node) + '.' };
        current = node;
      }
      if (current !== undefined) currentNodes.set(index, current);
    }
    if (scene.kind === 'queue' && previous && sequence(before) && sequence(after)) {
      if (queueLines[previous.l - 1] && before.v.length === after.v.length + 1 && before.v.slice(1).every((value, i) => Object.is(value, after.v[i]))) {
        action = { kind: 'dequeue', node: before.v[0] as Atom, label: 'Remove ' + rp(previous.H, before.v[0]) + ' from the front.' };
      } else if (after.v.length === before.v.length + 1 && before.v.every((value, i) => Object.is(value, after.v[i]))) {
        action = { kind: 'enqueue', node: after.v.at(-1) as Atom, label: 'Add ' + rp(step.H, after.v.at(-1)) + ' to the back.' };
      }
    }
    if (scene.kind === 'search' && previous && after) {
      const [lo, hi, pivot] = searchState(step, scene), [oldLo, oldHi] = searchState(previous, scene);
      if (lo !== undefined && hi !== undefined && oldLo !== undefined && oldHi !== undefined && (lo !== oldLo || hi !== oldHi)) {
        action = { kind: 'bounds', label: lo > hi ? 'The search range is empty.' : 'Keep indices ' + lo + ' through ' + hi + '.' };
      } else if (pivot !== undefined && cells.includes(pivot) && condition(previous)) {
        const target = scene.target ? scopeValue(previous, scene.target) : undefined;
        const value = after.v[pivot];
        const suffix = isAtom(target) && isAtom(value) ? (Object.is(value, target) ? ' It matches the target.' :
          typeof value === 'number' && typeof target === 'number' ? ' It is ' + (value < target ? 'below' : 'above') + ' the target ' + target + '.' : '') : '';
        action = { kind: 'probe', label: 'Check index ' + pivot + ' · value ' + String(value) + '.' + suffix, cells: [pivot] };
      }
    } else if (scene.kind === 'array' && sequence(before) && sequence(after)) {
      if (swap(before, after, changed, line)) {
        action = { kind: 'swap', cells: changed, label: 'Swap ' + changed.map(i => String(before.v[i])).join(' and ') + '.' };
      } else if (changed.length) {
        const [i] = changed;
        action = { kind: 'write', cells: changed, label: changed.length === 1 && i < after.v.length ? 'Set index ' + i + ' to ' + rp(step.H, after.v[i]) + '.' :
          changed.length === 1 ? 'Remove the value at index ' + i + '.' : 'Update ' + changed.length + ' cells.' };
      } else if (cells.length === 2 && condition(previous) && compareSource.test(line)) {
        action = { kind: 'compare', cells, label: 'Compare ' + cells.map(i => String(after.v[i])).join(' and ') + '.' };
      }
    } else if (scene.kind === 'grid' && previous && before && after) {
      const oldRows = matrixRows(before, previous), rows = matrixRows(after, step);
      const grid = gridDelta(oldRows, rows, step);
      if (grid.written.length) {
        const target = grid.written[0].replace(':', ', ');
        const rowIndex = Number(grid.written[0].split(':')[0]);
        const coordinate = scene.shape === 'points' ? rows?.[rowIndex]?.values : undefined;
        const readCell = (address: string, table: typeof rows) => {
          const [row, column] = address.split(':').map(Number);
          return table?.[row]?.values[column];
        };
        const result = readCell(grid.written[0], rows), [a, b] = grid.read.map(address => readCell(address, oldRows));
        const arithmetic = grid.read.length === 2 && line.includes('+') && typeof a === 'number' && typeof b === 'number' && a + b === result;
        action = { kind: 'write', grid, label: coordinate ? 'Move point ' + rowIndex + ' to (' + coordinate.join(', ') + ').' :
          grid.written.length === 1 ? 'Update cell [' + target + '] to ' + rp(step.H, result) +
          (arithmetic ? ' by adding ' + a + ' and ' + b + '.' : '.') : 'Update ' + grid.written.length + ' cells.' };
      }
    } else if (scene.kind === 'value' && previous) {
      if (before && after && (after.k === 'd' || after.k === 'o')) {
        const old = new Map(fields(before)), next = new Map(fields(after));
        const edited = [...next].filter(([key, value]) => !old.has(key) || !sameValue(old.get(key), value));
        const removed = [...old.keys()].filter(key => !next.has(key));
        const [key, value] = edited[0] ?? [];
        if (edited.length) action = { kind: 'write', entries: edited.map(([name]) => name), label: 'Set ' + scene.name + '[' + rp(step.H, key) + '] to ' + rp(step.H, value) + '.' };
        else if (removed.length) action = { kind: 'write', label: 'Remove ' + rp(previous.H, removed[0]) + ' from ' + scene.name + '.' };
      } else if (before && after && after.k === 's' && before.v.every(isAtom) && after.v.every(isAtom)) {
        const old = new Set(before.v), next = new Set(after.v);
        const added = after.v.filter(value => !old.has(value)), removed = before.v.filter(value => !next.has(value));
        if (added.length) action = { kind: 'write', entries: added, label: 'Add ' + rp(step.H, added[0]) + ' to ' + scene.name + '.' };
        else if (removed.length) action = { kind: 'write', label: 'Remove ' + rp(previous.H, removed[0]) + ' from ' + scene.name + '.' };
      } else if (before && after && before.v.length !== after.v.length) {
        action = { kind: 'write', label: scene.name + ' now holds ' + after.v.length + ' ' + (after.v.length === 1 ? 'entry.' : 'entries.') };
      }
    } else if (scene.kind === 'backtracking') {
      const decision = backtracking?.decisions.get(index);
      if (decision) action = { kind: decision.kind, label: decision.label, decision };
      else if (!started && backtracking?.states[index]) action = { kind: 'start', label: 'Follow the choices that build the path.' };
    } else if (scene.kind === 'recursion') {
      const call = callAt.get(index);
      if (call?.t === 'c') action = { kind: 'call', label: 'Call ' + (call.lab ?? 'function') + '.' };
      else if (call?.rv) {
        const label = returnLabels.get(index + ':' + call.rv);
        action = { kind: 'return', label: 'Return ' + call.rv + (label ? ' from ' + label : '') + '.' };
      }
    }
    if (!action && previous && (scene.kind === 'value' || scene.fallback) && assignment.test(line)) {
      const frame = step.F.at(-1), old = previous.F.at(-1);
      if (frame && old && frame.n === old.n && step.F.length === previous.F.length) {
        const edit = Object.entries(frame.v).find(([key, value]) => isAtom(value) && !Object.is(old.v[key], value));
        if (edit) action = { kind: 'write', label: 'Set ' + edit[0] + ' to ' + rp(step.H, edit[1]) + '.' };
      }
    }
    if (topic) {
      const cue = topic.events.get(index);
      if (cue) action = { kind: 'topic', label: cue.label, topic: cue };
      else if (!started && index === (firstTopicEvent ?? 0) - 1) action = { kind: 'start', label: 'Ready for the first decision.' };
    }
    if (!started && (after || action || (scene.kind === 'value' && !scene.id && index === 0))) {
      started = true;
      if (!action) action = { kind: 'start', label: scene.id ? 'Start with ' + scene.name + '.' : 'Ready to play.' };
    }
    if (step.error || step.exc) action = { kind: 'error', label: step.error ?? step.exc!.name + ': ' + step.exc!.message };
    else if (step.handled) action = { kind: 'error', label: 'Handled ' + step.handled + '.' };
    else if (step.out !== (previous?.out ?? '')) {
      const output = step.out.slice(previous?.out.length ?? 0).trim();
      if (!action) action = { kind: 'output', label: backtracking ? 'Printed output is ready in Inspect.' :
        output ? 'Output · ' + (output.length > 160 ? output.slice(0, 159) + '…' : output) : 'Output changed.' };
    }
    else if (step.done && !action) action = { kind: 'finish', label: 'Execution complete.' };
    if (action) beats.push({ index, ...action });
  });
  if (!beats.length) beats.push({ index: 0, kind: 'start', label: 'Ready to play.' });
  const last = steps.length - 1;
  if (last > beats.at(-1)!.index) beats.push({ index: last, kind: 'finish', label: 'Execution complete.' });
  return { scene, beats, currentNodes, sceneSteps, relevance, indexNames, calls: callForest, backtracking, callPaths: tracedBacktracking?.pathAtCall, topic };
}

export function beatPosition(beats: Beat[], index: number) {
  let low = 0, high = beats.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (beats[middle].index <= index) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

export function watchLandmarks(beats: Beat[]) {
  const result = new Map<number, string>(), seen = new Set<string>();
  const generic: Partial<Record<Beat['kind'], string>> = {
    swap: 'swap', bounds: 'range change', probe: 'probe', dequeue: 'queue removal', enqueue: 'queue addition',
    link: 'link change', return: 'return', error: 'exception', write: 'state update',
  };
  for (const beat of beats) {
    if (beat.decision?.landmark) result.set(beat.index, beat.decision.landmark);
    const operation = beat.topic?.operation.toLowerCase() ?? generic[beat.kind];
    if (operation && !seen.has(operation) && seen.size < 6) {
      seen.add(operation);
      result.set(beat.index, 'First ' + operation);
    }
  }
  return result;
}
