/*ENGINE — lexer → parser → tracing tree-walking interpreter. Every executed statement records a snapshot (stack frames + heap).*/
const KW=new Set('if elif else while for in def class return break continue pass and or not is True False None import from lambda global nonlocal'.split(' '));
const unesc=s=>s.replace(/\\(.)/g,(_,c)=>({n:'\n',t:'\t'}[c]||c));
function lex(src){
  const T=[],ind=[0],L=src.split('\n');let d=0;
  const re=/[ \t]*(?:(#.*)|(\d+\.?\d*)|(f?"(?:[^"\\]|\\.)*"|f?'(?:[^'\\]|\\.)*')|([A-Za-z_]\w*)|(\/\/=|\*\*|\/\/|<<|>>|==|!=|<=|>=|\+=|-=|\*=|\/=|%=|[-+*\/%<>=()\[\]{},:.&|^~@]))/y;
  L.forEach((s,i)=>{const ln=i+1;
    if(!d){if(!s.trim()||s.trim()[0]=='#')return;
      const w=s.match(/^[ \t]*/)[0].replace(/\t/g,'    ').length;
      if(w>ind[ind.length-1]){ind.push(w);T.push({t:'in',l:ln});}
      while(w<ind[ind.length-1]){ind.pop();T.push({t:'de',l:ln});}}
    re.lastIndex=0;
    while(re.lastIndex<s.length){const p=re.lastIndex,m=re.exec(s);
      if(!m){if(!s.slice(p).trim())break;throw Error(`Line ${ln}: unexpected character '${s.slice(p).trim()[0]}'`);}
      if(m[1])continue;
      if(m[2])T.push({t:'n',v:parseFloat(m[2]),l:ln});
      else if(m[3])T.push({t:'s',v:m[3],l:ln});
      else if(m[4])T.push({t:KW.has(m[4])?'k':'i',v:m[4],l:ln});
      else{T.push({t:'o',v:m[5],l:ln});if('([{'.includes(m[5]))d++;if(')]}'.includes(m[5]))d--;}}
    if(!d)T.push({t:'nl',l:ln});});
  while(ind.length>1){ind.pop();T.push({t:'de',l:L.length});}
  T.push({t:'eof',l:L.length});return T;}

function parse(T){
  let p=0;const nx=()=>T[p++],isO=v=>T[p].t=='o'&&T[p].v==v,isK=v=>T[p].t=='k'&&T[p].v==v;
  const eatO=v=>isO(v)&&(p++,true),eatK=v=>isK(v)&&(p++,true);
  const err=m=>{throw Error(`Line ${T[Math.min(p,T.length-1)].l}: syntax error — ${m}`)};
  const need=v=>{if(!eatO(v))err(`expected '${v}'`)};
  const bin=(sub,ops)=>()=>{let a=sub();while(T[p].t=='o'&&ops.includes(T[p].v)){const o=nx();a={t:'bin',o:o.v,a,b:sub(),l:o.l};}return a;};
  const ex=()=>{const l=T[p].l;if(eatK('lambda')){const ps=[];while(!isO(':')){ps.push({n:nx().v});if(!eatO(','))break;}need(':');return{t:'lam',ps,b:ex(),l};}const a=or();if(eatK('if')){const c=or();if(!eatK('else'))err("expected 'else'");return{t:'if',c,a,b:ex(),l};}return a;};
  const exs=()=>{const a=ex();if(!isO(','))return a;const es=[a];while(eatO(',')){if(T[p].t=='nl'||isO('='))break;es.push(ex());}return{t:'tup',a:es};};
  const or=()=>{let a=and();while(eatK('or'))a={t:'or',a,b:and()};return a;};
  const and=()=>{let a=not();while(eatK('and'))a={t:'and',a,b:not()};return a;};
  const not=()=>eatK('not')?{t:'not',a:not()}:cmp();
  const cmp=()=>{const a=add(),ops=[],rs=[],l=T[p].l;
    for(;;){let o=null;
      if(T[p].t=='o'&&['==','!=','<','>','<=','>='].includes(T[p].v))o=nx().v;
      else if(isK('in')){p++;o='in';}
      else if(isK('not')&&T[p+1].v=='in'){p+=2;o='not in';}
      else if(isK('is')){p++;o=eatK('not')?'is not':'is';}
      else break;ops.push(o);rs.push(add());}
    return ops.length?{t:'cmp',a,ops,rs,l}:a;};
  const add=bin(()=>mul(),['+','-','<<','>>','&','|','^']),mul=bin(()=>un(),['*','/','//','%']);
  const un=()=>isO('-')?(p++,{t:'neg',a:un()}):isO('+')?(p++,un()):isO('~')?{t:'invert',l:nx().l,a:un()}:pw();
  const pw=()=>{const a=post();return isO('**')?(p++,{t:'bin',o:'**',a,b:un(),l:T[p-1].l}):a;};
  const post=()=>{let a=atom();for(;;){const l=T[p].l;
    if(eatO('(')){const args=[];while(!isO(')')){if(T[p].t=='i'&&T[p+1].v=='='&&T[p+1].t=='o'){const k=nx().v;p++;args.push({kw:k,e:ex()});}else{let e=ex();if(isK('for'))e=comp(e);args.push(e);}if(!eatO(','))break;}need(')');a={t:'call',f:a,args,l};}
    else if(eatO('[')){let lo=null,hi=null,st=null,sl=false;if(!isO(':'))lo=ex();
      if(eatO(':')){sl=true;if(!isO(']')&&!isO(':'))hi=ex();if(eatO(':'))st=ex();}need(']');
      a=sl?{t:'slice',a,lo,hi,st,l}:{t:'idx',a,i:lo,l};}
    else if(eatO('.'))a={t:'attr',a,n:nx().v,l};
    else return a;}};
  const tgt=()=>{const a=post();if(!isO(','))return a;const es=[a];while(eatO(',')){if(isK('in'))break;es.push(post());}return{t:'tup',a:es};};
  const comp=e=>{p++;const tg=tgt();if(!eatK('in'))err("expected 'in'");const it=or();let c=null,inner=null;if(isK('for'))inner=comp(e);else if(eatK('if'))c=or();return{t:'comp',e,tg,it,c,inner};};
  const unq=s=>unesc(s.slice(1,-1));
  const atom=()=>{const t=nx(),l=t.l;
    if(t.t=='n')return{t:'c',v:t.v};
    if(t.t=='s')return t.v[0]=='f'?{t:'f',v:unesc(t.v.slice(2,-1)),l}:{t:'c',v:unq(t.v)};
    if(t.t=='i')return{t:'v',n:t.v,l};
    if(t.t=='k'){if(t.v=='True')return{t:'c',v:true};if(t.v=='False')return{t:'c',v:false};if(t.v=='None')return{t:'c',v:null};}
    if(t.t=='o'){
      if(t.v=='('){if(eatO(')'))return{t:'tup',a:[]};const a=ex();
        if(isO(',')){const es=[a];while(eatO(',')&&!isO(')'))es.push(ex());need(')');return{t:'tup',a:es};}need(')');return a;}
      if(t.v=='['){if(eatO(']'))return{t:'list',a:[]};const a=ex();
        if(isK('for')){const c=comp(a);need(']');return c;}
        const es=[a];while(eatO(',')&&!isO(']'))es.push(ex());need(']');return{t:'list',a:es};}
      if(t.v=='{'){if(eatO('}'))return{t:'dict',k:[],v:[]};const a=ex();
        if(eatO(':')){const ks=[a],vs=[ex()];while(eatO(',')&&!isO('}')){ks.push(ex());need(':');vs.push(ex());}need('}');return{t:'dict',k:ks,v:vs};}
        const es=[a];while(eatO(',')&&!isO('}'))es.push(ex());need('}');return{t:'set',a:es};}}
    p--;err(`unexpected ${t.v!==undefined?"'"+t.v+"'":'end of line'}`);};
  const block=()=>{need(':');const b=[];
    if(T[p].t=='nl'){p++;if(T[p].t!='in')err('expected an indented block');p++;while(T[p].t!='de'&&T[p].t!='eof')b.push(stmt());if(T[p].t=='de')p++;}
    else b.push(simple());return b;};
  const simple=()=>{const t=T[p],l=t.l;let r;
    if(t.t=='k'&&['break','continue','pass'].includes(t.v)){p++;r={t:t.v,l};}
    else if(t.t=='k'&&t.v=='return'){p++;r={t:'ret',v:T[p].t=='nl'?null:exs(),l};}
    else if(t.t=='k'&&(t.v=='global'||t.v=='nonlocal')){p++;const ns=[nx().v];while(eatO(','))ns.push(nx().v);r={t:'decl',ns,l};}
    else if(t.t=='k'&&(t.v=='import'||t.v=='from')){while(T[p].t!='nl')p++;r={t:'pass',l};}
    else{const a=exs();
      if(T[p].t=='o'&&['+=','-=','*=','/=','//=','%='].includes(T[p].v)){const o=nx().v.slice(0,-1);r={t:'aug',tg:a,o,v:ex(),l};}
      else if(isO('=')){const tg=[a];let v;while(eatO('=')){v=exs();if(isO('='))tg.push(v);}r={t:'asg',tg,v,l};}
      else r={t:'expr',v:a,l};}
    if(T[p].t=='nl')p++;else if(T[p].t!='eof')err('unexpected token');return r;};
  const stmt=()=>{if(isO('@')){const m=/cache/.test(T[p+1].v);while(T[p].t!='nl')p++;p++;const d=stmt();if(m&&d.t=='def')d.memo=1;return d;}const t=T[p],l=t.l;
    if(t.t=='k'){
      if(t.v=='if'){p++;const c=ex(),b=block();let e=[];
        if(isK('elif')){T[p]={...T[p],v:'if'};e=[stmt()];}else if(eatK('else'))e=block();return{t:'if',c,b,e,l};}
      if(t.v=='while'){p++;const c=ex();return{t:'while',c,b:block(),l};}
      if(t.v=='for'){p++;const tg=tgt();if(!eatK('in'))err("expected 'in'");const it=exs();return{t:'for',tg,it,b:block(),l};}
      if(t.v=='class'){p++;const n=nx().v;if(eatO('(')){while(!isO(')'))p++;p++;}return{t:'class',n,b:block(),l};}
      if(t.v=='def'){p++;const n=nx().v;need('(');const ps=[];
        while(!isO(')')){const pn=nx().v;if(eatO(':'))ex();let d;if(eatO('='))d=ex();ps.push({n:pn,d});if(!eatO(','))break;}
        need(')');if(isO('-')){p+=2;ex();}return{t:'def',n,ps,b:block(),l};}}
    return simple();};
  const prog=[];while(T[p].t!='eof')prog.push(stmt());return prog;}

export const rep=(v,q)=>v===null?'None':v===true?'True':v===false?'False':typeof v=='number'?(isFinite(v)?String(v):v>0?'inf':'-inf'):typeof v=='string'?(q?`'${v}'`:v):Array.isArray(v)?(v._t?'(':'[')+v.map(x=>rep(x,1)).join(', ')+(v._t?(v.length==1?',)':')'):']'):v instanceof Map?'{'+[...v].map(([a,b])=>rep(a,1)+': '+rep(b,1)).join(', ')+'}':v instanceof Set?(v.size?'{'+[...v].map(x=>rep(x,1)).join(', ')+'}':'set()'):v&&v.fn?`<function ${v.n}>`:v&&v.o?`<${v.c.n} object>`:v&&v.cls?`<class ${v.n}>`:String(v);
const truthy=v=>v===null||v===false||v===0||v===''?false:Array.isArray(v)?v.length>0:v instanceof Map||v instanceof Set?v.size>0:true;
const eq=(a,b)=>Array.isArray(a)&&Array.isArray(b)?a.length==b.length&&a.every((x,i)=>eq(x,b[i])):a===b;
const cmpv=(a,b)=>{if(Array.isArray(a)&&Array.isArray(b)){for(let i=0;i<Math.min(a.length,b.length);i++){const c=cmpv(a[i],b[i]);if(c)return c;}return a.length-b.length;}return a<b?-1:a>b?1:0;};

export function run(src){
  const prog=parse(lex(src)),steps=[],stack=[{n:'<module>',a:[],v:Object.create(null)}],ids=new WeakMap();
  let out='',nid=1,lc='';
  const err=(l,m)=>{throw Object.assign(new Error(m),{py:1,line:l})};
  class Ret{constructor(v){this.v=v}}const BRK={},CNT={};
  const UP=new WeakMap(),NL=new WeakMap(),evs=[],reads=new Set();let rvv=null;
  const idOf=o=>{let i=ids.get(o);if(!i){i=nid++;ids.set(o,i);}return i;};
  const snap=()=>{const H={};
    const ref=o=>{if(o===null||typeof o!='object')return o;if(o.fn||o.cls)return{f:o.n,c:o.cls?1:0};
      let id=ids.get(o);if(!id){id=nid++;ids.set(o,id);}
      if(!(id in H)){H[id]=null;H[id]=o instanceof Map?{k:'d',v:[...o].map(([a,b])=>[a,ref(b)])}:o instanceof Set?{k:'s',v:[...o].map(ref)}:o.o?{k:'o',c:o.c.n,v:Object.entries(o.a).map(([a,b])=>[a,ref(b)])}:{k:o._t?'t':'l',v:o.map(ref)};}
      return{r:id};};
    const F=stack.map(f=>({n:f.n,a:f.a,v:Object.fromEntries(Object.entries(f.v).map(([k,v])=>[k,ref(v)]))}));return{F,H};};
  const step=l=>{if(steps.length>=4000)err(l,'Stopped after 4000 steps — possible infinite loop');const st={l,out,rd:[...reads],...snap()};if(rvv){st.rv=rep(rvv.v,1);rvv=null;}reads.clear();steps.push(st);};
  const look=(n,l)=>{let v=stack[stack.length-1].v;while(v){if(n in v)return v[n];v=UP.get(v);}const g=stack[0].v;if(n in g)return g[n];if(n in B)return B[n];err(l,`NameError: name '${n}' is not defined`);};
  const setv=(n,x)=>{let c=stack[stack.length-1].v;const z=NL.get(c);if(z&&z.has(n)){let u=UP.get(c);while(u&&!(n in u))u=UP.get(u);c=u||stack[0].v;}c[n]=x;};
  const callAny=(f,a)=>f.fn?callFn(f,a,0):f(a,{},0),dflt=f=>f.fn?callFn(f,[],0):f===B.int?0:f([],{},0);
  const iter=(o,l)=>Array.isArray(o)?o:typeof o=='string'?[...o]:o instanceof Map?[...o.keys()]:o instanceof Set?[...o]:err(l,'TypeError: object is not iterable');
  const norm=(o,i,l)=>{if(!Number.isInteger(i))err(l,'TypeError: indices must be integers');const j=i<0?i+o.length:i;if(j<0||j>=o.length)err(l,'IndexError: index out of range');return j;};
  const getitem=(o,i,l)=>Array.isArray(o)?(reads.add(idOf(o)+':'+norm(o,i,l)),o[norm(o,i,l)]):typeof o=='string'?o[norm(o,i,l)]:o instanceof Map?(o.has(i)?o.get(i):o.cz?0:o.df?(o.set(i,dflt(o.df)),o.get(i)):err(l,'KeyError: '+rep(i,1))):err(l,'TypeError: object is not subscriptable');
  const binop=(o,a,b,l)=>{const A=Array.isArray(a),Bb=Array.isArray(b);
    if(a instanceof Set&&b instanceof Set&&'|&-'.includes(o))return o=='|'?new Set([...a,...b]):o=='&'?new Set([...a].filter(x=>b.has(x))):new Set([...a].filter(x=>!b.has(x)));
    if(o=='+'){if(A&&Bb)return a.concat(b);if(typeof a==typeof b&&(typeof a=='number'||typeof a=='string'))return a+b;}
    else if(o=='*'){if(A&&typeof b=='number')return Array.from({length:Math.max(0,b)*a.length},(_,i)=>a[i%a.length]);if(typeof a=='string'&&typeof b=='number')return a.repeat(Math.max(0,b));if(typeof a=='number'&&typeof b=='number')return a*b;}
    else if(typeof a=='number'&&typeof b=='number'){if(o=='-')return a-b;if(o=='**')return Math.pow(a,b);if(o=='&')return a&b;if(o=='|')return a|b;if(o=='^')return a^b;if(o=='<<')return a<<b;if(o=='>>')return a>>b;
      if(b===0)err(l,'ZeroDivisionError: division by zero');if(o=='/')return a/b;if(o=='//')return Math.floor(a/b);if(o=='%')return a-b*Math.floor(a/b);}
    err(l,`TypeError: unsupported operand type(s) for ${o}`);};
  const cmp1=(o,a,b,l)=>{switch(o){case'==':return eq(a,b);case'!=':return!eq(a,b);case'is':return a===b;case'is not':return a!==b;
    case'in':case'not in':{const r=Array.isArray(b)?b.some(x=>eq(x,a)):b instanceof Map||b instanceof Set?b.has(a):typeof b=='string'?b.includes(a):err(l,'TypeError: argument is not iterable');return o=='in'?r:!r;}}
    if(typeof a!=typeof b)err(l,`TypeError: '${o}' not supported between these types`);const c=cmpv(a,b);return o=='<'?c<0:o=='>'?c>0:o=='<='?c<=0:c>=0;};
  const assign=(t,v,l)=>{
    if(t.t=='v')setv(t.n,v);
    else if(t.t=='idx'){const o=ev(t.a),i=ev(t.i);if(Array.isArray(o))o[norm(o,i,l)]=v;else if(o instanceof Map)o.set(i,v);else err(l,'TypeError: object does not support item assignment');}
    else if(t.t=='tup'){const a=iter(v,l).slice();if(a.length!=t.a.length)err(l,'ValueError: wrong number of values to unpack');t.a.forEach((x,i)=>assign(x,a[i],l));}
    else if(t.t=='attr'){const o=ev(t.a);if(o&&o.o)o.a[t.n]=v;else err(l,`AttributeError: cannot set '${t.n}' on this value`);}
    else err(l,'SyntaxError: cannot assign here');};
  const meth=(o,m,a,k,l)=>{
    if(Array.isArray(o))switch(m){
      case'append':o.push(a[0]);return null;
      case'pop':if(!o.length)err(l,'IndexError: pop from empty list');return o.splice(a.length?norm(o,a[0],l):o.length-1,1)[0];
      case'insert':o.splice(a[0]<0?Math.max(0,o.length+a[0]):a[0],0,a[1]);return null;
      case'remove':{const i=o.findIndex(x=>eq(x,a[0]));if(i<0)err(l,'ValueError: x not in list');o.splice(i,1);return null;}
      case'extend':o.push(...iter(a[0],l));return null;
      case'index':{const i=o.findIndex(x=>eq(x,a[0]));if(i<0)err(l,'ValueError: x not in list');return i;}
      case'count':return o.filter(x=>eq(x,a[0])).length;
      case'reverse':o.reverse();return null;
      case'sort':{const kv=x=>k.key?callAny(k.key,[x]):x;o.sort((x,y)=>cmpv(kv(x),kv(y)));if(k.reverse)o.reverse();return null;}
      case'copy':return o.slice();case'popleft':if(!o.length)err(l,'IndexError: pop from empty deque');return o.shift();case'appendleft':o.unshift(a[0]);return null;case'clear':o.length=0;return null;}
    else if(o instanceof Map)switch(m){
      case'get':return o.has(a[0])?o.get(a[0]):a.length>1?a[1]:null;
      case'keys':return[...o.keys()];case'values':return[...o.values()];
      case'items':return[...o].map(e=>Object.assign(e,{_t:1}));
      case'setdefault':if(!o.has(a[0]))o.set(a[0],a.length>1?a[1]:null);return o.get(a[0]);
      case'pop':{const v=o.get(a[0]);o.delete(a[0]);return v===undefined?null:v;}}
    else if(o instanceof Set)switch(m){case'add':o.add(a[0]);return null;case'discard':case'remove':o.delete(a[0]);return null;}
    else if(typeof o=='string')switch(m){
      case'upper':return o.toUpperCase();case'lower':return o.toLowerCase();case'strip':return o.trim();
      case'split':return a.length?o.split(a[0]):o.trim().split(/\s+/);case'join':return iter(a[0],l).join(o);
      case'startswith':return o.startsWith(a[0]);case'endswith':return o.endsWith(a[0]);
      case'isalpha':return /^[A-Za-z]+$/.test(o);case'isdigit':return /^\d+$/.test(o);case'isalnum':return /^[A-Za-z0-9]+$/.test(o);
      case'find':return o.indexOf(a[0]);case'count':return o.split(a[0]).length-1;case'replace':return o.split(a[0]).join(a[1]);
      case'lstrip':return o.trimStart();case'rstrip':return o.trimEnd();}
    err(l,`AttributeError: no method '${m}' on this type`);};
  const B=Object.assign(Object.create(null),{
    print:(a,k)=>{out+=a.map(x=>rep(x)).join(k.sep!==undefined?k.sep:' ')+(k.end!==undefined?k.end:'\n');return null;},
    len:a=>Array.isArray(a[0])||typeof a[0]=='string'?a[0].length:a[0].size,
    range:a=>{let s=0,e,st=1;if(a.length==1)e=a[0];else[s,e,st=1]=a;const r=[];if(!st)err(0,'ValueError: range() step is zero');
      for(let i=s;st>0?i<e:i>e;i+=st){r.push(i);if(r.length>5000)err(0,'range too large');}return r;},
    enumerate:a=>iter(a[0]).map((x,i)=>Object.assign([i+(a[1]||0),x],{_t:1})),
    zip:a=>{const L=a.map(x=>iter(x)),n=Math.min(...L.map(x=>x.length));return Array.from({length:n},(_,i)=>Object.assign(L.map(x=>x[i]),{_t:1}));},
    sorted:(a,k)=>{const kv=x=>k.key?callAny(k.key,[x]):x,r=iter(a[0]).slice().sort((x,y)=>cmpv(kv(x),kv(y)));return k.reverse?r.reverse():r;},
    reversed:a=>iter(a[0]).slice().reverse(),
    min:(a,k)=>(a.length>1?a:iter(a[0])).reduce((x,y)=>{const kv=z=>k.key?callAny(k.key,[z]):z;return cmpv(kv(y),kv(x))<0?y:x;}),
    max:(a,k)=>(a.length>1?a:iter(a[0])).reduce((x,y)=>{const kv=z=>k.key?callAny(k.key,[z]):z;return cmpv(kv(y),kv(x))>0?y:x;}),
    sum:a=>iter(a[0]).reduce((x,y)=>x+y,a[1]||0),abs:a=>Math.abs(a[0]),
    int:a=>typeof a[0]=='string'?parseInt(a[0],10):Math.trunc(a[0]),
    float:a=>a[0]==='inf'?Infinity:a[0]==='-inf'?-Infinity:parseFloat(a[0]),
    str:a=>rep(a[0]),list:a=>a.length?iter(a[0]).slice():[],set:a=>new Set(a.length?iter(a[0]):[]),dict:()=>new Map(),
    tuple:a=>Object.assign(a.length?iter(a[0]).slice():[],{_t:1}),bool:a=>truthy(a[0]),
    round:a=>a[1]?+a[0].toFixed(a[1]):Math.round(a[0]),any:a=>iter(a[0]).some(truthy),all:a=>iter(a[0]).every(truthy),
    ord:a=>a[0].charCodeAt(0),chr:a=>String.fromCharCode(a[0]),defaultdict:a=>{const m=new Map();m.df=a[0];return m;},
    Counter:a=>{const m=new Map();m.cz=1;if(a.length)iter(a[0]).forEach(x=>m.set(x,(m.get(x)||0)+1));return m;},
    pow:a=>a.length>2?Number(BigInt(a[0])**BigInt(a[1])%BigInt(a[2])):Math.pow(a[0],a[1]),
    divmod:a=>Object.assign([Math.floor(a[0]/a[1]),a[0]-a[1]*Math.floor(a[0]/a[1])],{_t:1}),deque:a=>a.length?iter(a[0]).slice():[],
    heapq:{mod:1,heapify:a=>{const h=a[0],c=h.slice();h.length=0;c.forEach(x=>B.heapq.heappush([h,x]));return null;},heappush:a=>{const h=a[0];h.push(a[1]);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(cmpv(h[i],h[p])>=0)break;[h[i],h[p]]=[h[p],h[i]];i=p;}return null;},
      heappop:a=>{const h=a[0];if(!h.length)err(0,'IndexError: pop from empty heap');const t=h[0],x=h.pop();if(h.length){h[0]=x;let i=0;for(;;){let m=i;const c=2*i+1;if(c<h.length&&cmpv(h[c],h[m])<0)m=c;if(c+1<h.length&&cmpv(h[c+1],h[m])<0)m=c+1;if(m==i)break;[h[i],h[m]]=[h[m],h[i]];i=m;}}return t;}},
    random:{mod:1,choice:(a,k,l)=>{const items=a[0];if(!items.length)err(l,'IndexError: Cannot choose from an empty sequence');return items[Math.floor(Math.random()*items.length)];}},
    math:{mod:1,inf:Infinity,pi:Math.PI,sqrt:a=>Math.sqrt(a[0]),floor:a=>Math.floor(a[0]),ceil:a=>Math.ceil(a[0]),log:a=>Math.log(a[0]),fabs:a=>Math.abs(a[0]),gcd:a=>{let x=Math.abs(a[0]),y=Math.abs(a[1]);while(y)[x,y]=[y,x%y];return x;}}});
  const callFn=(f,args,l)=>{
    if(stack.length>120)err(l,'RecursionError: maximum recursion depth exceeded');
    const v=Object.create(null);UP.set(v,f.env);
    f.ps.forEach((p,i)=>{v[p.n]=i<args.length?args[i]:p.d!==undefined?p.d:err(l,`TypeError: ${f.n}() missing argument '${p.n}'`);});
    if(f.lam){stack.push({n:'lambda',a:[],v});try{return ev(f.b);}finally{stack.pop();}}
    const ck=f.memo?args.map(x=>rep(x,1)).join(','):null;if(ck!==null&&f.cache&&f.cache.has(ck))return f.cache.get(ck);
    stack.push({n:f.ps[0]&&f.ps[0].n=='self'&&args[0]&&args[0].o?args[0].c.n+'.'+f.n:f.n,a:f.ps.map(p=>p.n),v});
    evs.push({t:'c',s:steps.length,lab:f.n+'('+f.ps.map(p=>{const z=rep(v[p.n],1);return z.length>9?z.slice(0,8)+'…':z;}).join(',')+')'});
    try{execBlock(f.b);}catch(e){stack.pop();if(e instanceof Ret){if(ck!==null)(f.cache||(f.cache=new Map())).set(ck,e.v);rvv={v:e.v};evs.push({t:'r',s:steps.length,rv:rep(e.v,1)});return e.v;}throw e;}
    stack.pop();rvv={v:null};evs.push({t:'r',s:steps.length,rv:'None'});return null;};
  const ev=n=>{switch(n.t){
    case'c':return n.v;case'v':return look(n.n,n.l);
    case'f':return n.v.replace(/\{([^}]*)\}/g,(_,e)=>{const i=e.lastIndexOf(':'),sp=i>0?e.slice(i+1):'',x=ev(parse(lex(i>0?e.slice(0,i):e))[0].v);
      const m=sp.match(/^\.(\d+)f$/);return m?x.toFixed(+m[1]):rep(x);});
    case'lam':return{fn:1,n:'lambda',lam:1,ps:n.ps,b:n.b,env:stack[stack.length-1].v};
    case'list':return n.a.map(ev);
    case'tup':{const r=n.a.map(ev);r._t=1;return r;}
    case'dict':{const m=new Map();n.k.forEach((k,i)=>m.set(ev(k),ev(n.v[i])));return m;}
    case'set':return new Set(n.a.map(ev));
    case'comp':{const r=[];for(const x of iter(ev(n.it),0).slice()){assign(n.tg,x,0);if(!n.c||truthy(ev(n.c))){if(n.inner)r.push(...ev(n.inner));else r.push(ev(n.e));}}return r;}
    case'neg':{const v=ev(n.a);if(typeof v!='number')err(n.l,'TypeError: bad operand for unary -');return-v;}
    case'invert':{const v=ev(n.a);if(!Number.isInteger(v)&&typeof v!=='boolean')err(n.l,'TypeError: bad operand for unary ~');return -v-1;}
    case'not':return!truthy(ev(n.a));
    case'and':{const a=ev(n.a);return truthy(a)?ev(n.b):a;}
    case'or':{const a=ev(n.a);return truthy(a)?a:ev(n.b);}
    case'if':return truthy(ev(n.c))?ev(n.a):ev(n.b);
    case'bin':return binop(n.o,ev(n.a),ev(n.b),n.l);
    case'cmp':{let a=ev(n.a);for(let i=0;i<n.ops.length;i++){const b=ev(n.rs[i]);lc=rep(a,1)+' '+n.ops[i]+' '+rep(b,1);if(!cmp1(n.ops[i],a,b,n.l))return false;a=b;}return true;}
    case'idx':return getitem(ev(n.a),ev(n.i),n.l);
    case'slice':{const o=ev(n.a),L=o.length,lo=n.lo?ev(n.lo):null,hi=n.hi?ev(n.hi):null,st=n.st?ev(n.st):1;
      const nm=(x,d)=>x===null?d:x<0?Math.max(0,x+L):Math.min(x,L);
      if(st<0){const r=[...o].reverse();return typeof o=='string'?r.join(''):r;}return o.slice(nm(lo,0),nm(hi,L));}
    case'call':{const pos=[],kw={};n.args.forEach(a=>a.kw?kw[a.kw]=ev(a.e):pos.push(ev(a)));
      if(n.f.t=='attr'){const o=ev(n.f.a),m=n.f.n;
        if(o&&o.o){const f=o.c.m[m];if(!f)err(n.l,`AttributeError: '${o.c.n}' object has no attribute '${m}'`);return callFn(f,[o,...pos],n.l);}
        if(o&&o.mod&&typeof o[m]=='function')return o[m](pos,kw,n.l);
        return meth(o,m,pos,kw,n.l);}
      const f=ev(n.f);if(f&&f.fn)return callFn(f,pos,n.l);
      if(f&&f.cls){const o={o:1,c:f,a:Object.create(null)};if(f.m.__init__)callFn(f.m.__init__,[o,...pos],n.l);return o;}if(typeof f=='function')return f(pos,kw,n.l);err(n.l,'TypeError: object is not callable');}
    case'attr':{const o=ev(n.a);if(o&&o.o){if(n.n in o.a)return o.a[n.n];err(n.l,`AttributeError: '${o.c.n}' object has no attribute '${n.n}'`);}
      if(o&&o.mod&&n.n in o)return o[n.n];
      err(n.l,`AttributeError: '${o===null?'NoneType':typeof o}' object has no attribute '${n.n}'`);}}
    err(n.l,'Unsupported expression');};
  const loop=b=>{try{execBlock(b);}catch(e){if(e===BRK)return 1;if(e!==CNT)throw e;}};
  const execBlock=b=>{for(const s of b)exec(s);};
  const exec=s=>{switch(s.t){
    case'expr':step(s.l);ev(s.v);break;
    case'asg':{step(s.l);const v=ev(s.v);s.tg.forEach(t=>assign(t,v,s.l));break;}
    case'aug':{step(s.l);const c=ev(s.tg),r=ev(s.v);if(s.o=='+'&&Array.isArray(c)&&Array.isArray(r))c.push(...r);else assign(s.tg,binop(s.o,c,r,s.l),s.l);break;}
    case'if':{step(s.l);lc='';const r=truthy(ev(s.c));steps[steps.length-1].c=(lc?lc+'  →  ':'')+(r?'True':'False');execBlock(r?s.b:s.e);break;}
    case'while':for(;;){step(s.l);lc='';const r=truthy(ev(s.c));steps[steps.length-1].c=(lc?lc+'  →  ':'')+(r?'True':'False');if(!r)break;if(loop(s.b))break;}break;
    case'for':{step(s.l);const it=iter(ev(s.it),s.l);for(let i=0;i<it.length;i++){assign(s.tg,it[i],s.l);if(loop(s.b))break;if(i+1<it.length)step(s.l);}break;}
    case'class':{step(s.l);const m=Object.create(null);s.b.forEach(d=>{if(d.t=='def')m[d.n]={fn:1,n:d.n,ps:d.ps.map(p=>({n:p.n,d:p.d?ev(p.d):undefined})),b:d.b};});stack[stack.length-1].v[s.n]={cls:1,n:s.n,m};break;}
    case'def':step(s.l);stack[stack.length-1].v[s.n]={fn:1,n:s.n,ps:s.ps.map(p=>({n:p.n,d:p.d?ev(p.d):undefined})),b:s.b,env:stack[stack.length-1].v,memo:s.memo};break;
    case'decl':step(s.l);{const v=stack[stack.length-1].v,z=NL.get(v)||new Set();s.ns.forEach(x=>z.add(x));NL.set(v,z);}break;
    case'ret':step(s.l);throw new Ret(s.v?ev(s.v):null);
    case'break':step(s.l);throw BRK;case'continue':step(s.l);throw CNT;case'pass':step(s.l);}};
  try{execBlock(prog);steps.push({l:0,out,done:1,...snap()});}
  catch(x){if(x===BRK||x===CNT||x instanceof Ret)x=Error('SyntaxError: invalid control flow');
    steps.push({l:x.line||(steps.length?steps[steps.length-1].l:0),out,error:x.py?x.message:'Error: '+x.message,...snap()});}
  steps.evs=evs;return steps;}
/*END*/
