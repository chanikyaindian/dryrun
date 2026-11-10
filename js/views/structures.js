import { eh } from '../core.js';
import { rep } from '../engine/js-engine.js';
import { rp } from './basic.js';

let CTE = null;
const GRAPH_NAME = /graph|adj|neigh|edge|route|road|flight|conn|friend|prereq|dep/;
const EDGE_NAME = /edge|road|flight|conn|prereq|pair/;
const PARENT_NAME = /parent|^uf$|dsu|^par$/;
const HEAP_NAME = /heap|^pq$|priority|^seg|^st$/;
const isHeap = (name, roles) => HEAP_NAME.test(name) || roles.has('@heapvar:' + name);
const plain = value => value === null || typeof value !== 'object';
const series = (heap, value) => {
  const item = heap[value?.r];
  return item && 'lts'.includes(item.k) ? item.v : null;
};

function netOf(item, step, name) {
  const heap = step.H;
  const edges = [], nodes = new Set();
  const isId = value => plain(value) && value !== undefined;
  const addEdge = (from, to, weight = '') => {
    nodes.add(from);
    nodes.add(to);
    edges.push([from, to, weight]);
  };
  function neighbors(value) {
    const nested = heap[value?.r];
    if (nested?.k === 'd') {
      return nested.v.every(([key, weight]) => isId(key) && typeof weight === 'number')
        ? nested.v : null;
    }
    const values = series(heap, value);
    if (!values) return null;
    const entries = [];
    for (const entry of values) {
      const pair = series(heap, entry);
      if (isId(entry)) entries.push([entry, '']);
      else if (pair?.length === 2 && isId(pair[0]) && typeof pair[1] === 'number') entries.push(pair);
      else return null;
    }
    return entries;
  }

  if (item.k === 'd') {
    if (item.v.length < 2 && !GRAPH_NAME.test(name)) return null;
    const keys = new Set(item.v.map(([key]) => key));
    for (const [from, value] of item.v) {
      const entries = neighbors(value);
      if (!isId(from) || !entries || (!GRAPH_NAME.test(name) && entries.some(([to]) => !keys.has(to)))) return null;
      nodes.add(from);
      entries.forEach(([to, weight]) => addEdge(from, to, weight));
    }
  } else if ('lt'.includes(item.k)) {
    const size = item.v.length;
    if (PARENT_NAME.test(name) && item.v.every(value => Number.isInteger(value) && value >= 0 && value < size)) {
      item.v.forEach((value, index) => {
        nodes.add(index);
        if (value !== index) addEdge(index, value);
      });
    } else if (/^(adjacency|graph|adj)_?matrix$/i.test(name)) {
      const rows = item.v.map(value => series(heap, value));
      if (!size || !rows.every(row => row?.length === size && row.every(value => typeof value === 'number' || typeof value === 'boolean'))) return null;
      rows.forEach((row, from) => {
        nodes.add(from);
        row.forEach((weight, to) => {
          if (weight && Number.isFinite(Number(weight))) addEdge(from, to, weight === true || weight === 1 ? '' : weight);
        });
      });
    } else if (EDGE_NAME.test(name)) {
      const rows = item.v.map(value => series(heap, value));
      if (!rows.every(row => row?.length >= 2 && row.length <= 3 && isId(row[0]) && isId(row[1]) && (row.length === 2 || typeof row[2] === 'number'))) return null;
      rows.forEach(row => addEdge(...row));
    } else if (GRAPH_NAME.test(name) && size) {
      for (const [from, row] of item.v.entries()) {
        const entries = neighbors(row);
        if (!entries) return null;
        nodes.add(from);
        entries.forEach(([to, weight]) => addEdge(from, to, weight));
      }
    } else return null;
  } else return null;

  if (!nodes.size || (!edges.length && !GRAPH_NAME.test(name) && !PARENT_NAME.test(name))) return null;
  if (nodes.size > 100 || edges.length > 300) return null;
  return {
    N: [...nodes],
    E: edges,
    dir: edges.some(([from, to, weight]) => !edges.some(([u, v, w]) => u === to && v === from && w === weight)),
  };
}

