import { rp } from '../js/views/basic.js';
import { walkthroughPointers } from './interviewPointers';
import type { Topic, TopicEvent, TopicView } from './topicModel';
import type { DocumentSource, Step, Value } from './workspace';

function binding(step: Step, name: string): Value | undefined {
  for (let i = step.F.length - 1; i >= 0; i--) {
    if (Object.hasOwn(step.F[i].v, name)) return step.F[i].v[name];
  }
}

function sequence(step: Step, value?: Value) {
  const item = value && typeof value === 'object' && value.r ? step.H[value.r] : undefined;
  if (!item || (item.k !== 'l' && item.k !== 't')) return;
  return item.v as Value[];
}

function array(step: Step, value?: Value, nodeClass?: string) {
  return sequence(step, value)?.map(cell => {
    if (!cell || typeof cell !== 'object') return cell;
    const item = nodeClass && cell.r ? step.H[cell.r] : undefined;
    if (item?.c === nodeClass && item?.k === 'o') {
      const label = (item.v as [string, Value][]).find(([field]) => field === 'val')?.[1];
      if (typeof label === 'number' || typeof label === 'string') return label;
    }
    return rp(step.H, cell);
  });
}

function grid(step: Step, name: string) {
  const rows = sequence(step, binding(step, name))?.map(row => typeof row === 'string' ? [...row] : array(step, row));
  if (rows?.every(row => row !== undefined)) return rows;
}

function gridReads(before: Step, after: Step, name: string, rows: NonNullable<TopicView['grid']>['rows'], writes: string[]) {
  const reads = new Set(after.rd);
  const references = sequence(before, binding(before, name));
  return rows.flatMap((cells, row) => {
    const reference = references?.[row];
    if (!reference || typeof reference !== 'object' || !reference.r) return [];
    return cells.flatMap((_, col) => {
      const address = row + ':' + col;
      return !writes.includes(address) && reads.has(reference.r + ':' + col) ? [address] : [];
    });
  });
}

function bits(value: Value | undefined, width: number) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return;
  return [...BigInt.asUintN(width, BigInt(value)).toString(2).padStart(width, '0')];
}

function trieNodes(step: Step) {
  const root = binding(step, 'root');
  if (!root || typeof root !== 'object' || !root.r) return;
  const current = step.F.at(-1)?.v;
  const active = current?.branch ?? current?.node;
  const activeId = active && typeof active === 'object' ? active.r : undefined;
  const nodes: NonNullable<TopicView['trie']> = [];
  function visit(id: string | number, prefix: string, parent?: string, letter?: string) {
    const item = step.H[id];
    if (item?.k !== 'd' || nodes.length >= 64) return;
    const entries = item.v as [string, Value][];
    nodes.push({ prefix, parent, letter, word: entries.some(([key]) => key === '#'), active: id === activeId });
    for (const [key, child] of entries) {
      if (key !== '#' && typeof child === 'object' && child?.r) visit(child.r, prefix + key, prefix, key);
    }
  }
  visit(root.r, '');
  return nodes;
}

function changedLinks(before: Step, after: Step, nodeClass: string) {
  const changes: Record<string, string[]> = {};
  for (const [id, item] of Object.entries(after.H)) {
    const previous = before.H[id];
    if (item.k !== 'o' || item.c !== nodeClass || !previous) continue;
    const old = new Map(previous.v as [string, Value][]);
    const fields = (item.v as [string, Value][]).flatMap(([field, value]) => {
      if (!['next', 'prev', 'left', 'right', 'random'].includes(field)) return [];
      const prior = old.get(field);
      const target = value && typeof value === 'object' ? value.r : null;
      const previousTarget = prior && typeof prior === 'object' ? prior.r : null;
      return target === previousTarget ? [] : [field];
    });
    if (fields.length) changes[id] = fields;
  }
  return changes;
}

