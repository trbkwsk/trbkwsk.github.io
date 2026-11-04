/* Original frame coordinator arithmetic/order. Finite normal x87 arithmetic,
 * explicit float32 stores, declared caller events. Not a whole game runtime.
 * Object activation is separate from the manager's advancing clock.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const L=node?require('./gettingup-object-lifecycle.js'):root.GettingUpObjectLifecycle;
  const api=factory(L);if(node)module.exports=api;else root.GettingUpFrameCoordinator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(L){'use strict';
  const f=Math.fround,word=v=>new Uint32Array(new Float32Array([v]).buffer)[0];
  const STEP=f(1/60),BIG=new Float32Array(new Uint32Array([0x7e967699]).buffer)[0],NORMAL=f(.2),FAST=f(.1);
  const bitLength=n=>n.toString(2).length;
  function round(n,d){const q=n/d,r=n%d;return q+(2n*r>d||2n*r===d&&(q&1n)?1n:0n)}
  function shifted(n,k){return k>=0?n<<BigInt(k):round(n,1n<<BigInt(-k))}
  function extended(n,e){
    if(!n)return {n:0n,e:0};const sign=n<0n?-1n:1n;n*=sign;
    const exponent=e+bitLength(n)-1;if(exponent<=-1000||exponent>=1000)throw Error('outside normal x87 domain');
    const shift=Math.max(0,bitLength(n)-64);return {n:sign*shifted(n,-shift),e:e+shift};
  }
  function D(value){
    if(typeof value!=='number'||!Number.isFinite(value))throw Error('finite numeric operand required');
    const a=new DataView(new ArrayBuffer(8));a.setFloat64(0,value,true);const bits=a.getBigUint64(0,true);
    const exp=Number((bits>>52n)&2047n),mant=bits&((1n<<52n)-1n),sign=bits>>63n?-1n:1n;
    return extended(sign*(exp?mant|(1n<<52n):mant),exp?exp-1075:-1074);
  }
  const as=v=>typeof v==='number'?D(v):v,neg=a=>({n:-as(a).n,e:as(a).e});
  function add(a,b){a=as(a);b=as(b);const e=Math.min(a.e,b.e);return extended((a.n<<BigInt(a.e-e))+(b.n<<BigInt(b.e-e)),e)}
  const sub=(a,b)=>add(a,neg(b)),mul=(a,b)=>{a=as(a);b=as(b);return extended(a.n*b.n,a.e+b.e)};
  function div(a,b){
    a=as(a);b=as(b);if(!b.n)throw Error('zero x87 divisor');if(!a.n)return D(0);
    let n=a.n,d=b.n,sign=1n;if(n<0n){sign=-sign;n=-n}if(d<0n){sign=-sign;d=-d}
    let exponent=bitLength(n)-bitLength(d);
    if(exponent>=0?n<(d<<BigInt(exponent)):(n<<BigInt(-exponent))<d)exponent--;
    const shift=exponent-63;
    const q=shift>=0?round(n,d<<BigInt(shift)):round(n<<BigInt(-shift),d);
    return extended(sign*q,a.e-b.e+shift);
  }
  function store(a){
    a=as(a);if(!a.n)return 0;const sign=a.n<0n?-1:1,n=a.n<0n?-a.n:a.n,exponent=a.e+bitLength(n)-1;
    if(exponent>127)throw Error('f32 overflow outside frame domain');
    const shift=Math.max(exponent,-126)-23-a.e,q=shifted(n,-shift);
    const v=f(sign*Number(q)*2**(a.e+shift));if(!Number.isFinite(v))throw Error('f32 overflow');return v;
  }
  function compare(a,b){a=as(a);b=as(b);const e=Math.min(a.e,b.e),x=(a.n<<BigInt(a.e-e))-(b.n<<BigInt(b.e-e));return x<0n?-1:x>0n?1:0}
  function finite(v){D(v);const result=f(v);if(!Number.isFinite(result))throw Error('finite f32 required');return result}
  function integer(v){if(!Number.isInteger(v)||v< -2147483648||v>2147483647)throw Error('signed 32 bit integer required');return v}
  const FLOATS=Object.freeze(['total','total_pause','true_dt','scaled_dt','timer','scale','scale_target','one_tick_scale','mult','mult_target']);
  const COUNTS=['scale_steps','ramp_in','ramp_out','hold'];
  const DEFAULTS=Object.freeze({freeze:0,total:0,total_pause:0,frozen:0,true_dt:0,scaled_dt:0,timer:0,timer_arg:0,
    scale:1,scale_target:1,scale_steps:0,one_tick:0,one_tick_scale:0,mult:1,ramp_in:0,ramp_out:0,hold:0,mult_target:1});
  function timeManager(input={}){
    const s={...DEFAULTS,...input};
    if(Object.keys(s).some(k=>!Object.prototype.hasOwnProperty.call(DEFAULTS,k)))throw Error('known time-manager fields required');
    for(const k of FLOATS)s[k]=finite(s[k]);for(const k of COUNTS)s[k]=integer(s[k]);
    for(const k of ['freeze','frozen','one_tick'])if(!Number.isInteger(s[k])||s[k]<0||s[k]>255)throw Error('time byte required');
    if(!Number.isInteger(s.timer_arg)||s.timer_arg<0||s.timer_arg>0xffffffff)throw Error('timer DWORD required');return s;
  }
  function frameEnter(input,dt,timeScale=1,managerMode=0,fixedAccumulator=0,step=STEP){
    const s=timeManager(input),events=[];let d=finite(dt);step=finite(step);fixedAccumulator=finite(fixedAccumulator);
    if(step<=0||fixedAccumulator<0||fixedAccumulator>=step)throw Error('valid fixed accumulator required');
    s.total_pause=store(add(d,s.total_pause));
    if(s.ramp_in>0){const n=s.ramp_in--;s.mult=store(add(div(sub(s.mult_target,s.mult),n),s.mult))}
    else if(s.hold>0){s.hold--;s.mult=s.mult_target}
    else if(s.ramp_out>0){const n=s.ramp_out--;s.mult=store(add(div(sub(1,s.mult),n),s.mult))}
    else s.mult=1;
    const factor=managerMode===1?0:finite(timeScale);let k=store(mul(factor,s.mult));
    if(d>.5)d=.5;else if(d<0)d=0;s.true_dt=d;
    if(s.one_tick){k=s.one_tick_scale;s.one_tick=0}
    else if(s.frozen||s.scale_steps!==0){
      let x=D(d),acc=D(0),result=acc;
      if(s.timer>0){s.timer=store(sub(s.timer,d));if(s.timer<=0){events.push(['timer_fire',s.timer_arg]);s.timer=0}}
      let remain=store(sub(step,fixedAccumulator));const inverse=s.scale===0?BIG:store(div(1,s.scale));
      if(x.n){let guard=0;for(;;){
        if(++guard>10000)throw Error('piecewise scale did not terminate within verified domain');
        const limit=mul(inverse,remain);
        if(compare(x,limit)<0){result=add(acc,mul(x,s.scale));break}
        acc=add(acc,remain);x=sub(x,limit);const n=s.scale_steps;
        if(n){const q=div(1,n);s.scale=store(add(mul(q,s.scale_target),mul(sub(1,q),s.scale)))}else s.scale=s.scale_target;
        if(n>0)s.scale_steps=n-1;
        if(!s.frozen&&s.scale_steps===0){acc=add(acc,x);x=D(0)}
        remain=step;if(!x.n){result=acc;break}
      }}d=store(result);
    }
    if(d>.5)d=.5;d=store(mul(k,d));if(s.freeze)d=0;
    s.total=store(add(s.total,d));s.scaled_dt=d;return {tm:s,dt:d,events};
  }
  function objectManager(input={}){
    const s={ticks:-1,accumulator:0,frame_dt:0,...input};
    if(Object.keys(s).some(k=>!['ticks','accumulator','frame_dt'].includes(k)))throw Error('known object-manager fields required');
    s.ticks=integer(s.ticks);s.accumulator=finite(s.accumulator);s.frame_dt=finite(s.frame_dt);
    if(s.accumulator<0||s.accumulator>=STEP)throw Error('fixed accumulator outside one tick');return s;
  }
  function scheduleChunk(input,chunk,step=STEP){
    const s=objectManager(input),events=[];chunk=finite(chunk);step=finite(step);
    if(chunk<0||chunk>.5||step!==STEP)throw Error('bounded original chunk and fixed step required');
    s.frame_dt=chunk;events.push(['level',chunk]);
    if(s.ticks<0){events.push(['tick','fixed',0,1,0,0],['tick','variable',0,0,0,0],['interp',0,0]);s.ticks=0;s.accumulator=0}
    const remain=store(sub(step,s.accumulator));
    if(chunk<remain){events.push(['interp',chunk,0]);s.accumulator=store(add(chunk,s.accumulator))}
    else{
      events.push(['interp',remain,0]);let x=store(sub(chunk,remain));
      for(;;){const last=x<step;events.push(['tick','fixed',step,1,+last,last?x:step]);s.ticks=(s.ticks+1)|0;
        if(last){s.accumulator=x;events.push(['interp',x,1]);break}
        events.push(['interp',step,0]);x=store(sub(x,step));
      }
    }
    events.push(['tick','variable',chunk,0,0,0]);return {om:s,events};
  }
  function chunkFrame(dt,fastForward=()=>false){
    dt=finite(dt);if(dt<0||dt>64)throw Error('nonnegative finite chunking domain required');
    const chunks=[];let queries=0,timed=false;
    const ff=()=>{if(++queries>10000)throw Error('fast-forward source did not terminate');return Boolean(fastForward())};
    for(;;){if(!timed&&ff())timed=true;let total=ff()?FAST:dt;const limit=ff()?FAST:NORMAL;
      while(total!==0){const piece=total>limit?limit:total;chunks.push(piece);dt=piece;total=store(sub(total,piece))}
      if(!ff())return {chunks,queries};
    }
  }
  function frame(tm,om,rawDt,options={}){
    const raw_dt=finite(rawDt);tm=timeManager(tm);om=objectManager(om);
    if(options.active===false||raw_dt===0)return {tm,om,raw_dt,scaled_dt:0,chunks:[],events:[]};
    const entered=frameEnter(tm,raw_dt,options.time_scale??1,options.manager_mode??0,om.accumulator),events=entered.events.slice();
    let d=options.forced_step?STEP:entered.dt;const {chunks}=chunkFrame(d,options.fast_forward??(()=>false));
    for(const chunk of chunks){const r=scheduleChunk(om,chunk);om=r.om;events.push(...r.events)}
    return {tm:entered.tm,om,raw_dt,scaled_dt:d,chunks,events};
  }
  function route(input,events){
    if(!L)throw Error('original object lifecycle must load first');const state=L.copy(input),out=[];
    if(state.dormant)return out;
    for(const e of events){if(e[0]==='interp')out.push({call:'interp',argument_words:[word(e[1]),e[2]]});
      else if(e[0]==='tick'&&e[1]==='fixed')out.push({call:'fixed',argument_words:[word(e[2]),e[3],e[4],word(e[5])]});
      else if(e[0]==='tick'&&e[1]==='variable')out.push({call:'variable',argument_words:[word(e[2])]});}
    return out;
  }
  const arithmetic=Object.freeze({fromNumber:D,add,sub,mul,div,store});
  return Object.freeze({STEP,FLOATS,word,timeManager,objectManager,frameEnter,chunkFrame,scheduleChunk,frame,route,arithmetic});
});
