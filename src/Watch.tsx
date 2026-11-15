import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, CodeXml, ListTree, Maximize, Minimize, Minus, Pause, Play, Plus, RotateCcw, Settings2, Variable } from 'lucide-react';
import { rp } from '../js/views/basic.js';
import { barLayout, followArrayFocus } from '../js/views/array-layout.js';
import { kind, netOf, pointLayout } from '../js/views/structures.js';
import { arrayPointers, beatPosition, isAtom, linkedNodes, matrixRows, readIndices, scopeValue, searchState, type Beat, type Network, type Scene } from './watchModel';
import type { Replay, Step } from './workspace';
import { Prediction } from './Prediction';
import { DecisionState } from './DecisionState';
import { decisionLocation } from './backtracking';
import { TopicPanel } from './TopicPanel';
import type { TopicEvent } from './topicModel';
import { narrateStep } from './stepNarration';
import { CallTree } from './CallTree';
import { VariableSnapshot } from './VariableSnapshot';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const duration = (speed: number) => Math.min(320, Math.max(110, speed * .62));
const format = (value: unknown) => value === null ? 'None' : typeof value === 'boolean' ? value ? 'True' : 'False' : String(value);
function animate(element: Element | null | undefined, frames: Keyframe[], speed: number) {
  if (!element || reduced()) return;
  return element.animate(frames, { duration: duration(speed), easing: 'cubic-bezier(.25,.8,.25,1)' });
}
function useCue(host: React.RefObject<HTMLElement | null>, beat: Beat | undefined, moving: boolean, speed: number) {
  useLayoutEffect(() => {
    if (!moving || !beat || !['enqueue', 'dequeue', 'call', 'return', 'write', 'link', 'topic'].includes(beat.kind)) return;
    const animation = animate(host.current?.querySelector('[data-cue]'), [
      { opacity: .36, scale: .94 }, { opacity: 1, scale: 1 },
    ], speed);
    return () => animation?.cancel();
  }, [host, beat, moving, speed]);
}

