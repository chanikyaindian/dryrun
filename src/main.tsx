import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Group, Panel, Separator, type GroupImperativeHandle, type Layout, type PanelImperativeHandle } from 'react-resizable-panels';
import { Activity, BookOpen, ChevronDown, CircleAlert, CodeXml, FlaskConical, Focus, LayoutPanelTop, ListTree, Maximize, Minimize, Moon, PanelBottomOpen, PanelTopClose, PanelTopOpen, Settings2, Sun, Variable, X } from 'lucide-react';
import { Engine } from '../js/engine/engine.js';
import { SAMPLES } from '../js/samples.js';
import { diffs } from '../js/views/basic.js';
import { narrateStep } from './stepNarration';
import { Inspector, type InspectionTab } from './Inspector';
import { VariableSnapshot } from './VariableSnapshot';
import { Stage } from './Stage';
import { Timeline } from './Timeline';
import { Watch } from './Watch';
import { Library, exampleDescription, exampleNames, type ExampleName } from './Library';
import { InterviewCatalog, interviewDocument } from './InterviewCatalog';
import { WriteGuide, type RunDestination } from './WriteGuide';
import { decisionLocation } from './backtracking';
import { createReplay, initialPlayback, loadPreferences, playbackReducer, preferencesKey, presets, primaryOptions, readStored, rendererOptions, saveStored, type DocumentSource, type Preset, type Step, type ViewKey } from './workspace';
import '../css/renderers.css';
import '../css/app.css';
import '../css/watch.css';
import '../css/journeys.css';
import '../css/dark.css';
import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';

const draftKey = 'dryrun.draft.v1';
// Keep the existing storage key so saved interview edits still load.
const catalogDraftKey = 'dryrun.interview-drafts.v1';
const PythonEditor = lazy(() => import('./PythonEditor').then(module => ({ default: module.PythonEditor })));
const myCode = 'my-code';
const firstSample = exampleNames[0];
const media = window.matchMedia('(max-width: 760px)');
const horizontalDefault: Layout = { editor: 36, results: 64 };
const verticalDefault: Layout = { visualization: 74, inspector: 26 };
const stageKeys = ['calls', ...rendererOptions.map(([key]) => key)] as const;
const layoutKey = 'dryrun.panels.v1.';
type WorkspaceTab = 'code' | 'visualize' | 'inspect';
type Mode = 'library' | 'interview' | 'write' | 'watch' | 'inspect';
const workspaceTabs = [['code', 'Code', CodeXml], ['visualize', 'Visualize', Activity], ['inspect', 'State', ListTree]] as const;
const presetDescriptions = {
  Learn: 'Pattern, step explanation, and variables.',
  Debug: 'Exact source, step explanation, and call stack.',
  Focus: 'Source and visualizations with fewer panels.',
};

function readDraft() {
  const value = readStored(draftKey, '');
  return typeof value === 'string' ? value : '';
}
function readMode(): Mode {
  const route = location.hash.slice(1).split('?')[0];
  return route === 'write' || route === 'watch' || route === 'inspect' || route === 'interview' ? route : 'library';
}

function exampleDocument(key: string): DocumentSource | undefined {
  return Object.hasOwn(SAMPLES, key) ? { key, code: SAMPLES[key as ExampleName] } : undefined;
}

function catalogDocument(key: string) {
  return interviewDocument(key) ?? exampleDocument(key);
}

function readCatalogDocument(mode: Mode) {
  if (mode !== 'watch' && mode !== 'inspect' && mode !== 'write') return;
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const slug = params.get('lesson');
  const example = params.get('example');
  return slug ? interviewDocument('interview:' + slug) : example ? exampleDocument(example) : undefined;
}

function catalogDraft(original: DocumentSource, drafts = readStored<Record<string, string>>(catalogDraftKey, {})): DocumentSource {
  const code = drafts[original.key];
  if (typeof code !== 'string' || code === original.code) return original;
  return { key: original.key, title: original.title, description: original.description, code };
}

