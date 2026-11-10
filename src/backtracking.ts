import type { Step, Value } from './workspace';

export type PathValue = string | number | boolean | null;
type Choice = { input: string; flags: string; index: number; inputId: string; flagsId: string };
type Action = 'choose' | 'skip' | 'save' | 'undo';
export type Decision = { index: number; kind: Action; label: string; line: number; endLine?: number; landmark?: string; candidate?: number; removed?: PathValue };
export type PathState = { path: PathValue[]; input?: PathValue[]; used?: boolean[]; saved: number };
export type Backtracking = {
  states: (PathState | undefined)[];
  decisions: Map<number, Decision>;
  saved: PathValue[][];
  names: { path: string; input: string[]; results: string[] };
  pathAtCall: Map<number, string>;
};

const name = '([\\p{ID_Start}_][\\p{ID_Continue}]*)';
const append = new RegExp('^\\s*' + name + '\\s*\\.\\s*append\\((.*)\\)\\s*$', 'u');
const pop = new RegExp('^\\s*(?:' + name + '\\s*=\\s*)?' + name + '\\s*\\.\\s*pop\\(\\s*\\)\\s*$', 'u');
const indexed = new RegExp('^\\s*' + name + '\\[\\s*' + name + '\\s*\\]\\s*$', 'u');
const flagWrite = new RegExp('^\\s*' + name + '\\[\\s*' + name + '\\s*\\]\\s*=\\s*(True|False)\\s*$', 'u');
const guard = new RegExp('^\\s*if\\s+' + name + '\\[\\s*' + name + '\\s*\\]\\s*:\\s*$', 'u');
function binding(step: Step, key: string) {
  for (let i = step.F.length - 1; i >= 0; i--) {
    if (Object.hasOwn(step.F[i].v, key)) return step.F[i].v[key];
  }
}
const idOf = (value: unknown) => value && typeof value === 'object' && 'r' in value ? String(value.r) : undefined;
const values = (step: Step, id?: string) => id && ['l', 't'].includes(step.H[id]?.k) ? step.H[id].v : undefined;
const atoms = (items?: unknown[]): PathValue[] | undefined => items?.every(item =>
  item === null || typeof item === 'number' || typeof item === 'string' || typeof item === 'boolean') ? items as PathValue[] : undefined;
const prefix = (short: unknown[], long: unknown[]) => short.every((value, i) => Object.is(value, long[i]));
const equal = (a: unknown[], b: unknown[]) => a.length === b.length && prefix(a, b);
export const pathValue = (value: PathValue) => value === null ? 'None' :
  typeof value === 'boolean' ? value ? 'True' : 'False' : typeof value === 'string' ? JSON.stringify(value) : String(value);
export const pathLabel = (path: PathValue[]) => '[' + path.map(pathValue).join(', ') + ']';
export const decisionLocation = (decision: Decision) => decision.endLine && decision.endLine !== decision.line
  ? 'Lines ' + decision.line + '–' + decision.endLine : 'Line ' + decision.line;

type Mutation = { at: number; line: number; key: string; id: string; value: PathValue; expression?: string; paired?: number };

