import { eh, RM } from '../core.js';
import { rep } from '../engine/js-engine.js';

let kc = 0, duration = 336;
const GK = new Map();
function rp(heap, value, depth = 0) {
  if (value?.p !== undefined) return value.p;
  if (value?.f) return '<' + (value.c ? 'class ' : 'function ') + value.f + '>';
  if (!value?.r) return Number.isNaN(value) ? 'nan' : rep(value, 1);
  const item = heap[value.r];
  if (!item || depth > 2) return '…';
  if (item.k === 'o' && depth) return '<' + item.c + '>';
  const inner = item.v.slice(0, 8).map(entry => {
    if (item.k === 'd' || item.k === 'o') {
      const [key, field] = entry;
      return (item.k === 'd' ? rep(key, 1) + ': ' : key + '=') + rp(heap, field, depth + 1);
    }
    return rp(heap, entry, depth + 1);
  });
  if (item.v.length > 8) inner.push('…');
  const text = inner.join(', ');
  if (item.k === 'o') return item.c + '(' + text + ')';
  if (item.k === 's' || item.k === 'd') return item.k === 's' && !text ? 'set()' : '{' + text + '}';
  if (item.k === 't') return '(' + text + (inner.length === 1 ? ',' : '') + ')';
  return '[' + text + ']';
}

function keysFor(prev,pk,arr){const used=new Set(),res=new Array(arr.length);
  arr.forEach((v,i)=>{if(pk[i]!==undefined&&prev[i]===v){res[i]=pk[i];used.add(pk[i]);}});
  arr.forEach((v,i)=>{if(res[i]!==undefined)return;let b=-1;
    for(let q=0;q<prev.length;q++){if(used.has(pk[q])||prev[q]!==v)continue;if(b<0||Math.abs(q-i)<Math.abs(b-i))b=q;}
    if(b>=0){res[i]=pk[b];used.add(pk[b]);}else res[i]='n'+(++kc);});return res;}
