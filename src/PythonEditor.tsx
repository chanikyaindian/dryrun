import { useEffect, useLayoutEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, drawSelection, highlightActiveLineGutter, keymap, lineNumbers, placeholder, type DecorationSet } from '@codemirror/view';
import { HighlightStyle, indentOnInput, bracketMatching, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import { python } from '@codemirror/lang-python';
import { setDiagnostics, type Diagnostic } from '@codemirror/lint';
import type { Step } from './workspace';

type Highlights = { last?: number; next?: number; bad?: number };
const setHighlights = StateEffect.define<Highlights>();
const decorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (!effect.is(setHighlights)) continue;
      const classes = [
        [effect.value.last, 'cm-just-ran'],
        [effect.value.next, 'cm-next-line'],
        [effect.value.bad, 'cm-error-line'],
      ] as const;
      const ranges = classes.flatMap(([line, className]) =>
        line && line <= transaction.state.doc.lines
          ? [Decoration.line({ class: className }).range(transaction.state.doc.line(line).from)]
          : [],
      );
      return Decoration.set(ranges, true);
    }
    return value.map(transaction.changes);
  },
  provide: field => EditorView.decorations.from(field),
});
const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', background: '#171e3d', color: '#e5eaff' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.72', overflow: 'auto' },
  '.cm-content': { padding: '17px 0', caretColor: '#eff2ff' },
  '.cm-line': { paddingLeft: '12px' },
  '.cm-gutters': { background: '#171e3d', color: '#9ba8d4', border: '0' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 11px' },
  '.cm-activeLineGutter': { background: '#27345f', color: '#e5eaff' },
  '.cm-just-ran': { boxShadow: 'inset 3px 0 #d9f66c' },
  '.cm-next-line': { boxShadow: 'inset 3px 0 #93a7ff' },
  '.cm-just-ran.cm-next-line': { boxShadow: 'inset 3px 0 #d9f66c, inset 5px 0 #93a7ff' },
  '.cm-error-line': { background: '#512d4b', boxShadow: 'inset 2px 0 #ff9cb4' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { background: '#394c8d' },
  '.cm-panel': { background: '#27345f', color: '#e5eaff' },
  '.cm-panel input, .cm-panel button': { color: '#e5eaff', background: '#171e3d' },
}, { dark: true });
const syntax = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword], color: '#beb5ff' },
  { tag: [tags.number, tags.bool, tags.null], color: '#ffe0a1' },
  { tag: [tags.string, tags.special(tags.string)], color: '#d9f66c' },
  { tag: tags.comment, color: '#a7b1d6', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.definition(tags.variableName), tags.typeName], color: '#a4c7ff' },
  { tag: tags.operator, color: '#e6c2ff' },
]);

type Props = {
  source: string; readOnly: boolean; onChange: (value: string) => void; onRun: () => void;
  step?: Step; previous?: Step; showHighlights: boolean; follow: boolean;
};

export function PythonEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const hasDiagnostics = useRef(false);
  const latest = useRef(props);
  latest.current = props;

  useLayoutEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: latest.current.source,
        extensions: [
          theme, decorations, python(), lineNumbers(),
          history(), drawSelection(), bracketMatching(),
          indentOnInput(), highlightActiveLineGutter(), syntaxHighlighting(syntax),
          EditorState.tabSize.of(4), EditorState.readOnly.of(latest.current.readOnly),
          EditorView.editable.of(!latest.current.readOnly), placeholder('Paste or type Python code here…'),
          EditorView.contentAttributes.of({ 'aria-label': 'Python code', spellcheck: 'false', autocapitalize: 'off',
            ...(latest.current.readOnly ? { tabindex: '0', 'aria-readonly': 'true' } : {}) }),
          keymap.of([{ key: 'Mod-Enter', run: () => { latest.current.onRun(); return true; } },
            ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          EditorView.updateListener.of(update => {
            if (update.docChanged) latest.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    editor.current = view;
    return () => { view.destroy(); editor.current = null; };
  }, []);

  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    const { step, previous, showHighlights, follow } = props;
    const hasError = Boolean(step?.error || step?.exc);
    const last = previous?.l;
    const next = step?.done || hasError ? undefined : step?.l;
    const bad = hasError ? step?.l : undefined;
    view.dispatch({ effects: setHighlights.of(showHighlights ? { last: hasError ? undefined : last, next, bad } : {}) });

    const diagnostics: Diagnostic[] = [];
    if (step?.error && step.l && step.l <= view.state.doc.lines) {
      const line = view.state.doc.line(step.l);
      const from = Math.min(line.to, line.from + Math.max(0, (step.syntax?.column ?? 1) - 1));
      const endLine = view.state.doc.line(Math.max(line.number, Math.min(step.syntax?.endLine || line.number, view.state.doc.lines)));
      const to = step.syntax ? Math.min(endLine.to, endLine.from + Math.max(0, (step.syntax.endColumn ?? 1) - 1)) : line.to;
      diagnostics.push({ from, to: Math.max(from, to), severity: 'error', message: step.error });
    }
    if (diagnostics.length || hasDiagnostics.current) view.dispatch(setDiagnostics(view.state, diagnostics));
    hasDiagnostics.current = Boolean(diagnostics.length);

    const line = bad || next || last;
    if (follow && showHighlights && line && line <= view.state.doc.lines) {
      view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(line).from, { y: 'nearest', yMargin: 22 }) });
    }
  }, [props.step, props.previous, props.showHighlights, props.follow]);

  return <div className="python-editor" ref={host} />;
}
