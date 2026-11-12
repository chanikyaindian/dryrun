import { useState } from 'react';
import { frameVariables } from './Inspector';
import type { Step } from './workspace';

export function VariableSnapshot({ step, previous, id, label, fullscreen = false }: {
  step?: Step; previous?: Step; id?: string; label: string; fullscreen?: boolean;
}) {
  const [scope, setScope] = useState<number | null>(null);
  const frame = scope !== null && scope < (step?.F.length ?? 0) ? scope : null;
  const values = frameVariables(step, previous, frame);
  return <section id={id} className={'variable-snapshot' + (fullscreen ? ' fullscreen-variables' : ' watch-variables')}
    aria-label={label} tabIndex={fullscreen ? 0 : undefined}>
    <h3>Variables</h3>
    {step && step.F.length > 1 && <label className="scope-control">Scope
      <select value={frame ?? 'current'} onChange={event => setScope(event.target.value === 'current' ? null : Number(event.target.value))}>
        <option value="current">Current frame</option>
        {step.F.map((item, i) => <option key={i} value={i}>{item.n === '<module>' ? 'Main program' : item.n + ' · frame ' + (i + 1)}</option>)}
      </select>
    </label>}
    {values.length ? <dl>{values.map(({ name, shown, changed }) => <div key={name}>
      <dt>{changed && <i className="change-dot" aria-label="Changed" />}{name}</dt><dd title={shown}><code>{shown}</code></dd>
    </div>)}</dl> : <p>No variables in this frame yet.</p>}
  </section>;
}