function drawList(el,name,h,ptrs,id,s){
  const a=h.v,n=a.length,W=Math.max(26,Math.min(56,Math.floor((el.clientWidth||600)/Math.max(n,1))-2));
  if(!el._row){el.innerHTML='<div class="hd"></div><div class="row"></div>';el._row=el.lastChild;el._c=new Map();el._p=new Map();el._k=[];el._a=[];el._ix=[];el._seen=0;el._sig=null;}
  const row=el._row,first=!el._seen;el._seen=1;
  const primary = name.split(', ')[0];
  const label = /^s:/.test(id) ? 'string' : /stack|^stk$/.test(primary) ? 'stack' :
    /queue|deque|^dq$/.test(primary) ? 'queue' : h.label || (h.k === 't' ? 'tuple' : 'array');
  el.firstChild.textContent=`${name}, ${label}[${n}]`;
  const num=n>0&&a.every(x=>typeof x=='number'&&isFinite(x)),mn=num?Math.min(...a,0):0,mx=num?Math.max(...a,1):1;
  const hh=v=>num?Math.round(28+(v-mn)/((mx-mn)||1)*82):40;
  const keys=keysFor(el._a,el._k,a),ks=new Set(keys),pi=new Set(ptrs.map(x=>x[1]));
  const pm=Object.fromEntries(ptrs);let dim=null,win=null;
  for(const [p1,p2] of [['lo','hi'],['low','high'],['l','r'],['left','right'],['start','end']])if(p1 in pm&&p2 in pm&&pm[p1]<=pm[p2]&&pm[p2]<n){const g=[pm[p1],pm[p2]];if('mid' in pm||p1=='lo'||p1=='low')dim=g;else win=g;break;}
  row.style.width=n*W+'px';
  while(el._ix.length<n){const d=document.createElement('div');d.className='ix';row.appendChild(d);el._ix.push(d);}
  while(el._ix.length>n)el._ix.pop().remove();
  el._ix.forEach((d,i)=>{d.textContent=i;d.style.width=W+'px';d.style.transform=`translateX(${i*W}px)`;});
  el._c.forEach((d,k)=>{if(!ks.has(k)){d.classList.add('out');setTimeout(()=>d.remove(),450);el._c.delete(k);}});
  const pIdx=new Map(el._k.map((k,i)=>[k,i])),pVal=new Map(el._k.map((k,i)=>[k,el._a[i]]));
  keys.forEach((k,i)=>{let d=el._c.get(k);const fresh=!d,y=120-hh(a[i]);
    if(fresh){d=document.createElement('div');d.className='cell in';row.appendChild(d);el._c.set(k,d);d.style.transform=`translate(${i*W}px,${y}px)`;requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.remove('in')));}
    d.style.width=W-4+'px';d.style.height=hh(a[i])+'px';d.style.transform=`translate(${i*W}px,${y}px)`;d.textContent=a[i] && typeof a[i] === 'object' ? rp(s.H,a[i]) : rep(a[i]);
    d.title=d.textContent;
    d.classList.toggle('on',pi.has(i));d.classList.toggle('rd',!!(s&&s.rd&&s.rd.includes(id+':'+i)));d.classList.toggle('dim',!!dim&&(i<dim[0]||i>dim[1]));d.classList.toggle('win',!!win&&i>=win[0]&&i<=win[1]);
    if(!first&&(fresh||pIdx.get(k)!==i||pVal.get(k)!==a[i])){d.classList.remove('chg');void d.offsetWidth;d.classList.add('chg');}});
  el._k=keys;el._a=a.slice();
  const by=new Map(),alive=new Set();let mxr=1;
  ptrs.forEach(([k,v])=>{if(v<n){if(!by.has(v))by.set(v,[]);by.get(v).push(k);}});
  by.forEach((ns,idx)=>{mxr=Math.max(mxr,ns.length);ns.forEach((nm,r)=>{alive.add(nm);let p=el._p.get(nm);const tr=`translate(${idx*W}px,${142+r*18}px)`;
    if(!p){p=document.createElement('div');p.className='pt';p.textContent='▲ '+nm;row.appendChild(p);el._p.set(nm,p);p.style.transform=tr;void p.offsetWidth;}
    p.style.width=W+'px';p.style.transform=tr;});});
  el._p.forEach((p,nm)=>{if(!alive.has(nm)){p.remove();el._p.delete(nm);}});
  row.style.height=(146+mxr*18)+'px';}
function drawCard(el,name,s,h,pv,id){el._row=null;el._sig=null;
  const mk=(h,H)=>h.k=='d'||h.k=='o'?h.v.map(([a,b])=>(h.k=='d'?rep(a,1):a)+' → '+rp(H,b)):h.k=='s'?[h.v.map(x=>rp(H,x)).join('   ')||'∅']:h.v.map((x,i)=>i+': '+rp(H,x));
  const L=mk(h,s.H),ph=pv&&pv.H[id],PL=ph?mk(ph,pv.H):null;
  const title = document.createElement('div');
  title.className = 'hd';
  title.textContent = name + ', ' + (h.c || { d: 'dict', s: 'set', t: 'tuple', l: 'list' }[h.k]) + '[' + h.v.length + ']';
  const entries = L.map((value, i) => {
    const entry = document.createElement('div');
    entry.className = PL && PL[i] !== value ? 'l2 chg' : 'l2';
    entry.textContent = value;
    return entry;
  });
  el.replaceChildren(title, ...entries);
}
function diffs(pr,s){const o=[],a=pr.F[pr.F.length-1].v,b=s.F[s.F.length-1].v;
  for(const k in b){const x=a[k],y=b[k];
    if(y&&y.r&&x&&x.r){const p=pr.H[x.r],q=s.H[y.r];
      if(p.k=='l'&&q.k=='l'){q.v.forEach((e,i)=>{if(i<p.v.length&&p.v[i]!==e&&(!e||typeof e!='object'))o.push(`${k}[${i}]: ${rep(p.v[i],1)} → ${rep(e,1)}`);});if(q.v.length!=p.v.length)o.push(`${k}: len ${p.v.length} → ${q.v.length}`);continue;}}
    const sx=x===undefined?'—':rp(pr.H,x),sy=rp(s.H,y);if(sx!==sy)o.push(`${k}: ${sx} → ${sy}`);}
  return o.slice(0,6);}
