import { ListTree, Maximize, Play, Terminal } from 'lucide-react';

export type RunDestination = 'inspect' | 'inspect-fullscreen' | 'watch' | 'output';
type Props = {
  source: string; pending: boolean; pendingMessage: string; error: string; output?: string;
  onRun: (destination: RunDestination) => void;
};

export function WriteGuide({ source, pending, pendingMessage, error, output, onRun }: Props) {
  const disabled = !source.trim() || pending;
  return <aside className="write-guide" aria-label="Run your Python">
    <div className="write-overview">
      <h2>Run Python</h2>
      <p>Run your code to see what it prints, or follow it step by step.</p>
      <div className="write-destinations">
        <button className="button primary" type="button" disabled={disabled} onClick={() => onRun('output')} title="Ctrl or Cmd + Enter"><Terminal />Run code</button>
        <button className="button neutral" type="button" disabled={disabled} onClick={() => onRun('inspect-fullscreen')}><Maximize />Inspect fullscreen</button>
        <button className="button neutral" type="button" disabled={disabled} onClick={() => onRun('inspect')}><ListTree />Inspect</button>
        <button className="button neutral" type="button" disabled={disabled} onClick={() => onRun('watch')}><Play />Watch</button>
      </div>
      {pending && <p className="write-progress" role="status">{pendingMessage}</p>}
    </div>
    <section className="write-output" aria-labelledby="write-output-heading">
      <h3 id="write-output-heading">Output</h3>
      <div role="status">
        {!pending && error && <p className="write-output-error">{error}</p>}
        {!pending && output && <pre tabIndex={0}>{output}</pre>}
        {!pending && !error && !output && <p>{output === '' ? 'Run ready. Your code printed nothing.' : 'Printed output appears here.'}</p>}
      </div>
    </section>
  </aside>;
}
