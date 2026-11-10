# dryrun

dryrun replays Python data structure and algorithm snippets in the browser. Pick an example or paste your own code, then play, step, or drag the timeline to inspect changes.

## Run locally

Use Node.js 22.12 or newer and install the frontend dependencies.

    npm ci
    npm run dev

Open the URL printed by Vite. Run `npm run build` for a static site in `dist/` and `npm run preview` to check that build locally. A development or production server serves the worker and Python tracer over HTTP.

## Using dryrun

- **Examples** is the starting screen. Search by algorithm, filter by topic, or open a featured replay. Browser Back restores the catalog filters during the current session.
- **Write** opens your local draft. Paste code or open a `.py` file. Download a copy from the same screen. Use **Run and watch** or **Ctrl+Enter** (**Cmd+Enter** on macOS). Enable **Live run** to rerun after edits. The prior replay remains available while you edit or fix syntax errors.
- **Watch** opens after Run and follows meaningful events such as comparisons, swaps, changes to the search range, queue operations, table updates, and node relinking. Use the playback strip to step, scrub, or adjust speed. Open **Write Python** to edit your local draft.
- **Fullscreen** fills the display with the current visualization. Move the pointer, tap, or press a key to reveal playback controls. Use **Esc** or **Exit fullscreen** to return to the same event and zoom.
- Use **Predict next** when it appears to make a prediction and reveal the next recorded event.
- Open **Inspect** to see the exact source from the run, variables, call frames, output, and every executed line. **Find line** jumps between visits to an executed line. Switching between Watch and Inspect keeps the trace position.
- Drag the desktop dividers or focus one and press the arrow keys to resize. On smaller screens, switch between **Code**, **Visualize**, and **Inspect**. Choose a preset under **View** or adjust individual options.
- Step with the timeline or the arrow keys, and press Space to play or pause outside controls. The event menu jumps to calls, output, and exceptions. Turn off **Follow execution** to read a different part of the program during playback.
- Select a visualizable variable to bring its card into view. Use the grip or move buttons to reorder cards for the current replay. Drag diagrams to pan, or use the arrow keys when the diagram has focus. Use **+**, **−**, and **Fit** to adjust the view.

## Execution and playback

- Custom code runs on CPython 3.13.2 via Pyodide 0.29.5 in a Web Worker. Examples use the bundled Python-subset interpreter while Pyodide starts or if it is unavailable.
- Async snippets can use top-level `await main()` on the worker's event loop. A nested `asyncio.run()` call raises a runtime error.
- The tracer records executed lines, scopes, object snapshots, output, function calls and returns, and exceptions. Scrubbing replays snapshots. Syntax and compilation errors identify the offending line and column.
- Pattern suggestions combine AST signals, source names, and observed changes. The stage uses object shapes and role hints to choose its visualizations.

## Security and limits

Custom snippets run in a fresh worker inside an opaque-origin iframe. The runner’s Content Security Policy denies network access. The app fetches the pinned Pyodide files from jsDelivr without credentials and checks their SHA-256 integrity before passing them into the runner. The runner receives the snippet over a private message channel, and the app validates the trace before rendering it. Drafts are saved in the browser's local storage.

The tracer allowlists common standard-library modules and restricts file access, interactive input, and dynamic execution builtins. Browser isolation enforces the runner’s privileges separately from those Python restrictions. The runtime heap is capped at 256 MiB, a run at eight seconds, and a trace at 4,000 recorded steps plus its final snapshot. The app also bounds source and trace payload sizes. Examples can still use the bundled interpreter when the Python download is unavailable.

Vite dev and preview serve security headers. The Render Blueprint in `render.yaml` configures the production headers, including HSTS for HTTPS. The static build includes CSP in both HTML documents, and hosts serving `dist/` should add the response-only protections separately. Serve the app document with `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`. Serve `python-runner.html` with `Content-Security-Policy: frame-ancestors 'self'; sandbox allow-scripts` and `X-Frame-Options: SAMEORIGIN` so Dryrun can embed its own runner. Apply `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and the permissions policy in `vite.config.ts` on both routes. If you edit the inline runner broker, update its CSP SHA-256 hash to match the exact script.

## Project layout

| Path | Role |
| --- | --- |
| `src/` | React workspace, Watch scenes and event selection, CodeMirror editor, and playback state |
| `py/tracer.py` | CPython tracing, snapshot encoding, and AST signals |
| `js/engine/` | Worker lifecycle and example fallback interpreter |
| `js/detect/` | Pattern scoring and evidence |
| `js/views/` | Trace renderers and visualization interactions |

## Tests

    python -B -m unittest discover -s py -v
    npx playwright install chromium
    npm test

Set `PLAYWRIGHT_CHANNEL=chrome` to use an installed Chrome browser. Set `DRYRUN_PREVIEW=1` after building to test the production bundle. The browser suite includes a real Python worker run and needs access to the Pyodide CDN for that test.