const NS='http://www.w3.org/2000/svg',GN=new Map(),GT=new Map(),GL=new Map();let GE=null,GED=[],raf=0;
const isNode = item => item.v.some(([field]) => /^(next|prev|left|right|children|neighbors|neighbours)$/.test(field));
const mkn=(t,c,p)=>{const e=document.createElementNS(NS,t);if(c)e.setAttribute('class',c);p.appendChild(e);return e;};
function glide(o,x,y){if(o.x===undefined){o.x=o.tx=x;o.y=o.ty=y;o.el.setAttribute('transform',`translate(${x},${y})`);return;}
  if(o.tx!==x||o.ty!==y){o.fx=o.x;o.fy=o.y;o.tx=x;o.ty=y;o.t0=performance.now();o.on=1;if(!raf)raf=requestAnimationFrame(tick);}}
function tick(now){raf=0;let live=0;const D=RM?1:duration;
  for(const o of[...GN.values(),...GT.values()]){if(!o.on)continue;const k=Math.min(1,(now-o.t0)/D),e=1-Math.pow(1-k,3);
    o.x=o.fx+(o.tx-o.fx)*e;o.y=o.fy+(o.ty-o.fy)*e;o.el.setAttribute('transform',`translate(${o.x},${o.y})`);if(k<1)live=1;else o.on=0;}
  edgesUp();if(live)raf=requestAnimationFrame(tick);}
function edgesUp(){GED.forEach(([k,a,b])=>{const p=GL.get(k),A=GN.get(a),B=GN.get(b);if(!p||!A||!B)return;let dx=B.x-A.x,dy=B.y-A.y;const L=Math.hypot(dx,dy)||1;dx/=L;dy/=L;
  p.setAttribute('d',`M${A.x+dx*23},${A.y+dy*21}L${B.x-dx*27},${B.y-dy*25}`);const z=GK.get(k);if(z){z.setAttribute('x',(A.x+B.x)/2+6);z.setAttribute('y',(A.y+B.y)/2);}});}
