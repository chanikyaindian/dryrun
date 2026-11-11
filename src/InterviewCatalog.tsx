import { memo, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Play, Search } from 'lucide-react';
import { interviewCatalog } from '../js/interview-catalog.js';
import { interviewLessons } from '../js/interview-lessons.js';
import type { DocumentSource } from './workspace';

const source = 'https://leetcode.com/studyplan/top-interview-150/';
const lessons: Record<string, { code: string; variables: string[]; grid?: string; nodeClass?: string;
  trie?: boolean; heap?: string; search?: string; inclusive?: boolean; bits?: DocumentSource['lessonBits'] } | undefined> = interviewLessons;
const problems = interviewCatalog.map(([id, title, slug, difficulty, topic]) =>
  ({ id: Number(id), title: String(title), slug: String(slug), difficulty: String(difficulty), topic: String(topic) }));
const groups = [...new Set(problems.map(problem => problem.topic))];
const ready = problems.filter(problem => lessons[problem.slug]).length;
const prefix = 'interview:';
const documents = new Map<string, DocumentSource>();
for (const { title, slug, difficulty, topic } of problems) {
  const lesson = lessons[slug];
  if (!lesson) continue;
  const key = prefix + slug;
  documents.set(key, { key, title, code: lesson.code, description: 'Top Interview 150 / ' + topic + ' / ' + difficulty,
    lesson: lesson.variables, lessonGrid: lesson.grid, lessonNodeClass: lesson.nodeClass, lessonTrie: lesson.trie,
    lessonBits: lesson.bits,
    lessonHeap: lesson.heap, lessonSearch: lesson.search ? { name: lesson.search, inclusive: lesson.inclusive } : undefined });
}
export const interviewDocument = (key: string) => documents.get(key);

export const InterviewCatalog = memo(function InterviewCatalog({ active, onBack, onLesson }: { active: boolean; onBack: () => void; onLesson: (source: DocumentSource) => void }) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [readyOnly, setReadyOnly] = useState(false);
  const page = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const lastLesson = useRef<{ key: string; scrollTop: number } | null>(null);
  useLayoutEffect(() => {
    if (!active || !page.current) return;
    const last = lastLesson.current;
    const button = last && [...page.current.querySelectorAll<HTMLButtonElement>('[data-lesson]')].find(item => item.dataset.lesson === last.key);
    if (last && button) {
      page.current.scrollTop = last.scrollTop;
      button.focus({ preventScroll: true });
    } else heading.current?.focus({ preventScroll: true });
  }, [active]);
  const needle = query.trim().toLowerCase();
  const found = problems.filter(problem =>
    (!topic || problem.topic === topic) && (!difficulty || problem.difficulty === difficulty) && (!readyOnly || lessons[problem.slug]) &&
    (!needle || String(problem.id) === needle.replace(/^#\s*/, '') || [problem.title, problem.topic, problem.difficulty].some(value => value.toLowerCase().includes(needle))));
  const filtered = Boolean(query || topic || difficulty || readyOnly);
  function openLesson(document: DocumentSource) {
    lastLesson.current = { key: document.key, scrollTop: page.current?.scrollTop ?? 0 };
    onLesson(document);
  }
  function clearFilters() {
    setQuery('');
    setTopic('');
    setDifficulty('');
    setReadyOnly(false);
    if (page.current) page.current.scrollTop = 0;
    search.current?.focus({ preventScroll: true });
  }

  return <main ref={page} className="library-page interview-page" hidden={!active} aria-labelledby="interview-title">
    <div className="interview-sheet">
      <header className="interview-heading">
        <a className="interview-back" href="#" onClick={event => { event.preventDefault(); onBack(); }}><ArrowLeft size={15} />Examples</a>
        <h2 ref={heading} id="interview-title" tabIndex={-1}>Top Interview 150</h2>
        <p>Browse the official study plan in order. Open a problem to edit its Python solution in Write.</p>
        <div className="interview-meta">
          {ready < problems.length && <span><strong>{problems.length}</strong> problems</span>}
          <span><strong>{ready}</strong> runnable walkthroughs</span>
          <a href={source} target="_blank" rel="noreferrer">Official study plan <ExternalLink size={13} /></a>
        </div>
      </header>
      <div className="interview-tools">
        <label className="catalog-search"><Search size={17} /><span className="sr-only">Find interview problems</span>
          <input ref={search} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by title or problem number"
            onKeyDown={event => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing || found.length !== 1) return;
              const document = interviewDocument(prefix + found[0].slug);
              if (document) openLesson(document);
            }} /></label>
        <label className="interview-topic">Topic <select value={topic} onChange={event => setTopic(event.target.value)}>
          <option value="">All topics</option>{groups.map(name => <option key={name}>{name}</option>)}
        </select></label>
        <label className="interview-topic">Difficulty <select value={difficulty} onChange={event => setDifficulty(event.target.value)}>
          <option value="">All levels</option>{['Easy', 'Medium', 'Hard'].map(level => <option key={level}>{level}</option>)}
        </select></label>
        {ready < problems.length && <label className="interview-filter"><input type="checkbox" checked={readyOnly} onChange={event => setReadyOnly(event.target.checked)} />Walkthroughs only</label>}
        {filtered && <button type="button" className="button neutral compact" onClick={clearFilters}>Clear filters</button>}
      </div>
      <p className="catalog-count" role="status">{found.length} {found.length === 1 ? 'problem' : 'problems'}</p>
      {groups.map(name => {
        const matches = found.filter(problem => problem.topic === name);
        if (!matches.length) return null;
        return <section className="interview-group" key={name} aria-label={name}>
          <h3>{name} <span>{matches.length}</span></h3>
          <ul>{matches.map(problem => {
            const document = interviewDocument(prefix + problem.slug);
            return <li className="interview-row" key={problem.slug}>
              <span className="interview-number">{problem.id}</span>
              <a className="interview-problem" href={'https://leetcode.com/problems/' + problem.slug + '/'} target="_blank" rel="noreferrer">{problem.title}<ExternalLink size={13} aria-hidden="true" /></a>
              <span className="interview-difficulty" data-difficulty={problem.difficulty}>{problem.difficulty}</span>
              {document ? <button type="button" className="button neutral compact interview-watch" data-lesson={document.key}
                aria-label={'Watch ' + problem.title} onClick={() => openLesson(document)}><Play size={14} />Watch</button> :
                <span className="interview-status">Problem link</span>}
            </li>;
          })}</ul>
        </section>;
      })}
      {!found.length && <div className="catalog-empty">No problems match these filters.</div>}
    </div>
  </main>;
});
