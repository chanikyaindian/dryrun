/* Pattern detector: scores the source text plus trace signals (@deep, @rec, @dp1, @dp2, @memo) against each topic. */
const PAT=[
['Arrays, Strings & Hashing','Scan once and remember what you have seen in a hash map.',[/seen|freq|counter|defaultdict|hashmap|\bmp\b/,2,/ in (seen|mp|freq|count)\b|\.get\(/,2,/\.(join|split|isalpha|isdigit)\(|ord\(/,1]],
['Two Pointers','Two indexes close in on each other so each element is visited once.',[/while \w+ *< *\w+/,1,/\b(l|left|lo|i) *\+= *1/,1,/\b(r|right|hi|j) *-= *1/,2,/left.*right/,1]],
['Sliding Window','A window grows on the right and shrinks on the left while a running value is kept.',[/for (r|right|end|j)\b/,2,/\b(l|left|start) *\+= *1/,2,/window|longest|max_len|best/,1,/while .*(>|<=?) *k\b/,2]],
['Prefix Sum & Kadane','Running totals answer range sums and best-subarray questions in one pass.',[/prefix|presum|cumul/,3,/max_ending|cur_sum|curr_sum|current_sum|kadane|max_sum/,3,/max\([^,]+, *\w+ *\+/,3]],
['Linked List & In-place Reversal','Nodes are relinked in place. Watch the next arrows flip.',[/\.next/,3,/prev *= *none|\.next *= *prev/,2,/slow|fast|dummy/,1]],
['Stack & Monotonic Stack','Push and pop at one end. A monotonic stack pops while the top breaks the order.',[/stack|stk/,3,/while \w*(stack|stk)\w* and/,3]],
['Queue & Monotonic Queue','First in, first out. A monotonic queue also pops from the back to keep order.',[/queue|deque|popleft|\bdq\b/,3,/while \w*(dq|deque|q)\w* and .*\[-1\]/,2]],
['Sorting & Selection','Elements are compared and swapped until the order is right.',[/\[j\] *> *\w+\[j *\+ *1\]|pivot|partition|bubble|insertion|merge_sort|quick|key *= *\w+\[\w+\]|while \w+ *>= *0 and/,3,/\.sort\(|sorted\(/,1,/min_idx|min_index|selection/,3]],
['Binary Search','The search range halves around mid on every step.',[/\bmid\b/,2,/\/\/ *2|>> *1/,2,/= *mid *[+-] *1/,3]],
['Recursion & Divide and Conquer','A function calls itself on smaller inputs. The call tree shows how.',[/@rec/,3,/merge|divide|conquer|\bmid\b/,1,/@deep/,1]],
['Backtracking','Choose, explore, then undo the choice to try the next option.',[/path|permut|subset|combin|backtrack|board|\bused\b|\bres\b/,2,/\.append\([^)]*\)[\s\S]*\.pop\(\)/,2,/@rec/,1]],
['Tree Traversal (DFS & BFS)','Visit every node: depth-first by recursion, breadth-first with a queue.',[/\.left|\.right/,3,/inorder|preorder|postorder|level|root/,2]],
['Binary Search Tree (BST)','Smaller keys go left and larger go right, so a search skips half the tree.',[/\.left|\.right/,2,/(key|val|data) *< *\w+\.(key|val|data)|< *root\.|> *root\./,3,/bst|insert/,1]],
['Trie','Each edge is a letter, so words share their prefixes.',[/children|trie/,3,/is_end|end_of_word|is_word|\.end\b/,2]],
['Heap & Priority Queue','The smallest (or largest) item always sits at the top of the tree.',[/heapq|heappush|heappop|heapify/,4,/heap|\bpq\b|priority/,1]],
['Intervals & Line Sweep','Sort by start, then merge or sweep across overlapping ranges.',[/interval|merged|meeting|sweep|events/,3,/\[0\]|\[1\]/,1,/sort\(.*(key|\[0\])/,1]],
['Data Structure Design','A class bundles data with operations that stay fast together.',[/class \w+/,1,/def __init__/,2,/def (get|put|push|pop|add|remove|insert|top|peek)\b/,2,/cache|capacity|lru/,2]],
['Greedy Algorithms','Take the locally best choice at each step and never look back.',[/greedy|reach|farthest|profit|coins|\bcost\b/,2,/sort\(/,1]],
['Graph Traversal (DFS & BFS)','Explore nodes through their neighbours and mark each one visited once.',[/graph|adj|neighbo|visited|\bseen\b/,2,/dfs|bfs/,2,/for \w+ in (graph|adj)\[/,3]],
['Advanced Graph Algorithms','Weighted paths, orderings and components: Dijkstra, topological sort, union-find.',[/dijkstra|dist\[|indegree|topo|union|find\(|parent\[|kruskal|bellman|floyd|mst/,3,/heapq/,1,/weight/,1]],
['1D Dynamic Programming','Each dp[i] is built from earlier cells. The dashed rings show which.',[/@dp1/,3,/dp\[\w+ *- *[12]\]/,3]],
['Knapsack DP','Choose items under a capacity. Each cell is take or skip.',[/knap|capacity|weights|\bwt\b|values/,4,/max\(dp/,2]],
['2D & Grid Dynamic Programming','A table filled cell by cell from its neighbours.',[/@dp2|grid|matrix/,3,/dp\[\w+\]\[\w+\]/,2]],
['Advanced Dynamic Programming','Memoised states or bitmasks: remember sub-answers so none is solved twice.',[/@memo|lru_cache|bitmask|\bmask\b|lcs|lis|edit_dist/,3]],
['Maths, Geometry, String Matching & Range Queries','Number theory, geometry, pattern matching and BIT or segment-tree queries.',[/gcd|prime|sqrt|pow\(|% *\w+ *== *0|\bmod\b/,2,/kmp|lps|pattern|rabin/,3,/fenwick|\bbit\b|seg|i *& *-i|query|update/,3,/cross|point/,1]]];
PAT.push(
  ['Dijkstra & Shortest Paths', 'Track the best known distance and improve it when a shorter route appears.',
    [/\bdijkstra\b|\bshortest_paths?\b/, 5, /@heap/, 2, /\b(dist|distance)\[.*\] *>/, 2, /\b(new_dist|alt|relax)\b/, 2]],
  ['Topological Sort', 'Process dependencies only after their prerequisites have been handled.',
    [/topological|topo_sort|\bindegree\b|\bin_degree\b/, 5, /@deque|popleft/, 1]],
  ['Disjoint Set Union', 'Track representatives and merge sets by updating their parent links.',
    [/union_find|disjoint.set|\bdsu\b/, 5, /\bparent\[[^\]]+\] *= *(find|parent)\(/, 3, /def union\(|path_compression|union_by_rank/, 3]],
  ['Minimum Spanning Tree', 'Add edges that connect components while avoiding cycles.',
    [/kruskal|prim_mst|minimum_spanning|\bmst\b/, 6, /@sort|@heap/, 1]],
  ['Fenwick Tree', 'Move through cumulative ranges using the lowest set bit of the index.',
    [/@lowbit/, 5, /fenwick|binary_indexed_tree/, 6]],
  ['Segment Tree', 'Build interval summaries and combine them to answer range queries.',
    [/segment_tree|segmenttree|\bsegtree\b/, 6, /\b(query|update)\(/, 1, /2 *\* *node|node *<< *1/, 2]],
  ['String Matching', 'Compare text against a pattern and track the match position.',
    [/\bkmp\b|rabin_karp|z_algorithm|prefix_function|\blps\[/, 6, /@matchtext/, 3]],
  ['Bit Manipulation', 'Use bit positions to represent flags, sets, or compact state.',
    [/bit_count\(|bitmask|\bpopcount\b/, 5, /\b1 *<< *\w+/, 2, /\bmask\b.*[&|^]/, 2]],
  ['Number Theory', 'Use divisibility and arithmetic identities to simplify numeric problems.',
    [/\bsieve\b|\bprime\b|@number/, 4, /\bgcd\b|\blcm\b|\bmod_inverse\b/, 2]],
  ['Computational Geometry', 'Use points and orientation tests to reason about positions and intersections.',
    [/convex_hull|cross_product|orientation\(|line_intersection|shoelace/, 6]],
  ['Combinatorics', 'Enumerate or count combinations, permutations, and other selections.',
    [/@combinatorics|\bn_choose_k\b/, 4, /permutations\(|combinations\(/, 2]],
  ['Prefix Sums', 'Accumulate running totals so a range can be queried by subtracting two of them.',
    [/@prefix/, 5, /\bprefix\[.+\] *- *prefix\[/, 4]],
  ['Memoization', 'Cache a result by its input so a repeated call can reuse it.',
    [/@memo/, 4, /@rec/, 1, /lru_cache|functools\.cache/, 1]],
);
/* Hybrid detector: AST features from CPython (@tokens), behaviour seen in the trace, and name hints. */
const EXTRA={'Sorting & Selection':[/@swap/,4],'Two Pointers':[/@converge/,4],'Sliding Window':[/@window/,4],'Binary Search':[/@binhalf/,4],'Backtracking':[/@choose/,4],'Linked List & In-place Reversal':[/@relink/,3],'Prefix Sum & Kadane':[/@kadane/,4],'1D Dynamic Programming':[/@recur1/,2],'2D & Grid Dynamic Programming':[/@recur2/,3],'Recursion & Divide and Conquer':[/@rec2/,1],'Advanced Dynamic Programming':[/@memo/,2]};
PAT.forEach(p=>EXTRA[p[0]]&&p[2].push(...EXTRA[p[0]]));
const API_RULES = {
  'Arrays, Strings & Hashing': [/@frequency/, 4],
  'Queue & Monotonic Queue': [/@deque/, 3],
  'Heap & Priority Queue': [/@heap/, 5],
  'Binary Search': [/@bisect/, 7],
  'Sorting & Selection': [/@sort/, 2],
  'Linked List & In-place Reversal': [/@links/, 4],
  'Tree Traversal (DFS & BFS)': [/@tree/, 3],
  'Binary Search Tree (BST)': [/if (key|val|data) *[<>] *\w+\.(key|val|data)/, 3],
  'Graph Traversal (DFS & BFS)': [/@adjloop/, 3],
  'Trie': [/@trie/, 5],
};
for (const [name, , rules] of PAT) if (API_RULES[name]) rules.push(...API_RULES[name]);
const WHY={'@swap':'two items trade places in one statement','@converge':'one index moves up while another moves down','@window':'an index advances inside the loop while the loop variable also advances','@binhalf':'a midpoint is computed and becomes a new bound','@choose':'append, recurse, then pop (choose, explore, undo)','@relink':'next and prev links are reassigned','@kadane':'a running best is compared with itself plus the next item','@recur1':'each cell is built from an earlier cell','@recur2':'each table cell is built from neighbouring cells','@rec2':'the function calls itself more than once','@rec':'the function calls itself','@memo':'results are cached','@deep':'calls nest more than two levels'};
Object.assign(WHY, {
  '@bisect': 'the code calls a bisect routine',
  '@heap': 'the code uses priority queue operations',
  '@deque': 'the code uses a deque or removes from the front',
  '@frequency': 'a Counter stores frequencies',
  '@prefix': 'the code accumulates running values',
  '@number': 'the code calls a number-theory routine',
  '@combinatorics': 'itertools enumerates combinations, permutations, or products',
  '@lowbit': 'an index is masked with its negation',
  '@sort': 'the code sorts a collection',
  '@links': 'objects link to each other through next or prev',
  '@tree': 'objects link to left or right children',
  '@trie': 'objects branch by character and mark word endings',
  '@matchtext': 'the code calls a regular expression routine',
  '@adjloop': 'a loop visits neighbors from an adjacency map',
});
export function detect(src,S,feat){
  // Ignore comments and literal contents when applying source-name rules.
  let t=src.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|#[^\r\n]*/g,
    text => text.replace(/[^\r\n]/g, ' ')).toLowerCase();
  const tok=new Set((feat||[]).filter(signal => !signal.startsWith('@heapvar:') && signal !== '@exception'));
  const md=Math.max(...S.map(x=>x.F.length));
  if(md>2)tok.add('@deep');
  if(!feat){if(md>2&&[...t.matchAll(/def (\w+)\(/g)].some(m=>(t.match(new RegExp('\\b'+m[1]+'\\(','g'))||[]).length>=3))tok.add('@rec');if(/lru_cache|@cache|memo/.test(t))tok.add('@memo');}
  if(/dp\[/.test(t))tok.add(/dp\[[^\]]+\]\[/.test(t)?'@dp2':'@dp1');
  let sw=0;for(let i=1;i<S.length;i++){const a=S[i-1].H,b=S[i].H;for(const id in b){const p=a[id],q=b[id];if(p&&q&&p.k=='l'&&q.k=='l'&&p.v.length==q.v.length){const df=[];p.v.forEach((x,j)=>{if(x!==q.v[j])df.push(j);});if(df.length==2&&p.v[df[0]]===q.v[df[1]]&&p.v[df[1]]===q.v[df[0]])sw++;}}}
  if(sw)tok.add('@swap');
  const stride = Math.max(1, Math.ceil(S.length / 160));
  const iteratedMaps = new Set([...t.matchAll(/\bfor\s+\p{ID_Start}\p{ID_Continue}*\s+in\s+([_\p{ID_Start}]\p{ID_Continue}*)\s*\[/gu)].map(match => match[1]));
  for (let i = S.length - 1; i >= 0; i -= stride) {
    const heap = S[i].H;
    if (iteratedMaps.size && !tok.has('@adjloop')) {
      for (const frame of S[i].F) {
        for (const [name, reference] of Object.entries(frame.v)) {
          if (!iteratedMaps.has(name.toLowerCase())) continue;
          const value = heap[reference?.r];
          if (value?.k !== 'd' || value.v.length < 2) continue;
          const keys = new Set(value.v.map(([key]) => key));
          const neighbors = value.v.map(([, ref]) => heap[ref?.r]);
          if (neighbors.every(row => row && 'lts'.includes(row.k) && row.v.every(node => keys.has(node))) &&
            neighbors.some(row => row.v.length)) tok.add('@adjloop');
        }
      }
    }
    for (const value of Object.values(heap)) {
      if (value.k !== 'o') continue;
      const fields = new Map(value.v);
      for (const [signal, keys] of [['@links', ['next', 'prev']], ['@tree', ['left', 'right']]]) {
        if (keys.some(key => heap[fields.get(key)?.r]?.k === 'o')) tok.add(signal);
      }
      const children = heap[fields.get('children')?.r];
      if (children?.k === 'd' && fields.size > 1 && children.v.some(([key, child]) => typeof key === 'string' && key.length === 1 && heap[child?.r]?.k === 'o')) {
        if ([...fields].some(([key, flag]) => /end|word|terminal/.test(key) && typeof flag === 'boolean')) tok.add('@trie');
      }
    }
  }
  t+=' '+[...tok].join(' ');
  return PAT.map(([n,d,r])=>{let x=0;const why=[];for(let i=0;i<r.length;i+=2)if(r[i].test(t)){x+=r[i+1];const k=[...tok].find(z=>r[i].test(z));if(k&&WHY[k]&&!why.includes(WHY[k]))why.push(WHY[k]);}return{n,d,x,why};}).filter(o=>o.x>=3).sort((a,b)=>b.x-a.x).slice(0,3);}