function ArrayScene({ replay, step, beat, moving, speed, scene = replay.watch.scene }: { replay: Replay; step: Step; beat?: Beat; moving: boolean; speed: number; scene?: Scene }) {
  const values = step.H[scene.id!]?.v ?? [];
  const slots = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const pointerPositions = useRef(new Map<string, number>());
  const [lo, hi, pivot] = searchState(step, scene);
  const reads = scene.id ? readIndices(step, scene.id) : [];
  const pointers = scene.kind === 'search' ? [] : arrayPointers(step, replay.watch.indexNames.get(scene.id!), values.length);
  const target = scene.target ? scopeValue(step, scene.target) : undefined;
  const [min, max] = useMemo(() => {
    let min = 0, max = 0;
    for (const snapshot of replay.steps) {
      for (const value of snapshot.H[scene.id!]?.v ?? []) {
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    return [min, max];
  }, [replay, scene.id]);
  const bars = values.length > 0 && values.every(value => typeof value === 'number' && Number.isFinite(value));
  const range = lo !== undefined && hi !== undefined ? [Math.max(0, lo), Math.min(values.length - 1, hi)] : undefined;
  const focus = beat?.cells?.at(-1) ?? pivot ?? reads.at(-1) ?? pointers.at(-1)?.index;
  useLayoutEffect(() => {
    const host = slots.current;
    const scrollport = viewport.current;
    if (!host || !scrollport) return;
    const cell = (index: number | undefined) => index === undefined ? undefined : host.children[index] as HTMLElement | undefined;
    scrollport.tabIndex = scrollport.scrollWidth > scrollport.clientWidth ? 0 : -1;
    const scrolled = followArrayFocus(scrollport, cell(range?.[0]), cell(range?.[1]), cell(focus));
    const positions = new Map<string, number>();
    const animations: Animation[] = [];
    for (const marker of host.querySelectorAll<HTMLElement>('[data-array-pointer]')) {
      const name = marker.dataset.arrayPointer!;
      const x = marker.getBoundingClientRect().left - host.getBoundingClientRect().left;
      const previous = pointerPositions.current.get(name);
      positions.set(name, x);
      if (moving && !scrolled && previous !== undefined && previous !== x) {
        const animation = animate(marker, [{ transform: `translateX(${previous - x}px)` }, { transform: 'translateX(0)' }], speed);
        if (animation) animations.push(animation);
      }
    }
    pointerPositions.current = positions;
    return () => animations.forEach(animation => animation.cancel());
  }, [scene.id, step, moving, speed, range?.[0], range?.[1], focus]);
  useLayoutEffect(() => {
    if (!moving || !beat?.cells || !slots.current) return;
    const elements = beat.cells.map(i => slots.current?.querySelector<HTMLElement>('[data-slot="' + i + '"] .array-glyph'));
    const animations: Animation[] = [];
    if (beat.kind === 'swap' && elements[0] && elements[1]) {
      const delta = elements[1].getBoundingClientRect().left - elements[0].getBoundingClientRect().left;
      elements.forEach((element, index) => {
        const x = index === 0 ? delta : -delta, arc = index === 0 ? -22 : 16;
        const animation = animate(element, [
          { transform: 'translateX(' + x + 'px)' },
          { transform: 'translate(' + x / 2 + 'px,' + arc + 'px)' },
          { transform: 'translate(0,0)' },
        ], speed);
        if (animation) animations.push(animation);
      });
    } else if (beat.kind === 'write') {
      for (const element of elements) {
        const animation = animate(element, [{ opacity: .35 }, { opacity: 1 }], speed);
        if (animation) animations.push(animation);
      }
    }
    return () => animations.forEach(animation => animation.cancel());
  }, [beat, moving, speed]);

  if (!values.length) return <p className="scene-empty">Waiting for {scene.name}.</p>;
  const { zero, height } = barLayout(min, max);
  return <div className="array-viewport">
    {target !== undefined && <p className="array-target">Target <code>{rp(step.H, target)}</code></p>}
    <div ref={viewport} className="array-scroll" role="region" aria-label={scene.name + ' values'}>
      <div ref={slots} className={'array-scene' + (bars ? ' bars-scene' : '')} data-moving={moving}
        style={{ '--slots': values.length, '--zero': zero / 100 } as CSSProperties} aria-label={scene.name + ', ' + values.length + ' values'}>
        {values.map((value, index) => {
          const active = Boolean(beat?.cells?.includes(index));
          const outside = range && (index < range[0] || index > range[1]);
          const probe = scene.kind === 'search' && pivot === index && !outside;
          const roles = [range?.[0] === index ? scene.bounds?.[0] : '', probe ? scene.bounds?.[2] : '', range?.[1] === index ? scene.bounds?.[1] : '',
            ...pointers.filter(pointer => pointer.index === index).map(pointer => pointer.name)].filter(Boolean);
          const magnitude = bars ? height(Number(value)) : 0;
          const label = isAtom(value) ? format(value) : rp(step.H, value);
          return <div key={index} className="array-slot" data-slot={index} data-outside={Boolean(outside)}
            data-active={active || probe} data-read={!active && !probe && reads.includes(index)} data-changed={active && ['swap', 'write'].includes(beat?.kind ?? '')}>
            <div className="array-glyph">
              {bars && <span className="watch-bar-plot" aria-hidden="true"><i style={{
                top: (Number(value) < 0 ? zero : zero - magnitude) + '%', height: magnitude + '%',
              }} /></span>}
              <span title={label}>{label}</span>
            </div>
            <span className="array-index">{index}</span>
            <span className="array-role">{[...new Set(roles)].map(name => <span key={name} data-array-pointer={name} title={name}>{name}</span>)}</span>
          </div>;
        })}
      </div>
    </div>
  </div>;
}

function GraphScene({ scene, step, current, processed, beat, moving, speed, zoom }: {
  scene: Scene; step: Step; current: unknown; processed: Beat['node'][]; beat?: Beat; moving: boolean; speed: number; zoom: number;
}) {
  const baseline = scene.network!;
  const snapshot = step.H[scene.id!];
  const graph = snapshot ? netOf(snapshot, step, 'graph') as Network | null : null;
  const layout = useMemo(() => new Map(baseline.N.map((node, i) => {
    const angle = i / baseline.N.length * Math.PI * 2 - Math.PI / 2;
    return [node, [320 + Math.cos(angle) * 210, 186 + Math.sin(angle) * 125]];
  })), [baseline]);
  const radius = Math.min(24, 420 / Math.max(baseline.N.length, graph?.N.length ?? 0));
  const extras = graph?.N.filter(node => !layout.has(node)) ?? [];
  const point = (node: Network['N'][number]) => layout.get(node) ??
    [160 + (extras.indexOf(node) + 1) * 320 / (extras.length + 1), 186];
  const queueRef = scene.queue ? scopeValue(step, scene.queue) : undefined;
  const queue = queueRef && typeof queueRef === 'object' && queueRef.r ? step.H[String(queueRef.r)]?.v ?? [] : [];
  return <div className="graph-scene">
    <div className="diagram-window">
      <svg className="watch-graph" viewBox="0 0 640 372" role="img" aria-label="Graph and active traversal">
        <defs>
          <marker id="watch-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 8 4 0 8z" fill="var(--watch-edge)" /></marker>
          <marker id="watch-arrow-active" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 10 5 0 10z" fill="var(--watch-accent)" /></marker>
        </defs>
        <g transform={'translate(320 186) scale(' + zoom + ') translate(-320 -186)'}>
          {graph?.E.map(([from, to, weight], i) => {
            const [x1, y1] = point(from), [x2, y2] = point(to);
            const active = Boolean(beat?.edge && Object.is(beat.edge[0], from) && Object.is(beat.edge[1], to));
            const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy) || 1;
            const marker = graph.dir || active ? active ? 'url(#watch-arrow-active)' : 'url(#watch-arrow)' : undefined;
            return <g key={i} className="watch-edge" data-active={active}>
              {Object.is(from, to) ? <path pathLength="1" d={'M' + (x1 - 13) + ' ' + (y1 - radius) + 'c-36 -40 58 -40 27 0'} markerEnd={marker} /> :
                <line pathLength="1" x1={x1 + dx / length * (radius + 1)} y1={y1 + dy / length * (radius + 1)}
                  x2={x2 - dx / length * (radius + 4)} y2={y2 - dy / length * (radius + 4)} markerEnd={marker} />}
              {weight !== '' && <text x={(x1 + x2) / 2 + 7} y={(y1 + y2) / 2 - 6}>{format(weight)}</text>}
            </g>;
          })}
          {graph?.N.map((node, i) => {
            const [x, y] = point(node);
            const active = Object.is(node, current);
            return <g key={i} transform={'translate(' + x + ' ' + y + ')'} className="watch-node" data-active={active}
              data-queued={queue.some(value => Object.is(node, value))} data-processed={processed.some(value => Object.is(node, value))}>
              <title>{format(node)}{active ? ', current node' : ''}</title><circle r={radius} />
              <text textAnchor="middle" dy=".35em" style={{ fontSize: Math.min(16, radius * .72) }}>{format(node).slice(0, 8)}</text>
            </g>;
          })}
        </g>
      </svg>
    </div>
    {scene.queue && <QueueScene queue={queue} beat={beat} step={step} moving={moving} speed={speed} />}
    {processed.length > 0 && <div className="watch-queue watch-processed" aria-label="Removal order">
      <span>Removal order</span><ol>{processed.slice(-20).map((value, i) => <li key={i}>{format(value)}</li>)}</ol>
    </div>}
  </div>;
}

function QueueScene({ queue, beat, step, moving, speed }: { queue: unknown[]; beat?: Beat; step: Step; moving: boolean; speed: number }) {
  const host = useRef<HTMLElement>(null);
  useCue(host, beat, moving, speed);
  const active = beat?.kind === 'enqueue' ? beat.queueChange?.end === 'front' ? 0 : queue.length - 1 : -1;
  return <section ref={host} className="watch-queue" aria-label="Queue">
    <span>Queue (front on left)</span>
    {queue.length ? <ol>{queue.map((value, i) => <li key={i} data-cue={i === active ? '' : undefined}>
      {isAtom(value) ? format(value) : rp(step.H, value)}
    </li>)}</ol> : <span className="queue-empty">Empty</span>}
    {beat?.kind === 'dequeue' && <small data-cue>Removed {beat.queueChange?.value ?? format(beat.node)} from the {beat.queueChange?.end ?? 'front'}</small>}
  </section>;
}

function ValueScene({ replay, scene, step, beat, moving, speed }: { replay: Replay; scene: Scene; step: Step; beat?: Beat; moving: boolean; speed: number }) {
  const host = useRef<HTMLDivElement>(null);
  useCue(host, beat, moving, speed);
  const value = scene.id ? step.H[scene.id] : undefined;
  if (!value) {
    const entries = Object.entries(step.F.at(-1)?.v ?? {}).filter(([, value]) => isAtom(value)).slice(0, 10);
    if (entries.length) return <TopicPanel view={{ facts: entries.map(([key, value]) => [key, rp(step.H, value)]) }} />;
    return <div className="scene-empty">{step.error ?? (step.out ? <pre>{step.out}</pre> : 'Follow execution or open Inspect for line-by-line state.')}</div>;
  }
  const rows = matrixRows(value, step);
  if (rows) {
    const shape = kind(value, step, scene.name, replay.roles, replay.topics);
    if (shape === 'points' || shape === 'iv') {
      const pairs = rows.map(row => row.values as number[]);
      if (shape === 'iv') return <TopicPanel view={{ ranges: [{ name: scene.name, pairs }] }} />;
      const plot = pointLayout(pairs);
      const updated = new Set(beat?.grid?.written.map(address => Number(address.split(':')[0])));
      return <svg className="watch-points" viewBox="0 0 300 200" role="img" aria-label={scene.name + ' coordinate plot'}>
        <path d={'M8 ' + plot.axisY + 'H292 M' + plot.axisX + ' 8V192'} />
        {plot.points.map(({ x, y, cx, cy }, i) => <circle key={i} cx={cx} cy={cy} r={5} data-active={updated.has(i)}>
          <title>{'(' + x + ', ' + y + ')'}</title>
        </circle>)}
      </svg>;
    }
    const reads = new Set(beat?.grid?.read), writes = new Set(beat?.grid?.written);
    return <div className="watch-matrix-wrap" ref={host}><table className="watch-matrix" aria-label={scene.name}>
      <thead><tr><th scope="col">Row</th>{rows[0].values.map((_, i) => <th scope="col" key={i}>{i}</th>)}</tr></thead><tbody>
      {rows.map((row, i) => <tr key={i}><th scope="row">{i}</th>{row.values.map((cell, j) => {
        const address = i + ':' + j;
        return <td key={j} data-read={reads.has(address)} data-cue={writes.has(address) ? '' : undefined}>{format(cell)}</td>;
      })}</tr>)}
    </tbody></table></div>;
  }
  if (value.k === 'd' || value.k === 'o') {
    return <div className="watch-table-wrap" ref={host}>
      <table className="watch-table" aria-label={scene.name}>
        <thead><tr><th scope="col">{value.k === 'd' ? 'Key' : 'Field'}</th><th scope="col">Value</th></tr></thead>
        <tbody>{(value.v as [unknown, unknown][]).map(([key, entry], i) => <tr key={i} data-cue={beat?.entries?.includes(key) ? '' : undefined}><th scope="row">{rp(step.H, key)}</th><td>{rp(step.H, entry)}</td></tr>)}</tbody>
      </table>
    </div>;
  }
  return <div ref={host}><ol className="watch-values" aria-label={scene.name}>{value.v.map((entry, i) => <li key={i} data-cue={beat?.entries?.includes(entry) ? '' : undefined}>
    {value.k !== 's' && <span>{i}</span>}<code>{rp(step.H, entry)}</code>
  </li>)}</ol></div>;
}

function LinkedScene({ scene, step, beat, moving, speed, pointers, changes }: {
  scene: Scene; step: Step; beat?: Beat; moving: boolean; speed: number;
  pointers?: Record<string, string[]>; changes?: TopicEvent['nodeLinks'];
}) {
  const host = useRef<HTMLDivElement>(null);
  useCue(host, beat, moving, speed);
  const matching = linkedNodes(step, scene.nodeClass, Boolean(pointers));
  let nodes = matching;
  if (scene.id) {
    const byId = new Map(matching.map(node => [node.id, node]));
    const connected = new Set([scene.id]);
    for (const id of connected) {
      for (const link of byId.get(id)?.links ?? []) connected.add(link.to);
    }
    nodes = matching.filter(node => connected.has(node.id));
  }
  const focus = nodes.findIndex(node => node.id === beat?.link?.from || changes?.[node.id]);
  const first = Math.max(0, focus - 8);
  const shown = nodes.slice(first, first + 18);
  const visible = new Set(shown.map(node => node.id));
  const tree = shown.some(node => node.links.some(link => link.field === 'left' || link.field === 'right'));
  const depth = new Map<string, number>();
  const treeColumns = new Map<string, number>();
  if (tree || pointers) {
    const structuralFields = tree ? ['left', 'right'] : ['next'];
    const children = new Set(shown.flatMap(node => node.links.filter(link => structuralFields.includes(link.field)).map(link => link.to)));
    const walk = (id: string, level: number) => {
      if (depth.has(id) || !visible.has(id)) return;
      depth.set(id, level);
      const links = shown.find(node => node.id === id)?.links;
      structuralFields.forEach((field, position) => {
        const link = links?.find(link => link.field === field);
        if (link) walk(link.to, tree ? level + 1 : 0);
        if (tree && position === 0) treeColumns.set(id, treeColumns.size);
      });
    };
    shown.filter(node => !children.has(node.id)).forEach(node => walk(node.id, 0));
    shown.forEach(node => walk(node.id, 0));
  }
  const rows = new Map<number, string[]>();
  const order = pointers ? [...depth.keys()] : shown.map(node => node.id);
  order.forEach(id => {
    const level = depth.get(id) ?? 0;
    const row = rows.get(level) ?? [];
    row.push(id);
    rows.set(level, row);
  });
  const spacedTree = Boolean(pointers && tree);
  const width = Math.max(170, spacedTree ? treeColumns.size * 76 + 34 : 0, ...[...rows.values()].map(row => row.length * 106 + 34));
  const positions = new Map([...rows].flatMap(([level, row]) => row.map((id, index) =>
    [id, [width / 2 + (spacedTree ? (treeColumns.get(id)! - (treeColumns.size - 1) / 2) * 76 :
      (index - (row.length - 1) / 2) * 106), 65 + level * 82]] as const)));
  const side = beat?.kind === 'compare' && beat.link?.field;
  const origin = side && beat?.link ? positions.get(beat.link.from) : undefined;
  const guide = origin && (side === 'left' || side === 'right') &&
    !shown.find(node => node.id === beat?.link?.from)?.links.some(link => link.field === side)
    ? { x: Math.max(40, Math.min(width - 40, origin[0] + (side === 'left' ? -44 : 44))), y: origin[1] + 62 } : undefined;
  const height = Math.max(135, rows.size * 82 + (spacedTree ? 10 : 36), (guide?.y ?? 0) + 20);
  if (!nodes.length) return <p className="scene-empty">Nodes will appear as they are created.</p>;
  return <div className="linked-scroll" ref={host}>
    <svg className="linked-plot" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Node links">
      <defs><marker id="linked-tip" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7Z" fill="var(--watch-accent)" /></marker></defs>
      {guide && origin && <g className="linked-guide"><line x1={origin[0]} y1={origin[1] + 18} x2={guide.x} y2={guide.y - 12} />
        <text x={guide.x} y={guide.y} textAnchor="middle">{side} Â· empty</text></g>}
      {shown.flatMap(node => node.links.flatMap(link => {
        const end = positions.get(link.to);
        if (!end) return [];
        const [x1, y1] = positions.get(node.id)!, [x2, y2] = end;
        const direction = Math.sign(x2 - x1) || 1;
        const arc = y1 === y2;
        const secondary = link.field === 'random' || link.field === 'prev';
        const rise = pointers && direction < 0 && !secondary ? -76 : secondary ? -52 : -44;
        const straight = pointers && !tree && link.field === 'next' && x2 - x1 === 106;
        const path = node.id === link.to ? `M${x1 - 16} ${y1 - 17} C${x1 - 36} ${y1 - 57} ${x1 + 36} ${y1 - 57} ${x1 + 16} ${y1 - 19}` :
          straight ? `M${x1 + 31} ${y1} H${x2 - 35}` : arc ?
          `M${x1 + direction * 29} ${y1 - 9} Q${(x1 + x2) / 2} ${y1 + rise} ${x2 - direction * 33} ${y2 - 9}` :
          `M${x1} ${y1 + 18} L${x2} ${y2 - 21}`;
        const active = Boolean(changes?.[node.id]?.includes(link.field) || (beat?.link?.from === node.id && beat.link.field === link.field));
        return [<g key={node.id + link.field}>
          <path className="linked-edge" d={path} markerEnd="url(#linked-tip)"
            data-active={active} data-secondary={secondary} data-cue={active ? '' : undefined}><title>{link.field}</title></path>
          {(tree || secondary) && <text className="linked-side" x={(x1 + x2) / 2 + 7} y={arc ? y1 + rise / 2 - 8 : (y1 + y2) / 2 - 4}>{link.field}</text>}
        </g>];
      }))}
      {shown.map(node => {
        const [x, y] = positions.get(node.id)!;
        const names = pointers?.[node.id]?.join(', ');
        const active = Boolean(names || changes?.[node.id] || beat?.link?.from === node.id);
        return <g key={node.id} transform={`translate(${x} ${y})`} className="linked-node" data-active={active} data-cue={active ? '' : undefined}>
          <title>{node.label}</title><rect x="-31" y="-18" width="62" height="36" rx="6" />
          <text textAnchor="middle" dy=".35em">{node.label.length > 7 ? node.label.slice(0, 6) + 'â€¦' : node.label}</text>
          {names && <text className="linked-pointer" textAnchor="middle" y={tree ? -26 : 34}>{names}</text>}
        </g>;
      })}
    </svg>
    {shown.length < nodes.length && <small>{shown.length} of {nodes.length} nodes shown</small>}
  </div>;
}

type Props = {
  active: boolean; replay: Replay | null; index: number; playing: boolean; motion: boolean; speed: number;
  allSteps: boolean; onDetail: (allSteps: boolean) => void;
  onMove: (direction: number) => void; onSeek: (index: number) => void; onPlay: () => void;
  onFullscreen: (fullscreen: boolean) => void;
  onSpeed: (speed: number) => void;
  onWrite: () => void;
  onInterview: () => void;
  onExamples: () => void;
  onPause: () => void;
  onInspect: (output?: boolean) => void;
  showTree: boolean; showStack: boolean; desktop: boolean;
  showVariables: boolean;
  pinned: ReadonlyMap<string, string>; onPin: (id: string, name: string) => void;
  hiddenVariables: ReadonlySet<string>; onHideVariable: (name: string) => void; onRestoreVariables: () => void;
  onTree: () => void; onStack: () => void; onVariables: () => void;
};

export function Watch({ active, replay, index, playing, motion, speed, onMove, onSeek, onPlay, onFullscreen, onSpeed, onWrite, onInterview, onExamples,
  onPause, onInspect, allSteps, onDetail, showTree, showStack, showVariables, pinned, onPin, hiddenVariables, onHideVariable, onRestoreVariables, desktop, onTree, onStack, onVariables }: Props) {
  const surface = useRef<HTMLElement>(null);
  const settings = useRef<HTMLDetailsElement>(null);
  const expand = useRef<HTMLButtonElement>(null);
  const native = useRef(false);
  const requested = useRef(false);
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fitTree, setFitTree] = useState(true);
  const beats = replay?.watch.beats ?? [];
  const lines = useMemo(() => replay?.source.code.split('\n') ?? [], [replay]);
  const scene = replay?.watch.scene;
  const model = replay?.watch.backtracking;
  const topic = replay?.watch.topic;
  const title = replay?.source.title ?? (replay?.source.key === 'my-code' ? topic?.name ?? 'Watch' : replay?.source.key ?? 'Watch');
  const position = beatPosition(beats, index);
  const nearest = beats[position];
  const beat = nearest?.index === index ? nearest : undefined;
  const step = replay?.steps[index];
  const lastLessonDecision = replay?.source.lesson && (beat?.kind === 'output' || step?.done)
    ? beats.findLast(event => event.index <= index && event.topic)
    : undefined;
  const sceneIndex = lastLessonDecision?.index ?? replay?.watch.sceneSteps[index] ?? index;
  const sceneStep = replay?.steps[sceneIndex] ?? step, priorSceneStep = replay?.steps[sceneIndex - 1];
  const topicCue = useMemo(() => beat?.topic ?? lastLessonDecision?.topic ?? (sceneStep && priorSceneStep && allSteps
    ? topic?.traceCue?.(sceneStep, priorSceneStep) : undefined), [beat, lastLessonDecision, sceneStep, priorSceneStep, allSteps, topic]);
  const topicView = useMemo(() => topic && sceneStep ? topic.view(sceneStep, topicCue) : undefined, [topic, sceneStep, topicCue]);
  const topicReady = Boolean(topicView && (scene?.nodeClass || topicView.grid || topicView.heap || topicView.trie ||
    topicView.ranges?.length || topicView.rows?.length || topicView.facts?.length));
  const count = allSteps ? replay?.steps.length ?? 0 : beats.length;
  const first = allSteps ? 0 : beats[0]?.index ?? 0;
  const cursor = allSteps ? index : Math.max(0, position);
  const canPlay = count > 1;
  const done = cursor >= count - 1;
  const canOpenOutput = beat?.kind === 'output' || (done && Boolean(step?.out));
  const decision = beat?.decision ?? (!allSteps && model ? nearest?.decision : undefined);
  const cue = beat?.topic ?? (!allSteps && topic ? nearest?.topic : undefined);
  const operation = cue ? (beat?.topic ? cue.operation : 'Last decision')
    : decision ? (beat?.decision ? decision.kind[0].toUpperCase() + decision.kind.slice(1) : 'Last decision')
    : beat?.kind === 'compare' ? 'Comparison' : beat?.kind === 'swap' ? 'Swap'
    : beat?.kind === 'bounds' ? 'New range' : beat?.kind === 'probe' ? 'Probe'
    : beat?.kind === 'enqueue' || beat?.kind === 'dequeue' ? 'Queue update'
    : beat?.kind === 'call' ? 'Call' : beat?.kind === 'return' ? 'Return'
    : beat?.kind === 'write' ? 'State update' : beat?.kind === 'link' ? 'Link update' : beat?.kind === 'error' ? 'Exception'
    : beat?.kind === 'output' ? 'Output' : done && step?.done ? 'Finished' : allSteps ? 'Execution step' : 'Playback';
  const sourceLine = cue?.line ?? (beat && ['compare', 'swap', 'bounds', 'probe', 'write', 'enqueue', 'dequeue', 'link'].includes(beat.kind)
    ? replay?.steps[index - 1]?.l : allSteps ? replay?.steps[index - 1]?.l : undefined);
  const hasTree = Boolean(replay?.watch.calls.length);
  const showingTree = hasTree && showTree;
  const canZoom = scene?.kind === 'graph' || showingTree;
  const processed = scene?.kind === 'graph' ? beats.slice(0, position + 1).filter(event => event.kind === 'dequeue').map(event => event.node) : [];
  const leave = () => {
    settings.current?.removeAttribute('open');
    const node = surface.current;
    const ownsFullscreen = node && document.fullscreenElement === node;
    native.current = false;
    requested.current = false;
    setFull(false);
    onFullscreen(false);
    if (ownsFullscreen) void document.exitFullscreen().catch(() => {});
    requestAnimationFrame(() => expand.current?.focus());
  };
  const enter = () => {
    const node = surface.current;
    if (!node) return;
    settings.current?.removeAttribute('open');
    requested.current = true;
    setFull(true);
    onFullscreen(true);
    requestAnimationFrame(() => node.focus({ preventScroll: true }));
    void node.requestFullscreen?.().then(() => {
      if (document.fullscreenElement !== node) return;
      if (requested.current) native.current = true;
      else void document.exitFullscreen().catch(() => {});
    }).catch(() => {});
  };
  useEffect(() => { setZoom(1); setFitTree(true); }, [replay?.id]);
  useEffect(() => {
    if (!active) {
      settings.current?.removeAttribute('open');
      return;
    }
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !settings.current?.contains(event.target)) settings.current?.removeAttribute('open');
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [active]);
  useEffect(() => {
    if (!full) return;
    const change = () => {
      if (document.fullscreenElement === surface.current) native.current = true;
      else if (native.current) leave();
    };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); leave(); }
      if (event.key === 'Tab') {
        const controls = [...(surface.current?.querySelectorAll<HTMLElement>(
          '.watch-player [tabindex="0"], .watch-player :is(button, input, select, summary, a[href]):not(:disabled)') ?? [])]
          .filter(element => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        const target = document.activeElement;
        if (!first || !last) return;
        if (event.shiftKey && (target === first || target === surface.current)) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && target === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('fullscreenchange', change);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('fullscreenchange', change);
      document.removeEventListener('keydown', key);
    };
  }, [full, onFullscreen]);

  const caption = <div className="watch-operation" data-error={beat?.kind === 'error'}>
    <div className="operation-label"><i />{operation}{decision ? <span>{decisionLocation(decision)}</span> : sourceLine ? <span>Line {sourceLine}</span> : null}</div>
    <p className="watch-caption" aria-live={playing ? 'off' : 'polite'}>
      {replay ? narrateStep(replay, index, lines) : 'Choose an example or run your own code.'}
    </p>
  </div>;

  return <main className={'watch-player' + (full ? ' watch-fullscreen' : '')} ref={surface} hidden={!active}
    tabIndex={-1} role={full ? 'dialog' : undefined} aria-modal={full || undefined} aria-label="Algorithm player"
    data-sidebar={showVariables || showStack || undefined}>
    <div className="watch-canvas" data-scene={scene?.kind} data-moving={motion}>
      <div className="scene-body">
        <div className="watch-step-panel">
          <h2 className="sr-only">{title}</h2>
          {caption}
        </div>
        <div className="scene-stack">
          {!replay || !scene || !sceneStep ? <p className="scene-empty">Run Python code to start playback.</p> :
            scene.kind === 'array' || scene.kind === 'search' ? <ArrayScene replay={replay} step={sceneStep} beat={beat} moving={motion} speed={speed} /> :
            scene.kind === 'queue' ? <QueueScene queue={sceneStep.H[scene.id!]?.v ?? []} beat={beat} step={sceneStep} moving={motion} speed={speed} /> :
            scene.kind === 'graph' ? <GraphScene scene={scene} step={sceneStep} current={replay.watch.currentNodes.get(index)} processed={processed} beat={beat} moving={motion} speed={speed} zoom={zoom} /> :
            scene.kind === 'linked' ? <LinkedScene scene={scene} step={sceneStep} beat={beat} moving={motion} speed={speed} /> :
            model ? <div className="decision-lesson">
              <DecisionState model={model} index={index} decision={beat?.decision} moving={motion} />
              {showingTree && <div className="decision-tree"><h3>Call tree</h3><CallTree replay={replay} index={index} beat={beat} moving={motion} speed={speed} zoom={zoom} fit={fitTree} /></div>}
            </div> :
            topicView ? <div className="decision-lesson">
              {showingTree ? <div className="decision-tree"><h3>Call tree</h3><CallTree replay={replay} index={index} beat={beat} moving={motion} speed={speed} zoom={zoom} fit={fitTree} /></div> : <>
                {scene.nodeClass && <LinkedScene scene={scene} step={sceneStep} beat={beat} moving={motion} speed={speed}
                  pointers={topicView.nodePointers} changes={topicCue?.nodeLinks} />}
                {topicReady ? <TopicPanel view={topicView} cue={topicCue} motion={motion} speed={speed} showKey /> :
                  <p className="scene-empty">The visual state appears as the program creates values.</p>}
              </>}
            </div> : scene.kind === 'recursion' ? showingTree ? <CallTree replay={replay} index={index} beat={beat} moving={motion} speed={speed} zoom={zoom} fit={fitTree} />
              : <p className="scene-empty">Call tree hidden. The current operation is shown alongside playback.</p> :
            <ValueScene replay={replay} scene={scene} step={sceneStep} beat={beat} moving={motion} speed={speed} />}
          {full && replay && step && [...pinned].filter(([id]) => id !== scene?.id).map(([id, name]) => {
            const object = step.H[id];
            const pinnedScene: Scene = { kind: 'value', id, name };
            return <section key={id} className="pinned-visual" aria-label={`Pinned ${name}`}>
              <header><h3>{name}</h3><button className="button neutral compact" type="button" onClick={() => onPin(id, name)}>Unpin</button></header>
              {!object ? <p className="scene-empty">This value is out of scope at this step.</p> :
                object.label === 'deque' ? <QueueScene queue={object.v} step={step} moving={motion} speed={speed} /> :
                object.k === 'o' && object.c && object.v.some(entry => Array.isArray(entry) && ['next', 'left', 'right'].includes(entry[0])) ?
                  <LinkedScene scene={{ ...pinnedScene, kind: 'linked', nodeClass: object.c }} step={step} moving={motion} speed={speed} /> :
                ['l', 't'].includes(object.k) && object.v.every(isAtom) ?
                  <ArrayScene replay={replay} scene={pinnedScene} step={step} moving={motion} speed={speed} /> :
                  <ValueScene replay={replay} scene={pinnedScene} step={step} moving={motion} speed={speed} />}
            </section>;
          })}
        </div>
      </div>
    </div>
    {(showVariables || showStack) && <aside className="watch-sidebar" aria-label="Playback state">
      {showVariables && <VariableSnapshot key={replay?.id} id="watch-variables" label="Watch variables"
        pinned={pinned} onPin={full ? onPin : undefined}
        step={step} previous={replay?.steps[index - 1]} hiddenVariables={hiddenVariables}
        onHideVariable={onHideVariable} onRestoreVariables={onRestoreVariables} />}
      {showStack && step && <section className="watch-stack-panel" aria-label="Call stack">
        <h3>Call stack</h3>
        <ol className="watch-stack" aria-label="Call stack">
          {step.F.slice().reverse().map((frame, i) => <li key={i}><code>{frame.n === '<module>' ? 'Main program' : frame.n + '()'}</code>{i === 0 && <span>Active</span>}</li>)}
        </ol>
      </section>}
    </aside>}
    <div className="watch-dock playback-controls" role="group" aria-label="Watch playback">
      <div className="watch-transport">
        <button type="button" className="watch-icon watch-step" title={allSteps ? 'Previous step' : 'Previous event'} aria-label={allSteps ? 'Previous step' : 'Previous event'} disabled={!count || index <= first} onClick={() => onMove(-1)}><ChevronLeft /></button>
        <button type="button" className="watch-play" aria-label={playing ? 'Pause' : done && canPlay ? 'Replay' : 'Play'} disabled={!canPlay} onClick={onPlay}>
          {playing ? <Pause /> : done ? <RotateCcw /> : <Play />}
        </button>
        <button type="button" className="watch-icon watch-step" title={allSteps ? 'Next step' : 'Next event'} aria-label={allSteps ? 'Next step' : 'Next event'} disabled={done} onClick={() => onMove(1)}><ChevronRight /></button>
      </div>
      <div className="watch-track">
        <input className="playback-scrubber" type="range" aria-label={allSteps ? 'Watch step' : 'Watch event'} min="0" max={Math.max(1, count - 1)} value={cursor} disabled={!canPlay}
          aria-valuetext={allSteps ? `Step ${cursor} of ${Math.max(0, count - 1)}` : `Highlight ${count ? cursor + 1 : 0} of ${count}`}
          style={{ '--progress': (canPlay ? cursor / (count - 1) * 100 : 0) + '%' } as CSSProperties}
          onChange={event => { const target = Number(event.target.value); onSeek(allSteps ? target : beats[target].index); }} />
        <span className="watch-count">{allSteps ? cursor : count ? cursor + 1 : 0}<span> / {allSteps ? Math.max(0, count - 1) : count}</span></span>
      </div>
      <div className="watch-tools">
        <select className="watch-detail" aria-label="Playback detail" value={allSteps ? 'steps' : 'highlights'} onChange={event => onDetail(event.target.value === 'steps')}>
          <option value="steps">All steps</option><option value="highlights">Highlights</option>
        </select>
        <select className="watch-speed" aria-label="Playback speed" value={speed} onChange={event => onSpeed(Number(event.target.value))}>
          <option value={1000}>Slow</option><option value={560}>Normal</option><option value={240}>Fast</option>
        </select>
        {canZoom && <div className="watch-zoom">
          {showingTree && <button type="button" className="watch-tree-action" aria-label="Fit tree" aria-pressed={fitTree}
            onClick={() => { setFitTree(true); setZoom(1); }}>Fit</button>}
          {showingTree && <button type="button" className="watch-tree-action" aria-label="Follow active call" aria-pressed={!fitTree}
            onClick={() => { setFitTree(false); setZoom(1); }}>Follow</button>}
          <button type="button" className="watch-icon" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .25))}><Minus /></button>
          <button type="button" className="watch-icon" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => {
            if (showingTree) setFitTree(false);
            setZoom(value => Math.min(2, value + .25));
          }}><Plus /></button>
        </div>}
        <button type="button" className="watch-icon fullscreen-variable-toggle" aria-label="Show variables" title="Show variables"
          disabled={!step} aria-pressed={showVariables} aria-controls={showVariables ? 'watch-variables' : undefined}
          onClick={onVariables}><Variable />{desktop && <span>Variables</span>}</button>
        <details className="watch-view" ref={settings} onKeyDown={event => {
          if (event.key !== 'Escape' || !event.currentTarget.open) return;
          event.preventDefault();
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }}>
          <summary className="watch-icon" role="button" aria-label="Playback options" title="Playback options"><Settings2 /></summary>
          <div className="watch-view-menu">
            {replay && <button type="button" className="button neutral compact" onClick={() => { if (full) leave(); onInspect(); }}><ListTree />Inspect this step</button>}
            {canOpenOutput && <button type="button" className="button neutral compact" onClick={() => { if (full) leave(); onInspect(true); }}>View output</button>}
            {hasTree && <label><input type="checkbox" checked={showTree} onChange={onTree} />Call tree</label>}
            <label><input type="checkbox" checked={showStack} onChange={onStack} />Call stack</label>
            {!full && replay && !allSteps && <Prediction key={replay.id} replay={replay} index={index} onPause={onPause} onReveal={() => onMove(1)} />}
            {replay && replay.source.key !== 'my-code' && <a className="button neutral compact" href={replay.source.key.startsWith('interview:') ? '#interview' : '#library'}
              onClick={event => { event.preventDefault(); if (full) leave(); (replay.source.key.startsWith('interview:') ? onInterview : onExamples)(); }}>
              {replay.source.key.startsWith('interview:') ? 'Back to study plan' : 'Back to examples'}</a>}
            <button type="button" className="button neutral compact" onClick={() => { if (full) leave(); onWrite(); }}><CodeXml />Custom code</button>
          </div>
        </details>
        {full ? <button type="button" className="watch-icon watch-exit" aria-label="Exit fullscreen" title="Exit fullscreen (Esc)" onClick={leave}><Minimize />{desktop && <span>Exit</span>}</button> :
          <button ref={expand} type="button" className="watch-icon" aria-label="Fullscreen" title="Fullscreen" disabled={!step} onClick={enter}><Maximize /></button>}
      </div>
    </div>
  </main>;
}
