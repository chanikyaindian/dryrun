import { detect } from '../js/detect/detector.js';
import { buildTree } from '../js/views/structures.js';
import { beatPosition, makeWatch, watchLandmarks, type WatchModel } from './watchModel';

export type Value = null | string | number | boolean | { r?: string | number; f?: string; p?: string };
export type Frame = { n: string; a: string[]; v: Record<string, Value> };
export type Step = {
  l: number; out: string; F: Frame[]; H: Record<string, { k: string; v: unknown[]; c?: string }>; rd?: string[];
  c?: string; rv?: string; done?: boolean; error?: string; handled?: string; cleanup?: boolean;
  tryElse?: boolean; exc?: { name: string; message: string };
  syntax?: { column?: number; endLine?: number; endColumn?: number };
};
type CallEvent = { t: 'c' | 'r'; s: number; lab?: string; rv?: string };
type Trace = Step[] & { feat?: string[]; evs?: CallEvent[] };
export type DocumentSource = { key: string; code: string; title?: string; description?: string; lesson?: string[];
  lessonGrid?: string; lessonNodeClass?: string; lessonTrie?: boolean; lessonHeap?: string;
  lessonBits?: { names: string[]; width: number };
  lessonSearch?: { name: string; inclusive?: boolean } };
export type Moment = { index: number; label: string; kind: 'call' | 'exception' | 'output' | 'decision' };
type PatternMatch = { n: string; d: string; x: number; why: string[] };
export type Replay = {
  id: number; source: DocumentSource; steps: Step[]; moments: Moment[];
  matches: PatternMatch[]; roles: Set<string>; topics: Set<string>; tree: ReturnType<typeof buildTree>;
  watch: WatchModel;
};

export function createReplay(id: number, source: DocumentSource, steps: Trace): Replay {
  const matches = steps[0]?.syntax ? [] : detect(source.code, steps, steps.feat ?? null) as PatternMatch[];
  const moments = new Map<number, Moment>();
  for (const event of steps.evs ?? []) {
    if (event.t === 'c' && event.s < steps.length) {
      moments.set(event.s, { index: event.s, label: 'Call ' + event.lab, kind: 'call' });
    }
  }
  steps.forEach((step, index) => {
    if (step.error || step.exc || step.handled) {
      moments.set(index, { index, kind: 'exception', label: step.error ?? (step.handled ? 'Handled ' + step.handled : step.exc!.name) });
    } else if (step.out !== (steps[index - 1]?.out ?? '')) {
      moments.set(index, { index, kind: 'output', label: 'Output changed' });
    }
  });
  const watch = makeWatch(source, steps, steps.evs ?? []);
  const landmarks = watchLandmarks(watch.beats);
  for (const { index, label } of watch.beats) {
    if (landmarks.has(index) && moments.get(index)?.kind !== 'exception') {
      moments.set(index, { index, label: landmarks.get(index) + ' · ' + label, kind: 'decision' });
    }
  }
  const treeEvents = watch.callPaths ? (steps.evs ?? []).map(event => {
    const path = event.t === 'c' && watch.callPaths?.get(event.s);
    return path ? { ...event, lab: path + ' · ' + event.lab } : event;
  }) : steps.evs ?? [];
  return {
    id, source, steps, matches, moments: [...moments.values()].sort((a, b) => a.index - b.index),
    roles: new Set(steps.feat ?? []), topics: new Set(matches.map(match => match.n)),
    tree: buildTree(treeEvents),
    watch,
  };
}

export type Playback = {
  replay: Replay | null; index: number; playing: boolean; pending: boolean; error: string; motion: boolean;
};
export const initialPlayback: Playback = { replay: null, index: 0, playing: false, pending: false, error: '', motion: false };
type Action = { type: 'run' | 'pause' } | { type: 'play' | 'tick'; watch?: boolean; allSteps?: boolean } |
  { type: 'ready'; replay: Replay; watch?: boolean; allSteps?: boolean } | { type: 'error'; error: string } |
  { type: 'beat'; direction: number; allSteps?: boolean } |
  { type: 'seek' | 'step'; index: number };
