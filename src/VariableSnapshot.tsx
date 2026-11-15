import { useState } from 'react';
import { Pin } from 'lucide-react';
import { frameVariables, HideVariableButton, type VariableVisibility } from './Inspector';
import type { Step } from './workspace';

export function VariableSnapshot({ step, previous, id, label, fullscreen = false, hiddenVariables, onHideVariable, onRestoreVariables, pinned, onPin }: {
  step?: Step; previous?: Step; id?: string; label: string; fullscreen?: boolean;
  pinned?: ReadonlyMap<string, string>; onPin?: (id: string, name: string) => void;
} & VariableVisibility) {
  const [scope, setScope] = useState<number | null>(null);
  const frame = scope !== null && scope < (step?.F.length ?? 0) ? scope : null;
  const values = frameVariables(step, previous, frame).filter(({ name }) => !hiddenVariables.has(name));
  return <section id={id} className={'variable-snapshot' + (fullscreen ? ' fullscreen-variables' : ' watch-variables')}
    aria-label={label} tabIndex={0}>
    <div className="variable-snapshot-header"><h3>Variables</h3>
      {hiddenVariables.size > 0 && <button type="button" className="variable-restore" onClick={onRestoreVariables}>Restore hidden</button>}
    </div>
    {step && step.F.length > 1 && <label className="scope-control">Scope
      <select value={frame ?? 'current'} onChange={event => setScope(event.target.value === 'current' ? null : Number(event.target.value))}>
        <option value="current">Current frame</option>
        {step.F.map((item, i) => <option key={i} value={i}>{item.n === '<module>' ? 'Main program' : item.n + ' · frame ' + (i + 1)}</option>)}
      </select>
    </label>}
    {values.length ? <dl>{values.map(({ name, value, shown, changed }) => {
      const ref = value && typeof value === 'object' && value.r !== undefined ? String(value.r) : undefined;
      return <div key={name}>
        <dt>
          {changed && <i className="change-dot" aria-label="Changed" />}
          {onPin && ref !== undefined && step?.H[ref] ? <button type="button" className="variable-pin" aria-label={`Pin ${name} to canvas`}
            title={pinned?.has(ref) ? 'Unpin from canvas' : 'Pin to canvas'} aria-pressed={pinned?.has(ref) ?? false}
            onClick={() => onPin(ref, name)}>{name}<Pin size={12} /></button> : name}
        </dt>
        <dd title={shown}><code>{shown}</code></dd>
        <dd><HideVariableButton name={name} onHide={onHideVariable} /></dd>
      </div>;
    })}</dl> : <p>{hiddenVariables.size ? 'No visible variables in this frame.' : 'No variables in this frame yet.'}</p>}
  </section>;
}
