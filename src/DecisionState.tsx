import { useLayoutEffect, useRef } from 'react';
import { pathLabel, pathValue, type Backtracking, type Decision, type PathValue } from './backtracking';

type Props = { model: Backtracking; index: number; decision?: Decision; moving?: boolean; compact?: boolean; focus?: string };

export function DecisionState({ model, index, decision, moving, compact, focus }: Props) {
  const state = model.states[index];
  const change = useRef<HTMLLIElement>(null);
  const undo = useRef<HTMLSpanElement>(null);
  const removed = decision?.removed;

  useLayoutEffect(() => {
    if (!moving || !decision || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pulse = change.current?.animate([
      { opacity: .5, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 220, easing: 'ease-out' });
    const exit = undo.current?.animate([
      { opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(14px)' },
    ], { duration: 220, easing: 'ease-out' });
    return () => { pulse?.cancel(); exit?.cancel(); };
  }, [decision, moving]);

  if (!state) return <p className="scene-empty">The path appears after initialization.</p>;
  const highlight = (value: string) => focus === value ? 'true' : undefined;
  const shown = model.saved.slice(Math.max(0, state.saved - 60), state.saved);
  return <div className={'decision-state' + (compact ? ' decision-compact' : '')} aria-label="Backtracking state">
    <section className="decision-path" aria-label="Current path" data-focused={highlight(model.names.path)}>
      <h3>Current path <code>{pathLabel(state.path)}</code></h3>
      <ol className="decision-tiles">
        {state.path.map((value, i) => {
          const added = decision?.kind === 'choose' && i === state.path.length - 1;
          return <li key={i} data-changed={added} ref={added ? change : undefined}>{pathValue(value)}</li>;
        })}
        {!state.path.length && <li className="decision-empty">Empty path</li>}
      </ol>
      {removed !== undefined && <span ref={undo} className="decision-removed" aria-hidden="true">{pathValue(removed)}</span>}
    </section>
    {state.input && <section className="decision-candidates" aria-label="Candidates" data-focused={focus && model.names.input.includes(focus)}>
      <h3>Candidates</h3>
      <ol className="decision-tiles">
        {state.input.map((value, i) => {
          const active = i === decision?.candidate;
          return <li key={i} data-used={state.used?.[i]} data-changed={active}
            ref={active && decision?.kind !== 'choose' ? change : undefined}>
            {pathValue(value)}
            <small>{state.used ? state.used[i] ? 'Used' : 'Available' : 'Input'}</small>
          </li>;
        })}
      </ol>
    </section>}
    <section className="decision-results" aria-label="Saved paths" data-focused={focus && model.names.results.includes(focus)}>
      <h3>Saved paths <span className="decision-count">{state.saved}</span></h3>
      {shown.length ? <ol className="decision-saved" reversed start={state.saved}>
        {shown.map((path, i) => ({ path, id: state.saved - shown.length + i + 1 })).reverse().map(({ path, id }) => {
          const added = decision?.kind === 'save' && id === state.saved;
          return <li key={id} ref={added ? change : undefined} data-changed={added}><code>{pathLabel(path)}</code></li>;
        })}
      </ol> : <p className="decision-empty">No paths saved yet.</p>}
      {state.saved > shown.length && <small>Showing the latest {shown.length} saves.</small>}
    </section>
  </div>;
}