function drawGraph(wrap,s,fr,speed){duration = Math.min(700,speed*.6)+1; const H=s.H,inst=id=>H[id]&&H[id].k=='o',tags=new Map(),seen=new Set(),q=[],outs=a=>H[a].v.flatMap(([f,e])=>{if(!e||!e.r)return[];const z=H[e.r];if(z.k=='o')return[[f,e.r,'']];if(z.k=='d')return z.v.filter(([k,x])=>x&&x.r&&inst(x.r)).map(([k,x])=>[f+k,x.r,rep(k)]);if('lts'.includes(z.k))return z.v.map((x,i)=>x&&x.r&&inst(x.r)?[f+i,x.r,'']:null).filter(Boolean);return[];});
  fr.forEach(f=>Object.entries(f.v).forEach(([k,v])=>{if(v&&v.r&&inst(v.r)&&(outs(v.r).length||isNode(H[v.r]))){const a=tags.get(v.r)||tags.set(v.r,[]).get(v.r);if(!a.includes(k))a.push(k);q.push(v.r);}}));
  while(q.length){const id=q.pop();if(seen.has(id))continue;seen.add(id);outs(id).forEach(o=>q.push(o[1]));}
  if(!seen.size){if(GE)GE.style.display='none';return;}
  if(!GE){GE=document.createElement('div');GE.className='obj';GE.dataset.vizId='nodes';GE.dataset.zoomable='';GE.innerHTML='<div class="hd"></div><svg style="color:var(--mu);display:block"><defs><marker id="ar" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="currentColor"/></marker></defs></svg>';wrap.prepend(GE);GE._s=GE.lastChild;GE._e=mkn('g','',GE._s);GE._n=mkn('g','',GE._s);GE._t=mkn('g','',GE._s);}
  GE.style.display='';
  const kid=(id,f)=>{const e=(H[id].v.find(x=>x[0]==f)||[])[1];return e&&e.r&&inst(e.r)?e.r:null;};
  const E=[];seen.forEach(a=>outs(a).forEach(o=>E.push([a+'>'+o[1]+':'+o[0],a,o[1],o[2]])));
  const inc=new Set(E.map(e=>e[2])),pos=new Map();let roots=[...seen].filter(i=>!inc.has(i)).sort((a,b)=>a-b),cx=0,base=0,mx=0;
  if(!roots.length)roots=[Math.min(...seen)];
  const place=(id,d)=>{if(pos.has(id))return;pos.set(id,0);const L=kid(id,'left'),R=kid(id,'right'),N=kid(id,'next'),G=outs(id).filter(o=>!/^(left|right|next|prev|parent)$/.test(o[0])).map(o=>o[1]),hf=G.length>>1;
    if(L)place(L,d+1);G.slice(0,hf).forEach(c=>place(c,d+1));pos.set(id,{x:cx++,y:d});mx=Math.max(mx,d);G.slice(hf).forEach(c=>place(c,d+1));if(R)place(R,d+1);if(N)place(N,d);};
  roots.concat([...seen]).forEach(r=>{if(pos.has(r))return;cx=0;place(r,base);base=mx+1;});
  const GX=66,GY=74,svg=GE._s;svg.setAttribute('width',Math.max(...[...pos.values()].map(p=>p.x))*GX+80);svg.setAttribute('height',(mx+1)*GY+54);
  GN.forEach((n,id)=>{if(!seen.has(id)){n.el.remove();GN.delete(id);}});
  seen.forEach(id=>{const p=pos.get(id),x=p.x*GX+34,y=p.y*GY+56;let n=GN.get(id);
    if(!n){const g=mkn('g','nd',GE._n);g.innerHTML='<rect x="-22" y="-19" width="44" height="38" rx="12"/><text y="5" text-anchor="middle"></text>';g.style.opacity=0;requestAnimationFrame(()=>g.style.opacity=1);n={el:g};GN.set(id,n);}
    const h=H[id],pf=h.v.find(([f,e])=>['val','value','data','key','v','item'].includes(f)&&(!e||typeof e!='object'))||h.v.find(([f,e])=>e!==null&&typeof e!='object'&&typeof e!='boolean');
    n.el.lastChild.textContent=pf?rep(pf[1]):h.c[0];n.el.classList.toggle('hot',tags.has(id));n.el.classList.toggle('end',h.v.some(([f,e])=>/end|word|leaf|term/.test(f)&&e===true));glide(n,x,y);});
  const tk=new Set();tags.forEach((ns,id)=>ns.forEach((nm,r)=>{tk.add(nm);let t=GT.get(nm);if(!t){const e=mkn('text','tg',GE._t);e.setAttribute('text-anchor','middle');e.textContent='▾ '+nm;t={el:e};GT.set(nm,t);}const p=pos.get(id);glide(t,p.x*GX+34,p.y*GY+26-r*13);}));
  GT.forEach((t,nm)=>{if(!tk.has(nm)){t.el.remove();GT.delete(nm);}});
  GL.forEach((p,k)=>{if(!E.some(e=>e[0]==k)){p.remove();GL.delete(k);}});GK.forEach((z,k)=>{if(!E.some(e=>e[0]==k)){z.remove();GK.delete(k);}});
  E.forEach(([k,,,lb])=>{if(lb&&!GK.has(k)){const z=mkn('text','ew',GE._e);z.textContent=lb;GK.set(k,z);}if(!GL.has(k)){const p=mkn('path','eg',GE._e);p.setAttribute('marker-end','url(#ar)');p.style.opacity=0;requestAnimationFrame(()=>p.style.opacity=1);GL.set(k,p);}});
  GED=E;edgesUp();
  GE.firstChild.textContent=[...new Set([...seen].map(i=>H[i].c))].join(', ')+' ('+seen.size+')';}


function resetGraph() {
  GE = null; GED = []; GN.clear(); GT.clear(); GL.clear(); GK.clear();
  cancelAnimationFrame(raf); raf = 0;
}
const graphCard = () => GE;
export { rp, drawList, drawCard, diffs, drawGraph, isNode, graphCard, resetGraph };