export function traceBacktracking(lines: string[], steps: Step[]): Backtracking | undefined {
  // Strip trailing comments for supported statements. A match only proposes a role;
  // snapshots must confirm each mutation and a recursive round trip on the same list.
  const statements = lines.map(line => line.replace(/\s+#.*$/, '').trim());
  const additions = statements.map(line => append.exec(line));
  const removals = statements.map(line => pop.exec(line));
  const flags = statements.map(line => flagWrite.exec(line));
  const guards = statements.map(line => guard.exec(line));
  if (!additions.some(Boolean) || !removals.some(Boolean)) return;
  const open = new Map<string, Mutation[]>();
  const mutations: Mutation[] = [];
  const recursed = new Map<string, number>();
  const confirmed = new Map<string, number>();
  for (let at = 1; at < steps.length; at++) {
    const before = steps[at - 1], after = steps[at];
    if (after.error || after.exc || !before.F.length) continue;
    const frame = before.F.at(-1)!;
    before.F.slice(0, -1).forEach((parent, depth) => {
      if (parent.n === frame.n) recursed.set(frame.n + ':' + (depth + 1), at);
    });
    const adding = additions[before.l - 1], removing = removals[before.l - 1];
    const key = adding?.[1] ?? removing?.[2];
    if (!key) continue;
    const id = idOf(binding(before, key));
    const old = atoms(values(before, id)), next = atoms(values(after, id));
    if (!id || !old || !next) continue;
    const stackKey = JSON.stringify([id, frame.n, before.F.length]);
    if (adding && next.length === old.length + 1 && prefix(old, next)) {
      const mutation = { at, line: before.l, key, id, value: next.at(-1)!, expression: adding[2] };
      mutations.push(mutation);
      const stack = open.get(stackKey) ?? [];
      stack.push(mutation);
      open.set(stackKey, stack);
    } else if (removing && old.length === next.length + 1 && prefix(next, old)) {
      const choice = open.get(stackKey)?.pop();
      if (!choice || !Object.is(choice.value, old.at(-1)) || (recursed.get(frame.n + ':' + before.F.length) ?? 0) <= choice.at) continue;
      choice.paired = at;
      mutations.push({ at, line: before.l, key, id, value: old.at(-1)!, paired: choice.at });
      confirmed.set(id, (confirmed.get(id) ?? 0) + 1);
    }
  }
  const pathId = [...confirmed].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!pathId) return;
  const actions = mutations.filter(mutation => mutation.id === pathId && mutation.paired !== undefined);
  const chosen = new Map<number, Choice>();
  const choicesByFlags = new Map<string, Choice>();
  const decisions = new Map<number, Decision>();
  const decisionAt = (kind: Action, index: number, line: number, label: string, detail?: Pick<Decision, 'candidate' | 'endLine' | 'removed'>) =>
    decisions.set(index, { kind, index, line, label, ...detail });

  function flagChange(at: number, expected: boolean, inputIndex?: number, knownId?: string) {
    const before = steps[at], after = steps[at + 1];
    const write = flags[before?.l - 1];
    if (!write || !after || after.error || after.exc || (write[3] === 'True') !== expected) return;
    const flagsId = idOf(binding(before, write[1])), index = binding(before, write[2]);
    if (!flagsId || typeof index !== 'number' || !Number.isInteger(index) ||
        (inputIndex !== undefined && inputIndex !== index) || (knownId && knownId !== flagsId)) return;
    const old = values(before, flagsId), next = values(after, flagsId);
    if (!old || !next || old.length !== next.length || old[index] !== !expected || next[index] !== expected ||
        !old.every((value, i) => typeof value === 'boolean' && (i === index || value === next[i]))) return;
    return { flags: write[1], flagsId, index };
  }
  for (const action of actions) {
    const label = pathValue(action.value);
    if (action.expression !== undefined) {
      const match = indexed.exec(action.expression);
      const step = steps[action.at - 1];
      const inputId = match && idOf(binding(step, match[1]));
      const input = inputId ? atoms(values(step, inputId)) : undefined;
      const index = match ? binding(step, match[2]) : undefined;
      const flag = typeof index === 'number' && Object.is(input?.[index], action.value) ? flagChange(action.at, true, index) : undefined;
      if (match && inputId && input && flag && input.length === values(steps[action.at + 1], flag.flagsId)?.length) {
        const choice = { input: match[1], inputId, ...flag };
        chosen.set(action.at, choice);
        choicesByFlags.set(flag.flagsId, choice);
      }
      const choice = chosen.get(action.at);
      decisionAt('choose', action.at + Number(Boolean(choice)), action.line, 'Choose ' + label + '.',
        choice && { candidate: choice.index, endLine: steps[action.at].l });
    } else {
      const choice = chosen.get(action.paired!);
      const release = choice && flagChange(action.at, false, choice.index, choice.flagsId);
      decisionAt('undo', action.at + Number(Boolean(release)), action.line,
        release ? 'Undo ' + label + ' and make it available again.' : 'Undo ' + label + '.',
        { candidate: release?.index, endLine: release ? steps[action.at].l : undefined, removed: action.value });
    }
  }
  const primary = choicesByFlags.values().next().value;
  const saved: PathValue[][] = [];
  const states: Backtracking['states'] = [];
  const pathName = actions[0].key;
  const inputNames = primary ? [primary.input, primary.flags] : [];
  const resultNames = new Set<string>();
  const pathFrames = new Set(actions.map(action => steps[action.at - 1].F.at(-1)?.n));
  const pathAtCall = new Map<number, string>();
  for (let at = 0; at < steps.length; at++) {
    const step = steps[at], before = steps[at - 1];
    const path = atoms(values(step, pathId));
    if (path && pathFrames.has(step.F.at(-1)?.n) && (step.F.length > (before?.F.length ?? 0))) {
      pathAtCall.set(at, pathLabel(path));
      const undone = decisions.get(at - 1);
      const beforePath = before && atoms(values(before, pathId));
      if (!primary && undone?.kind === 'undo' && undone.removed !== undefined && beforePath && equal(beforePath, path) &&
          before.F.at(-1)?.n === step.F.at(-1)?.n) {
        decisionAt('skip', at, before.l, 'Explore without the last choice of ' + pathValue(undone.removed) + '.');
      }
    }
    if (before && !step.error && !step.exc) {
      const check = guards[before.l - 1];
      const flagId = check && idOf(binding(before, check[1]));
      const choice = flagId ? choicesByFlags.get(flagId) : undefined;
      if (check && choice && /^continue\s*$/.test(statements[step.l - 1] ?? '') && path) {
        const i = binding(before, check[2]);
        const input = atoms(values(before, choice.inputId));
        if (typeof i === 'number' && input && i >= 0 && i < input.length && values(before, choice.flagsId)?.[i] === true) {
          decisionAt('skip', at, before.l, 'Skip ' + pathValue(input[i]) + ' because it’s already in the path.', { candidate: i });
        }
      }
      const adding = additions[before.l - 1];
      const resultId = adding && idOf(binding(before, adding[1]));
      const old = resultId ? values(before, resultId) : undefined, next = resultId ? values(step, resultId) : undefined;
      if (adding && path && resultId !== pathId && old && next && old.length + 1 === next.length) {
        const copyId = idOf(next.at(-1)), copy = atoms(values(step, copyId)), beforePath = atoms(values(before, pathId));
        if (copyId !== pathId && copy && beforePath && equal(copy, path) && equal(beforePath, path) &&
            old.every((item, i) => idOf(item) ? idOf(item) === idOf(next[i]) : Object.is(item, next[i]))) {
          resultNames.add(adding[1]);
          saved.push(copy);
          decisionAt('save', at, before.l, 'Save a copy of ' + pathLabel(copy) + '.');
        }
      }
    }
    const previous = states[at - 1];
    const input = atoms(values(step, primary?.inputId)) ?? previous?.input;
    const flagsNow = values(step, primary?.flagsId);
    const used = flagsNow?.every(value => typeof value === 'boolean') ? flagsNow as boolean[] : previous?.used;
    states.push(path || input || previous ? { path: path ?? previous?.path ?? [], input, used, saved: saved.length } : undefined);
  }
  let foundSave = false, foundUndo = false, foundExclusion = false, nextBranch = false;
  for (const [index, decision] of [...decisions].sort(([a], [b]) => a - b)) {
    if (decision.kind === 'save' && !foundSave) {
      decision.landmark = 'First complete path';
      foundSave = true;
    } else if (decision.kind === 'undo' && !foundUndo) {
      decision.landmark = 'First undo';
      foundUndo = true;
    } else if (!primary && decision.kind === 'skip' && !foundExclusion) {
      decision.landmark = 'First exclusion';
      foundExclusion = true;
    } else if (foundUndo && !nextBranch && decision.kind === 'choose') {
      decision.landmark = 'Next branch';
      nextBranch = true;
    }
  }
  return { states, decisions, saved, names: { path: pathName, input: inputNames, results: [...resultNames] }, pathAtCall };
}
