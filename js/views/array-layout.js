const lastFocus = new WeakMap();

// Move only the array's scrollport. ScrollIntoView can also move the canvas and its caption.
export function followArrayFocus(scrollport, start, end, active) {
  const key = active ? [start?.offsetLeft, end?.offsetLeft, active.offsetLeft, scrollport.clientWidth].join(':') : '';
  if (lastFocus.get(scrollport) === key) return false;
  lastFocus.set(scrollport, key);
  if (!active || scrollport.scrollWidth <= scrollport.clientWidth) return false;

  const width = scrollport.clientWidth;
  const rangeStart = Math.min(start?.offsetLeft ?? active.offsetLeft, active.offsetLeft);
  const rangeEnd = Math.max(end ? end.offsetLeft + end.offsetWidth : 0, active.offsetLeft + active.offsetWidth);
  const fits = rangeEnd - rangeStart <= width - 12;
  const left = fits ? rangeStart : active.offsetLeft;
  const right = fits ? rangeEnd : active.offsetLeft + active.offsetWidth;
  const previous = scrollport.scrollLeft;
  if (left < previous + 6 || right > previous + width - 6) {
    scrollport.scrollLeft = Math.max(0, (left + right - width) / 2);
  }
  return scrollport.scrollLeft !== previous;
}

export function barLayout(min, max) {
  const scale = Math.max(Math.abs(min), Math.abs(max), 1);
  const span = max / scale - min / scale || 1;
  const zero = max === 0 && min === 0 ? 96 : 4 + 92 * (max / scale) / span;
  return { zero, height: value => 92 * Math.abs(value / scale) / span };
}
