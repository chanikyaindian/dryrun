import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import type { Playback } from './workspace';

type Props = { playback: Playback; speed: number; onSpeed: (speed: number) => void; onSeek: (index: number) => void; onStep: (direction: number) => void; onPlay: () => void; compact?: boolean };
const speeds = [[1000, 'Slow'], [560, 'Normal'], [240, 'Fast']] as const;

export function Timeline({ playback, speed, onSpeed, onSeek, onStep, onPlay, compact = false }: Props) {
  const { index, replay, playing, pending } = playback;
  const max = Math.max(0, (replay?.steps.length ?? 1) - 1);
  const line = replay?.steps[index]?.l;
  const [lineSelection, setLineSelection] = useState<number | null>(null);
  const occurrences = useMemo(() => {
    const lines = new Map<number, number[]>();
    replay?.steps.forEach((step, position) => {
      if (!step.l) return;
      if (!lines.has(step.l)) lines.set(step.l, []);
      lines.get(step.l)!.push(position);
    });
    return lines;
  }, [replay]);
  const selected = lineSelection && occurrences.has(lineSelection) ? lineSelection : null;
  const positions = selected ? occurrences.get(selected)! : [];
  const earlier = positions.findLast(position => position < index);
  const later = positions.find(position => position > index);
  const markers = useMemo(() => {
    const markers = new Map<number, NonNullable<Props['playback']['replay']>['moments'][number]>();
    for (const event of replay?.moments ?? []) {
      const bucket = Math.round(event.index / Math.max(1, max) * 64);
      if (!markers.has(bucket) || event.kind === 'exception' || (event.kind === 'decision' && markers.get(bucket)?.kind === 'call')) {
        markers.set(bucket, event);
      }
    }
    return [...markers.values()];
  }, [replay, max]);
  const playLabel = playing ? 'Pause' : index === max && max > 0 ? 'Replay' : 'Play';

  return <footer className={'timeline' + (compact ? ' timeline-compact' : '')} aria-label="Playback controls">
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
        {!compact && occurrences.size > 0 && <details className="trace-jump">
          <summary>Find line</summary>
          <div>
            <label>Executed line <select value={selected ?? ''} disabled={pending} onChange={event => {
              const target = Number(event.target.value);
              setLineSelection(target || null);
              const hits = occurrences.get(target);
              if (hits) onSeek(hits.find(position => position >= index) ?? hits[0]);
            }}>
              <option value="">Choose a line</option>
              {[...occurrences].sort(([a], [b]) => a - b).map(([number, hits]) =>
                <option key={number} value={number}>Line {number} ({hits.length} {hits.length === 1 ? 'visit' : 'visits'})</option>)}
            </select></label>
            <div className="visit-actions">
              <button type="button" className="button neutral compact" disabled={earlier === undefined || pending} onClick={() => earlier !== undefined && onSeek(earlier)}>Previous visit</button>
              <button type="button" className="button neutral compact" disabled={later === undefined || pending} onClick={() => later !== undefined && onSeek(later)}>Next visit</button>
            </div>
          </div>
        </details>}
        {!compact && <label className="event-menu">
          <span className="sr-only">Jump to event</span>
          <select aria-label="Jump to event" value="" disabled={!replay?.moments.length || pending}
            onChange={event => { if (event.target.value) onSeek(Number(event.target.value)); }}>
            <option value="">Events{replay?.moments.length ? ' (' + replay.moments.length + ')' : ''}</option>
            {replay?.moments.map(moment => <option key={moment.index} value={moment.index}>{moment.index} · {moment.label}</option>)}
          </select>
        </label>}
      </div>
      <div className="scrub-wrap">
        <input type="range" aria-label="Playback step" aria-valuetext={index + ' of ' + max} min={0} max={max || 1} disabled={!max || pending} value={index}
          style={{ '--progress': (max ? index / max * 100 : 0) + '%' } as React.CSSProperties}
          onChange={event => onSeek(Number(event.target.value))} />
        {!compact && <div className="event-markers" aria-hidden="true">
          {markers.map(moment => <button key={moment.index} type="button" tabIndex={-1}
            disabled={pending} className={'event-marker ' + moment.kind} title={'Step ' + moment.index + ' · ' + moment.label}
            style={{ left: moment.index / Math.max(1, max) * 100 + '%' }} onClick={() => onSeek(moment.index)} />)}
        </div>}
      </div>
    </div>
    <label className="speed"><span>Speed</span><select aria-label="Playback speed" value={speed} onChange={event => onSpeed(Number(event.target.value))}>
      {speeds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
  </footer>;
}
