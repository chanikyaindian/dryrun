import workerSource from './py-worker.js?raw';
import tracerUrl from '../../py/tracer.py?url&no-inline';

export const runtimeUrl = 'https://cdn.jsdelivr.net/pyodide/v0.29.5/full/';
const integrity = {
  'pyodide.js': 'sha256-f4MqNQJAJj2ZRqnDyHf3vNq2w31txl9yzTvlkF3KYt0=',
  'pyodide.asm.js': 'sha256-NWxC9p4WlTl+nYZwvTwuZ4JIzeduGL2uFzHoSFN7R9c=',
  'pyodide.asm.wasm': 'sha256-VDCaWiz9dXsfD9vJCTySUD97NBUAEQMp2TJIcYORJxg=',
  'python_stdlib.zip': 'sha256-gx/R5TUIS5cvh8ajUnXePSNu/VFm9ed86JSXcQY15zw=',
  'pyodide-lock.json': 'sha256-FNLC26EBJ3mZ4XE15lPY8VOJrRQ39T6uITvww83/cj0=',
};
let loading;

async function load(url, hash, binary = false) {
  const response = await fetch(url, {
    integrity: hash, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw Error('Python asset unavailable');
  return binary ? response.arrayBuffer() : response.text();
}

function runtimeAssets() {
  if (loading) return loading;
  const files = Object.entries(integrity).map(([file, hash]) =>
    load(runtimeUrl + file, hash, !file.endsWith('.js')));
  loading = Promise.all([...files, load(tracerUrl)]).then(([loader, asm, wasm, stdlib, lock, tracer]) => ({
    script: [loader, asm, workerSource].join('\n'), wasm, stdlib, lock, tracer,
  })).catch(error => {
    loading = undefined;
    throw error;
  });
  return loading;
}

export function createPythonRunner() {
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.title = 'Isolated Python runtime';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  frame.src = new URL(import.meta.env.BASE_URL + 'python-runner.html', document.baseURI).href;

  const { port1, port2 } = new MessageChannel();
  let terminated = false;
  const runner = {
    onmessage: null,
    onerror: null,
    postMessage(data) { port1.postMessage(data); },
    terminate() {
      terminated = true;
      port1.close();
      port2.close();
      frame.remove();
    },
  };

  port1.onmessageerror = () => runner.onerror?.();
  frame.onerror = () => runner.onerror?.();
  runtimeAssets().then(assets => {
    if (terminated) return;
    port1.onmessage = event => {
      if (event.data?.type === 'connected') {
        port1.onmessage = message => runner.onmessage?.(message);
        port1.postMessage(assets);
      }
    };
    frame.addEventListener('load', () => {
      if (terminated) return;
      try {
        frame.contentWindow.postMessage('dryrun-init', '*', [port2]);
      } catch {
        runner.onerror?.();
      }
    }, { once: true });
    document.body.append(frame);
  }).catch(() => {
    if (!terminated) runner.onerror?.();
  });

  return runner;
}
