import { ListTree, Maximize, Play } from 'lucide-react';

export type RunDestination = 'inspect' | 'inspect-fullscreen' | 'watch';
type Props = {
  source: string; pending: boolean; pendingMessage: string; error: string; ready: boolean;
  onRun: (destination: RunDestination) => void;
};

export function WriteGuide({ source, pending, pendingMessage, error, ready, onRun }: Props) {
  const disabled = !source.trim() || pending;
  return <aside className="write-guide" aria-label="Run your Python">
    <div className="write-overview">
      <h2>Run your code.</h2>
      <p>{source.trim() ? 'Step through your code in Inspect, or replay the changes in Watch.' : 'Type or paste Python to start a run.'}</p>
      <div className="write-destinations">
        <button className="button neutral" type="button" disabled={disabled} onClick={() => onRun('inspect-fullscreen')}><Maximize />Inspect fullscreen</button>
        <button className="button primary" type="button" disabled={disabled} onClick={() => onRun('inspect')} title="Ctrl or Cmd + Enter"><ListTree />Inspect</button>
        <button className="button neutral" type="button" disabled={disabled} onClick={() => onRun('watch')}><Play />Watch</button>
      </div>
      {pending && <p className="write-progress" role="status">{pendingMessage}</p>}
    </div>
    {!pending && (error || ready) && <div className={'write-feedback' + (error ? ' error' : '')} role="status">
      <strong>{error ? 'Run needs attention' : 'Run ready'}</strong>
      {error && <p>{error}</p>}
    </div>}
  </aside>;
}
