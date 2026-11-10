import { useState } from 'react';
import { ChevronRight, Copy, ListTree, PanelBottomClose, Terminal, Variable } from 'lucide-react';
import { rp } from '../js/views/basic.js';
import type { Step } from './workspace';

export type InspectionTab = 'variables' | 'stack' | 'output';
const tabs = [['variables', 'Variables', Variable], ['stack', 'Call stack', ListTree], ['output', 'Output', Terminal]] as const;

export function frameVariables(step?: Step, previous?: Step, scope: number | null = null) {
  const index = Math.min(scope ?? Infinity, (step?.F.length ?? 1) - 1);
  const frame = step?.F[index];
  const prior = previous?.F[index]?.n === frame?.n ? previous?.F[index] : undefined;
  return Object.entries(frame?.v ?? {}).filter(([, value]) => !(value && typeof value === 'object' && value.f)).map(([name, value]) => {
    const shown = rp(step!.H, value);
    const changed = Boolean(previous && (!prior || !Object.hasOwn(prior.v, name) || rp(previous.H, prior.v[name]) !== shown));
    return { name, value, shown, changed };
  });
}

type Props = {
  step?: Step; previous?: Step; tab: InspectionTab; setTab: (tab: InspectionTab) => void; onClose: () => void;
  focus: string; onFocus: (name: string) => void; showStack: boolean;
};
export function Inspector({ step, previous, tab: selected, setTab, onClose, focus, onFocus, showStack }: Props) {
  const visibleTabs = showStack ? tabs : tabs.filter(([key]) => key !== 'stack');
  const tab = !showStack && selected === 'stack' ? 'variables' : selected;
  const [scope, setScope] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const variables = tab === 'variables' ? frameVariables(step, previous, scope) : [];

  return <section className="pane inspector" id="inspector-region" aria-label="Inspector">
    <div className="pane-header inspector-header">
      <div className="inspector-tabs" role="tablist" aria-label="Inspector sections">
        {visibleTabs.map(([key, label, Icon], index) => <button key={key} type="button" id={'inspect-tab-' + key} role="tab" aria-selected={tab === key}
          aria-controls={'inspect-' + key} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)}
          onKeyDown={event => {
            const next = event.key === 'ArrowRight' ? (index + 1) % visibleTabs.length : event.key === 'ArrowLeft' ? (index + visibleTabs.length - 1) % visibleTabs.length : -1;
            if (next === -1) return;
            event.preventDefault();
            setTab(visibleTabs[next][0]);
            document.getElementById('inspect-tab-' + visibleTabs[next][0])?.focus();
          }}><Icon />{label}{key === 'stack' && (step?.F.length ?? 0) > 1 && <span className="badge">{step!.F.length}</span>}</button>)}
      </div>
      <button className="icon-button hide-inspector" type="button" title="Hide inspector" aria-label="Hide inspector" onClick={onClose}><PanelBottomClose /></button>
    </div>
    <div className="inspector-body" role="tabpanel" tabIndex={0} id={'inspect-' + tab} aria-labelledby={'inspect-tab-' + tab}>
      {tab === 'variables' && <>
        {step && step.F.length > 1 && <label className="scope-control">Scope<select value={scope ?? 'current'} onChange={event => setScope(event.target.value === 'current' ? null : Number(event.target.value))}>
          <option value="current">Current frame</option>
          {step.F.map((item, index) => <option value={index} key={index}>{item.n === '<module>' ? 'Main program' : item.n}</option>)}
        </select></label>}
        {!variables.length && <p className="pane-empty">Variables appear as the code runs.</p>}
        {variables.length > 0 && <div className="variable-head" aria-hidden="true"><span>Name</span><span>Value</span></div>}
        <div className="variable-grid">{variables.map(({ name, value, shown, changed }) => {
          const bitValue = typeof value === 'number' && Number.isSafeInteger(value) ||
            value && typeof value === 'object' && /^-?\d+$/.test(value.p ?? '');
          const visual = Boolean(typeof value === 'string' && value.length > 1 && value.length <= 80 ||
            bitValue && /mask|flags|^bits$|^bitset$/i.test(name) ||
            value && typeof value === 'object' && value.r);
          return <button type="button" key={name} className="variable" disabled={!visual} aria-pressed={visual ? focus === name : undefined}
            title={shown} onClick={() => onFocus(name)}>
            <span className="variable-name">{changed && <i className="change-dot" aria-label="Changed" />}{name}</span>
            <code>{shown}</code>{visual && <ChevronRight />}
          </button>;
        })}</div>
      </>}
      {tab === 'stack' && (step ? <ol className="stack-frames">
        {step.F.map((item, index) => ({ item, index })).reverse().map(({ item, index }) =>
          <li key={index}><button className="stack-frame" type="button" onClick={() => { setScope(index); setTab('variables'); }}>
            <code>{item.n === '<module>' ? 'Main program' : item.n + '(' + item.a.map(name => rp(step.H, item.v[name])).join(', ') + ')'}</code>
            {index === step.F.length - 1 && <span className="badge">Active</span>}
          </button></li>)}
      </ol> : <p className="pane-empty">Run code to see its call stack.</p>)}
      {tab === 'output' && <>
        {step?.out ? <div className="output-block"><pre>{step.out}</pre><button className="icon-button" type="button" aria-label="Copy output" title="Copy output"
          onClick={async () => { try { await navigator.clipboard.writeText(step.out); setCopyStatus('Output copied.'); } catch { setCopyStatus('Could not copy output.'); } }}><Copy /></button></div> :
          <p className="pane-empty">Printed output appears here.</p>}
        <span role="status" className="sr-only">{copyStatus}</span>
      </>}
    </div>
  </section>;
}
