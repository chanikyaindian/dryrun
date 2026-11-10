import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, Binary, Braces, CodeXml, GitFork, Layers3, ListTree, Play, Search } from 'lucide-react';
import { SAMPLES } from '../js/samples.js';

export type ExampleName = keyof typeof SAMPLES;
type Group = 'Arrays' | 'Search' | 'Graphs and trees' | 'Recursion' | 'Backtracking' | 'Dynamic programming' | 'Collections';
const topics: [ExampleName, Group, string][] = [
  ['Bubble sort', 'Arrays', 'Compare neighbors and swap them when they’re out of order.'],
  ['Binary search', 'Search', 'Cut a sorted search range in half at each probe.'],
  ['Insertion sort', 'Arrays', 'Shift values aside to insert the next item into a sorted prefix.'],
  ['Recursion (Fibonacci)', 'Recursion', 'Follow calls down to their base cases, then combine the returns.'],
  ['Linked list reverse', 'Graphs and trees', 'Reverse a list by rewiring one next pointer at a time.'],
  ['Binary search tree', 'Graphs and trees', 'Insert keys by comparing them with the nodes along a branch.'],
  ['BFS with queue', 'Graphs and trees', 'Explore outward from a starting node using a queue.'],
  ['Sliding window', 'Arrays', 'Carry a running sum as a fixed-size window moves.'],
  ['Monotonic stack', 'Collections', 'Keep candidates in order and remove them as they’re resolved.'],
  ['Kadane', 'Dynamic programming', 'Track the best subarray ending at the current index.'],
  ['Heap', 'Collections', 'Insert values and remove them in priority order.'],
  ['Grid DP', 'Dynamic programming', 'Build each cell from the paths counted above and to its left.'],
  ['Knapsack', 'Dynamic programming', 'Update the best value possible for each capacity.'],
  ['Intervals', 'Arrays', 'Sort ranges and combine overlapping neighbors.'],
  ['Trie', 'Graphs and trees', 'Share common prefixes as strings are added to a tree.'],
  ['Subsets (backtracking)', 'Backtracking', 'Make an include-or-skip decision for each element.'],
  ['Permutations', 'Backtracking', 'Choose an unused value, save a complete path, and undo the choice.'],
  ['Two Sum (dict)', 'Search', 'Look up the complement of each number in a dictionary.'],
];
const icons = { Arrays: Layers3, Search: Search, 'Graphs and trees': GitFork, Recursion: ListTree, Backtracking: GitFork, 'Dynamic programming': Binary, Collections: Braces };
const groups = [...new Set(topics.map(([, group]) => group))];
export const exampleNames = Object.keys(SAMPLES) as ExampleName[];
export const exampleDescription = (name: string) => topics.find(([key]) => key === name)?.[2];

export function Library({ active, onExample, onWrite, onInterview }: { active: boolean; onExample: (name: ExampleName) => void; onWrite: () => void; onInterview: () => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Group | 'All'>('All');
  const result = useMemo(() => topics.filter(([name, group, summary]) =>
    (filter === 'All' || group === filter) && (name + ' ' + group + ' ' + summary).toLowerCase().includes(query.trim().toLowerCase())), [filter, query]);

  return <main className="library-page" hidden={!active} aria-labelledby="library-title">
    <section className="library-intro">
      <div className="library-lead">
        <h2 id="library-title" tabIndex={-1}>See Python<br />step by step.</h2>
        <p>Watch an algorithm make decisions, or bring your own code and follow the changes it makes.</p>
        <div className="library-start">
          <button className="button primary" type="button" onClick={onWrite}><CodeXml />Write Python</button>
          <a className="button neutral" href="#interview" onClick={event => { event.preventDefault(); onInterview(); }}>Top Interview 150</a>
          <a className="button library-anchor" href="#library-examples" onClick={event => {
            event.preventDefault();
            document.getElementById('library-examples')?.scrollIntoView({ block: 'start' });
            document.getElementById('library-examples')?.focus({ preventScroll: true });
          }}>Browse examples<ArrowDown /></a>
        </div>
      </div>
      <button className="library-feature" type="button" aria-label="Watch Bubble sort" onClick={() => onExample('Bubble sort')}>
        <span className="feature-heading"><span>Bubble sort</span><span className="feature-open"><Play size={17} /></span></span>
        <span className="feature-plot" aria-hidden="true">
          {[5, 2, 9, 1, 6].map((value, index) => <span className="feature-bar" key={value} data-compare={index < 2} style={{ height: (value + 2) * 9 + '%' }}>{value}</span>)}
        </span>
        <span className="feature-foot">Compare neighboring values<ArrowUpRight size={16} /></span>
      </button>
    </section>
    <section className="library-examples" id="library-examples" tabIndex={-1} aria-labelledby="examples-title">
      <div className="catalog-heading"><div><h3 id="examples-title">Example library</h3><p>Pick a topic and start a replay.</p></div>
        <label className="catalog-search"><Search size={17} /><span className="sr-only">Filter examples</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an algorithm" /></label>
      </div>
      <div className="catalog-filters" role="group" aria-label="Filter by topic">
        {(['All', ...groups] as const).map(group => <button type="button" key={group} aria-pressed={filter === group} onClick={() => setFilter(group)}>{group}</button>)}
      </div>
      <p className="catalog-count" aria-live="polite">{result.length} {result.length === 1 ? 'example' : 'examples'}</p>
      {result.length ? <div className="catalog-grid">{result.map(([name, group, summary]) => {
        const Icon = icons[group];
        return <button type="button" key={name} className="example-option catalog-card" aria-label={name} onClick={() => onExample(name)}>
          <span className="catalog-card-type"><Icon size={17} />{group}</span>
          <strong>{name.replace(/ \(backtracking\)$/i, '')}</strong>
          <span className="catalog-card-summary">{summary}</span>
          <ArrowUpRight className="catalog-arrow" size={18} />
        </button>;
      })}</div> : <div className="catalog-empty"><p>No examples match those filters.</p>
        <div className="catalog-recovery">
          <button type="button" className="button neutral" onClick={() => { setQuery(''); setFilter('All'); }}>Clear filters</button>
          <button type="button" className="button neutral" onClick={() => onExample('Permutations')}>Try permutations</button>
          <button type="button" className="button primary" onClick={onWrite}>Use custom code</button>
        </div></div>}
    </section>
  </main>;
}
