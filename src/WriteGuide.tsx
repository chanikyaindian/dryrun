import { ListTree, Play } from 'lucide-react';

export type RunDestination = 'watch' | 'inspect';
type Props = {
  source: string; pending: boolean; pendingMessage: string; error: string; ready: boolean;
  onRun: (destination: RunDestination) => void;
  onExample: () => void;
};

export function WriteGuide({ source, pending, pendingMessage, error, ready, onRun, onExample }: Props) {
  const disabled = !source.trim() || pending;
  return <aside className="write-guide" aria-label="Run your Python">
    <div className="write-overview">
      <h2>Run your code.</h2>
      <p>{source.trim() ? 'Watch the key changes or inspect each line of execution.' : 'Type or paste Python to enable Watch and Inspect.'}</p>
      <div className="write-destinations">
        <button className="button primary" type="button" disabled={disabled} onClick={() => onRun('watch')} title="Ctrl or Cmd + Enter"><Play />Watch</button>
        <button className="button neutral" type="button" disabled={disabled} onClick={() => onRun('inspect')}><ListTree />Inspect</button>
      </div>
      {!source.trim() && !pending && <button className="button neutral compact write-example" type="button" onClick={onExample}>Try Bubble sort</button>}
      {pending && <p className="write-progress" role="status">{pendingMessage}</p>}
    </div>
    {!pending && (error || ready) && <div className={'write-feedback' + (error ? ' error' : '')} role="status">
      <strong>{error ? 'Run needs attention' : 'Run ready'}</strong>
      {error && <p>{error}</p>}
    </div>}
  </aside>;
}