function Popover({ title, icon, children }: { title: string; icon: ReactNode; children: (close: () => void) => ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const close = () => { if (details.current) details.current.open = false; summary.current?.focus(); };
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (details.current?.open && event.target instanceof Node && !details.current.contains(event.target)) details.current.open = false;
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  return <details className={'popover ' + (title === 'View' ? 'view-popover' : 'examples-popover')} ref={details} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <summary ref={summary} className="button neutral">{icon}<span>{title}</span><ChevronDown className="chevron" /></summary>
    <div className="popover-content">{children(close)}</div>
  </details>;
}

function App() {
  const [draft, setDraft] = useState(readDraft);
  const [catalogDrafts, setCatalogDrafts] = useState(() => readStored<Record<string, string>>(catalogDraftKey, {}));
  const [docKey, setDocKey] = useState<string>(() => {
    const initial = readMode();
    return readCatalogDocument(initial)?.key ?? (initial === 'write' || (initial === 'inspect' && readDraft()) ? myCode : firstSample);
  });
  const [prefs, setPrefs] = useState(loadPreferences);
  const [mode, setMode] = useState(readMode);
  const modeRef = useRef(mode);
  const focusedMode = useRef(mode);
  const [immersed, setImmersed] = useState(false);
  const [inspectFullscreen, setInspectFullscreen] = useState(false);
  const workspace = useRef<HTMLElement>(null);
  const hideNavbar = useRef<HTMLButtonElement>(null);
  const showNavbar = useRef<HTMLButtonElement>(null);
  const inspectExpand = useRef<HTMLButtonElement>(null);
  const inspectFullRequest = useRef(false);
  const inspectNative = useRef(false);
  const watching = mode === 'watch';
  const writing = mode === 'write';
  const inspecting = mode === 'inspect';
  const navbarHidden = prefs.navbarHidden === true;
  const showNavbarControl = navbarHidden && !inspectFullscreen && !immersed;
  const [playback, dispatch] = useReducer(playbackReducer, initialPlayback);
  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('visualize');
  const [inspectionTab, setInspectionTab] = useState<InspectionTab>('variables');
  const [focusedVariable, setFocusedVariable] = useState('');
  const [replacement, setReplacement] = useState<string | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [draftIssue, setDraftIssue] = useState<{ source: string; step: Step } | null>(null);
  const [horizontal, setHorizontal] = useState(() => readStored(layoutKey + 'horizontal', horizontalDefault));
  const [vertical, setVertical] = useState(() => readStored(layoutKey + 'vertical', verticalDefault));
  const split = useRef<GroupImperativeHandle>(null);
  const stacked = useRef<GroupImperativeHandle>(null);
  const inspector = useRef<PanelImperativeHandle>(null);
  const replaceDialog = useRef<HTMLDialogElement>(null);
  const request = useRef(0);
  const lastRequest = useRef<DocumentSource | undefined>(undefined);
  const original = useMemo(() => catalogDocument(docKey), [docKey]);
  const documentSource = useMemo(() => original ? catalogDraft(original, catalogDrafts) : {
    key: docKey, code: draft,
  }, [catalogDrafts, docKey, draft, original]);
  const source = documentSource.code;
  const visibleDocument = useRef({ key: docKey, code: source });
  visibleDocument.current = { key: docKey, code: source };
  const mobile = useSyncExternalStore(callback => { media.addEventListener('change', callback); return () => media.removeEventListener('change', callback); }, () => media.matches);
  const runtime = useSyncExternalStore(listener => Engine.subscribe(listener), () => Engine.status);
  const { replay, index, pending, playing } = playback;
  const step = replay?.steps[index], previous = replay?.steps[index - 1];
  const decision = replay?.watch.backtracking?.decisions.get(index);
  const allWatchSteps = prefs.watchSteps ?? Boolean(replay?.source.lesson);
  const watchStepsPreference = useRef(prefs.watchSteps);
  watchStepsPreference.current = prefs.watchSteps;
  const showStepNote = inspectFullscreen ? prefs.fullscreenSteps !== false : prefs.views.narration;
  const showFullscreenVariables = inspectFullscreen && Boolean(prefs.inspectFullscreenVariables);
  const inspectTree = prefs.views.calls && (prefs.explicitTree === true || Boolean(replay?.watch.calls.length && !replay.watch.backtracking));
  const inspectViews = useMemo(() => ({ ...prefs.views, calls: inspectTree }), [inspectTree, prefs.views]);
  const draftHasChanges = replay?.source.key === myCode && draft !== replay.source.code;
  const lines = useMemo(() => replay?.source.code.split('\n') ?? [], [replay]);
  const sameSource = replay?.source.key === docKey && replay?.source.code === source;
  const inspectedSource = inspecting ? replay?.source : undefined;
  const editorCode = inspectedSource?.code ?? source;
  const editorKey = inspectedSource?.key ?? docKey;
  const editorMatches = inspecting ? Boolean(replay) : sameSource;
  const issue = writing && draftIssue?.source === source ? draftIssue.step : undefined;
  const editorStep = issue ?? (editorMatches ? step : undefined);
  const activeWorkspaceTab = writing ? 'code' : inspectFullscreen && mobile ? 'visualize' : workspaceTab;
  const stageVisible = stageKeys.some(key => inspectViews[key]);
  const frame = step?.F.at(-1);
  const changes = inspecting && step && previous && showStepNote && step.F.length === previous.F.length ? diffs(previous, step) : [];
  const best = replay?.matches[0];
  const activePreset = (Object.keys(presets) as Preset[]).find(preset =>
    prefs.inspector === presets[preset].inspector &&
    Object.keys(prefs.views).every(key => prefs.views[key as ViewKey] === presets[preset].views[key as ViewKey]));
  const navigate = useCallback((target: Mode, source?: DocumentSource) => {
    let suffix = '';
    if (source && (target === 'watch' || target === 'inspect' || target === 'write')) {
      if (source.key.startsWith('interview:')) suffix = '?lesson=' + source.key.slice('interview:'.length);
      else if (Object.hasOwn(SAMPLES, source.key)) suffix = '?example=' + encodeURIComponent(source.key);
    }
    const hash = '#' + target + suffix;
    if (location.hash === hash) return;
    history.pushState(null, '', hash);
    modeRef.current = target;
    if (target === 'write') setDocKey(source?.key ?? myCode);
    setMode(target);
    pause();
  }, [pause]);
  const openExamples = useCallback(() => navigate('library'), [navigate]);
  useEffect(() => {
    if (focusedMode.current === mode) return;
    focusedMode.current = mode;
    if (mode === 'interview' || inspectFullscreen) return;
    const target = mode === 'library' ? '#library-title' : mode === 'watch' ? '.watch-heading h2'
      : mode === 'inspect' && mobile && workspaceTab !== 'code' ? '.workspace-tabs [aria-current="page"]' : '.editor-pane h2';
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>(target)?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [mode, mobile, workspaceTab, inspectFullscreen]);
  useEffect(() => { if (writing && !Engine.ready) Engine.init(); }, [writing]);

  const enterInspectFullscreen = useCallback((native = true) => {
    const element = workspace.current;
    if (!element) return;
    inspectFullRequest.current = true;
    setInspectFullscreen(true);
    requestAnimationFrame(() => inspectExpand.current?.focus({ preventScroll: true }));
    if (!native) return;
    void element.requestFullscreen?.().then(() => {
      if (document.fullscreenElement !== element) return;
      if (inspectFullRequest.current) inspectNative.current = true;
      else void document.exitFullscreen().catch(() => {});
    }).catch(() => {});
  }, []);

  const run = useCallback(async (document: DocumentSource, destination: RunDestination | null = 'watch', intro = false) => {
    const id = ++request.current;
    const origin = modeRef.current;
    lastRequest.current = document;
    dispatch({ type: 'run' });
    try {
      const sample = catalogDocument(document.key)?.code === document.code;
      const trace = await Engine.run(document.code, { sample });
      if (id !== request.current) return;
      if (!trace) throw Error('Run interrupted. Select Run to try again.');
      const result = createReplay(id, document, trace);
      if (!sample && result.steps[0]?.syntax) {
        setDraftIssue({ source: document.code, step: result.steps[0] });
        dispatch({ type: 'error', error: '' });
        return;
      }
      if (!sample) setDraftIssue(null);
      setFocusedVariable('');
      const same = visibleDocument.current.key === document.key && visibleDocument.current.code === document.code;
      const showWatch = (destination === 'watch' || intro) && same && origin === modeRef.current && !result.steps[0]?.syntax;
      dispatch({ type: 'ready', replay: result, watch: showWatch, allSteps: watchStepsPreference.current ?? Boolean(document.lesson) });
      if (destination && same && origin === modeRef.current) {
        if (!showWatch) setWorkspaceTab('visualize');
        navigate(showWatch ? 'watch' : 'inspect', document);
        if (destination === 'inspect-fullscreen') enterInspectFullscreen(false);
      }
    } catch (error) {
      if (id !== request.current) return;
      lastRequest.current = undefined;
      dispatch({ type: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }, [enterInspectFullscreen, navigate]);

  useEffect(() => {
    const restore = () => {
      const target = readMode();
      modeRef.current = target;
      if (target === 'write') setDocKey(myCode);
      if (target === 'inspect') setWorkspaceTab('visualize');
      setMode(target);
      pause();
      const original = readCatalogDocument(target);
      if (!original) return;
      setDocKey(original.key);
      if (target === 'write') return;
      const document = catalogDraft(original);
      visibleDocument.current = document;
      if (lastRequest.current?.key !== document.key || lastRequest.current.code !== document.code) void run(document, null, target === 'watch');
    };
    window.addEventListener('popstate', restore);
    window.addEventListener('hashchange', restore);
    return () => {
      window.removeEventListener('popstate', restore);
      window.removeEventListener('hashchange', restore);
    };
  }, [pause, run]);

  useEffect(() => {
    const initial = readMode();
    if (initial === 'library' || initial === 'interview' || initial === 'write') return;
    Engine.init();
    const original = readCatalogDocument(initial);
    if (original) {
      void run(catalogDraft(original), null, initial === 'watch');
      return;
    }
    if (initial === 'watch' || (initial === 'inspect' && !readDraft())) {
      void run({ key: firstSample, code: SAMPLES[firstSample] }, null, initial === 'watch');
    }
  }, [run]);
  useEffect(() => {
    if (!prefs.live || !writing || !source.trim() || source === original?.code) return;
    const alreadyRun = () => lastRequest.current?.key === docKey && lastRequest.current.code === source;
    if (alreadyRun()) return;
    const timer = window.setTimeout(() => {
      if (!alreadyRun()) void run(documentSource, null);
    }, 500);
    return () => clearTimeout(timer);
  }, [docKey, documentSource, original, prefs.live, run, source, writing]);
  useEffect(() => saveStored(draftKey, draft), [draft]);
  useEffect(() => saveStored(catalogDraftKey, catalogDrafts), [catalogDrafts]);
  useEffect(() => saveStored(preferencesKey, prefs), [prefs]);
  useEffect(() => { document.documentElement.dataset.theme = prefs.dark ? 'dark' : 'light'; }, [prefs.dark]);
  useEffect(() => {
    if (!playing) return;
    const hold = watching && prefs.speed === 560 && (decision?.landmark === 'First complete path' || decision?.landmark === 'First undo');
    const timer = window.setTimeout(() => dispatch({ type: 'tick', watch: watching, allSteps: allWatchSteps }), hold ? 1100 : prefs.speed);
    return () => clearTimeout(timer);
  }, [playing, prefs.speed, watching, allWatchSteps, index, decision]);
  useEffect(() => {
    if (mobile || !inspecting) return;
    if (prefs.inspector && !inspectFullscreen) inspector.current?.expand();
    else inspector.current?.collapse();
  }, [mobile, prefs.inspector, inspecting, inspectFullscreen]);

  const exitInspectFullscreen = useCallback(() => {
    inspectFullRequest.current = false;
    inspectNative.current = false;
    setInspectFullscreen(false);
    if (workspace.current && document.fullscreenElement === workspace.current) void document.exitFullscreen().catch(() => {});
    requestAnimationFrame(() => {
      const target = inspectExpand.current ?? document.querySelector<HTMLElement>('.workspace-tabs [aria-current="page"]');
      target?.focus({ preventScroll: true });
    });
  }, []);
  useEffect(() => {
    if (!inspectFullscreen) return;
    if (!inspecting) { exitInspectFullscreen(); return; }
    const handleChange = () => {
      if (document.fullscreenElement === workspace.current) inspectNative.current = true;
      else if (inspectNative.current) exitInspectFullscreen();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        exitInspectFullscreen();
      } else if (!pending && event.target === inspectExpand.current && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        dispatch({ type: 'step', index: event.key === 'ArrowLeft' ? -1 : 1 });
      } else if (event.key === 'Tab') {
        const controls = [...(workspace.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex]') ?? [])]
          .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const boundary = event.shiftKey ? controls[0] : controls.at(-1);
        if (boundary && document.activeElement === boundary) {
          event.preventDefault();
          (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
        }
      }
    };
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('keydown', handleKey);
    };
  }, [exitInspectFullscreen, inspectFullscreen, inspecting, pending]);
  useEffect(() => {
    if (replacement !== null) replaceDialog.current?.showModal();
    else replaceDialog.current?.close();
  }, [replacement]);

  function setCallView(key: 'calls' | 'stack', value: boolean) {
    setPrefs(old => ({ ...old, views: { ...old.views, [key]: value },
      ...(key === 'calls' ? { explicitTree: value } : { explicitStack: value }) }));
  }
  const toggle = (key: ViewKey) => {
    if (key === 'calls' || key === 'stack') setCallView(key, !inspectViews[key]);
    else setPrefs(old => ({ ...old, views: { ...old.views, [key]: !old.views[key] } }));
  };
  const watchTree = prefs.views.calls && ((!replay?.watch.backtracking && !replay?.source.lesson) || prefs.explicitTree === true);
  const watchStack = prefs.views.stack && prefs.explicitStack === true;
  function choosePreset(preset: Preset) {
    setPrefs(old => ({ ...old, ...presets[preset] }));
    if (preset === 'Learn') setInspectionTab('variables');
    if (preset === 'Debug') setInspectionTab('stack');
  }
  function resetLayout() {
    setHorizontal(horizontalDefault);
    setVertical(verticalDefault);
    saveStored(layoutKey + 'horizontal', horizontalDefault);
    saveStored(layoutKey + 'vertical', verticalDefault);
    split.current?.setLayout(horizontalDefault);
    stacked.current?.setLayout(verticalDefault);
    setPrefs(old => ({ ...old, inspector: true }));
  }
  function openCatalogDocument(document: DocumentSource) {
    setWorkspaceTab('code');
    navigate('write', document);
  }
  function chooseSample(name: ExampleName) {
    openCatalogDocument({ key: name, code: SAMPLES[name] });
  }
  function openMyCode() {
    setDocKey(myCode);
    navigate('write');
    setWorkspaceTab('code');
    dispatch({ type: 'pause' });
  }
  function loadDraft(text: string, confirmed = false) {
    if (draft.trim() && draft !== text && !confirmed) {
      setReplacement(text);
      return;
    }
    setReplacement(null);
    setDraft(text);
    setEditorRevision(value => value + 1);
    openMyCode();
  }
  function runCurrent(destination: RunDestination = 'inspect') {
    if (!source.trim() || pending) return;
    if (writing && sameSource && !playback.error) {
      if (destination === 'watch') navigate('watch', documentSource);
      else {
        inspectMoment();
        if (destination === 'inspect-fullscreen') enterInspectFullscreen();
      }
      return;
    }
    void run(documentSource, destination);
  }
  function runUpdatedDraft() {
    if (!draft.trim() || pending) return;
    openMyCode();
    void run({ key: myCode, code: draft }, 'inspect');
  }
  function inspectMoment(output = false) {
    setWorkspaceTab(output ? 'inspect' : 'visualize');
    if (output) {
      setInspectionTab('output');
      setPrefs(old => ({ ...old, inspector: true }));
    }
    navigate('inspect', replay?.source);
  }
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if ((!watching && !inspecting) || pending || event.defaultPrevented || replacement !== null || event.target instanceof Element &&
        event.target.closest('input,textarea,select,button,summary,[contenteditable],[role="separator"],[role="tablist"]')) return;
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) runCurrent();
      else if (event.key === 'ArrowRight') dispatch(watching ? { type: 'beat', direction: 1, allSteps: allWatchSteps } : { type: 'step', index: 1 });
      else if (event.key === 'ArrowLeft') dispatch(watching ? { type: 'beat', direction: -1, allSteps: allWatchSteps } : { type: 'step', index: -1 });
      else if (event.key === 'Home') dispatch({ type: 'seek', index: watching && !allWatchSteps ? replay?.watch.beats[0]?.index ?? 0 : 0 });
      else if (event.key === 'End') dispatch({ type: 'seek', index: (replay?.steps.length ?? 1) - 1 });
      else if (event.key === ' ') dispatch({ type: 'play', watch: watching, allSteps: allWatchSteps });
      else return;
      event.preventDefault();
    }
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });

  const runMessage = pending ? (Engine.ready || source === original?.code ? 'Tracing execution…' : 'Starting Python…')
    : playback.error || (sameSource ? '' : replay ? (replay.source.key === docKey ? 'Code changed · Run to update' : 'Showing previous replay · Run to update') : '');

  function setNavbarHidden(hidden: boolean) {
    setPrefs(old => ({ ...old, navbarHidden: hidden }));
    requestAnimationFrame(() => (hidden ? showNavbar : hideNavbar).current?.focus({ preventScroll: true }));
  }
  const timeline = inspecting && <Timeline compact={inspectFullscreen} playback={playback} speed={prefs.speed}
    onSpeed={speed => setPrefs(old => ({ ...old, speed }))}
    onSeek={index => dispatch({ type: 'seek', index })} onStep={index => dispatch({ type: 'step', index })} onPlay={() => dispatch({ type: 'play' })} />;

  return <div className={'app-shell is-' + (watching ? 'watching' : writing ? 'writing' : mode) + (showNavbarControl ? ' navbar-hidden' : '')}
    style={{ '--dur': Math.min(.65, prefs.speed * .6 / 1000) + 's' } as CSSProperties}>
    <header className="topbar" id="app-navbar" hidden={inspectFullscreen || navbarHidden} inert={immersed}>
      <div className="identity"><span className="brand-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none">
        <path d="M3 19h18M5 16v-4m5 4V7m5 9v-7m5 7V4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      </svg></span><div><h1>dryrun<span>.</span></h1><p>Python visualizer</p></div></div>
      <nav className="product-nav" aria-label="Dryrun pages">
        <button type="button" aria-current={mode === 'library' || mode === 'interview' ? 'page' : undefined} onClick={() => navigate('library')}><BookOpen /><span>Examples</span></button>
        <button type="button" aria-current={writing ? 'page' : undefined} onClick={openMyCode}><CodeXml /><span>Write</span></button>
        <button type="button" disabled={!replay} aria-current={inspecting ? 'page' : undefined} onClick={() => { if (!inspecting) inspectMoment(); }}><ListTree /><span>Inspect</span></button>
        <button type="button" disabled={!replay} onClick={() => { if (!inspecting) inspectMoment(); enterInspectFullscreen(); }}><Maximize /><span>Inspect fullscreen</span></button>
        <button type="button" disabled={!replay || Boolean(replay.steps[0]?.syntax)} aria-current={watching ? 'page' : undefined} onClick={() => navigate('watch', replay?.source)}><Activity /><span>Watch</span></button>
      </nav>
      <div className="top-actions">
        <button type="button" className="icon-button theme-toggle" aria-label="Dark mode" aria-pressed={Boolean(prefs.dark)}
          title={prefs.dark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setPrefs(old => ({ ...old, dark: !old.dark }))}>{prefs.dark ? <Sun /> : <Moon />}</button>
        <button ref={hideNavbar} type="button" className="icon-button" aria-label="Hide navbar" title="Hide navbar"
          aria-controls="app-navbar" aria-expanded={true} onClick={() => setNavbarHidden(true)}><PanelTopClose /></button>
        {writing && <span className="runtime" title={runtime}><i data-ready={runtime.startsWith('CPython')} /><span>{runtime}</span></span>}
        {inspecting && <Popover title="View" icon={<Settings2 />}>{close => <>
          <div className="popover-heading">Layout <span>{activePreset ?? 'Custom'}</span></div>
          <div className="presets" aria-label="Layout presets">
            {(['Learn', 'Debug', 'Focus'] as const).map(preset => <button type="button" className="button neutral" key={preset}
              aria-pressed={activePreset === preset} aria-description={presetDescriptions[preset]} title={presetDescriptions[preset]} onClick={() => { choosePreset(preset); close(); }}>
              {preset === 'Learn' ? <BookOpen /> : preset === 'Debug' ? <FlaskConical /> : <Focus />}{preset}</button>)}
          </div>
          <p className="preset-summary">{activePreset ? presetDescriptions[activePreset] : 'Choose a preset or adjust individual settings.'}</p>
          <fieldset className="view-options"><legend>Learning aids</legend>
            {primaryOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={inspectViews[key]} onChange={() => toggle(key)} />{label}</label>)}
            <label><input type="checkbox" checked={prefs.follow} onChange={() => setPrefs(old => ({ ...old, follow: !old.follow }))} />Follow execution</label>
            {!mobile && <label><input type="checkbox" checked={prefs.inspector} onChange={() => setPrefs(old => ({ ...old, inspector: !old.inspector }))} />Inspector</label>}
            <small className="preset-summary">Call tree and call stack changes also apply in Watch.</small>
          </fieldset>
          <details className="advanced"><summary>Advanced visualizations</summary><fieldset className="view-options" aria-label="Visualization families">
            {rendererOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={prefs.views[key]} onChange={() => toggle(key)} />{label}</label>)}
          </fieldset></details>
          <button type="button" className="button neutral reset-layout" onClick={() => { resetLayout(); close(); }}>Reset layout</button>
        </>}</Popover>}
      </div>
    </header>
    {showNavbarControl && <button ref={showNavbar} type="button" className="icon-button navbar-restore"
      aria-label="Show navbar" title="Show navbar" aria-controls="app-navbar" aria-expanded={false}
      onClick={() => setNavbarHidden(false)}><PanelTopOpen /></button>}

    <Library active={mode === 'library'} onExample={chooseSample} onWrite={openMyCode} onInterview={() => navigate('interview')} />
    <InterviewCatalog active={mode === 'interview'} onBack={openExamples} onLesson={openCatalogDocument} />
    <nav className="workspace-tabs" hidden={!inspecting || inspectFullscreen} aria-label="Workspace sections">
      {workspaceTabs.map(([key, label, Icon]) => <button type="button" key={key} aria-current={workspaceTab === key ? 'page' : undefined}
        onClick={() => setWorkspaceTab(key)}><Icon />{label}</button>)}
    </nav>

    <main ref={workspace} className={'workspace' + (writing ? ' write-workspace' : '') + (inspectFullscreen ? ' inspect-fullscreen' : '')}
      hidden={!inspecting && !writing} data-tab={activeWorkspaceTab}
      role={inspectFullscreen ? 'dialog' : undefined} aria-modal={inspectFullscreen || undefined}
      aria-label={inspectFullscreen ? 'Inspect fullscreen' : undefined}
      aria-description={inspectFullscreen ? 'Use the playback controls below the workspace. Press Escape to leave.' : undefined}>
      <Group className="workspace-group" id="workspace-split" groupRef={split} disabled={mobile || writing} defaultLayout={horizontal}
        onLayoutChanged={(layout, meta) => { if (!mobile && !writing && meta.isUserInteraction) { setHorizontal(layout); saveStored(layoutKey + 'horizontal', layout); } }}>
        <Panel id="editor" className="editor-panel" minSize="270px">
          <section className="pane editor-pane" aria-label="Code editor">
            <div className="pane-header"><div className="pane-title"><CodeXml /><h2 tabIndex={-1}>{writing ? original?.title ?? original?.key ?? 'My code' : editorKey === myCode ? 'Run source' : inspectedSource?.title ?? editorKey}</h2><span className="badge">Python</span></div>
              {writing
                ? <label className="live-run"><input type="checkbox" checked={prefs.live} onChange={() => setPrefs(old => ({ ...old, live: !old.live }))} />Live run</label>
                : <button type="button" className="button compact neutral" onClick={() => loadDraft(editorCode)}>Edit a copy</button>}
            </div>
            <Suspense fallback={<div className="python-editor editor-loading" role="status">Loading editor…</div>}>
              <PythonEditor key={editorKey + ':' + writing + ':' + editorRevision + ':' + (inspecting ? replay?.id : '')}
                source={editorCode} readOnly={!writing} onChange={value => {
                if (original) setCatalogDrafts(old => ({ ...old, [original.key]: value }));
                else setDraft(value);
                dispatch({ type: 'pause' });
              }} onRun={() => { if (writing) runCurrent(); }} step={inspecting || writing ? editorStep : undefined}
                previous={(inspecting || writing) && editorMatches ? previous : undefined}
                showHighlights={prefs.views.highlight} follow={prefs.follow} />
            </Suspense>
            <div className="editor-footer">
              <span>{editorCode.includes('\n') ? editorCode.split('\n').length + ' lines' : '1 line'}</span>
              <span>{writing ? 'Draft saved on this device' : 'Recorded source'}</span>
            </div>
            {(inspecting || writing) && editorStep?.error && <div className="editor-error" role="status"><CircleAlert /><span>Line {editorStep.l || '—'}{editorStep.syntax?.column ? ', column ' + editorStep.syntax.column : ''} · {editorStep.error}</span></div>}
          </section>
        </Panel>
        <Separator className="splitter vertical-splitter" id="resize-editor" aria-label="Resize editor and visualization" />
        <Panel id="results" className="results-panel" minSize="330px">
          {writing && <WriteGuide source={source} pending={pending} pendingMessage={runMessage}
            error={playback.error || (sameSource ? replay?.steps.at(-1)?.error ?? '' : '')}
            ready={Boolean(sameSource && replay)} onRun={runCurrent} />}
          <div className="inspect-results" hidden={!inspecting}>
          <Group className="results-group" id="results-split" orientation="vertical" groupRef={stacked} disabled={mobile || !inspecting || inspectFullscreen} defaultLayout={vertical}
            onLayoutChanged={(layout, meta) => {
              if (mobile || !meta.isUserInteraction) return;
              const open = layout.inspector > 0;
              setPrefs(old => old.inspector === open ? old : { ...old, inspector: open });
              if (open) { setVertical(layout); saveStored(layoutKey + 'vertical', layout); }
            }}>
            <Panel id="visualization" className="visualization-panel" minSize="195px">
              <section className="pane visualization" aria-label="Visualization">
                <div className="pane-header visualization-header">
                  <div className="pane-title"><Activity /><h2>Execution state</h2>{step?.done && <span className="badge success">Complete</span>}</div>
                  <div className="stage-actions">
                    {!inspectFullscreen && replay?.source.key.startsWith('interview:') && <a href="#interview" className="button neutral compact inspect-study-back"
                      onClick={event => { event.preventDefault(); navigate('interview'); }}>Back to study plan</a>}
                    {!inspectFullscreen && step?.done && step.out && <button type="button" className="button neutral compact"
                      onClick={() => inspectMoment(true)}>Open output</button>}
                    {focusedVariable && <button type="button" className="button compact neutral clear-focus" onClick={() => setFocusedVariable('')} aria-label="Clear variable focus"><X />{focusedVariable}</button>}
                    {!prefs.inspector && !mobile && !inspectFullscreen && <button type="button" className="icon-button" title="Show inspector" aria-label="Show inspector" onClick={() => setPrefs(old => ({ ...old, inspector: true }))}><PanelBottomOpen /></button>}
                    {inspectFullscreen && <button type="button" className="button neutral compact fullscreen-step-toggle" aria-pressed={showStepNote}
                      onClick={() => setPrefs(old => ({ ...old, fullscreenSteps: old.fullscreenSteps === false }))}>Step explanation</button>}
                    {inspectFullscreen && <button type="button" className="button neutral compact fullscreen-variable-toggle" aria-label="Show variables" title="Show variables"
                      aria-pressed={showFullscreenVariables} aria-controls={showFullscreenVariables ? 'inspect-fullscreen-variables' : undefined}
                      onClick={() => setPrefs(old => ({ ...old, inspectFullscreenVariables: !old.inspectFullscreenVariables }))}><Variable /><span>Variables</span></button>}
                    {(!mobile || inspectFullscreen) && <button ref={inspectExpand} type="button" className="icon-button inspect-expand"
                      aria-label={inspectFullscreen ? 'Exit Inspect fullscreen' : 'Fullscreen Inspect'}
                      title={inspectFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen Inspect'}
                      onClick={inspectFullscreen ? exitInspectFullscreen : () => enterInspectFullscreen()}>
                      {inspectFullscreen ? <Minimize /> : <Maximize />}
                    </button>}
                  </div>
                </div>
                {(pending || playback.error) && <div className={'run-message' + (playback.error ? ' error' : '')} role={playback.error ? 'alert' : 'status'}>{runMessage}</div>}
                {draftHasChanges && <div className="run-message replay-version">
                  <span>Viewing last run · draft has changes</span>
                  <button type="button" className="button neutral compact" disabled={pending || !draft.trim()} onClick={runUpdatedDraft}>Run updated draft</button>
                </div>}
                {prefs.views.pattern && replay && !replay.steps[0]?.syntax && <div className="pattern-strip">
                  {replay.watch.topic ? <><span className="pattern-label">{replay.watch.topic.name}</span>
                    <span className="pattern-description">{replay.source.description ?? exampleDescription(replay.source.key) ?? 'Watch highlights the decisions confirmed by this run.'}</span></>
                    : best ? <><span className="pattern-label">{best.n}</span><span className="pattern-description">{best.d}</span>
                    {(best.why.length > 0 || replay.matches.length > 1) && <details className="pattern-details"><summary>Why?</summary><div>
                      {best.why.length > 0 && <p>{best.why.join(' · ')}</p>}
                      {replay.matches.length > 1 && <p>Also looks like {replay.matches.slice(1).map(item => item.n).join(', ')}.</p>}
                    </div></details>}</> : <span className="pattern-description">No strong pattern match. You can still inspect each step.</span>}
                </div>}
                {showStepNote && replay && step && frame && <div className={'step-note' + (step.error || step.exc ? ' error-note' : '')} aria-live={playing ? 'off' : 'polite'}>
                  <div><span className="step-kicker">{step.error ? 'Error' : step.exc ? 'Exception' : step.handled ? 'Handled' : 'Step ' + index}</span>
                    <strong>{narrateStep(replay, index, lines, changes)}</strong>
                    {decision && <span className="step-landmark">{decision.landmark ?? 'Decision'} · {decisionLocation(decision)}</span>}</div>
                  {step.l > 0 && !step.error && !step.exc && !step.done && <span className="next-line">Runs next · line {step.l}</span>}
                  {!inspectFullscreen && changes.length > 0 && <div className="change-list">{changes.map((change, position) => <code key={position}>{change}</code>)}</div>}
                </div>}
                {showFullscreenVariables && <VariableSnapshot key={replay?.id} id="inspect-fullscreen-variables" label="Inspect fullscreen variables" fullscreen
                  step={step} previous={previous} />}
                {!stageVisible && <div className="empty-visual"><LayoutPanelTop /><p>Visualizations are hidden.</p>
                  <button className="button neutral compact" type="button" onClick={() => setPrefs(old => ({ ...old,
                    views: { ...old.views, ...Object.fromEntries(rendererOptions.map(([key]) => [key, true])) },
                  }))}>Show visualizations</button></div>}
                <div className="stage-shell" hidden={!stageVisible}>
                  <Stage replay={replay} index={index} views={inspectViews} focus={focusedVariable} speed={prefs.speed} motion={playback.motion}
                    visible={inspecting && stageVisible && (!mobile || activeWorkspaceTab === 'visualize')} onInteract={pause} desktop={!mobile} />
                </div>
                {stageVisible && <div className="legend"><span><i /> Just changed</span><span><i /> Active index</span><span><i /> Value read</span></div>}
              </section>
            </Panel>
            <Separator className="splitter horizontal-splitter" id="resize-inspector" aria-label="Resize visualization and inspector" />
            <Panel id="inspector" className="inspector-panel" minSize="125px" collapsible collapsedSize={0} panelRef={inspector}>
              <Inspector key={replay?.id ?? 0} step={step} previous={previous} tab={inspectionTab} setTab={setInspectionTab} showStack={prefs.views.stack}
                onClose={() => setPrefs(old => ({ ...old, inspector: false }))} focus={focusedVariable} onFocus={name => {
                  setFocusedVariable(old => old === name ? '' : name);
                  if (mobile) setWorkspaceTab('visualize');
                }} />
            </Panel>
          </Group>
          </div>
        </Panel>
      </Group>
      {mobile && inspecting && step?.error && activeWorkspaceTab !== 'code' && <div className="mobile-status" role="status">{step.error}</div>}
      {inspectFullscreen && timeline}
    </main>

    {(watching || mode === 'library' || mode === 'interview') && (pending || playback.error) && <div className={'watch-status' + (playback.error ? ' error' : '')} role={playback.error ? 'alert' : 'status'}>{runMessage}</div>}
    <Watch active={watching} replay={replay} index={index} playing={playing} motion={playback.motion} speed={prefs.speed} allSteps={allWatchSteps}
      onMove={direction => dispatch({ type: 'beat', direction, allSteps: allWatchSteps })} onSeek={index => dispatch({ type: 'seek', index })}
      onPlay={() => dispatch({ type: 'play', watch: true, allSteps: allWatchSteps })} onFullscreen={setImmersed}
      onDetail={allSteps => { pause(); setPrefs(old => ({ ...old, watchSteps: allSteps })); }}
      onSpeed={speed => setPrefs(old => ({ ...old, speed }))} onWrite={openMyCode} onInterview={() => navigate('interview')} onExamples={openExamples}
      onPause={pause} onInspect={inspectMoment}
      desktop={!mobile} showTree={watchTree} showStack={watchStack} showVariables={Boolean(prefs.watchVariables)}
      showFullscreenVariables={Boolean(prefs.watchFullscreenVariables)}
      onFullscreenVariables={() => setPrefs(old => ({ ...old, watchFullscreenVariables: !old.watchFullscreenVariables }))}
      onTree={() => setCallView('calls', !watchTree)} onStack={() => setCallView('stack', !watchStack)}
      onVariables={() => setPrefs(old => ({ ...old, watchVariables: !old.watchVariables }))} />
    {!inspectFullscreen && timeline}
    <dialog ref={replaceDialog} className="draft-dialog" onCancel={() => setReplacement(null)} aria-labelledby="replace-title">
      <h2 id="replace-title">Replace your draft?</h2><p>This will replace the Python code saved on this device.</p>
      <div><button className="button neutral" type="button" autoFocus onClick={() => setReplacement(null)}>Keep draft</button>
        <button className="button primary" type="button" onClick={() => { if (replacement !== null) loadDraft(replacement, true); }}>Replace draft</button></div>
    </dialog>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
