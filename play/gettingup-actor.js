/* Original-code-derived zero-event base actor and cyclic root consumers.
 * Declared descriptors, default compensation/shape, finite checked domains.
 * Not original script/factory assignment, live scheduling, entity motion or IK.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const A=node?require('./gettingup-animation.js'):root.GettingUpAnimation;
  const C=node?require('./gettingup-clocks.js'):root.GettingUpClocks;
  const api=factory(A,C);if(node)module.exports=api;else root.GettingUpActor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A,C){'use strict';
  if(!A||!C)throw Error('Animation and clock modules must load before actor');
  const f=Math.fround,view=a=>new DataView(a.buffer,a.byteOffset,a.byteLength);
  const short=C.short,TABLES=[0x10400ea8,0x10400ec4,0x10400ee0,0x10400efc],SIZES=[0x30,0x3c,0x38,0x3c];
  const word=v=>{const d=new DataView(new ArrayBuffer(4));d.setFloat32(0,v,true);return d.getUint32(0,true)};
  const number=v=>{const d=new DataView(new ArrayBuffer(4));d.setUint32(0,v,true);return d.getFloat32(0,true)};
  const length=n=>n.toString(2).length;
  function roundShift(n,s){if(s<=0)return n<<BigInt(-s);const k=BigInt(s),q=n>>k,r=n-(q<<k),h=1n<<(k-1n);return q+(r>h||r===h&&(q&1n)?1n:0n)}
  // Exact finite dyadics, rounded after each x87 operation to 64 bits.
  // Rational division is needed for cursor duration reciprocals, not JS 1/d.
  class Extended{
    constructor(n,e=0,z=false){
      if(n===0n){this.n=0n;this.e=0;this.z=z;return}
      const sign=n<0n?-1n:1n,s=Math.max(0,length(n*sign)-64);
      this.n=sign*roundShift(n*sign,s);this.e=e+s;this.z=false;
    }
    static integer(v){if(!Number.isSafeInteger(v))throw Error('exact integer required');return new Extended(BigInt(v))}
    static float(v){v=f(v);if(!Number.isFinite(v))throw Error('finite f32 operand required');const b=word(v),e=(b>>>23)&255;return new Extended((b>>>31?-1n:1n)*BigInt(e?(b&0x7fffff)|0x800000:b&0x7fffff),e?e-150:-149,Object.is(v,-0))}
    static ratio(n,d){
      if(d===0n)throw Error('nonzero divisor required');if(d<0n){n=-n;d=-d}if(n===0n)return new Extended(0n);
      const sign=n<0n?-1n:1n;n*=sign;let exponent=length(n)-length(d);
      if(exponent>=0?n<(d<<BigInt(exponent)):(n<<BigInt(-exponent))<d)exponent--;
      if(exponent<=-1000||exponent>=1000)throw Error('outside normal x87 domain');
      const e=exponent-63,a=e<0?n<<BigInt(-e):n,b=e>=0?d<<BigInt(e):d;
      let q=a/b;const r=a%b;if(2n*r>b||2n*r===b&&(q&1n))q++;
      return new Extended(sign*q,e);
    }
    neg(){return new Extended(-this.n,this.e,this.n===0n?!this.z:false)}
    negative(){return this.n<0n||this.n===0n&&this.z}
    add(b){const e=Math.min(this.e,b.e),n=(this.n<<BigInt(this.e-e))+(b.n<<BigInt(b.e-e));return new Extended(n,e,n===0n&&this.n===0n&&b.n===0n&&this.z&&b.z)}
    sub(b){return this.add(b.neg())}
    mul(b){return new Extended(this.n*b.n,this.e+b.e,this.negative()!==b.negative())}
    compare(b){const e=Math.min(this.e,b.e),a=this.n<<BigInt(this.e-e),v=b.n<<BigInt(b.e-e);return a<v?-1:a>v?1:0}
    trunc(){return Number(this.e>=0?this.n<<BigInt(this.e):this.n/(1n<<BigInt(-this.e)))}
    value(){return Number(this.n)*2**this.e}
    bits(){
      if(this.n===0n)return this.z?0x80000000:0;
      const sign=this.n<0n?0x80000000:0,n=this.n<0n?-this.n:this.n,b=length(n);let exp=this.e+b-1;
      if(exp>127)throw Error('finite f32 result required');
      if(exp<-126){const q=roundShift(n,-149-this.e);return (sign|Number(q))>>>0}
      let q=roundShift(n,b-24);if(q===1n<<24n){q>>=1n;exp++}
      if(exp>127)throw Error('finite f32 result required');
      return (sign|((exp+127)<<23)|Number(q-(1n<<23n)))>>>0;
    }
  }
  const I=Extended.integer,F=Extended.float,Z=I(0),ONE=I(1),EPS=F(number(0x358637bd));
  const fp=(r,a)=>view(r).getFloat32(a,true),i32=(r,a)=>view(r).getInt32(a,true),i16=(r,a)=>view(r).getInt16(a,true);
  // Cursor references use rational scalar zeros, unlike signed pose words.
  const store=(r,a,v)=>view(r).setUint32(a,v.n===0n?0:v.bits(),true);
  const integer=(r,a,v)=>view(r).setInt32(a,v,true),small=(r,a,v)=>view(r).setInt16(a,short(v),true);
  const scalar=(r,a)=>F(fp(r,a)),ints=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<hi;
  function descriptor(d){
    if(!d||Object.keys(d).some(k=>!['kind','start','end','duration','next_frame','direction','token','previous_direction'].includes(k)))throw Error('unsupported cursor descriptor field');
    const o={kind:d.kind,start:d.start,end:d.end,duration:d.duration??4,next_frame:d.next_frame??-1,direction:d.direction??1,token:d.token??7,previous_direction:d.previous_direction};
    if(!ints(o.kind,0,4)||!ints(o.start,0,256)||!ints(o.end,0,256)||!ints(o.duration,1,128)||![-1,1].includes(o.direction)||(o.end-o.start)*o.direction<0||!ints(o.next_frame,-32768,32768)||!ints(o.token,0,2**31))throw Error('outside verified cursor descriptor domain');
    if(o.previous_direction!==undefined&&![-1,1].includes(o.previous_direction))throw Error('bounded previous direction required');return o;
  }
  class Cursor{
    constructor(options){
      const d=descriptor(options),{kind,start,end,duration,next_frame,token}=d;let direction=d.direction;
      if(kind===3&&start===end&&d.previous_direction!==undefined)direction=d.previous_direction;
      this.kind=kind;this.raw=new Uint8Array(SIZES[kind]).fill(0xa5);this.wrap_flag=0;const r=this.raw;
      view(r).setUint32(0,TABLES[kind],true);view(r).setUint32(4,token,true);
      for(const [at,v] of [[8,start],[10,end],[12,next_frame],[14,direction]])small(r,at,v);
      integer(r,0x10,(end-start)*(kind!==3?direction:1));store(r,0x14,I(start));store(r,0x18,I(direction));r[0x1c]=0;store(r,0x20,Z);
      if(kind!==3){store(r,0x24,ONE);store(r,0x28,ONE);r[0x2c]=0}
      if(kind===1){store(r,0x30,Z);integer(r,0x34,duration);store(r,0x38,Extended.ratio(1n,BigInt(duration)).add(EPS))}
      else if(kind===2||kind===3){integer(r,0x30,duration);store(r,0x34,Extended.ratio(1n,BigInt(duration)));if(kind===3)store(r,0x38,Extended.ratio(1n,2n))}
    }
    time(){
      const r=this.raw,[start,end,nxt,direction]=[8,10,12,14].map(a=>i16(r,a));
      if(r[0x1c])return [end,nxt,fp(r,0x20)];if(this.kind===3)return [start,end,fp(r,0x20)];
      let lo,hi,frac;
      if(direction>0){lo=short(scalar(r,0x14).trunc());hi=short(lo+1);frac=scalar(r,0x14).sub(I(lo));if(hi>end)hi=nxt}
      else{const distance=I(start).sub(scalar(r,0x14)),whole=short(distance.trunc());lo=short(start-whole);hi=short(lo-1);frac=distance.sub(I(whole));if(lo<end)hi=nxt}
      return [lo,hi,number(frac.n===0n?0:frac.bits())];
    }
    step(input){
      const delta=F(input);if(!Number.isFinite(input)||Math.abs(input)>128)throw Error('outside bounded finite cursor delta domain');
      const r=this.raw,token=i32(r,4),ticks=[];let rest;
      const appendRange=(a,b,d)=>{for(let v=a;(b-v)*d>0;v+=d)ticks.push(v)};
      if(this.kind===3){
        let value;if(r[0x1c])value=delta.add(scalar(r,0x20));
        else{value=delta.mul(scalar(r,0x34)).add(scalar(r,0x20));store(r,0x20,value);if(value.compare(ONE)>0){value=value.sub(ONE).mul(I(i32(r,0x30)));if(value.compare(ONE)<=0)r[0x1c]=1}}
        store(r,0x20,value);if(value.compare(ONE)<=0){ticks.push(scalar(r,0x14).trunc());rest=Z}else rest=value.sub(ONE);
      }else if(r[0x1c]){
        let increment=delta;
        if(this.kind===1){
          increment=delta.mul(scalar(r,0x38));const beta=increment.add(scalar(r,0x30));store(r,0x30,beta);
          const period=scalar(r,0x38),threshold=period.sub(EPS);
          if(beta.compare(threshold)>=0){this.wrap_flag=1;do{store(r,0x30,scalar(r,0x30).sub(period))}while(scalar(r,0x30).compare(threshold)>=0)}
        }
        const value=increment.add(scalar(r,0x20));store(r,0x20,value);
        if(value.compare(ONE)<=0){ticks.push(scalar(r,0x14).trunc());rest=Z}else rest=value.sub(ONE);
      }else{
        const [start,end,direction]=[8,10,14].map(a=>i16(r,a)),old=scalar(r,0x14);
        const previous=old.sub(I(start)).mul(scalar(r,0x18)).trunc()*direction+start;
        const rate=this.kind===0?ONE:this.kind===1?scalar(r,0x38):I(i32(r,0x30));
        const scale=this.kind===0?ONE:this.kind===1?I(i32(r,0x34)):scalar(r,0x34);
        const value=delta.mul(scalar(r,0x24)).mul(rate).mul(scalar(r,0x18)).add(old);store(r,0x14,value);
        const distance=value.sub(I(start)).mul(scalar(r,0x18)),overshoot=distance.sub(I(i32(r,0x10))),residual=F(number(overshoot.n===0n?0:overshoot.bits()));
        if(overshoot.compare(Z)<=0){
          const target=distance.trunc()*direction+start;appendRange(previous,target,direction);
          if(!ticks.length||ticks[ticks.length-1]!==target)ticks.push(target);r[0x2c]=1;rest=Z;
        }else{
          appendRange(previous,end,direction);if(ticks.length)r[0x2c]=1;
          if(residual.compare(ONE)<0){if(!ticks.length||ticks[ticks.length-1]!==end){ticks.push(end);r[0x2c]=1}r[0x1c]=1;store(r,0x20,residual);rest=Z}
          else{
            if(start===end&&!r[0x2c]){ticks.push(start);r[0x2c]=1}
            rest=residual.sub(ONE);if(rest.compare(ONE)>=0)rest=Z;
            rest=rest.mul(scale).mul(scalar(r,0x28));if(rest.n===0n)rest=EPS;
          }
        }
      }
      if(Math.abs(fp(r,0x14))>=32768)throw Error('cursor ftol short conversion outside checked domain');
      return {tokens:ticks.map(()=>token),ticks,remainder_f32:number(rest.n===0n?0:rest.bits()),remainder_extended:rest,time:this.time(),raw:new Uint8Array(r),wrap_flag:this.wrap_flag};
    }
  }
  class Chain{
    constructor(descriptors){
      if(!Array.isArray(descriptors)||!ints(descriptors.length,1,33))throw Error('bounded descriptor chain required');
      this.descriptors=descriptors.map(descriptor);this.cursors=[null,null,null,null];this.index=-1;this.cursor=null;this.previous_direction=1;this.event_counter=-1024;this.wrap_flag=0;this.bind(0);
    }
    bind(index){
      if(!ints(index,0,this.descriptors.length))throw Error('descriptor index outside chain');
      this.previous_direction=this.cursor?i16(this.cursor.raw,14):1;this.index=index;
      const d=this.descriptors[index];this.cursor=new Cursor({...d,previous_direction:this.previous_direction});this.cursors[d.kind]=this.cursor;
      this.cursor.wrap_flag=this.wrap_flag;this.event_counter=-1024;
    }
    step(delta){
      const tokens=[],ticks=[],calls=[],bound=[];let remainder;
      for(;;){
        calls.push([this.index,word(delta)]);const r=this.cursor.step(delta);tokens.push(...r.tokens);ticks.push(...r.ticks);this.wrap_flag=r.wrap_flag;
        if(r.remainder_extended.compare(Z)<=0){remainder=0;break}
        if(this.index===this.descriptors.length-1){remainder=r.remainder_f32;break}
        this.bind(this.index+1);bound.push(this.index);delta=r.remainder_f32;
      }
      return {tokens,ticks,remainder_f32:remainder,time:this.cursor.time(),index:this.index,previous_direction:this.previous_direction,
        event_counter:this.event_counter,cursors:this.cursors.map(c=>c?new Uint8Array(c.raw):null),wrap_flag:this.wrap_flag,advance_calls:calls,bound_indices:bound};
    }
  }
  class Actor{
    constructor(descriptors,raw=A.initialState(1,0)){
      if(descriptors.some(d=>(d.token??0)!==0))throw Error('zero-event index descriptors required');
      this.chain=new Chain(descriptors.map(d=>({...d,token:0})));this.speed=1;
      this.tick_preparations=this.cycles=this.since_end=this.delay=this.script_tick=0;
      this.event_counter=-1024;this.ended=false;this.cycle_enabled=true;this.pending_tokens=[];this.pending_ticks=[];this.raw=new Uint8Array(raw);
    }
    dispatch(){
      for(const tick of this.pending_ticks)this.script_tick=tick;
      if(this.pending_ticks.length)this.event_counter=this.pending_ticks[this.pending_ticks.length-1];this.pending_tokens=[];this.pending_ticks=[];
    }
    advance(delta){
      const r=this.chain.step(delta);if(r.bound_indices.length)this.event_counter=-1024;
      this.pending_tokens.push(...r.tokens);this.pending_ticks.push(...r.ticks);
      this.calls.push(...r.advance_calls.map(([index,bits])=>['advance',index,bits]));this.binds.push(...r.bound_indices);return r.remainder_f32;
    }
    bindFirst(){this.chain.bind(0);this.event_counter=-1024;this.binds.push(0)}
    step(delta,controls={}){
      delta=f(delta);if(!Number.isFinite(delta)||delta<0||delta>128)throw Error('bounded finite nonnegative actor delta required');
      const {skip_once=false,delay,cycle_enabled,speed}=controls;
      if(Object.keys(controls).some(k=>!['skip_once','delay','cycle_enabled','speed'].includes(k)))throw Error('unsupported actor control');
      if(speed!==undefined){const s=f(speed);if(!Number.isFinite(s)||s<0||s>4)throw Error('bounded nonnegative speed required');this.speed=s}
      if(delay!==undefined){if(!ints(delay,0,33))throw Error('bounded nonnegative delay required');this.delay=delay}
      if(cycle_enabled!==undefined)this.cycle_enabled=!!cycle_enabled;
      this.calls=[];this.binds=[];let submission=null,secondary_update=false;
      if(!skip_once){
        this.ended=false;this.since_end=(this.since_end+1)>>>0;this.tick_preparations=(this.tick_preparations+1)>>>0;
        if(this.delay)this.delay--;
        else{
          let time=this.chain.cursor.time(),cycle=0;this.chain.wrap_flag=this.chain.cursor.wrap_flag=0;
          const increment=number(F(delta).mul(F(this.speed)).bits());if(Math.abs(increment)>128)throw Error('bounded product required');
          let remainder=this.advance(increment);this.dispatch();if(remainder<=0)time=this.chain.cursor.time();
          if(remainder>0||time[1]<0&&time[2]>=1){
            this.since_end=0;
            if(this.cycle_enabled){
              this.script_tick=this.chain.descriptors[this.chain.descriptors.length-1].end;this.ended=true;const first=this.chain.descriptors[0];
              if(time[1]<0){time=[time[0],first.start,time[2]];if(time[1]<time[0])cycle=1;else if(time[0]<time[1])cycle=2}
              else cycle=1+Number(first.end<first.start);
              this.cycles=(this.cycles+1)>>>0;
              if(remainder===0){this.bindFirst();this.advance(0)}
              else{
                let done=false;for(let i=0;i<256;i++){this.bindFirst();remainder=this.advance(remainder);this.dispatch();if(remainder===0){done=true;break}}
                if(!done)throw Error('bounded cycle remainder loop did not terminate');
              }
              time=this.chain.cursor.time();if(time[1]<0)time=[time[0],first.start,time[2]];
            }
          }else this.cycle_enabled=true;
          submission=[time,cycle];this.raw=A.submitTime(this.raw,C.packTC(time));
        }
        secondary_update=true;
      }
      return {submission,secondary_update,advance_calls:this.calls.slice(),bound_indices:this.binds.slice(),
        actor_fields:{'0x2c':this.tick_preparations,'0x5c':this.cycles,'0x68':this.since_end,'0x70':this.event_counter>>>0,
          '0x74':this.chain.previous_direction>>>0,'0x90':this.delay},ended:Number(this.ended),cycle_enabled:Number(this.cycle_enabled),
        global_wrap_flag:this.chain.wrap_flag,event_flag:0,script_tick:this.script_tick>>>0,descriptor_index:this.chain.index,
        base_state:Array.from(this.raw),pending_tokens:this.pending_tokens.slice(),pending_ticks:this.pending_ticks.slice(),
        cursors:this.chain.cursors.map(c=>c?Array.from(c.raw):null)};
    }
  }
  function quaternionMultiply(a,b){
    const [ax,ay,az,aw]=a,[bx,by,bz,bw]=b;
    return [aw.mul(bx).add(ax.mul(bw)).add(ay.mul(bz)).sub(az.mul(by)),
      aw.mul(by).add(ay.mul(bw)).add(az.mul(bx)).sub(ax.mul(bz)),
      aw.mul(bz).add(ax.mul(by)).add(az.mul(bw)).sub(ay.mul(bx)),
      aw.mul(bw).sub(ax.mul(bx)).sub(ay.mul(by)).sub(az.mul(bz))];
  }
  function poseWords(left,right,difference=false){
    if(!left||!right||left.length!==7||right.length!==7||[...left,...right].some(v=>!Number.isFinite(v)||Math.abs(v)>4096))throw Error('bounded finite Q4/XYZ3 operands required');
    const a=left.map(F),b=right.map(F),dot=a[3].mul(b[3]).add(a[2].mul(b[2])).add(a[1].mul(b[1])).add(a[0].mul(b[0]));
    if(dot.compare(Z)<0)for(let i=0;i<4;i++)a[i]=a[i].neg();
    const q=difference?quaternionMultiply(b.slice(0,4).map((v,i)=>i<3?v.neg():v),a.slice(0,4)):quaternionMultiply(a.slice(0,4),b.slice(0,4));
    return [...q,...[4,5,6].map(i=>difference?a[i].sub(b[i]):a[i].add(b[i]))].map(v=>v.bits());
  }
  function poseOperation(a,b,difference=false){const v=poseWords(a.flat(),b.flat(),difference).map(number);return [v.slice(0,4),v.slice(4)]}
  class RootCycleTC extends C.RootTC{
    endpoint(index,frame){
      const [q,t]=this.samplers[index].sample(frame),mode=this.clip.mode;
      if(mode===0){const h=this.height.sample(frame)[0];t[1]=f(index===0?t[1]+h:t[1]-h)}
      else if(mode===1&&index===1)t[1]=f(t[1]-this.first);
      else if(mode===2){if(index===0)t[1]=f(t[1]+this.rootHeight+this.first);else t.splice(0,3,0,-this.first,0)}
      return [q,t];
    }
    requestCycleTC(time,cycle){
      if(![0,1,2].includes(cycle))throw Error('cycle argument 0/1/2 required');
      this.snapshot=this.current.map(A.copyPose);this.target=this.sampleTC(time).map((p,i)=>A.alignedPose(p,this.snapshot[i]));
      if(!cycle)return;const [end,start]=cycle===1?[this.clip.frames-1,0]:[0,this.clip.frames-1];
      // Recordwise origin end/start, then root end/start. Mode 0 shares a
      // stateful integer-time height cache; eager paired sampling is wrong.
      for(let index=0;index<2;index++){
        const first=poseOperation(this.endpoint(index,end),this.snapshot[index],true);
        const second=poseOperation(this.target[index],this.endpoint(index,start),true);
        this.snapshot[index]=poseOperation(this.target[index],poseOperation(first,second),true);
      }
    }
    requestTC(time){this.requestCycleTC(time,0)}
  }
  class ActorCharacterController extends C.ClockCharacterController{
    constructor(bones,clip,descriptors){
      const checked=new Actor(descriptors);super(bones,clip);this.descriptors=checked.chain.descriptors.map(d=>({...d}));
      this.root=new RootCycleTC(clip);this.roots[0]=this.root;this.actor=new Actor(this.descriptors,this.state);this.lastActorOutcome=null;
    }
    initializeOriginal(clip,start=0){
      if(start!==0)throw Error('actor full-skeleton proof uses fresh Init start zero');
      super.initializeOriginal(clip,start);this.root=new RootCycleTC(clip,[0,0,0]);this.roots[0]=this.root;
      this.actor=new Actor(this.descriptors,this.state);this.lastActorOutcome=null;return this.poses();
    }
    actorStep(delta,controls={}){
      this.actor.raw=this.state;const out=this.actor.step(delta,controls);
      if(out.submission){
        const [time,cycle]=out.submission;this.timer(1,.5);this.state=A.submitTime(this.state,C.packTC(time));
        this.root.requestCycleTC(time,cycle);this.layers[0].items.requestTC(time);
        if(this.state.some((v,i)=>v!==this.actor.raw[i]))throw Error('independent actor/controller submit states differ');
      }
      if(out.secondary_update)this.updateSecondaryClocks();this.lastActorOutcome=out;return out;
    }
  }
  return Object.freeze({Extended,word,number,TABLES,SIZES,Cursor,Chain,Actor,poseWords,poseOperation,RootCycleTC,ActorCharacterController});
});