export function playbackReducer(state: Playback, action: Action): Playback {
  const last = Math.max(0, (state.replay?.steps.length ?? 1) - 1);
  const beats = state.replay?.watch.beats;
  const rawStep = (direction: number) => Math.max(0, Math.min(last, state.index + direction));
  const nextBeat = (direction: number) => {
    if (!beats?.length) return state.index;
    const position = beatPosition(beats, state.index);
    const exact = beats[position]?.index === state.index;
    const target = direction > 0 ? position + 1 : exact ? position - 1 : position;
    return beats[Math.max(0, Math.min(beats.length - 1, target))].index;
  };
  switch (action.type) {
    case 'run': return { ...state, pending: true, playing: false, error: '' };
    case 'ready': return { ...initialPlayback, replay: action.replay, index: action.watch && !action.allSteps ? action.replay.watch.beats[0].index : 0 };
    case 'error': return { ...state, pending: false, playing: false, error: action.error };
    case 'pause': return state.playing ? { ...state, playing: false } : state;
    case 'play': return last > 0 && !state.pending
      ? { ...state, playing: !state.playing, motion: false,
        index: state.index === last && !state.playing ? (action.watch && !action.allSteps ? beats?.[0]?.index ?? 0 : 0) : state.index }
      : state;
    case 'tick': {
      if (!state.playing) return state;
      const index = action.watch && !action.allSteps ? nextBeat(1) : rawStep(1);
      return { ...state, index, playing: index < last && index !== state.index, motion: index > state.index };
    }
    case 'beat': {
      const index = action.allSteps ? rawStep(action.direction) : nextBeat(action.direction);
      return { ...state, index, playing: false, motion: index > state.index };
    }
    case 'seek':
    case 'step': {
      const index = Math.max(0, Math.min(last, action.type === 'step' ? state.index + action.index : action.index));
      return { ...state, index, playing: false, motion: action.type === 'step' && index > state.index };
    }
  }
}

export const primaryOptions = [
  ['pattern', 'Detected pattern'], ['narration', 'Step explanation'], ['highlight', 'Code highlights'],
  ['calls', 'Call tree'], ['stack', 'Call stack'],
] as const;
export const rendererOptions = [
  ['list', 'Arrays and strings'], ['card', 'Collection and object cards'], ['grid', 'Grids and tables'],
  ['iv', 'Intervals'], ['net', 'Graphs'], ['nodes', 'Linked lists, trees and tries'], ['heap', 'Heap and segment trees'],
  ['bits', 'Bits and flags'], ['points', 'Coordinate plots'],
] as const;
export type ViewKey = (typeof primaryOptions | typeof rendererOptions)[number][0];
export type Preferences = {
  views: Record<ViewKey, boolean>; follow: boolean; live: boolean; inspector: boolean; speed: number;
  explicitTree?: boolean; explicitStack?: boolean; watchVariables?: boolean; dark?: boolean; navbarHidden?: boolean;
  watchSteps?: boolean; fullscreenSteps?: boolean;
};
export type Preset = 'Learn' | 'Debug' | 'Focus';
const keys = [...primaryOptions, ...rendererOptions].map(([key]) => key);
const allViews = Object.fromEntries(keys.map(key => [key, true])) as Preferences['views'];
export const defaults: Preferences = { views: allViews, follow: true, live: false, inspector: true, speed: 560 };
export const presets: Record<Preset, Pick<Preferences, 'views' | 'inspector' | 'explicitTree' | 'explicitStack'>> = {
  Learn: { views: { ...allViews }, inspector: true, explicitTree: undefined, explicitStack: undefined },
  Debug: { views: { ...allViews, pattern: false }, inspector: true, explicitTree: undefined, explicitStack: undefined },
  Focus: { views: { ...allViews, pattern: false, narration: false, calls: false, stack: false }, inspector: false, explicitTree: undefined, explicitStack: undefined },
};
export function readStored<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
  catch { return fallback; }
}
export function saveStored<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing or storage quota */ }
}
export const preferencesKey = 'dryrun.workspace.v1';
export function loadPreferences(): Preferences {
  const saved = readStored<Partial<Preferences>>(preferencesKey, {});
  const old = readStored<Partial<Preferences['views']>>('dryrun.playback-views.v1', {});
  const views = { ...allViews };
  for (const key of keys) {
    const value = saved.views?.[key] ?? old[key];
    if (typeof value === 'boolean') views[key] = value;
  }
  return {
    views,
    explicitTree: saved.explicitTree === true, explicitStack: saved.explicitStack === true,
    watchVariables: saved.watchVariables === true, dark: saved.dark === true,
    navbarHidden: saved.navbarHidden === true,
    watchSteps: typeof saved.watchSteps === 'boolean' ? saved.watchSteps : undefined,
    fullscreenSteps: saved.fullscreenSteps !== false,
    live: saved.live === true, follow: saved.follow !== false, inspector: saved.inspector !== false,
    speed: [1000, 560, 240].includes(saved.speed ?? 0) ? saved.speed! : defaults.speed,
  };
}