function kind(item, step, name, roles, topics) {
  if (netOf(item, step, name)) return 'net';
  if (!'lt'.includes(item.k)) return 'card';
  if (isHeap(name, roles)) return 'list';
  const rows = item.v.map(value => series(step.H, value));
  if (rows.length && rows.every(row => row && row.every(value => plain(value) || value?.p !== undefined))) {
    if (/^(points?|vertices|polygon|hull|coords|coordinates)$/i.test(name) &&
      rows.every(row => row.length === 2 && row.every(value => Number.isFinite(value) && Math.abs(value) < 1e100))) return 'points';
    const intervalName = /interv|meet|slot|range|merg|sched|job|task|event/.test(name);
    if (rows.every(row => row.length === 2 && row.every(Number.isFinite) && row[0] <= row[1]) &&
      (intervalName || topics.has('Intervals & Line Sweep'))) return 'iv';
    if (rows[0].length && rows.every(row => row.length === rows[0].length)) return 'grid';
  }
  return item.v.every(value => plain(value) || value?.p !== undefined) ? 'list' : 'card';
}

function drawPoints(element, name, item, step) {
  const points = item.v.map(value => step.H[value.r].v);
  const x = points.map(point => point[0]), y = points.map(point => point[1]);
  const left = Math.min(0, ...x), right = Math.max(0, ...x);
  const bottom = Math.min(0, ...y), top = Math.max(0, ...y);
  const scale = Math.min(256 / (right - left || 1), 156 / (top - bottom || 1));
  const sx = value => 150 + (value - (left + right) / 2) * scale;
  const sy = value => 100 - (value - (top + bottom) / 2) * scale;
  element._row = element._sig = null;
  element.innerHTML = '<div class="hd">' + eh(name) + ', ' + points.length + ' points</div>' +
    '<svg class="points" viewBox="0 0 300 200" aria-label="Coordinate plot">' +
    '<path class="eg" d="M8 ' + sy(0) + 'H292 M' + sx(0) + ' 8V192"/>' +
    points.map(([a, b]) => '<circle cx="' + sx(a) + '" cy="' + sy(b) + '" r="5"><title>(' +
      a + ', ' + b + ')</title></circle>').join('') + '</svg>';
}

function drawBits(element, name, value, previous) {
  const width = Math.max(8, Math.ceil(((value < 0n ? ~value : value).toString(2).length + Number(value < 0n)) / 8) * 8);
  const shown = Math.min(width, 64);
  const bits = BigInt.asUintN(shown, value).toString(2).padStart(shown, '0');
  const before = previous === undefined ? bits : BigInt.asUintN(shown, previous).toString(2).padStart(shown, '0');
  element.innerHTML = '<div class="hd">' + eh(name) + ' = ' + value + (value < 0n ? ' (two’s complement)' : '') +
    (width > shown ? ', lowest ' + shown + ' bits' : '') + '</div><div class="bits">' +
    [...bits].map((bit, index) => '<span class="' + (before[index] !== bit ? 'chg' : '') +
      '" title="Bit ' + (shown - index - 1) + '">' + bit + '</span>').join('') + '</div>';
}
function drawNet(el,nm,h,s,fr){const {N,E,dir}=netOf(h,s,nm),W=Math.min(480,Math.max(300,N.length*54)),Hh=Math.round(W*.62),sig=JSON.stringify([nm,N,E]);el._row=null;
  const pos=new Map(N.map((n,i)=>{const a=i/N.length*6.2832-1.5708;return[n,[W/2+Math.cos(a)*(W/2-34),Hh/2+Math.sin(a)*(Hh/2-32)]];}));
  if(el._sig!==sig){el._sig=sig;
    el.innerHTML=`<div class="hd">${eh(nm)}, graph with ${N.length} nodes</div><svg width="${W}" height="${Hh}" style="color:var(--mu)"><defs><marker id="ar2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="currentColor"/></marker></defs>`+
    E.map(([a,b,w])=>{const [x1,y1]=pos.get(a),[x2,y2]=pos.get(b);if(a===b)return `<path class="eg" d="M${x1-9},${y1-12}C${x1-26},${y1-38} ${x1+26},${y1-38} ${x1+9},${y1-12}"/>`;const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,u=dx/L,v=dy/L;
      return`<line class="eg" x1="${x1+u*17}" y1="${y1+v*17}" x2="${x2-u*(dir?20:17)}" y2="${y2-v*(dir?20:17)}"${dir?' marker-end="url(#ar2)"':''}/>`+(w!==''?`<text class="ew" x="${(x1+x2)/2+5}" y="${(y1+y2)/2-3}">${eh(w)}</text>`:'');}).join('')+
    N.map(n=>`<g class="gn" transform="translate(${pos.get(n)})"><circle r="17"/><text y="5">${eh(n)}</text><text class="dd" y="32"></text></g>`).join('')+'</svg>';}
  const vis=new Set(),dd=new Map(),cu=new Set(),nbs=new Set();
  fr.forEach(f=>Object.entries(f.v).forEach(([k,v])=>{
    if(v&&v.r){const o=s.H[v.r];
      if(/visit|seen|done|explored|processed|order|result|^res$|^vis$/.test(k)){if(o.k=='d')o.v.forEach(([a])=>vis.add(a));else{const bl=o.v.length&&o.v.every(x=>typeof x=='boolean');o.v.forEach((x,i)=>{if(bl){if(x)vis.add(i);}else if(!x||typeof x!='object')vis.add(x);});}}
      else if(/dist|cost|level|depth/.test(k)){if(o.k=='d')o.v.forEach(([a,b])=>{if(!b||typeof b!='object')dd.set(a,b);});else if(o.k=='l')o.v.forEach((b,i)=>{if(!b||typeof b!='object')dd.set(i,b);});}}
    else if(/^(node|u|cur|curr|current|start|src|source|vertex)$/.test(k))cu.add(v);else if(/^(nb|v|neighbor|neighbour|nxt|child|nei)$/.test(k))nbs.add(v);}));
  el.querySelectorAll('.gn').forEach((g,i)=>{const n=N[i];g.classList.toggle('vis',vis.has(n));g.classList.toggle('cu',cu.has(n));g.classList.toggle('nb',nbs.has(n)&&!cu.has(n));g.querySelector('.dd').textContent=dd.has(n)?rp(s.H,dd.get(n)):'';});}
