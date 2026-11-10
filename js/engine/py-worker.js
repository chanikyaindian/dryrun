/* Runs inside a dedicated worker in the opaque, network-denied runner. */
(() => {
  const boot = async ({ wasm, stdlib, lock, tracer }) => {
    const base = 'https://dryrun.invalid/';
    const assets = new Map([
      [base + 'pyodide.asm.wasm', [wasm, 'application/wasm']],
      [base + 'python_stdlib.zip', [stdlib, 'application/zip']],
      [base + 'pyodide-lock.json', [lock, 'application/json']],
    ]);
    const nativeFetch = globalThis.fetch;
    globalThis.fetch = async url => {
      const asset = assets.get(String(url));
      if (!asset) throw new TypeError('Network access is disabled');
      return new Response(asset[0], { headers: { 'Content-Type': asset[1] } });
    };
    const Memory = WebAssembly.Memory;
    Object.defineProperty(WebAssembly, 'Memory', {
      value: new Proxy(Memory, {
        construct(target, [options]) {
          return new target({ ...options, maximum: Math.min(options.maximum ?? 4096, 4096) });
        },
      }),
    });
    try {
      const py = await loadPyodide({ indexURL: base, jsglobals: Object.create(null) });
      py.runPython(tracer);
      return py;
    } finally {
      globalThis.fetch = nativeFetch;
      assets.clear();
    }
  };

  self.onmessage = async ({ data }) => {
    self.onmessage = null;
    let py;
    try {
      py = await boot(data);
      postMessage({ type: 'ready', version: py.runPython('sys.version.split()[0]') });
    } catch {
      postMessage({ type: 'unavailable' });
      return;
    }
    self.onmessage = async ({ data: { id, src } }) => {
      self.onmessage = null;
      try {
        py.globals.set('USER_SRC', src);
        postMessage({ type: 'result', id, json: await py.runPythonAsync('await run_trace_async(USER_SRC)') });
      } catch {
        postMessage({ type: 'fail', id });
      } finally {
        self.close();
      }
    };
  };
})();