export function interviewTrace(document: DocumentSource, steps: Step[]): Topic | undefined {
  if (!document.lesson) return;
  const variables = document.lesson;
  const gridName = document.lessonGrid;
  const nodeClass = document.lessonNodeClass;
  const heapName = document.lessonHeap;
  const search = document.lessonSearch;
  const bitFields = document.lessonBits;
  const slug = document.key.replace(/^interview:/, '');
  const { rows: pointerRows, window } = walkthroughPointers(slug, document.code, variables, search?.name);
  const checkpoints = new Map<number, Omit<TopicEvent, 'changed'>>();
  document.code.split('\n').forEach((source, i) => {
    const match = /^\s*[^#].+?\s+# Step: ([^|]+)\|\s*(.+)$/.exec(source);
    if (match) checkpoints.set(i + 1, { operation: match[1].trim(), label: match[2], line: i + 1 });
  });

  function traceCue(after: Step, before: Step): TopicEvent {
    const changed = Object.fromEntries(variables.flatMap(name => {
      if (name === gridName) return [];
      const oldValue = binding(before, name), nextValue = binding(after, name);
      const bitRow = bitFields?.names.includes(name) ? bitFields : undefined;
      const old = bitRow ? bits(oldValue, bitRow.width) : array(before, oldValue);
      const current = bitRow ? bits(nextValue, bitRow.width) : array(after, nextValue);
      if (!old || !current) return [];
      return [[name, current.flatMap((value, position) => !Object.is(old[position], value) ? [position] : [])]];
    }));
    const reads = Object.fromEntries(variables.flatMap(name => {
      const value = binding(after, name);
      if (!value || typeof value !== 'object' || value.r === undefined || !sequence(after, value)) return [];
      const prefix = value.r + ':';
      const indices = (after.rd ?? []).filter(read => read.startsWith(prefix)).map(read => Number(read.slice(prefix.length)));
      return indices.length ? [[name, indices]] : [];
    }));
    const oldGrid = gridName ? grid(before, gridName) : undefined;
    const currentGrid = gridName ? grid(after, gridName) ?? oldGrid : undefined;
    const gridCells = oldGrid && currentGrid ? currentGrid.flatMap((row, r) => row.flatMap((value, c) =>
      Object.is(oldGrid[r]?.[c], value) ? [] : [r + ':' + c])) : [];
    if (currentGrid && !gridCells.length && checkpoints.has(before.l)) {
      const top = binding(before, 'top'), left = binding(before, 'left'), size = binding(before, 'size');
      const row = binding(before, 'row'), col = binding(before, 'col');
      if (typeof top === 'number' && typeof left === 'number' && typeof size === 'number') {
        currentGrid.slice(top, top + size).forEach((cells, r) => {
          cells.slice(left, left + size).forEach((_, c) => gridCells.push((top + r) + ':' + (left + c)));
        });
      } else if (typeof row === 'number' && typeof col === 'number' && col in (currentGrid[row] ?? [])) {
        gridCells.push(row + ':' + col);
      }
    }
    return { operation: 'Execution step', label: '', line: before.l, changed, reads, gridCells, active: heapName ? changed[heapName] : undefined,
      gridReads: gridName && currentGrid ? gridReads(before, after, gridName, currentGrid, gridCells) : undefined,
      nodeLinks: nodeClass ? changedLinks(before, after, nodeClass) : undefined };
  }

  const events = new Map<number, TopicEvent>();
  const windowStates = new WeakMap<Step, [number, number]>();
  let liveWindow: [number, number] | undefined;
  for (let i = 1; i < steps.length; i++) {
    const before = steps[i - 1], after = steps[i], checkpoint = checkpoints.get(before.l);
    if (window) {
      const left = binding(after, 'left'), right = binding(after, 'right');
      const width = window.chunkSize ? binding(after, window.chunkSize) : 1;
      if (typeof left !== 'number' || typeof right !== 'number' || typeof width !== 'number') liveWindow = undefined;
      else if (checkpoint) liveWindow = [left, right + width - 1];
      if (liveWindow) windowStates.set(after, liveWindow);
    }
    if (!checkpoint || after.error || after.exc) continue;
    let label = checkpoint.label;
    if (slug === 'minimum-size-subarray-sum') {
      const total = binding(after, 'total'), target = binding(after, 'target');
      const nums = array(after, binding(after, 'nums'));
      const left = binding(before, 'left'), right = binding(after, 'right');
      if (typeof total === 'number' && typeof target === 'number') {
        if (checkpoint.operation === 'Expand' && typeof right === 'number' && nums?.[right] !== undefined) {
          label = `Add ${nums[right]} at index ${right}. The window now sums to ${total}.`;
        } else if (checkpoint.operation === 'Shrink' && typeof left === 'number' && nums?.[left] !== undefined) {
          label = `Drop ${nums[left]} from index ${left}. The remaining sum is ${total}, ${total < target ? 'below' : 'enough to reach'} the target of ${target}.`;
        }
      }
    }
    events.set(i, { ...traceCue(after, before), ...checkpoint, label });
  }
  if (!events.size) return;

  return {
    name: 'Walkthrough',
    variables,
    events,
    traceCue,
    view(step, cue) {
      const rows: NonNullable<TopicView['rows']> = [];
      const facts: NonNullable<TopicView['facts']> = [];
      const matrix = gridName ? grid(step, gridName) : undefined;
      const value = gridName ? binding(step, gridName) : undefined;
      const reference = value && typeof value === 'object' ? value.r : undefined;
      const trie = document.lessonTrie ? trieNodes(step) : undefined;
      const heap = heapName ? array(step, binding(step, heapName)) : undefined;
      const nodePointers: Record<string, string[]> = {};
      const span = windowStates.get(step);
      for (const name of variables) {
        if (name === gridName || name === heapName || (trie && name === 'node')) continue;
        if (span && (name === 'left' || name === 'right')) continue;
        const value = binding(step, name);
        if (value === undefined) continue;
        if (bitFields?.names.includes(name) && typeof value === 'number') {
          const values = bits(value, bitFields.width);
          if (values) rows.push({ name, values, active: cue?.changed?.[name], decimal: value });
          continue;
        }
        const id = value && typeof value === 'object' ? value.r : undefined;
        if (id !== undefined && nodeClass && step.H[id]?.c === nodeClass) {
          (nodePointers[id] ??= []).push(name);
          continue;
        }
        const pointerNames = pointerRows.get(name);
        const characters = Boolean(pointerNames) && typeof value === 'string';
        const values = characters ? Array.from(value as string) : array(step, value, nodeClass);
        if (values) {
          const row: NonNullable<TopicView['rows']>[number] = { name, values, index: true, characters, active: cue?.changed?.[name], related: cue?.reads?.[name] };
          if (pointerNames) {
            row.pointers = pointerNames.flatMap(pointer => {
              const index = binding(step, pointer);
              return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < values.length ? [{ name: pointer, index }] : [];
            });
          }
          if (window?.row === name) row.window = span;
          if (search?.name === name) {
            const low = binding(step, 'low'), high = binding(step, 'high'), mid = binding(step, 'mid');
            if (typeof low === 'number' && typeof high === 'number') {
              const end = search.inclusive ? high : high - 1;
              row.outside = [low, end];
              const probing = cue?.operation.startsWith('Probe') || cue?.operation === 'Compare slope';
              if (probing && typeof mid === 'number' && mid >= low && mid <= end) row.active = [mid];
              if (cue?.operation === 'Keep candidate' && mid === high) row.related = [...(row.related ?? []), high];
            }
          }
          rows.push(row);
        } else facts.push([name, rp(step.H, value)]);
      }
      return { rows, facts, trie, heap, nodePointers: nodeClass ? nodePointers : undefined,
        grid: gridName && matrix ? { name: gridName, rows: matrix, active: cue?.gridCells, related: cue?.gridReads, reference } : undefined };
    },
  };
}