function drawGrid(el,nm,h,s,pv,pt){el._row=null;el._sig=null;const H=s.H,rows=h.v.map(x=>H[x.r]),m=rows[0].v.length,P=pv&&pv.H,
  cr=pt.r!==undefined?pt.r:pt.i!==undefined?pt.i:pt.row,cc=pt.c!==undefined?pt.c:pt.j!==undefined?pt.j:pt.col;
  el.innerHTML=`<div class="hd">${eh(nm)}, ${rows.length} by ${m}</div><div class="gr" style="grid-template-columns:repeat(${m},minmax(26px,44px))">`+
  rows.map((r,i)=>r.v.map((v,j)=>{const rid=h.v[i].r,o=P&&P[rid]?P[rid].v[j]:v;return`<div class="g${o!==v?' chg':''}${i===cr&&j===cc?' cu':''}${s.rd&&s.rd.includes(rid+':'+j)?' rd':''}">${eh(v?.p ?? rep(v))}</div>`;}).join('')).join('')+'</div>';}
function drawIv(el,nm,h,s,pt){el._row=null;el._sig=null;const rows=h.v.map(x=>s.H[x.r].v),mn=Math.min(...rows.map(r=>r[0])),mx=Math.max(...rows.map(r=>r[1])),sp=(mx-mn)||1;
  el.innerHTML=`<div class="hd">${eh(nm)}, ${rows.length} intervals</div><div class="iv" style="height:${rows.length*26+22}px">`+rows.map((r,i)=>`<div class="ib${i===pt.i?' on':''}" style="left:${(r[0]-mn)/sp*90}%;width:${Math.max(6,(r[1]-r[0])/sp*90)}%;top:${i*26}px">[${r[0]}, ${r[1]}]</div>`).join('')+`<div class="ia" style="top:${rows.length*26+4}px"><span>${mn}</span><span>${mx}</span></div></div>`;}
