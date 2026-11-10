const maxTraceLength = 24 * 1024 * 1024;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const scalar = value => value === null || ['string', 'number', 'boolean'].includes(typeof value);
const strings = (value, limit) => Array.isArray(value) && value.length <= limit && value.every(item => typeof item === 'string');
const optionalText = value => value === undefined || typeof value === 'string';

function snapshot(step) {
  if (!record(step) || !integer(step.l) || typeof step.out !== 'string' || step.out.length > 8200 ||
      !Array.isArray(step.F) || !step.F.length || step.F.length > 180 || !record(step.H) ||
      !strings(step.rd, 4000) || ![step.c, step.rv, step.error, step.handled].every(optionalText)) return false;
  if (step.exc !== undefined && (!record(step.exc) || typeof step.exc.name !== 'string' || typeof step.exc.message !== 'string')) return false;
  if (step.syntax !== undefined && (!record(step.syntax) || ['column', 'endLine', 'endColumn'].some(key =>
    step.syntax[key] != null && !Number.isSafeInteger(step.syntax[key])))) return false;

  const heap = Object.setPrototypeOf(step.H, null);
  function value(item) {
    if (scalar(item)) return true;
    if (!record(item)) return false;
    if (Object.hasOwn(item, 'r')) return Object.keys(item).length === 1 && integer(item.r) && Object.hasOwn(heap, item.r);
    if (Object.hasOwn(item, 'p')) return Object.keys(item).length === 1 && typeof item.p === 'string';
    return typeof item.f === 'string' && Object.keys(item).every(key => key === 'f' || key === 'c') &&
      (item.c === undefined || item.c === 0 || item.c === 1);
  }
  const objects = Object.entries(heap);
  if (objects.length > 200 || !objects.every(([key, item]) =>
    /^[1-9]\d*$/.test(key) && record(item) && ['d', 'o', 'l', 't', 's'].includes(item.k) &&
    (item.k === 'o' ? typeof item.c === 'string' : optionalText(item.c)) && optionalText(item.label) && Array.isArray(item.v) && item.v.length <= 80 &&
    item.v.every(entry => item.k === 'd' || item.k === 'o' ?
      Array.isArray(entry) && entry.length === 2 && (item.k === 'o' ? typeof entry[0] === 'string' : scalar(entry[0])) && value(entry[1]) : value(entry))
  )) return false;
  return step.F.every(frame =>
    record(frame) && typeof frame.n === 'string' && strings(frame.a, 256) && record(frame.v) &&
    Object.values(Object.setPrototypeOf(frame.v, null)).every(value));
}

export function parseTrace(json) {
  const invalid = () => Error('The Python runtime returned an invalid or oversized trace.');
  if (typeof json !== 'string' || json.length > maxTraceLength) throw invalid();
  let data;
  try {
    data = JSON.parse(json, (_, value) => {
      if (record(value) && Object.keys(value).length === 1 && Object.hasOwn(value, '$')) {
        if (value.$ === 'inf') return Infinity;
        if (value.$ === '-inf') return -Infinity;
        if (value.$ === 'nan') return NaN;
      }
      return value;
    });
  } catch {
    throw invalid();
  }
  if (!record(data)) throw invalid();
  const { steps, evs, feat } = data;
  if (!Array.isArray(steps) || !steps.length || steps.length > 4001 || !steps.every(snapshot) ||
      !Array.isArray(evs) || evs.length > 16000 || !evs.every(event =>
        record(event) && ['c', 'r'].includes(event.t) && integer(event.s) && event.s <= steps.length &&
        (event.t === 'c' ? typeof event.lab === 'string' : optionalText(event.lab)) && optionalText(event.rv)) || !strings(feat, 1024)) throw invalid();
  steps.evs = evs;
  steps.feat = feat;
  return steps;
}
