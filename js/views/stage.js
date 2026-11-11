import { PN } from '../core.js';
import { drawList, drawCard, drawGraph, isNode, graphCard, resetGraph } from './basic.js';
import { isHeap, kind, drawPoints, drawBits, drawNet, drawGrid, drawIv, heapTree, drawCT, callCard, resetCalls } from './structures.js';

const objs = new Map();

export function drawStage(wrap, step, frame, index, previous, lastViewed, {
  views, roles, topics, tree, speed, focus, relevance, indexNames, scene, withSummary, showSupporting, omitNames = /** @type {string[]} */ ([]), omitReference = /** @type {string | number | undefined} */ (undefined),
}) {
  const frames = step.F.length > 1 ? [step.F[0], frame] : [frame];
  const refs = new Map();
  const add = (id, name) => {
    if (!refs.has(id)) refs.set(id, []);
    if (!refs.get(id).includes(name)) refs.get(id).push(name);
  };
  frames.forEach(f => Object.entries(f.v).forEach(([name, value]) => {
    if (value?.r) add(value.r, name);
    else if (typeof value === 'string' && value.length > 1 && value.length <= 80 && name === focus) {
      const id = 's:' + name;
      step.H[id] = { k: 'l', v: [...value] };
      add(id, name);
    }
  }));
  for (const [id, names] of [...refs]) {
    if (step.H[id].k !== 'o') continue;
    for (const [field, value] of step.H[id].v) {
      const child = step.H[value?.r];
      if (child && child.k !== 'o' && !child.v.some(item => step.H[(Array.isArray(item) ? item[1] : item)?.r]?.k === 'o')) {
        if (!refs.has(value.r)) add(value.r, names[0] + '.' + field);
      }
    }
  }

  const candidates = [...refs].map(([id, names]) => {
    const heap = step.H[id];
    const heapName = names.find(name => isHeap(name, roles));
    const type = heap.k === 'o' ? 'card' : kind(heap, step, heapName || names[0], roles, topics);
    const heapTreeEnabled = type === 'list' && views.heap && heap.v.length > 0 && Boolean(heapName);
    const linked = heap.k === 'o' && (isNode(heap) || heap.v.some(([, value]) => {
      const child = step.H[value?.r];
      return child?.k === 'o' || child?.v.some(item => step.H[(Array.isArray(item) ? item[1] : item)?.r]?.k === 'o');
    }));
    const score = relevance.get(String(id)) ?? 0;
    const primary = String(id) === scene.id || (scene.kind === 'graph' && names.includes(scene.queue));
    const priority = names.includes(focus) ? 5 : String(id) === scene.id || (type === 'net' && score) ? 3 :
      primary ? 2 : score ? 1 + score / (1 + score) : 0;
    return { id, names, heap, type, priority, visible: views[type] && !(linked && views.nodes), heapTreeEnabled };
  }).filter(object => object.id !== omitReference && !object.names.every(name => omitNames.includes(name)) && (object.visible || object.heapTreeEnabled))
    .sort((a, b) => b.priority - a.priority);
  const relevant = candidates.filter(candidate => candidate.priority > 0);
  const ranked = relevant.length || withSummary || relevance.size ? relevant : candidates.slice(0, 1);
  const primaryCount = ranked.filter(candidate => candidate.priority >= 2).length;
  const featuredCount = primaryCount || (withSummary ? 0 : 1);
  const objects = ranked.slice(0, showSupporting ? 8 : featuredCount);

  const asInteger = value => Number.isSafeInteger(value) ? BigInt(value) :
    /^-?\d+$/.test(value?.p ?? '') ? BigInt(value.p) : undefined;
  const bitVariables = views.bits ? Object.entries(frame.v).filter(([name, value]) =>
    /mask|flags|^bits$|^bitset$/i.test(name) && asInteger(value) !== undefined).slice(0, 4) : [];
  const ids = new Set([...objects.map(object => object.id), ...bitVariables.map(([name]) => 'bits:' + name)]);
  for (const [id, element] of objs) {
    if (ids.has(id)) continue;
    element.remove();
    objs.delete(id);
  }
  const pointers = Object.entries(frame.v).filter(([name, value]) => PN.test(name) && Number.isInteger(value) && value >= 0);
  const container = id => {
    let element = objs.get(id);
    if (!element) {
      element = document.createElement('div');
      element.className = 'obj';
      element.dataset.vizId = id;
      objs.set(id, element);
      wrap.append(element);
    }
    return element;
  };
  for (const { id, names, heap, type, priority, heapTreeEnabled } of objects) {
    const element = container(id);
    element.dataset.vizPriority = priority;
    element.classList.toggle('focused-card', names.includes(focus));
    element.toggleAttribute('data-zoomable', type === 'net');
    const label = names.join(', ');
    if (type === 'grid') drawGrid(element, label, heap, step, lastViewed, frame.v);
    else if (type === 'iv') drawIv(element, label, heap, step, frame.v);
    else if (type === 'net') drawNet(element, label, heap, step, frames);
    else if (type === 'points') drawPoints(element, label, heap, step);
    else if (type === 'list') {
      const searchPointers = scene.kind === 'search' ? (String(id) === scene.id
        ? Object.entries(frame.v).filter(([name, value]) => scene.bounds.includes(name) && Number.isInteger(value) && value >= 0)
        : []) : pointers.filter(([name]) => indexNames.get(String(id))?.has(name));
      drawList(element, label, heap, searchPointers, id, step);
      element._row.hidden = !views.list;
      if (heapTreeEnabled) heapTree(element, heap.v, names.some(name => /seg/.test(name)) ? 1 : 0, searchPointers, step.H);
      else element._tr?.remove();
    } else drawCard(element, label, step, heap, lastViewed, id);
  }
  const previousFrame = previous?.F.at(-1);
  for (const [name, value] of bitVariables) {
    const priorValue = previousFrame?.n === frame.n ? asInteger(previousFrame.v[name]) : undefined;
    const element = container('bits:' + name);
    element.classList.toggle('focused-card', name === focus);
    drawBits(element, name, asInteger(value), priorValue);
  }

  if (views.nodes) drawGraph(wrap, step, frames, speed);
  else if (graphCard()) graphCard().style.display = 'none';
  const focusedNode = [...refs].find(([, names]) => names.includes(focus));
  const graph = graphCard();
  if (graph) {
    const focused = Boolean(focusedNode && step.H[focusedNode[0]]?.k === 'o');
    graph.dataset.vizPriority = focused ? '5' : '3';
    graph.classList.toggle('focused-card', focused);
  }
  if (views.calls) drawCT(wrap, tree, index);
  else if (callCard()) callCard().style.display = 'none';
  const stageIsEmpty = !ids.size && (!graphCard() || graphCard().style.display === 'none') && (!callCard() || callCard().style.display === 'none');
  wrap.classList.toggle('void', stageIsEmpty);
  return Math.max(0, Math.min(ranked.length, 8) - featuredCount);
}

export function resetStage(wrap) {
  wrap.replaceChildren();
  wrap.classList.add('void');
  objs.clear();
  resetGraph();
  resetCalls();
}
