import workerSource from './py-worker.js?raw';
import tracerUrl from '../../py/tracer.py?url&no-inline';

export const runtimeUrl = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const integrity = {
  'pyodide.js': 'sha256-wAaRB2IdW5QqZZ5zehLndMwEUf6qIlb0ddcuBx2ETsc=',
  'pyodide.asm.js': 'sha256-kZVgZS7T2tNwfLOjlHhdoeBG+xPcDe+hYgWP8jDLfu0=',
  'pyodide.asm.wasm': 'sha256-t+ZqGUJ6VQEKwzZ8G2xkuJP5gm94NBKUX98MMzfzvJQ=',
  'python_stdlib.zip': 'sha256-colFIreRhYudYTrHhrlR2LUJQDXc83YxPqJKRmgQ8zY=',
  'pyodide-lock.json': 'sha256-zVC0nelExXkEXhIv6GKLMfnORGN58DLzbAXic9OHZuA=',
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

  port1.onmessage = event => runner.onmessage?.(event);
  port1.onmessageerror = () => runner.onerror?.();
  frame.onerror = () => runner.onerror?.();
  frame.addEventListener('load', () => {
    if (!terminated) frame.contentWindow.postMessage('dryrun-init', '*', [port2]);
  }, { once: true });

  runtimeAssets().then(assets => {
    if (terminated) return;
    document.body.append(frame);
    port1.postMessage(assets);
  }).catch(() => {
    if (!terminated) runner.onerror?.();
  });

  return runner;
}
