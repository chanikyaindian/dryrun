import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';

export function createStageControls(stage, announce, onInteract, onHidden) {
  const order = [];
  const hidden = new Map();
  const positions = new Map();
  const fitting = new Set();
  const observers = new Map();
  const panModes = new Map();
  const viewports = new Map();
  let customOrder = false;
  let drag = null;
  let dragFrame = 0;

  const available = () => [...stage.children].filter(card => card.dataset.vizId && card.style.display !== 'none');
  const cards = () => available().filter(card => !card.hidden);
  const orderedIds = () => cards().map(card => card.dataset.vizId);
  const titleOf = card => card.querySelector('.hd')?.textContent || 'Visualization';
  function arrange() {
    const byId = new Map(cards().map(card => [card.dataset.vizId, card]));
    for (const { dataset: { vizId } } of available()) if (!order.includes(vizId)) order.push(vizId);
    const arranged = customOrder ? order.map(id => byId.get(id)).filter(Boolean) :
      [...byId.values()].sort((a, b) => Number(b.dataset.vizPriority || 0) - Number(a.dataset.vizPriority || 0));
    if (!customOrder) order.splice(0, order.length, ...arranged.map(card => card.dataset.vizId));
    let cursor = stage.firstElementChild;
    for (const card of arranged) {
      while (cursor && (cursor.hidden || cursor.style.display === 'none')) cursor = cursor.nextElementSibling;
      if (card !== cursor) stage.insertBefore(card, cursor);
      cursor = card.nextElementSibling;
    }
    arranged.forEach((card, index) => {
      card.querySelector('[data-action="up"]').disabled = index === 0;
      card.querySelector('[data-action="down"]').disabled = index === arranged.length - 1;
      card.querySelector('[data-action="drag"]').disabled = arranged.length === 1;
      card.toggleAttribute('data-draggable', arranged.length > 1);
    });
    stage.classList.toggle('void', arranged.length === 0);
    stage.classList.toggle('single-card', arranged.length === 1);
    stage.toggleAttribute('data-hidden-cards', hidden.size > 0);
  }

  function move(id, target) {
    if (!target || id === target) return;
    customOrder = true;
    const destination = order.indexOf(target);
    order.splice(order.indexOf(id), 1);
    order.splice(destination, 0, id);
    arrange();
    const card = cards().find(card => card.dataset.vizId === id);
    announce(card.querySelector('.hd')?.textContent + ' moved to position ' + (orderedIds().indexOf(id) + 1));
  }

  function button(action, label, symbol) {
    const control = document.createElement('button');
    control.type = 'button';
    control.dataset.action = action;
    control.title = label;
    control.setAttribute('aria-label', label);
    control.textContent = symbol;
    return control;
  }

  function attachZoom(card, svg) {
    const id = card.dataset.vizId;
    const viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';
    if (!panModes.has(id)) panModes.set(id, !window.matchMedia('(pointer: coarse)').matches);
    viewport.classList.toggle('panning', panModes.get(id));
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'group');
    viewport.setAttribute('aria-label', 'Diagram. Use arrow keys to pan, plus or minus to zoom, or Home to fit.');
    svg.before(viewport);
    viewport.append(svg);

    const behavior = zoom().scaleExtent([.015, 5])
      .filter(event => event.type === 'wheel' ? event.ctrlKey || event.metaKey : panModes.get(id) && !event.button)
      .on('start', ({ sourceEvent }) => { if (sourceEvent) { fitting.delete(id); onInteract(); } })
      .on('zoom', ({ transform }) => {
        positions.set(id, transform);
        svg.style.transform = 'translate(' + transform.x + 'px,' + transform.y + 'px) scale(' + transform.k + ')';
      });
    const surface = select(viewport).call(behavior).on('dblclick.zoom', null);
    const fit = () => {
      fitting.add(id);
      if (!viewport.clientWidth || !viewport.clientHeight) return;
      const width = Number(svg.getAttribute('width')) || 300;
      const height = Number(svg.getAttribute('height')) || 150;
      const max = stage.classList.contains('single-card') ? 1.4 : 1;
      const scale = Math.max(.015, Math.min(max, (viewport.clientWidth - 24) / width, (viewport.clientHeight - 20) / height));
      surface.call(behavior.transform, zoomIdentity.translate(
        (viewport.clientWidth - width * scale) / 2, (viewport.clientHeight - height * scale) / 2).scale(scale));
    };
    if (positions.has(id) && !fitting.has(id)) surface.call(behavior.transform, positions.get(id));
    else fit();
    observers.get(id)?.disconnect();
    const observer = new ResizeObserver(() => { if (fitting.has(id)) fit(); });
    observers.set(id, observer);
    observer.observe(viewport);
    viewport.addEventListener('keydown', event => {
      const moves = { ArrowLeft: [30, 0], ArrowRight: [-30, 0], ArrowUp: [0, 30], ArrowDown: [0, -30] };
      if (moves[event.key]) {
        const scale = (positions.get(id) ?? zoomIdentity).k;
        surface.call(behavior.translateBy, moves[event.key][0] / scale, moves[event.key][1] / scale);
      } else if (event.key === '+' || event.key === '=') surface.call(behavior.scaleBy, 1.2);
      else if (event.key === '-') surface.call(behavior.scaleBy, 1 / 1.2);
      else if (event.key === 'Home') fit();
      else return;
      if (event.key !== 'Home') fitting.delete(id);
      onInteract();
      event.stopPropagation();
      event.preventDefault();
    });
    const pan = () => {
      const enabled = !panModes.get(id);
      panModes.set(id, enabled);
      viewport.classList.toggle('panning', enabled);
      card.querySelector('[data-action="pan"]').setAttribute('aria-pressed', String(enabled));
    };
    const scaleBy = factor => { fitting.delete(id); surface.call(behavior.scaleBy, factor); };
    viewports.set(id, { fit, pan, zoomIn: () => scaleBy(1.2), zoomOut: () => scaleBy(1 / 1.2) });
  }

  function refresh() {
    const mounted = new Set([...stage.children].map(card => card.dataset.vizId));
    for (const [id, observer] of observers) if (!mounted.has(id)) {
      observer.disconnect();
      observers.delete(id);
      viewports.delete(id);
    }
    for (const card of available()) {
      card.hidden = hidden.has(card.dataset.vizId);
      const zoomable = card.hasAttribute('data-zoomable');
      const svg = zoomable && card.querySelector(':scope > svg');
      if (svg && !card.hidden) attachZoom(card, svg);
      let tools = card.querySelector(':scope > .card-actions');
      if (!tools || tools.hasAttribute('data-zoom-actions') !== zoomable) {
        tools?.remove();
        tools = document.createElement('div');
        tools.className = 'card-actions';
        tools.toggleAttribute('data-zoom-actions', zoomable);
        if (zoomable) {
          const pan = button('pan', 'Pan diagram', 'Pan');
          pan.setAttribute('aria-pressed', String(panModes.get(card.dataset.vizId)));
          tools.append(pan, button('zoomOut', 'Zoom out', '−'), button('zoomIn', 'Zoom in', '+'), button('fit', 'Fit diagram', 'Fit'));
        }
        tools.append(button('up', 'Move card up', '↑'), button('down', 'Move card down', '↓'),
          button('drag', 'Drag card to reorder', '⠿'), button('hide', 'Hide visualization', '×'));
        card.append(tools);
      }
    }
    arrange();
  }

  function click(event) {
    const control = event.target.closest('[data-action]');
    const id = control?.closest('[data-viz-id]')?.dataset.vizId;
    if (!id) return;
    onInteract();
    const action = control.dataset.action;
    const ids = orderedIds();
    if (action === 'hide') {
      const card = control.closest('[data-viz-id]');
      hidden.set(id, titleOf(card));
      card.hidden = true;
      arrange();
      onHidden([...hidden]);
      announce(titleOf(card) + ' hidden');
      stage.focus({ preventScroll: true });
    } else if (action === 'up' || action === 'down') {
      move(id, ids[ids.indexOf(id) + (action === 'up' ? -1 : 1)]);
      if (control.disabled) control.closest('.card-actions').querySelector(action === 'up' ? '[data-action="down"]' : '[data-action="up"]').focus({ preventScroll: true });
      else control.focus({ preventScroll: true });
    } else viewports.get(id)?.[action]?.();
  }

  function pointerDown(event) {
    const handle = event.target.closest('[data-action="drag"]');
    const header = event.target.closest('.hd');
    const card = (handle ?? header)?.closest('[data-draggable]');
    if (!card || card.parentElement !== stage || handle?.disabled || event.button !== 0) return;
    onInteract();
    event.preventDefault();
    handle?.focus({ preventScroll: true });
    drag = { card, pointer: event.pointerId, target: null, x: event.clientX, y: event.clientY };
    stage.setPointerCapture(event.pointerId);
    card.classList.add('dragging-card');
  }
  function pointerMove(event) {
    if (drag?.pointer !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    updateTarget();
    if (!dragFrame) dragFrame = requestAnimationFrame(scrollNearEdge);
  }
  function updateTarget() {
    const candidate = document.elementFromPoint(drag.x, drag.y)?.closest('[data-viz-id]');
    const target = candidate && candidate.parentElement === stage && candidate !== drag.card ? candidate : null;
    if (target === drag.target) return;
    drag.target?.classList.remove('drop-card');
    target?.classList.add('drop-card');
    drag.target = target;
  }
  function scrollNearEdge() {
    dragFrame = 0;
    if (!drag) return;
    const box = stage.getBoundingClientRect();
    const zone = 32;
    if (drag.x < box.left || drag.x > box.right || drag.y < box.top - zone || drag.y > box.bottom + zone) return;
    const offset = drag.y < box.top + zone ? -10 : drag.y > box.bottom - zone ? 10 : 0;
    if (!offset) return;
    const before = stage.scrollTop;
    stage.scrollTop += offset;
    updateTarget();
    if (before !== stage.scrollTop) dragFrame = requestAnimationFrame(scrollNearEdge);
  }
  function pointerEnd(event) {
    if (drag?.pointer !== event.pointerId) return;
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    const { card, target } = drag;
    card.classList.remove('dragging-card');
    target?.classList.remove('drop-card');
    drag = null;
    if (event.type === 'pointerup' && target) move(card.dataset.vizId, target.dataset.vizId);
  }

  const handlers = { click, pointerdown: pointerDown, pointermove: pointerMove, pointerup: pointerEnd, pointercancel: pointerEnd, lostpointercapture: pointerEnd };
  for (const [type, listener] of Object.entries(handlers)) stage.addEventListener(type, listener);
  return {
    refresh,
    restore(id) {
      const title = hidden.get(id);
      if (!title) return;
      hidden.delete(id);
      onHidden([...hidden]);
      refresh();
      announce(title + ' restored');
      stage.focus({ preventScroll: true });
    },
    reset() {
      customOrder = false;
      order.length = 0; positions.clear(); panModes.clear(); viewports.clear(); drag = null;
      for (const observer of observers.values()) observer.disconnect();
      observers.clear(); fitting.clear();
      if (hidden.size) { hidden.clear(); onHidden([]); }
      cancelAnimationFrame(dragFrame); dragFrame = 0;
    },
    destroy() {
      for (const [type, listener] of Object.entries(handlers)) stage.removeEventListener(type, listener);
      positions.clear(); panModes.clear(); viewports.clear();
      for (const observer of observers.values()) observer.disconnect();
      observers.clear(); fitting.clear();
      cancelAnimationFrame(dragFrame);
    },
  };
}
