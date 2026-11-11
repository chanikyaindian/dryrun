import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { drawStage, resetStage } from '../js/views/stage.js';
import { createStageControls } from '../js/views/interactions.js';
import type { Preferences, Replay } from './workspace';
import { DecisionState } from './DecisionState';
import { TopicPanel } from './TopicPanel';

type Props = { replay: Replay | null; index: number; views: Preferences['views']; focus: string; speed: number; motion: boolean; visible: boolean; onInteract: () => void; desktop: boolean };

export const Stage = memo(function Stage({ replay, index, views, focus, speed, motion, visible, onInteract, desktop }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<ReturnType<typeof createStageControls> | null>(null);
  const run = useRef<number | undefined>(undefined);
  const lastViewed = useRef<Replay['steps'][number] | undefined>(undefined);
  const lastFocus = useRef('');
  const [notice, announce] = useState('');
  const [supportingRun, setSupportingRun] = useState<number>();
  const [supportCount, setSupportCount] = useState(0);
  const showSupporting = supportingRun !== undefined && supportingRun === replay?.id;
  const [hidden, setHidden] = useState<[string, string][]>([]);
  const [summary] = useState(() => {
    const card = document.createElement('div');
    card.className = 'obj summary-card';
    card.dataset.vizId = 'summary';
    card.dataset.vizPriority = '4';
    return card;
  });
  const model = desktop && views.list ? replay?.watch.backtracking : undefined;
  const showDecision = Boolean(model?.states[index]);
  const candidate = replay?.watch.topic;
  const topic = visible && !focus && (desktop || candidate?.traceCue) ? candidate : undefined;
  const step = replay?.steps[index], previous = replay?.steps[index - 1];
  const cue = useMemo(() => topic?.events.get(index) ?? (step && previous ? topic?.traceCue?.(step, previous) : undefined), [topic, index, step, previous]);
  const view = useMemo(() => step && topic?.view(step, cue), [step, topic, cue]);
  const topicVisible = Boolean(view && (view.grid ? views.grid : view.heap ? views.heap : view.trie ? views.nodes : view.ranges ? views.iv : replay?.source.lessonBits ? views.bits :
    views.list && (view.rows?.length || view.facts?.length)));
  const hideDuplicateTree = topicVisible && Boolean(view?.trie);
  const shownGrid = topicVisible ? view?.grid?.reference : undefined;
  const withSummary = Boolean(showDecision || topicVisible);

  useLayoutEffect(() => {
    const target = host.current!;
    const controller = createStageControls(target, announce, onInteract, setHidden);
    controls.current = controller;
    return () => { controller.destroy(); resetStage(target); };
  }, [onInteract]);

  useLayoutEffect(() => {
    const target = host.current!;
    if (run.current !== replay?.id) {
      resetStage(target);
      setSupportCount(0);
      controls.current?.reset();
      lastViewed.current = undefined;
      lastFocus.current = '';
      run.current = replay?.id;
    }
    const current = replay?.steps[index];
    if (!visible || !current || !replay) return;
    if (withSummary && summary.parentElement !== target) target.prepend(summary);
    else if (!withSummary) summary.remove();
    const step = { ...current, H: { ...current.H } };
    const count = drawStage(target, step, step.F.at(-1), index, replay.steps[index - 1], lastViewed.current, {
      views: hideDuplicateTree ? { ...views, nodes: false } : views,
      focus, speed, tree: replay.tree, roles: replay.roles, topics: replay.topics,
      relevance: replay.watch.relevance, indexNames: replay.watch.indexNames, scene: replay.watch.scene, withSummary, showSupporting,
      omitNames: showDecision && model ? [model.names.path, ...model.names.input, ...model.names.results] : topicVisible ? topic?.variables : undefined,
      omitReference: shownGrid,
    });
    setSupportCount(count);
    controls.current?.refresh();
    lastViewed.current = step;
    if (focus && lastFocus.current !== focus) {
      const card = [...target.querySelectorAll<HTMLElement>('.focused-card, .decision-state [data-focused="true"]')]
        .find(card => !card.closest('[hidden]') && card.style.display !== 'none');
      if (card) target.scrollTop += card.getBoundingClientRect().top - target.getBoundingClientRect().top - 12;
    }
    lastFocus.current = focus;
  }, [replay, index, views, focus, speed, visible, model, showDecision, topic, topicVisible, withSummary, showSupporting, hideDuplicateTree, shownGrid, summary]);

  return <>
    <div className="stage-content">
      {(supportCount > 0 || showSupporting) && <button type="button" className="button neutral compact supporting-visuals"
        aria-expanded={showSupporting} aria-controls="stage"
        onClick={() => setSupportingRun(showSupporting ? undefined : replay?.id)}>
        {showSupporting ? 'Hide supporting visuals' : 'Show supporting visuals (' + supportCount + ')'}
      </button>}
      {hidden.length > 0 && <details className="hidden-visualizations">
        <summary>Hidden visualizations ({hidden.length})</summary>
        <div>{hidden.map(([id, label]) => <button key={id} type="button" className="button neutral compact"
          onClick={() => controls.current?.restore(id)}>Show {label}</button>)}</div>
      </details>}
      <div id="stage" className="visual-stage void" ref={host} tabIndex={-1} aria-label="Visualizations" />
      {withSummary && createPortal(<>
        <div className="hd">{model && showDecision ? 'Backtracking state' : topic?.name}</div>
        {model && showDecision && <DecisionState model={model} index={index} decision={model.decisions.get(index)} compact focus={focus} />}
        {view && topicVisible && <TopicPanel view={view} cue={cue} motion={motion} speed={speed} showKey />}
      </>, summary)}
    </div>
    <span className="sr-only" role="status">{notice}</span>
  </>;
});
