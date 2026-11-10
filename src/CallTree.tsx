import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Replay } from './workspace';
import type { Beat, CallNode } from './watchModel';

type Props = { replay: Replay; index: number; beat?: Beat; zoom: number; fit: boolean; moving: boolean; speed: number };

export function CallTree({ replay, index, beat, zoom, fit, moving, speed }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const highlighted = useRef<SVGGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const calls = replay.watch.calls;
  let low = 0, high = calls.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (calls[middle].born <= index) low = middle + 1;
    else high = middle;
  }
  const known = low;
  const returns = useMemo(() => {
    const byStep = new Map<number, CallNode>();
    for (const call of calls) if (Number.isFinite(call.end) && !byStep.has(call.end)) byStep.set(call.end, call);
    return byStep;
  }, [calls]);
  let active: CallNode | undefined = calls[known - 1];
  if (beat?.kind !== 'call') {
    while (active && active.end <= index && active.p !== undefined) active = calls[active.p];
  }
  if (beat?.kind === 'return' && !replay.steps[index]?.done) active = returns.get(index) ?? active;

  const { cards, width, height, cardWidth } = useMemo(() => {
    const nodes = calls.slice(0, known);
    const label = (node: CallNode) => replay.watch.callPaths?.get(node.born) ?? node.lab ?? 'Call';
    const cardWidth = Math.min(218, Math.max(96, ...nodes.map(node => label(node).length * 8 + 24)));
    const pitch = cardWidth + 24, row = 76, margin = 16;
    const depth: number[] = [], x: number[] = [];
    let leaves = 0, levels = 0;
    for (const node of nodes) {
      depth[node.id] = node.p === undefined ? 0 : depth[node.p] + 1;
      levels = Math.max(levels, depth[node.id] + 1);
      if (!node.k.length || node.k[0] >= known) x[node.id] = margin + cardWidth / 2 + leaves++ * pitch;
    }
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (x[node.id] !== undefined) continue;
      const children = node.k.filter(child => child < known);
      x[node.id] = (x[children[0]] + x[children.at(-1)!]) / 2;
    }
    return {
      cards: nodes.map(node => ({ node, x: x[node.id], y: margin + 17 + depth[node.id] * row, label: label(node) })),
      width: Math.max(120, margin * 2 + leaves * pitch - 24),
      height: Math.max(90, margin * 2 + levels * row - 22),
      cardWidth,
    };
  }, [calls, known, replay.watch.callPaths]);

  useLayoutEffect(() => {
    const viewport = host.current!;
    const measure = () => setSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const scale = fit && size.width && size.height ? Math.min(1, size.width / width, size.height / height) : zoom;
  const current = active && cards[active.id];
  useLayoutEffect(() => {
    if (!host.current) return;
    host.current.scrollLeft = !fit && current ? current.x * scale - size.width / 2 : 0;
    host.current.scrollTop = !fit && current ? current.y * scale - size.height / 2 : 0;
  }, [current, fit, scale, size]);

  useLayoutEffect(() => {
    if (!moving || !highlighted.current || !['call', 'return'].includes(beat?.kind ?? '') ||
        matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = highlighted.current.animate([{ opacity: .45 }, { opacity: 1 }], { duration: Math.min(240, speed / 2) });
    return () => animation.cancel();
  }, [beat, moving, speed]);

  return <div className="diagram-window call-window" ref={host} tabIndex={0} aria-label="Call tree viewport"
    onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) event.stopPropagation(); }}>
    {!cards.length ? <p className="scene-empty">Function calls will appear here.</p> :
      <svg className="watch-tree" viewBox={`0 0 ${width} ${height}`} width={width * scale} height={height * scale}
        style={{ marginBlock: Math.max(0, (size.height - height * scale) / 2) }} role="img" aria-label="Call tree">
        {cards.map(({ node, x, y }) => {
          const parent = node.p === undefined ? undefined : cards[node.p];
          return parent && <line className="call-link" key={node.id} x1={parent.x} y1={parent.y + 17} x2={x} y2={y - 17} />;
        })}
        {cards.map(({ node, x, y, label }) => {
          const hasPath = replay.watch.callPaths?.has(node.born);
          const returned = node.end <= index ? node.rv : undefined;
          const selected = node.id === active?.id;
          const limit = Math.max(5, Math.floor((cardWidth - 18) / 8));
          const shorten = (value: string) => value.length > limit ? value.slice(0, limit - 1) + '…' : value;
          return <g key={node.id} transform={`translate(${x} ${y})`}>
            <g className="watch-call" ref={selected ? highlighted : undefined} data-active={selected} data-call-id={node.id}>
              <title>{label}{hasPath ? ' · ' + node.lab : ''}{returned ? ' → ' + returned : ''}</title>
              <rect x={-cardWidth / 2} y="-17" width={cardWidth} height="34" rx="7" />
              <text textAnchor="middle" dy={hasPath ? '0' : '.35em'}>{shorten(label)}</text>
            </g>
            {hasPath && <text className="call-function" y="11" textAnchor="middle">{shorten(node.lab.split('(')[0])}</text>}
            {returned && <text className="call-return" y="30" textAnchor="middle">{shorten(returned)}</text>}
          </g>;
        })}
      </svg>}
    <span className="sr-only">{known} {known === 1 ? 'call' : 'calls'} recorded so far</span>
  </div>;
}
