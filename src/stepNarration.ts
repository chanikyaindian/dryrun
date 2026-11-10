import { explain } from '../js/views/narration.js';
import { diffs } from '../js/views/basic.js';
import { beatPosition } from './watchModel';
import type { Replay } from './workspace';

export function narrateStep(replay: Replay, index: number, lines: string[], changes?: string[]) {
  const step = replay.steps[index];
  if (!step) return '';
  const beat = replay.watch.beats[beatPosition(replay.watch.beats, index)];
  if (beat?.index === index && beat.kind !== 'finish' && (beat.kind !== 'start' || index > 0)) return beat.label;
  const previous = replay.steps[index - 1];
  const frame = step.F.at(-1);
  if (!frame) return step.error ?? '';
  const updates = changes ?? (previous?.F.length === step.F.length ? diffs(previous, step) as string[] : []);
  return explain(step, previous, frame, updates, lines) as string;
}
