import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import type { Playback } from './workspace';

type Props = { playback: Playback; speed: number; onSpeed: (speed: number) => void; onSeek: (index: number) => void; onStep: (direction: number) => void; onPlay: () => void; compact?: boolean };
const speeds = [[1000, 'Slow'], [560, 'Normal'], [240, 'Fast']] as const;

export function Timeline({ playback, speed, onSpeed, onSeek, onStep, onPlay, compact = false }: Props) {
  const { index, replay, playing, pending } = playback;
  const max = Math.max(0, (replay?.steps.length ?? 1) - 1);
  const line = replay?.steps[index]?.l;
  const playLabel = playing ? 'Pause' : index === max && max > 0 ? 'Replay' : 'Play';

  return <footer className={'timeline playback-controls' + (compact ? ' timeline-compact' : '')} aria-label="Playback controls">
    <div className="transport">
      {!compact && <button className="icon-button desktop-control" aria-label="First step" title="First step" disabled={!index || pending} onClick={() => onSeek(0)}><SkipBack /></button>}
      <button className="icon-button" aria-label="Previous step" title="Previous step" disabled={!index || pending} onClick={() => onStep(-1)}><ChevronLeft /></button>
      <button className="button primary play-button" aria-label={playLabel} disabled={!max || pending} onClick={onPlay}>
        {playLabel === 'Pause' ? <Pause /> : playLabel === 'Replay' ? <RotateCcw /> : <Play />}<span>{playLabel}</span>
      </button>
      <button className="icon-button" aria-label="Next step" title="Next step" disabled={index >= max || pending} onClick={() => onStep(1)}><ChevronRight /></button>
      {!compact && <button className="icon-button desktop-control" aria-label="Last step" title="Last step" disabled={index >= max || pending} onClick={() => onSeek(max)}><SkipForward /></button>}
    </div>
    <div className="track">
      <div className="track-meta">
        <span className="step-count">{replay ? <><strong>{index}</strong><span> / {max}</span><span className="step-unit"> steps</span></> : 'No steps yet'}</span>
        {!!line && <span className="timeline-location">Line {line}</span>}
      </div>
      <div className="scrub-wrap">
        <input className="playback-scrubber" type="range" aria-label="Playback step" aria-valuetext={index + ' of ' + max} min={0} max={max || 1} disabled={!max || pending} value={index}
          style={{ '--progress': (max ? index / max * 100 : 0) + '%' } as React.CSSProperties}
          onChange={event => onSeek(Number(event.target.value))} />
      </div>
    </div>
    <label className="speed"><span>Speed</span><select aria-label="Playback speed" value={speed} onChange={event => onSpeed(Number(event.target.value))}>
      {speeds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
  </footer>;
}