function heapTree(el,a,b,ptrs,H){const n=a.length;if(n<=b)return;if(!el._tr||!el.contains(el._tr)){el._tr=document.createElement('div');el._tr.className='ht';el.insertBefore(el._tr,el.children[1]);}
  const rows=[];for(let i=b?1:0;i<n;i++){const L=Math.floor(Math.log2(b?i:i+1)),f=b?1<<L:(1<<L)-1;rows.push({i,L,x:(i-f+.5)/(1<<L)*100,v:a[i]});}
  const old=el._ha||a,pi=new Set(ptrs.map(p=>p[1])),lv=rows[rows.length-1].L+1;el._tr.style.height=lv*46+8+'px';
  el._tr.innerHTML='<svg>'+rows.filter(r=>r.i>(b?1:0)).map(r=>{const p=rows.find(q=>q.i==(b?r.i>>1:(r.i-1)>>1));return`<line x1="${p.x}%" y1="${p.L*46+28}" x2="${r.x}%" y2="${r.L*46}"/>`;}).join('')+'</svg>'+
  rows.map(r=>`<div class="hn${old[r.i]!==r.v?' chg':''}${pi.has(r.i)?' on':''}" style="left:${r.x}%;top:${r.L*46}px">${eh(r.v && typeof r.v === 'object' ? rp(H,r.v) : rep(r.v))}</div>`).join('');el._ha=a.slice();}
/* Index the calls once. Inspect uses an overview and Watch uses a focused branch. */
function buildCallForest(events) {
  const nodes = [], stack = [];
  for (const event of events) {
    if (event.t === 'c') {
      const parent = stack.at(-1);
      const node = { id: nodes.length, k: [], born: event.s, end: Infinity, d: stack.length, lab: event.lab, p: parent, rv: undefined };
      if (parent !== undefined) nodes[parent].k.push(node.id);
      stack.push(node.id);
      nodes.push(node);
    } else {
      const id = stack.pop();
      if (id !== undefined) {
        nodes[id].end = event.s;
        nodes[id].rv = event.rv;
      }
    }
  }
  return nodes;
}
function buildTree(evs){const calls=buildCallForest(evs),total=calls.length;
  const nodes=calls.slice(0,90).map(node=>({...node,k:node.k.filter(id=>id<90)}));
  if(!nodes.length)return null;
  let cx=0;const lay=n=>{if(!n.k.length)n.x=cx++;else{n.k.forEach(c=>lay(nodes[c]));n.x=(nodes[n.k[0]].x+nodes[n.k[n.k.length-1]].x)/2;}};
  nodes.filter(n=>n.p===undefined).forEach(lay);
  const gx=Math.max(70,Math.max(...nodes.map(n=>n.lab.length))*7.4+16);
  return{n:nodes,total,gx,W:Math.ceil(cx*gx+10),H:(Math.max(...nodes.map(n=>n.d))+1)*50+14};}
function drawCT(wrap,CT,d){
  if(!CT||CT.n[0]?.born>d){if(CTE)CTE.style.display='none';return;}
  if(!CTE||!wrap.contains(CTE)){CTE=document.createElement('div');CTE.className='obj ct';CTE.dataset.vizId='calls';CTE.dataset.zoomable='';}
  if(!wrap.contains(CTE))wrap.appendChild(CTE);CTE.style.display='';
  const on=n=>n.born<=d&&d<n.end,N=CT.n.filter(n=>n.born<=d),act=N.filter(on),cn=act[act.length-1],X=n=>n.x*CT.gx+CT.gx/2;
  const signature = N.length + ':' + act.map(node => node.id).join(',');
  if (CTE._callSignature === signature) return;
  CTE._callSignature = signature;
  CTE.innerHTML=`<div class="hd">Call tree, ${N.length} of ${CT.total} calls${CT.total > CT.n.length ? ' (first ' + CT.n.length + ' shown)' : ''}</div><svg width="${CT.W}" height="${CT.H}">`+
  N.filter(n=>n.p!==undefined).map(n=>{const p=CT.n[n.p];return`<line class="${on(n)?'ca':''}" x1="${X(p)}" y1="${p.d*50+30}" x2="${X(n)}" y2="${n.d*50+6}"/>`;}).join('')+
  N.map(n=>`<g class="cn${on(n)?' on':' dn'}${n===cn?' cur':''}" transform="translate(${X(n)},${n.d*50+18})"><rect x="${-n.lab.length*3.7-7}" y="-12" width="${n.lab.length*7.4+14}" height="24" rx="7"/><text y="4">${eh(n.lab)}</text>${n.end<=d?`<text class="rv" y="27">${eh(n.rv)}</text>`:''}</g>`).join('')+'</svg>';}


const callCard = () => CTE;
const resetCalls = () => { CTE = null; };
export { isHeap, netOf, kind, drawPoints, drawBits, drawNet, drawGrid, drawIv, heapTree, buildCallForest, buildTree, drawCT, callCard, resetCalls };
