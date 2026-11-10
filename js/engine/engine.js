import { run } from './js-engine.js';
import { createPythonRunner } from './python-runner.js';
import { parseTrace } from './trace-boundary.js';

/* Samples start immediately. Custom snippets always run on the Python runtime. */
export const Engine = {
  ready: false, worker: null, starting: null, active: null, request: 0, queue: Promise.resolve(),
  status: 'Starting Python…', listeners: new Set(),
  badge(text) {
    this.status = text;
    for (const listener of this.listeners) listener();
  },
  subscribe(listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  },
  reset(worker, unavailable = true) {
    worker.terminate();
    if (this.worker !== worker) return;
    this.worker = this.starting = null;
    this.ready = false;
    if (unavailable) this.badge('Python unavailable');
  },
  init() {
    if (this.starting) return this.starting;
    const startup = new Promise((resolve, reject) => {
      const worker = createPythonRunner();
      this.worker = worker;
      this.badge('Starting Python…');
      const fail = (message) => {
        if (this.worker !== worker) return;
        clearTimeout(timer);
        if (this.active) this.active.finish(Error(message));
        else this.reset(worker);
        reject(Error(message));
      };
      const timer = setTimeout(() => fail('Python took too long to start. Select Run to retry.'), 75000);
      worker.onerror = () => fail('Could not load the Python runtime. Select Run to retry.');
      worker.onmessage = ({ data }) => {
        if (this.worker !== worker || !data || typeof data !== 'object') return;
        if (data.type === 'ready' && !this.ready && typeof data.version === 'string' && /^\d+\.\d+\.\d+$/.test(data.version)) {
          clearTimeout(timer);
          this.ready = true;
          this.badge('CPython ' + data.version);
          resolve(worker);
        } else if (data.type === 'unavailable') {
          fail('Could not load the Python runtime. Select Run to retry.');
        } else if (this.active && this.active.id === data.id) {
          if (data.type === 'result') this.active.finish(null, data.json);
          if (data.type === 'oversized') this.active.finish(Error('The trace exceeded the size limit. Try a smaller input.'));
          if (data.type === 'fail') this.active.finish(Error('The Python runtime could not complete this run.'));
        }
      };
    });
    this.starting = startup;
    startup.catch(() => {
      if (this.starting === startup) {
        this.starting = null;
        this.badge('Python unavailable');
      }
    });
    return startup;
  },
  async run(source, { sample = false } = {}) {
    if (typeof source !== 'string' || source.length > 128 * 1024) throw Error('Python source is limited to 131,072 characters.');
    const id = ++this.request;
    if (sample && !this.ready) return run(source);
    const task = this.queue.then(async () => {
      if (id !== this.request) return null;
      const worker = await this.init();
      if (id !== this.request) return null;
      const json = await new Promise((resolve, reject) => {
        const finish = (error, result) => {
          clearTimeout(timer);
          this.active = null;
          this.reset(worker, false);
          error ? reject(error) : resolve(result);
        };
        const timer = setTimeout(() => {
          finish(Error('Execution stopped after 8 seconds. Edit the snippet or select Run to try again.'));
        }, 8000);
        this.active = { id, finish };
        try { worker.postMessage({ id, src: source }); }
        catch (error) { finish(error); }
      });
      return parseTrace(json);
    });
    this.queue = task.catch(() => {});
    return task;
  }
};
