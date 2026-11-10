import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { display, type TopicEvent, type TopicView } from './topicModel';

function HeapTree({ values, active }: { values: NonNullable<TopicView['heap']>; active?: number[] }) {
  const shown = values.slice(0, 31);
  if (!shown.length) return <p className="topic-empty">Heap is empty.</p>;
  const levels = Math.floor(Math.log2(shown.length)) + 1;
  const width = Math.max(270, 2 ** (levels - 1) * 58);
  const positions = shown.map((_, index) => {
    const level = Math.floor(Math.log2(index + 1)), slots = 2 ** level;
    return { x: (index + 1 - slots + .5) * width / slots, y: 28 + level * 52 };
  });
  return <div className="topic-diagram">
    <svg className="topic-tree" role="img" aria-label="Min heap tree" width={width} height={levels * 52} viewBox={`0 0 ${width} ${levels * 52}`}>
      {positions.slice(1).map(({ x, y }, i) => {
        const parent = positions[Math.floor(i / 2)];
        return <line key={i} x1={parent.x} y1={parent.y} x2={x} y2={y} />;
      })}
      {positions.map(({ x, y }, i) => <g key={i} data-minimum={i === 0} data-active={active?.includes(i)} data-topic-cue={active?.includes(i) || undefined}>
        <title>{i === 0 ? 'Minimum ' : 'Index ' + i + ', '}{display(shown[i])}</title>
        <rect x={x - 24} y={y - 15} width="48" height="30" rx="6" />
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central">{display(shown[i]).slice(0, 6)}</text>
      </g>)}
    </svg>
    {shown.length < values.length && <small>Showing the first {shown.length} heap entries.</small>}
  </div>;
}

function TrieTree({ nodes }: { nodes: NonNullable<TopicView['trie']> }) {
  if (!nodes.length) return <p className="topic-empty">The root has yet to be created.</p>;
  const branches = new Map<string, typeof nodes>();
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) if (node.parent !== undefined) {
    const children = branches.get(node.parent) ?? [];
    children.push(node);
    branches.set(node.parent, children);
  }
  let leaf = 0, height = 0;
  function place(prefix: string, level: number): number {
    const children = branches.get(prefix) ?? [];
    const xs = children.map(node => place(node.prefix, level + 1));
    const x = xs.length ? (xs[0] + xs.at(-1)!) / 2 : 50 + 92 * leaf++;
    const y = 26 + level * 65;
    positions.set(prefix, { x, y });
    height = Math.max(height, y + 28);
    return x;
  }
  place('', 0);
  const width = 92 * leaf + 8;
  return <div className="topic-diagram">
    <svg className="topic-tree" role="img" aria-label="Prefix tree" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {nodes.map(({ prefix, parent, letter }) => {
        const p = parent === undefined ? undefined : positions.get(parent), c = positions.get(prefix)!;
        return p && <g key={prefix}><line x1={p.x} y1={p.y} x2={c.x} y2={c.y} />
          <text className="topic-edge-label" x={(p.x + c.x) / 2 + 6} y={(p.y + c.y) / 2 - 4}>{letter}</text></g>;
      })}
      {nodes.map(({ prefix, word, active }) => {
        const { x, y } = positions.get(prefix)!;
        return <g key={prefix} data-active={active} data-word={word} data-topic-cue={active || undefined}>
          <title>{prefix || 'Root'}{word ? ', complete word' : ''}</title>
          <rect x={x - 38} y={y - 15} width="76" height="30" rx="6" />
          <text x={x} y={y} textAnchor="middle" dominantBaseline="central">{(prefix || 'Root').slice(0, 8)}{word ? ' ✓' : ''}</text>
        </g>;
      })}
    </svg>
    <small>✓ marks a complete word</small>
  </div>;
}

function IntervalLanes({ ranges }: { ranges: NonNullable<TopicView['ranges']> }) {
  const numbers = ranges.flatMap(group => group.pairs.flat());
  if (!numbers.length) return <p className="topic-empty">Waiting for intervals.</p>;
  const min = numbers.reduce((a, b) => Math.min(a, b));
  const max = numbers.reduce((a, b) => Math.max(a, b));
  const span = max / 2 - min / 2;
  const position = (value: number) => span ? 100 * (value / 2 - min / 2) / span : 50;
  return <div className="topic-ranges">
    {ranges.map(({ name, pairs }, group) => <section key={name} aria-label={name}>
      <h3>{name}</h3>
      {pairs.length ? <ol>{pairs.slice(0, 24).map(([start, end], i) =>
        <li key={i} data-topic-cue={group > 0 && i === pairs.length - 1 || undefined}>
          <code>[{start}, {end}]</code>
          <span className="topic-lane"><span style={{ '--from': position(start) + '%', '--width': (position(end) - position(start)) + '%' } as CSSProperties} /></span>
        </li>)}</ol> : <p className="topic-empty">No intervals yet.</p>}
      {pairs.length > 24 && <small>Showing 24 of {pairs.length} intervals.</small>}
    </section>)}
  </div>;
}

