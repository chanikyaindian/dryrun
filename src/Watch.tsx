import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, CodeXml, ListTree, Maximize, Minimize, Minus, Pause, Play, Plus, RotateCcw, Settings2 } from 'lucide-react';
import { rp } from '../js/views/basic.js';
import { kind, netOf, pointLayout } from '../js/views/structures.js';
import { beatPosition, isAtom, linkedNodes, matrixRows, readIndices, scopeValue, searchState, watchLandmarks, type Beat, type Network, type Scene } from './watchModel';
import type { Replay, Step } from './workspace';
import { Prediction } from './Prediction';
import { DecisionState } from './DecisionState';
import { decisionLocation } from './backtracking';
import { TopicPanel } from './TopicPanel';
import type { TopicEvent } from './topicModel';
import { narrateStep } from './stepNarration';
import { exampleDescription } from './Library';
import { CallTree } from './CallTree';
import { frameVariables } from './Inspector';

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

function ArrayScene({ replay, step, beat, moving, speed, allSteps }: { replay: Replay; step: Step; beat?: Beat; moving: boolean; speed: number; allSteps: boolean }) {
  const { scene } = replay.watch;
  const values = step.H[scene.id!]?.v ?? [];
  const slots = useRef<HTMLDivElement>(null);
  const [lo, hi, pivot] = searchState(step, scene);
  const reads = allSteps && scene.id ? readIndices(step, scene.id) : [];
  const target = scene.target ? scopeValue(step, scene.target) : undefined;
  const [min, max] = useMemo(() => {
    let min = 0, max = 1;
    for (const snapshot of replay.steps) {
      for (const value of snapshot.H[scene.id!]?.v ?? []) {
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    return [min, max];
  }, [replay, scene.id]);
  const bars = scene.kind === 'array' && values.length > 0 && values.every(value => typeof value === 'number' && Number.isFinite(value));
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
  const span = max - min;
  const scale = span === Infinity ? .5 : 1;
  const scaledSpan = max * scale - min * scale;
  const zero = 8 + max * scale / scaledSpan * 84;
  const range = lo !== undefined && hi !== undefined ? [Math.max(0, lo), Math.min(values.length - 1, hi)] : undefined;
  return <div className="array-viewport">
    {target !== undefined && <p className="array-target">Target <code>{rp(step.H, target)}</code></p>}
    <div ref={slots} className={'array-scene' + (bars ? ' bars-scene' : '')} data-moving={moving}
      style={{ '--slots': values.length, '--zero': zero / 100 } as CSSProperties} aria-label={scene.name + ', ' + values.length + ' values'}>
      {values.map((value, index) => {
        const active = Boolean(beat?.cells?.includes(index));
        const outside = range && (index < range[0] || index > range[1]);
        const probe = scene.kind === 'search' && pivot === index && !outside;
        const roles = [range?.[0] === index ? 'low' : '', probe ? 'mid' : '', range?.[1] === index ? 'high' : ''].filter(Boolean);
        const glyph = bars ? {
          height: Math.abs(Number(value) * scale) / scaledSpan * 84 + '%',
          ...(Number(value) < 0 ? { top: zero + '%' } : { bottom: (100 - zero) + '%' }),
        } : undefined;
        return <div key={index} className="array-slot" data-slot={index} data-outside={Boolean(outside)}
          data-active={active || probe} data-read={!active && !probe && reads.includes(index)} data-changed={active && ['swap', 'write'].includes(beat?.kind ?? '')}>
          <div className="glyph-track"><div className="array-glyph" style={glyph}>
            <span title={format(value)}>{isAtom(value) ? format(value) : rp(step.H, value)}</span>
          </div></div>
          <span className="array-index">{index}</span>
          <span className="array-role">{roles.join(' · ')}</span>
        </div>;
      })}
    </div>
  </div>;
}

function GraphScene({ scene, step, current, processed, beat, moving, speed, zoom }: {
  scene: Scene; step: Step; current: unknown; processed: Beat['node'][]; beat?: Beat; moving: boolean; speed: number; zoom: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  useCue(host, beat, moving, speed);
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
  return <div className="graph-scene" ref={host}>
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
    {scene.queue && <QueueScene queue={queue} beat={beat} />}
    {processed.length > 0 && <div className="watch-queue watch-processed" aria-label="Removal order">
      <span>Removal order</span><ol>{processed.slice(-20).map((value, i) => <li key={i}>{format(value)}</li>)}</ol>
    </div>}
  </div>;
}

function QueueScene({ queue, beat }: { queue: unknown[]; beat?: Beat }) {
  return <div className="watch-queue" aria-label="Queue">
      <span>Queue · front on left</span>
      {queue.length ? <ol>{queue.map((value, i) => <li key={i} data-cue={beat?.kind === 'enqueue' && i === queue.length - 1 ? '' : undefined}>{format(value)}</li>)}</ol> :
        <span className="queue-empty">Empty</span>}
      {beat?.kind === 'dequeue' && <small data-cue>Dequeued {format(beat.node)}</small>}
    </div>;
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
  const nodes = linkedNodes(step, scene.nodeClass, Boolean(pointers));
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
        <text x={guide.x} y={guide.y} textAnchor="middle">{side} · empty</text></g>}
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
          <text textAnchor="middle" dy=".35em">{node.label.length > 7 ? node.label.slice(0, 6) + '…' : node.label}</text>
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
  onTree: () => void; onStack: () => void; onVariables: () => void;
};

function WatchVariables({ step, previous }: { step?: Step; previous?: Step }) {
  const [scope, setScope] = useState<number | null>(null);
  const values = frameVariables(step, previous, scope);
  return <section className="watch-variables" aria-label="Watch variables">
    <h3>Variables</h3>
    {step && step.F.length > 1 && <label className="scope-control">Scope
      <select value={scope !== null && scope < step.F.length ? scope : 'current'}
        onChange={event => setScope(event.target.value === 'current' ? null : Number(event.target.value))}>
        <option value="current">Current frame</option>
        {step.F.map((frame, i) => <option key={i} value={i}>{frame.n === '<module>' ? 'Main program' : frame.n + ' · frame ' + (i + 1)}</option>)}
      </select>
    </label>}
    {values.length ? <dl>{values.map(({ name, shown, changed }) => <div key={name}>
      <dt>{changed && <i className="change-dot" aria-label="Changed" />}{name}</dt><dd title={shown}><code>{shown}</code></dd>
    </div>)}</dl> : <p>No variables in this frame yet.</p>}
  </section>;
}

export function Watch({ active, replay, index, playing, motion, speed, onMove, onSeek, onPlay, onFullscreen, onSpeed, onWrite, onInterview, onExamples,
  onPause, onInspect, allSteps, onDetail, showTree, showStack, showVariables, desktop, onTree, onStack, onVariables }: Props) {
  const surface = useRef<HTMLElement>(null);
  const expand = useRef<HTMLButtonElement>(null);
  const native = useRef(false);
  const requested = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const [full, setFull] = useState(false);
  const [revealed, setRevealed] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [fitTree, setFitTree] = useState(true);
  const beats = replay?.watch.beats ?? [];
  const lines = useMemo(() => replay?.source.code.split('\n') ?? [], [replay]);
  const scene = replay?.watch.scene;
  const model = replay?.watch.backtracking;
  const topic = replay?.watch.topic;
  const central = Boolean(model || topic);
  const sceneTitle = scene?.shape === 'points' ? 'Coordinate plot' : scene?.shape === 'iv' ? 'Intervals' :
    scene?.kind === 'search' ? 'Binary search' : scene?.kind === 'queue' ? 'Queue' : scene?.kind === 'graph' ? 'Graph traversal' :
    scene?.kind === 'backtracking' ? 'Backtracking' : scene?.kind === 'recursion' ? 'Recursion' : scene?.kind === 'grid' ? 'Grid' : scene?.kind === 'array' ? 'Array' :
    scene?.kind === 'linked' ? 'Node links' : 'Execution';
  const sampleTitle = replay && replay.source.key !== 'my-code' ? replay.source.title ?? replay.source.key : '';
  const description = replay?.source.description ?? (sampleTitle ? exampleDescription(sampleTitle) : undefined);
  const title = sampleTitle.replace(/ \(backtracking\)$/i, '') || topic?.name || sceneTitle;
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
  const landmarks = useMemo(() => watchLandmarks(replay?.watch.beats ?? []), [replay]);
  const showControls = () => {
    setRevealed(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRevealed(false), 2400);
  };
  const leave = () => {
    const node = surface.current;
    const ownsFullscreen = node && document.fullscreenElement === node;
    native.current = false;
    requested.current = false;
    setFull(false);
    onFullscreen(false);
    window.clearTimeout(timer.current);
    if (ownsFullscreen) void document.exitFullscreen().catch(() => {});
    requestAnimationFrame(() => expand.current?.focus());
  };
  const enter = () => {
    const node = surface.current;
    if (!node) return;
    requested.current = true;
    setFull(true);
    onFullscreen(true);
    showControls();
    requestAnimationFrame(() => node.focus({ preventScroll: true }));
    void node.requestFullscreen?.().then(() => {
      if (document.fullscreenElement !== node) return;
      if (requested.current) native.current = true;
      else void document.exitFullscreen().catch(() => {});
    }).catch(() => {});
  };
  useEffect(() => { setZoom(1); setFitTree(true); }, [replay?.id]);
  useEffect(() => {
    if (!full) return;
    const change = () => {
      if (document.fullscreenElement === surface.current) native.current = true;
      else if (native.current) leave();
    };
    const key = (event: KeyboardEvent) => {
      showControls();
      if (event.key === 'Escape') { event.preventDefault(); leave(); }
      if (event.key === 'Tab') {
        const controls = [...(surface.current?.querySelectorAll<HTMLElement>('.watch-dock :is(button, input, select):not(:disabled)') ?? [])];
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
      window.clearTimeout(timer.current);
    };
  }, [full, onFullscreen]);

  const caption = <div className="watch-operation" data-error={beat?.kind === 'error'}>
    <div className="operation-label"><i />{operation}{decision ? <span>{decisionLocation(decision)}</span> : sourceLine ? <span>Line {sourceLine}</span> : null}</div>
    <p className="watch-caption" aria-live={playing ? 'off' : 'polite'}>
      {replay ? narrateStep(replay, index, lines) : 'Choose an example or run your own code.'}
    </p>
  </div>;

  return <main className={'watch-player' + (full ? ' watch-fullscreen' : '')} ref={surface} hidden={!active}
    tabIndex={full ? -1 : undefined} role={full ? 'dialog' : undefined} aria-modal={full || undefined} aria-label="Algorithm player"
    data-controls={revealed} data-playing={playing} data-all-steps={allSteps} onPointerMove={full ? showControls : undefined} onPointerDown={full ? showControls : undefined}>
    {!full && <aside className="watch-rail" aria-label="Current operation">
      <div className={'watch-heading' + (replay?.source.lesson ? ' interview-watch-heading' : '')}>
        {model && sampleTitle && <span className="watch-topic">Backtracking</span>}
        <h2 tabIndex={-1}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {!desktop && caption}
      {replay && <div className="watch-actions">
        <button type="button" className="button primary compact" onClick={() => onInspect()}><ListTree />Inspect this moment</button>
        {replay.source.key !== 'my-code' && <a className="button neutral compact" href={replay.source.lesson ? '#interview' : '#library'}
          onClick={event => { event.preventDefault(); (replay.source.lesson ? onInterview : onExamples)(); }}>
          {replay.source.lesson ? 'Back to study plan' : 'Back to examples'}</a>}
        {canOpenOutput && (!central || !desktop) && <button type="button" className="button neutral compact" onClick={() => onInspect(true)}>Open printed output</button>}
        <details className="watch-view">
          <summary><Settings2 size={15} />View details</summary>
          {hasTree && <label><input type="checkbox" checked={showTree} onChange={onTree} />Call tree</label>}
          <label><input type="checkbox" checked={showStack} onChange={onStack} />Call stack</label>
          <label><input type="checkbox" checked={showVariables} onChange={onVariables} />Variables</label>
          <small>{hasTree ? 'Call tree and stack settings also apply in Inspect.' : 'Call stack settings also apply in Inspect.'}</small>
        </details>
      </div>}
      {showVariables && <WatchVariables key={'variables:' + replay?.id} step={step} previous={replay?.steps[index - 1]} />}
      {desktop && showStack && step && <ol className="watch-stack" aria-label="Call stack">
        {step.F.slice().reverse().map((frame, i) => <li key={i}><code>{frame.n === '<module>' ? 'Main program' : frame.n + '()'}</code>{i === 0 && <span>Active</span>}</li>)}
      </ol>}
      {active && replay && !allSteps && <Prediction key={replay.id} replay={replay} index={index} onPause={onPause} onReveal={() => onMove(1)} />}
      <button className="button write-python" type="button" onClick={onWrite}><CodeXml />Write Python</button>
    </aside>}
    <div className="watch-canvas" data-scene={scene?.kind} data-moving={motion}>
      {!full && scene && !central && <div className="canvas-label"><span className="plot-mark" aria-hidden="true" />{scene.name === title ? sceneTitle : scene.name}</div>}
      {full && desktop && !central && <div className="fullscreen-operation">{caption}</div>}
      <div className="scene-body">
        <div className="scene-stack">
          {!full && desktop && !central && <div className="watch-stage-operation">{caption}</div>}
          {!replay || !scene || !sceneStep ? <p className="scene-empty">Run Python code to start playback.</p> :
            scene.kind === 'array' || scene.kind === 'search' ? <ArrayScene replay={replay} step={sceneStep} beat={beat} moving={motion} speed={speed} allSteps={allSteps} /> :
            scene.kind === 'queue' ? <QueueScene queue={sceneStep.H[scene.id!]?.v ?? []} beat={beat} /> :
            scene.kind === 'graph' ? <GraphScene scene={scene} step={sceneStep} current={replay.watch.currentNodes.get(index)} processed={processed} beat={beat} moving={motion} speed={speed} zoom={zoom} /> :
            scene.kind === 'linked' ? <LinkedScene scene={scene} step={sceneStep} beat={beat} moving={motion} speed={speed} /> :
            model ? <div className="decision-lesson">
              {desktop && caption}
              <DecisionState model={model} index={index} decision={beat?.decision} moving={motion} />
              {showingTree && <div className="decision-tree"><h3>Call tree</h3><CallTree replay={replay} index={index} beat={beat} moving={motion} speed={speed} zoom={zoom} fit={fitTree} /></div>}
              {!full && desktop && canOpenOutput && <button type="button" className="button neutral compact" onClick={() => onInspect(true)}>Open printed output</button>}
            </div> :
            topicView ? <div className="decision-lesson">
              {desktop && caption}
              {showingTree ? <div className="decision-tree"><h3>Call tree</h3><CallTree replay={replay} index={index} beat={beat} moving={motion} speed={speed} zoom={zoom} fit={fitTree} /></div> : <>
                {scene.nodeClass && <LinkedScene scene={scene} step={sceneStep} beat={beat} moving={motion} speed={speed}
                  pointers={topicView.nodePointers} changes={topicCue?.nodeLinks} />}
                {topicReady ? <TopicPanel view={topicView} cue={topicCue} motion={motion} speed={speed} showKey /> :
                  <p className="scene-empty">The visual state appears as the program creates values.</p>}
              </>}
              {!full && desktop && canOpenOutput && <button type="button" className="button neutral compact" onClick={() => onInspect(true)}>Open printed output</button>}
            </div> : scene.kind === 'recursion' ? showingTree ? <CallTree replay={replay} index={index} beat={beat} moving={motion} speed={speed} zoom={zoom} fit={fitTree} />
              : <p className="scene-empty">Call tree hidden. The current operation is shown alongside playback.</p> :
            <ValueScene replay={replay} scene={scene} step={sceneStep} beat={beat} moving={motion} speed={speed} />}
        </div>
      </div>
    </div>
    <div className="watch-dock" aria-label="Watch playback">
      <button type="button" className="watch-icon watch-step" title={allSteps ? 'Previous step' : 'Previous event'} aria-label={allSteps ? 'Previous step' : 'Previous event'} disabled={!count || index <= first} onClick={() => onMove(-1)}><ChevronLeft /></button>
      <button type="button" className="watch-play" aria-label={playing ? 'Pause' : done && canPlay ? 'Replay' : 'Play'} disabled={!canPlay} onClick={onPlay}>
        {playing ? <Pause /> : done ? <RotateCcw /> : <Play />}
      </button>
      <button type="button" className="watch-icon watch-step" title={allSteps ? 'Next step' : 'Next event'} aria-label={allSteps ? 'Next step' : 'Next event'} disabled={done} onClick={() => onMove(1)}><ChevronRight /></button>
      <input type="range" aria-label={allSteps ? 'Watch step' : 'Watch event'} min="0" max={Math.max(1, count - 1)} value={cursor} disabled={!canPlay}
        style={{ '--progress': (canPlay ? cursor / (count - 1) * 100 : 0) + '%' } as CSSProperties}
        onChange={event => { const target = Number(event.target.value); onSeek(allSteps ? target : beats[target].index); }} />
      <span className="watch-count">{allSteps ? cursor : count ? cursor + 1 : 0}<span> / {allSteps ? Math.max(0, count - 1) : count}</span></span>
      <select className="watch-detail" aria-label="Playback detail" value={allSteps ? 'steps' : 'highlights'} onChange={event => onDetail(event.target.value === 'steps')}>
        <option value="steps">All steps</option><option value="highlights">Highlights</option>
      </select>
      {desktop && landmarks.size > 0 && <select className="watch-landmarks" aria-label="Jump to landmark" value={landmarks.has(index) ? index : ''}
        onChange={event => { if (event.target.value) onSeek(Number(event.target.value)); }}>
        <option value="">Landmarks</option>
        {[...landmarks].map(([at, label]) => <option key={at} value={at}>{label}</option>)}
      </select>}
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
      {full ? <button type="button" className="watch-icon watch-exit" aria-label="Exit fullscreen" title="Exit fullscreen (Esc)" onClick={leave}><Minimize />{desktop && <span>Exit</span>}</button> :
        <button ref={expand} type="button" className="watch-icon" aria-label="Fullscreen" title="Fullscreen" disabled={!step} onClick={enter}><Maximize /></button>}
    </div>
  </main>;
}
