type PointerRows = Record<string, string[]>;

const pointers: Record<string, PointerRows> = {
  'merge-sorted-array': { nums: ['left', 'write'], other: ['right'] },
  'remove-element': { nums: ['read', 'write'] },
  'remove-duplicates-from-sorted-array': { nums: ['read', 'write'] },
  'remove-duplicates-from-sorted-array-ii': { nums: ['read', 'write'] },
  'rotate-array': { nums: ['left', 'right'] },
  'best-time-to-buy-and-sell-stock-ii': { prices: ['day'] },
  'jump-game': { nums: ['index', 'reach'] },
  'jump-game-ii': { nums: ['index', 'boundary', 'reach'] },
  'h-index': { buckets: ['h'] },
  'product-of-array-except-self': { nums: ['index'], result: ['index'] },
  'gas-station': { gas: ['station', 'start'], cost: ['station'] },
  candy: { ratings: ['index'], candies: ['index'] },
  'trapping-rain-water': { height: ['left', 'right'] },
  'length-of-last-word': { text: ['index'] },
  'reverse-words-in-a-string': { words: ['index'] },
  'zigzag-conversion': { rows: ['row'] },
  'find-the-index-of-the-first-occurrence-in-a-string': { text: ['start'] },
  'text-justification': { words: ['start', 'end'] },
  'valid-palindrome': { text: ['left', 'right'] },
  'is-subsequence': { pattern: ['matched'], text: ['index'] },
  'two-sum-ii-input-array-is-sorted': { nums: ['left', 'right'] },
  'container-with-most-water': { heights: ['left', 'right'] },
  '3sum': { nums: ['anchor', 'left', 'right'] },
  'two-sum': { nums: ['index'] },
  'contains-duplicate-ii': { nums: ['index'] },
  'summary-ranges': { nums: ['start', 'end'] },
  'insert-interval': { intervals: ['index'] },
  'letter-combinations-of-a-phone-number': { digits: ['index'] },
  permutations: { nums: ['i'], used: ['i'] },
  'convert-sorted-array-to-binary-search-tree': { nums: ['low', 'mid', 'high'] },
  'maximum-subarray': { nums: ['index'] },
  'median-of-two-sorted-arrays': { first: ['cut'], second: ['other'] },
  'find-k-pairs-with-smallest-sums': { first: ['i'], second: ['j'] },
  'add-binary': { first: ['left'], second: ['right'] },
  'plus-one': { digits: ['index'] },
  'max-points-on-a-line': { points: ['anchor', 'other'] },
  'word-break': { reachable: ['start', 'end'], text: ['start'] },
  'coin-change': { fewest: ['amount'] },
  'longest-increasing-subsequence': { tails: ['low', 'high'] },
  triangle: { best: ['col'] },
  'longest-palindromic-substring': { text: ['left', 'center', 'right'] },
  'best-time-to-buy-and-sell-stock-iv': { hold: ['transaction'], sold: ['transaction'] },
};

const windows: Record<string, { row: string; chunkSize?: string }> = {
  'minimum-size-subarray-sum': { row: 'nums' },
  'longest-substring-without-repeating-characters': { row: 'text' },
  'substring-with-concatenation-of-all-words': { row: 'text', chunkSize: 'width' },
  'minimum-window-substring': { row: 'text' },
};

export function walkthroughPointers(slug: string, source: string, variables: string[], search?: string) {
  const window = windows[slug];
  const rows = new Map<string, string[]>();
  for (const match of source.matchAll(/\b(\w+)\[([A-Za-z_]\w*)\]/g)) {
    const [, row, pointer] = match;
    if (!variables.includes(row) || !variables.includes(pointer)) continue;
    const names = rows.get(row) ?? [];
    if (!names.includes(pointer)) names.push(pointer);
    rows.set(row, names);
  }
  for (const [row, names] of Object.entries(pointers[slug] ?? {})) rows.set(row, names);
  if (window) rows.set(window.row, ['left', 'right']);
  if (search) rows.set(search, ['low', 'mid', 'high']);
  return { rows, window };
}