export function TopicPanel({ view, cue, motion = false, speed = 560, showKey = false }: {
  view: TopicView; cue?: TopicEvent; motion?: boolean; speed?: number; showKey?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const pointerPositions = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const panel = host.current;
    if (!panel) return;
    const bounds = panel.getBoundingClientRect();
    const positions = new Map<string, { x: number; y: number }>();
    const animations: Animation[] = [];
    const moving = motion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const marker of panel.querySelectorAll<HTMLElement>('[data-topic-pointer]')) {
      const key = marker.dataset.topicPointer!;
      const rect = marker.getBoundingClientRect();
      const position = { x: rect.left - bounds.left, y: rect.top - bounds.top };
      const previous = pointerPositions.current.get(key);
      positions.set(key, position);
      if (!moving || !previous || (previous.x === position.x && previous.y === position.y)) continue;
      animations.push(marker.animate([
        { transform: `translate(${previous.x - position.x}px, ${previous.y - position.y}px)` },
        { transform: 'translate(0, 0)' },
      ], { duration: Math.min(320, Math.max(90, speed * .56)), easing: 'cubic-bezier(.25,.8,.25,1)' }));
    }
    pointerPositions.current = positions;
    if (moving && cue) {
      for (const element of panel.querySelectorAll('[data-topic-cue]')) {
        animations.push(element.animate([{ opacity: .46 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }));
      }
    }
    return () => animations.forEach(animation => animation.cancel());
  }, [view, cue, motion, speed]);
  const facts = [...(view.facts ?? []), ...(cue?.facts ?? [])];
  const hasPointers = showKey && view.rows?.some(row => row.pointers);
  return <div className="topic-panel" ref={host} aria-label="Decision state" data-motion={motion}>
    {facts.length > 0 && <dl className="topic-facts">{facts.map(([label, value]) =>
      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {view.heap && <HeapTree values={view.heap} active={cue?.active} />}
    {view.trie && <TrieTree nodes={view.trie} />}
    {view.ranges && <IntervalLanes ranges={view.ranges} />}
    {view.grid && <div className="topic-grid-scroll">
      <table className="topic-grid">
        <caption>{view.grid.name}</caption>
        <tbody>{view.grid.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => {
          const address = r + ':' + c;
          const active = view.grid?.active?.includes(address);
          const related = view.grid?.related?.includes(address);
          return <td key={c} data-active={active} data-related={related} data-topic-cue={active || undefined}>{display(cell)}</td>;
        })}</tr>)}</tbody>
      </table>
      {Boolean(view.grid.related?.length) && <small className="topic-grid-key">Dashed cells supplied values for this step.</small>}
    </div>}
    {view.rows?.map(row => {
      const limit = 36;
      const focus = row.active?.at(-1) ?? row.pointers?.at(-1)?.index ?? row.related?.at(-1) ?? 0;
      const start = Math.min(Math.max(0, row.values.length - limit), Math.max(0, focus - 12));
      const visible = row.values.slice(start, start + limit);
      return <section className="topic-row" key={row.name} aria-label={row.name} data-bits={row.decimal !== undefined || undefined}
        data-pointers={row.pointers ? '' : undefined} data-characters={row.characters || undefined} data-window={row.window ? '' : undefined}>
      <h3>{row.name}{row.decimal !== undefined && <small> · {row.decimal}</small>}
        {row.window && <small> · {row.window[0] <= row.window[1] ? `Window ${row.window[0]}–${row.window[1]}` : 'Empty window'}</small>}</h3>
      {visible.length ? <ol className="topic-cells">{visible.map((value, position) => {
        const i = start + position;
        const active = row.active?.includes(i), related = !active && row.related?.includes(i);
        const pointers = row.pointers?.filter(pointer => pointer.index === i);
        return <li key={i} data-active={active} data-related={related} data-topic-cue={active || undefined}
          data-pointed={Boolean(pointers?.length) || undefined}
          data-in-window={Boolean(row.window && i >= row.window[0] && i <= row.window[1]) || undefined}
          data-outside={Boolean(row.outside && (i < row.outside[0] || i > row.outside[1]))}>
          <code>{row.characters && value === ' ' ? <span aria-label="Space">␠</span> : display(value)}</code>{row.index && <small>{i}</small>}
          {pointers && <span className="topic-pointer-lane">{pointers.map(({ name }) =>
            <span className="topic-pointer" key={name} data-topic-pointer={row.name + ':' + name}>{name}</span>)}</span>}
        </li>;
      })}</ol> : <p className="topic-empty">Empty</p>}
      {row.values.length > limit && <small>Showing entries {start + 1}–{start + visible.length} of {row.values.length}.</small>}
    </section>;
    })}
    {hasPointers && <ul className="topic-array-key" aria-label="Array highlighting">
      <li><i data-key="pointer" />Pointer</li><li><i data-key="read" />Read</li><li><i data-key="write" />Changed</li>
      {view.rows?.some(row => row.window) && <li><i data-key="window" />In window</li>}
    </ul>}
  </div>;
}
