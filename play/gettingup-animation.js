/* Bounded port of the x86-validated Python references. No Three.js dependency.
 * Controlled SSE/sign threshold 0; RCPSS uses f32 division, not bit emulation.
 * Not a full game scheduler, entity-world driver, IK or live-runtime claim.
 */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GettingUpAnimation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
  const f=Math.fround,identity=()=>[[0,0,0,1],[0,0,0]];
  function finiteVector(v,n){if(!v||v.length!==n||!Array.from(v).every(Number.isFinite))throw Error('finite vector required');return Array.from(v,f)}
  const copyPose=p=>[finiteVector(p[0],4),finiteVector(p[1],3)];
  // 497470: x87 64-significand operations with asymmetric f32 stores.
  // Keep dyadic arithmetic local so the ordinary module has no cyclic
  // dependency on the signed/provider module. Signed zero is defined.
  const xyzLength=n=>n.toString(2).length;
  function xyzRound(n,s){if(s<=0)return n<<BigInt(-s);const k=BigInt(s),q=n>>k,r=n-(q<<k),h=1n<<(k-1n);return q+(r>h||r===h&&(q&1n)?1n:0n)}
  function xyzExt(n,e,z=false){if(n===0n)return {n,e:0,z};const sign=n<0n?-1n:1n,s=Math.max(0,xyzLength(n*sign)-64);return {n:sign*xyzRound(n*sign,s),e:e+s,z:false}}
  function xyzNum(v){v=f(v);if(!Number.isFinite(v))throw Error('finite XYZ operand required');const a=new Float32Array([v]),b=new Uint32Array(a.buffer)[0],s=b>>>31?-1n:1n,e=(b>>>23)&255;return xyzExt(s*BigInt(e?(b&0x7fffff)|0x800000:b&0x7fffff),e?e-150:-149,Object.is(v,-0))}
  const xyzNeg=a=>({n:-a.n,e:a.e,z:a.n===0n?!a.z:false}),xyzSign=a=>a.n<0n||a.n===0n&&a.z;
  function xyzAdd(a,b){const e=Math.min(a.e,b.e),n=(a.n<<BigInt(a.e-e))+(b.n<<BigInt(b.e-e));return xyzExt(n,e,n===0n&&a.n===0n&&b.n===0n&&a.z&&b.z)}
  const xyzMul=(a,b)=>xyzExt(a.n*b.n,a.e+b.e,xyzSign(a)!==xyzSign(b));
  function xyzStore(a){if(a.n===0n)return a.z?-0:0;const sign=a.n<0n?-1:1,n=a.n<0n?-a.n:a.n,b=xyzLength(n),exp=a.e+b-1;if(exp>127)throw Error('XYZ f32 overflow outside finite domain');const s=exp<-126?-149-a.e:b-24,q=xyzRound(n,s);return f(sign*Number(q)*2**(a.e+s))}
  function lerpXYZ(left,right,coefficient){
    left=finiteVector(left,3).map(xyzNum);right=finiteVector(right,3).map(xyzNum);
    const w=xyzNum(coefficient),l=xyzAdd(xyzNum(1),xyzNeg(w)),stored=a=>xyzNum(xyzStore(a));
    return [xyzAdd(xyzMul(left[0],l),xyzMul(right[0],w)),
      xyzAdd(stored(xyzMul(left[1],l)),xyzMul(right[1],w)),
      xyzAdd(stored(xyzMul(left[2],l)),stored(xyzMul(right[2],w)))].map(xyzStore);
  }
  function weight(v){v=f(v);if(!Number.isFinite(v)||v<0||v>1)throw Error('weight outside [0,1]');return v}
  function frameValue(v){v=f(v);if(!Number.isFinite(v)||v<0||v>=32767)throw Error('frame outside bounded domain');return v}
  function nearestEven(x){const lo=Math.floor(x),r=x-lo;return r<.5?lo:r>.5?lo+1:lo%2===0?lo:lo+1}
  let cachedTables;
  function tables(){
    if(!cachedTables){
      const acos=new Float32Array(2048),sine=new Float32Array(256),pi=f(Math.PI);
      for(let i=0;i<2047;i++)acos[i]=f(Math.acos(f(i/2046)));
      for(let i=0;i<255;i++)sine[i]=f(Math.sin(f(i*pi/254)));
      cachedTables={acos,sine};
    }return cachedTables;
  }
  function lookup(table,value,scale){
    const x=f(f(value)*f(scale)),i=nearestEven(f(x-f(.5))),t=f(x-f(i));
    if(i<0||i>=table.length-1)throw Error('lookup outside verified domain');
    return f(f(f(1-t)*table[i])+f(t*table[i+1]));
  }
  function interpolate(a,b,t){
    a=finiteVector(a,4);b=finiteVector(b,4);t=weight(t);
    for(const q of [a,b]){const n=q.reduce((s,x)=>s+x*x,0);if(n<.99||n>1.01)throw Error('raw quaternion norm outside verified domain')}
    if(a.every((x,i)=>Object.is(x,b[i])))return a.slice();
    const p=a.map((x,i)=>f(x*b[i]));let dot=f(f(p[0]+p[1])+f(p[2]+p[3]));
    if(dot<0){b=b.map(x=>-x);dot=f(-dot)}
    let wa,wb;
    if(f(1-dot)<=f(1e-6)){wa=f(1-t);wb=t}
    else{
      const {acos,sine}=tables(),theta=lookup(acos,dot,2046),r=f(1/lookup(sine,theta,80.8507080078125));
      const alpha=f(f(1-t)*theta),beta=f(t*theta);
      wa=f(lookup(sine,alpha,80.8507080078125)*r);
      wb=f(beta*r); // Original 0x46b656 overwrites sin(beta), intentionally asymmetric.
    }
    let out=a.map((x,i)=>f(f(x*wa)+f(b[i]*wb))),sq=out.map(x=>f(x*x));
    const n=f(f(f(sq[0]+sq[1])+sq[2])+sq[3]);
    if(n!==0){const r=f(1/Math.sqrt(n));out=out.map(x=>f(x*r))}return out;
  }
  function alignedPose(target,reference){
    const out=copyPose(target),rq=finiteVector(reference[0],4);
    if(out[0].reduce((s,x,i)=>s+x*rq[i],0)<0)out[0]=out[0].map(x=>-x);return out;
  }
  function blendPose(a,b,w){
    // 4930d0 compares the coefficient before selecting raw endpoints. These
    // gates accept negative/over-one values and +/-Inf; root/items do not.
    w=f(w);if(Number.isNaN(w))throw Error('NaN body coefficient requires blendBodyRecord raw diagnostic');
    a=copyPose(a);b=copyPose(b);
    if(w<f(.001))return a;if(w>f(.999))return b;
    return [interpolate(a[0],b[0],w),a[1].map((x,i)=>f((1-w)*x+w*b[1][i]))];
  }
  function bodyCoefficientBranch(bits){
    if(!Number.isInteger(bits)||bits<0||bits>0xffffffff)throw Error('raw u32 coefficient required');
    if((bits&0x7fffffff)>0x7f800000)return 'interior';
    if(bits>=0x80000000||bits<0x3a83126f)return 'snapshot';
    return bits>0x3f7fbe77?'target':'interior';
  }
  // Diagnostic bone-record consumer, not a renderer-safe exceptional pose.
  // Preserve every unrelated byte, the fourth vector word and NaN payloads.
  function blendBodyRecord(raw,bits){
    if(!(raw instanceof Uint8Array)||raw.length!==0x160)throw Error('requires a complete 0x160 bone record');
    const out=new Uint8Array(raw),view=new DataView(out.buffer),picked=bodyCoefficientBranch(bits);
    if(picked!=='interior'){
      const q=picked==='snapshot'?0x20:0x40,t=picked==='snapshot'?0x50:0x70;
      out.set(raw.subarray(q,q+16),0x30);out.set(raw.subarray(t,t+16),0x60);
    }else{
      const pose=(q,t)=>[Array.from({length:4},(_,i)=>view.getFloat32(q+4*i,true)),Array.from({length:3},(_,i)=>view.getFloat32(t+4*i,true))];
      const a=pose(0x20,0x50),b=pose(0x40,0x70);
      if((bits&0x7fffffff)>0x7f800000){
        for(const p of [a,b]){const n=p[0].reduce((s,x)=>s+x*x,0);if(!p.flat().every(Number.isFinite)||n<.99||n>1.01)throw Error('NaN prediction requires finite near-unit poses')}
        const equal=Array.from({length:4},(_,i)=>view.getUint32(0x20+4*i,true)===view.getUint32(0x40+4*i,true)).every(Boolean),quiet=(bits|0x400000)>>>0;
        if(equal)out.set(raw.subarray(0x20,0x30),0x30);else for(let i=0;i<4;i++)view.setUint32(0x30+4*i,quiet,true);
        for(let i=0;i<3;i++)view.setUint32(0x60+4*i,quiet,true);
      }else{
        const coefficient=new DataView(new ArrayBuffer(4));coefficient.setUint32(0,bits,true);
        const p=blendPose(a,b,coefficient.getFloat32(0,true));
        for(let i=0;i<4;i++)view.setFloat32(0x30+4*i,p[0][i],true);
        for(let i=0;i<3;i++)view.setFloat32(0x60+4*i,p[1][i],true);
      }
    }
    out[0x158]=1;return out;
  }
  function blendSlotPose(a,b,w){
    w=weight(w);a=copyPose(a);b=copyPose(b);
    if(w===0)return a;if(w===1)return alignedPose(b,a);
    const l=1-w,t=[f(l*a[1][0]+w*b[1][0]),f(f(l*a[1][1])+w*b[1][1]),f(f(l*a[1][2])+f(w*b[1][2]))];
    return [interpolate(a[0],b[0],w),t];
  }
  function timerWeight(elapsed,duration,shape){
    elapsed=f(elapsed);duration=f(duration);shape=weight(shape);
    if(!Number.isFinite(elapsed)||!Number.isFinite(duration)||duration<=0||elapsed<0||elapsed>duration)throw Error('invalid timer domain');
    const x=f(elapsed*f(1/duration));return f(Math.min(1,Math.max(0,(2-4*shape)*x*x+(4*shape-1)*x)));
  }
  class Sampler{
    constructor(keys,kind){
      if(!['xyzw','xyz'].includes(kind))throw Error('unknown sample kind');
      this.kind=kind;this.keys=keys;this.initialized=false;this.lower=0;this.upper=1;this.previousFrame=0;this.current=null;
      keys.forEach((k,i)=>{finiteVector(k[kind],kind==='xyzw'?4:3);if(!Number.isInteger(k.frame)||k.frame<0||i&&keys[i-1].frame>=k.frame)throw Error('bad key times')});
    }
    value(i){return this.keys[i][this.kind].map(f)}
    resetBindingCache(){this.initialized=false}
    sampleSmall(){
      const n=this.keys.length;if(n>1)throw Error('small component requires zero/one key');
      if(!this.initialized){this.current=n?this.value(0):this.kind==='xyzw'?[0,0,0,1]:[0,0,0];this.initialized=true}
      this.lastBranch=n?'one_key':'no_keys';return this.current.slice();
    }
    sample(frame){
      if(this.keys.length<2)return this.sampleSmall();
      frame=frameValue(frame);const n=this.keys.length;
      if(!this.initialized){this.lower=0;this.upper=1;this.previousFrame=this.keys[0].frame;this.current=this.value(0);this.initialized=true}
      const eps=f(1e-4);
      if(Math.abs(frame-this.previousFrame)<eps){this.lastBranch='previous_integer_frame';return this.current.slice()}
      if(Math.abs(frame-this.keys[this.upper].frame)<eps){this.previousFrame=this.keys[this.upper].frame;this.current=this.value(this.upper);this.lastBranch='cached_upper_key';return this.current.slice()}
      if(Math.abs(frame-this.keys[this.lower].frame)<eps){this.previousFrame=this.keys[this.lower].frame;this.current=this.value(this.lower);this.lastBranch='cached_lower_key';return this.current.slice()}
      if(frame<=this.keys[this.lower].frame||frame>=this.keys[this.upper].frame){
        if(frame<=this.previousFrame){
          let found=null;if(Math.trunc(frame)===0)found=0;else for(let i=this.lower-1;i>=0;i--)if(this.keys[i].frame<=frame){found=i;break}
          if(found===null){this.previousFrame=Math.trunc(frame);this.current=this.value(0);this.initialized=false;this.lastBranch='before_first';return this.current.slice()}
          this.lower=found;this.upper=found+1;
        }else{
          let found=null;for(let i=this.lower+2;i<n;i++)if(frame<=this.keys[i].frame){found=i;break}
          if(found===null){this.previousFrame=Math.trunc(frame);this.current=this.value(n-1);this.initialized=false;this.lastBranch='after_last';return this.current.slice()}
          this.lower=found-1;this.upper=found;
        }this.lastBranch='new_interval';
      }else this.lastBranch='cached_interval';
      this.previousFrame=Math.trunc(frame);
      const a=this.keys[this.lower],b=this.keys[this.upper],w=f(f(frame-a.frame)*f(1/(b.frame-a.frame))),va=this.value(this.lower),vb=this.value(this.upper);
      this.current=this.kind==='xyzw'?interpolate(va,vb,w):lerpXYZ(va,vb,w);return this.current.slice();
    }
  }
  class PoseSampler{
    constructor(track,fallback){this.fallback=copyPose(fallback);this.samplers=track?[new Sampler(track.rotations,'xyzw'),new Sampler(track.translations,'xyz')]:null}
    sample(frame){return this.samplers?this.samplers.map(s=>s.sample(frame)):copyPose(this.fallback)}
  }
  class BonePose{
    constructor(sampler,frame=0){this.sampler=sampler;this.target=sampler.sample(frame);this.snapshot=copyPose(this.target);this.current=copyPose(this.target)}
    bindTarget(sampler,frame,preserveCurrent=true){
      this.sampler=sampler;this.snapshot=copyPose(this.current);this.target=sampler.sample(frame);
      if(!preserveCurrent){this.snapshot=copyPose(this.target);this.current=copyPose(this.target)}
    }
    coefficientOnly(w){this.current=blendPose(this.snapshot,this.target,w);return copyPose(this.current)}
    ordinaryRequest(frame,w,suppressSnapshot=false){if(!suppressSnapshot)this.snapshot=copyPose(this.target);this.target=this.sampler.sample(frame);return this.coefficientOnly(w)}
    prepareStop(sampler,frame,progress,complete=false){this.sampler=sampler;this.snapshot=copyPose(this.current);this.target=sampler.sample(frame);this.current=complete?copyPose(this.target):blendPose(this.snapshot,this.target,progress);if(complete)this.snapshot=copyPose(this.target);return copyPose(this.current)}
  }
  class RootSlot{
    constructor(clip,frame=0){
      if(![0,1,2,10].includes(clip.mode))throw Error('root mode not verified');
      if(clip.tracks[0]?.bone!=='origin'||clip.tracks[1]?.bone!=='root')throw Error('origin/root ordering mismatch');
      this.clip=clip;this.samplers=clip.tracks.slice(0,2).map(t=>new PoseSampler(t,identity()));
      this.height=new Sampler(clip.curve.map(([frame,v])=>({frame,xyz:[v,0,0]})),'xyz');
      this.rootHeight=f(clip.binding[0]);this.first=f(clip.binding[1]);this.target=this.sample(frame);this.snapshot=this.target.map(copyPose);this.current=this.target.map(copyPose);
    }
    sample(frame){
      frame=frameValue(frame);frame=Math.min(Math.trunc(frame),this.clip.frames-1)+(frame-Math.trunc(frame));
      const [origin,root]=this.samplers.map(s=>s.sample(frame));
      if(this.clip.mode===0){origin[1][1]=f(origin[1][1]+this.height.sample(frame)[0]);root[1][1]=f(root[1][1]-this.height.sample(frame)[0])}
      else if(this.clip.mode===1)root[1][1]=f(root[1][1]-this.first);
      else if(this.clip.mode===2){origin[1][1]=f(origin[1][1]+this.rootHeight+this.first);root[1]=[0,-this.first,0]}
      return [origin,root];
    }
    transitionTo(clip,frame){
      const oldMode=this.clip.mode,old=this.current.map(copyPose),next=new RootSlot(clip,frame);
      this.clip=next.clip;this.samplers=next.samplers;this.height=next.height;this.rootHeight=next.rootHeight;this.first=next.first;
      this.target=next.target.map((p,i)=>alignedPose(p,old[i]));let ot;
      if([1,10].includes(oldMode)&&[1,10].includes(clip.mode))ot=clip.originZero?[0,0,0]:this.target[0][1].slice();
      else{const a=this.target[1][1],b=old[1][1],c=this.target[0][1];ot=[f(a[0]-b[0]+c[0]),f(a[1]-b[1]+c[1]),f(f(a[2]-b[2])+c[2])]}
      this.snapshot=[[this.target[0][0].slice(),ot],old[1]];this.current=this.snapshot.map(copyPose);
    }
    request(frame){this.snapshot=this.current.map(copyPose);this.target=this.sample(frame).map((p,i)=>alignedPose(p,this.snapshot[i]))}
    coefficientOnly(w){this.current=this.snapshot.map((p,i)=>blendSlotPose(p,this.target[i],w));return this.current.map(copyPose)}
    update(frame,w){this.request(frame);return this.coefficientOnly(w)}
  }
  // Byte-exact state layout preserves all unrelated bytes, like the x86 routines.
  const stateView=s=>new DataView(s.buffer,s.byteOffset,s.byteLength);
  function stateCopy(raw){if(raw.length!==0x34)throw Error('state must be 0x34 bytes');return new Uint8Array(raw)}
  function stateFloat(s,at){return stateView(s).getFloat32(at,true)}
  function stateCount(s){return stateView(s).getUint32(0x14,true)}
  // GCore INC/DEC wrap u32, but x87 FILD/FIDIV interpret the operands i32.
  // Round the FADD and division to 64 significant bits, then directly to
  // binary32. Using JS f64 as an intermediate can lose a halfway decision.
  function counterRound(n,d,precision,minShift=-1000){
    if(d<0n){n=-n;d=-d}if(n===0n)return {n:0n,e:0};
    const sign=n<0n?-1n:1n;n=n<0n?-n:n;
    let exponent=n.toString(2).length-d.toString(2).length;
    if(exponent>=0?n<(d<<BigInt(exponent)):(n<<BigInt(-exponent))<d)exponent--;
    const e=Math.max(exponent-precision+1,minShift);
    let a=n,b=d;if(e<0)a<<=BigInt(-e);else b<<=BigInt(e);
    let q=a/b;const r=a%b;if(2n*r>b||2n*r===b&&(q&1n))q++;
    return {n:sign*q,e};
  }
  function counterDyadic(p){
    const v=new DataView(new ArrayBuffer(4));v.setFloat32(0,p,true);
    const bits=v.getUint32(0,true),exp=(bits>>>23)&255,mant=bits&0x7fffff;
    return mant===0&&exp===0?{n:0n,e:0}:{n:BigInt(exp?mant|0x800000:mant),e:exp?exp-150:-149};
  }
  function counterRatio(pair,denominator=1n){
    return pair.e>=0?[pair.n<<BigInt(pair.e),denominator]:[pair.n,denominator<<BigInt(-pair.e)];
  }
  function counterCoefficientBits(count,p){
    const dec=((count-1)>>>0)|0,den=count|0,progress=counterDyadic(p),e=Math.min(0,progress.e);
    const sum=(BigInt(dec)<<BigInt(-e))+(progress.n<<BigInt(progress.e-e));
    const numerator=counterRound(sum,1n<<BigInt(-e),64);
    if(den===0)return numerator.n===0n?0xffc00000:numerator.n<0n?0xff800000:0x7f800000;
    const quotient=counterRound(...counterRatio(numerator,BigInt(den)),64);
    const stored=counterRound(...counterRatio(quotient),24,-149);
    if(stored.n===0n)return 0;
    const sign=stored.n<0n?0x80000000:0;let q=stored.n<0n?-stored.n:stored.n,shift=stored.e;
    if(q===1n<<24n){q>>=1n;shift++}
    if(shift===-149&&q<1n<<23n)return (sign|Number(q))>>>0;
    const exponent=shift+23;if(exponent>127)throw Error('counter coefficient outside finite f32 domain');
    return (sign|((exponent+127)<<23)|Number(q-(1n<<23n)))>>>0;
  }
  function storeCounterCoefficient(s,count,p){stateView(s).setUint32(0x20,counterCoefficientBits(count,p),true)}
  function timeBytes(frame,sameEndpoint=false){frame=frameValue(frame);const lo=Math.trunc(frame),a=new Uint8Array(8),v=stateView(a);v.setInt16(0,lo,true);v.setInt16(2,sameEndpoint?lo:lo+1,true);v.setFloat32(4,frame-lo,true);return a}
  function assignClip(raw,id){if(!Number.isInteger(id)||id<0||id>=32768)throw Error('clip id outside bounded domain');const s=stateCopy(raw);s.set(s.slice(0,8),8);s.set(s.slice(0x20,0x24),0x24);stateView(s).setInt16(0x10,id,true);s[0x2a]=1;s[0x2b]=0;return s}
  function submitTime(raw,time){
    const s=stateCopy(raw);if(time.length!==8)throw Error('TC time must be eight bytes');let reset=!s[0x28];
    if(s[0x2b]){s.set(s.slice(0x30,0x34),0x1c);for(const at of [0x29,0x28,0x2c,0x2a,0x2b])s[at]=0;reset=true}
    const v=stateView(s);if(reset)for(const at of [0x14,0x20,0x30])v.setUint32(at,0,true);
    const n=(stateCount(s)+1)>>>0;v.setUint32(0x14,n,true);s[0x28]=1;s.set(time,0);v.setUint32(0x30,0,true);storeCounterCoefficient(s,n,0);return s;
  }
  function updateProgress(raw,p){
    const s=stateCopy(raw);p=weight(p);if(!Number.isFinite(stateFloat(s,0x30)))throw Error('invalid previous progress');
    const v=stateView(s);
    if(s[0x2b]){s.set(s.slice(0x30,0x34),0x1c);for(const at of [0x29,0x28,0x2c])s[at]=0;for(const at of [0x14,0x20,0x30])v.setUint32(at,0,true)}
    const n=stateCount(s);if(p!==stateFloat(s,0x30)){v.setFloat32(0x30,p,true);s[0x29]=1;if(n)storeCounterCoefficient(s,n,p)}
    if(!n)v.setFloat32(0x20,p,true);return s;
  }
  function finishQueued(raw){const s=stateCopy(raw),n=stateCount(s),p=weight(stateFloat(s,0x30));s.set(s.slice(0x30,0x34),0x1c);for(const at of [0x29,0x28,0x2c])s[at]=0;storeCounterCoefficient(s,n,p);return s}
  function initialState(id,start){
    if(!Number.isInteger(start))throw Error('integer Init start required');frameValue(start);
    let s=submitTime(assignClip(new Uint8Array(0x34),id),timeBytes(start,true));
    s.set(s.slice(0,8),8);s.set(s.slice(0x20,0x24),0x24);s[0x2a]=1;s[0x2b]=1;
    return updateProgress(s,0); // original Init +e4(true) followed by Interp(0)
  }
  class PrimaryController{
    constructor(bones,clip){
      if(bones.length!==48||bones[0].name!=='root')throw Error('verified Act1 rig required');
      this.bones=bones;this.clip=clip;this.root=new RootSlot(clip);this.body=[null,...bones.slice(1).map(b=>new BonePose(this.sampler(clip,b)))];
      this.state=submitTime(assignClip(new Uint8Array(0x34),clip.clipId),timeBytes(0,true));
      this.duration=1;this.elapsed=0;this.shape=.5;this.lastQueueCount=0;
      this.initializationMode='explicit-ready-fixture';this.initializationStart=0;
    }
    initializeOriginal(clip,start=0){
      this.state=initialState(clip.clipId,start);this.clip=clip;this.root=new RootSlot(clip,start);
      this.body=[null,...this.bones.slice(1).map(b=>{const m=new BonePose(new PoseSampler(null,[b.bindQuaternion,[0,0,0]]));m.bindTarget(this.sampler(clip,b),start);return m})];
      this.duration=1;this.elapsed=0;this.shape=.5;this.lastQueueCount=0;this.queuedState=stateCopy(this.state);
      this.initializationMode='original-Init';this.initializationStart=start;return this.poses();
    }
    sampler(clip,bone){const track=clip.tracks.find(t=>t.bone?.toLowerCase()===bone.name.toLowerCase());return new PoseSampler(track,[bone.bindQuaternion,[0,0,0]])}
    timer(duration,shape){duration=f(duration);if(!Number.isFinite(duration)||duration<=0)throw Error('positive duration required');this.duration=duration;this.elapsed=0;this.shape=weight(shape)}
    transitionTo(clip,start,duration,shape=.5){
      if(!Number.isInteger(start))throw Error('integer transition start required');frameValue(start);this.timer(duration,shape);
      this.state=submitTime(assignClip(this.state,clip.clipId),timeBytes(start,true));this.state[0x2b]=1;
      this.root.transitionTo(clip,start);this.body.slice(1).forEach((m,i)=>m.bindTarget(this.sampler(clip,this.bones[i+1]),start));this.clip=clip;
    }
    request(frame,duration=1){this.timer(duration,.5);this.state=submitTime(this.state,timeBytes(frame));this.root.request(frame)}
    tick(delta){
      delta=f(delta);if(!Number.isFinite(delta)||delta<0)throw Error('nonnegative timer delta required');
      this.elapsed=f(Math.min(f(this.elapsed+delta),this.duration));const p=f(this.elapsed*f(1/this.duration));
      this.state=updateProgress(this.state,p);this.root.coefficientOnly(timerWeight(this.elapsed,this.duration,this.shape));
      const c=stateFloat(this.state,0x20),sample=!!this.state[0x28],frame=stateView(this.state).getInt16(0,true)+stateFloat(this.state,4);
      if(sample)this.body.slice(1).forEach(m=>m.ordinaryRequest(frame,c,!!this.state[0x2a]));
      else if(this.state[0x29])this.body.slice(1).forEach(m=>m.coefficientOnly(c));
      this.lastQueueCount=sample?1:0;
      if(sample){this.state[0x2c]=1;this.queuedState=stateCopy(this.state);this.state=finishQueued(this.state)}else this.queuedState=stateCopy(this.state);
      return this.poses();
    }
    poses(){return [copyPose(this.root.current[1]),...this.body.slice(1).map(m=>copyPose(m.current))]}
  }
  function integerKey(keys,kind,frame){
    if(!['xyzw','xyz'].includes(kind)||!Number.isInteger(frame)||frame<0||frame>=32767)throw Error('invalid integer key request');
    if(!keys.length)return kind==='xyzw'?[0,0,0,1]:[0,0,0];
    if(keys[0].frame!==0)throw Error('attachment before-first-key behavior not verified');
    for(let i=0;i<keys.length;i++){
      const k=keys[i],v=finiteVector(k[kind],kind==='xyzw'?4:3);
      if(i&&keys[i-1].frame>=k.frame)throw Error('attachment key times must increase');
      if(frame===k.frame)return v;
      if(frame<k.frame){const a=keys[i-1],av=finiteVector(a[kind],v.length),w=f((frame-a.frame)/(k.frame-a.frame));return kind==='xyzw'?interpolate(av,v,w):av.map((x,j)=>f(f(1-w)*x+w*v[j]))}
    }return finiteVector(keys[keys.length-1][kind],kind==='xyzw'?4:3);
  }
  function sampleAttachment(slot,frame,frames){
    frame=frameValue(frame);if(frame>=32766||!Number.isInteger(frames)||frames<1||frames>=32767)throw Error('attachment time outside verified domain');
    const lo=Math.min(Math.trunc(frame),frames-1),hi=Math.min(Math.trunc(frame)+1,frames-1);
    const pose=k=>[integerKey(slot.rotations,'xyzw',k),integerKey(slot.translations,'xyz',k)];
    return blendSlotPose(pose(lo),pose(hi),f(frame-Math.trunc(frame)));
  }
  class AttachmentPose{
    constructor(slot,frames,frame=0){this.slot=slot;this.frames=frames;this.target=sampleAttachment(slot,frame,frames);this.snapshot=copyPose(this.target);this.current=copyPose(this.target)}
    request(frame){this.snapshot=copyPose(this.current);this.target=alignedPose(sampleAttachment(this.slot,frame,this.frames),this.snapshot)}
    blend(w){this.current=blendSlotPose(this.snapshot,this.target,w);return copyPose(this.current)}
  }
  class AttachmentBank{
    constructor(clip,frame=0){this.records=new Map();this.bind(clip,frame,false)}
    snapshotAll(){for(const record of this.records.values())record.snapshot=copyPose(record.current)}
    sampleAuthored(frame){
      for(const slot of this.clip.attachments||[]){
        let record=this.records.get(slot.slot);
        if(!record){record=new AttachmentPose(slot,this.clip.frames,frame);this.records.set(slot.slot,record)}
        else{record.slot=slot;record.frames=this.clip.frames;record.target=alignedPose(sampleAttachment(slot,frame,this.clip.frames),record.snapshot)}
      }
    }
    bind(clip,frame,primaryTransition){
      if(primaryTransition)this.snapshotAll();this.clip=clip;this.sampleAuthored(frame);
      for(const record of this.records.values()){
        if(!primaryTransition)record.snapshot=copyPose(record.target);record.current=copyPose(record.snapshot);
      }
    }
    request(frame){this.snapshotAll();this.sampleAuthored(frame)}
    blend(w){for(const record of this.records.values())record.blend(w)}
    authored(index){return (this.clip.attachments||[]).find(a=>a.slot===index)}
  }
  function chooseAttachmentSlot(slots,scanSecondary=true){
    if(!slots.length)throw Error('base slot required');let winner=-1,priority=-1;
    if(scanSecondary)for(let i=slots.length-1;i>0;i--){const s=slots[i];if(s.bound&&s.authored&&s.enabled&&s.priority>=priority){winner=i;priority=s.priority}}
    if(winner<0&&slots[0].bound&&slots[0].authored)return 0;return winner;
  }
  function poseMatrix(pose){
    const [q,t]=copyPose(pose),[x,y,z,w]=q,n=q.reduce((s,v)=>s+v*v,0),s=n===0?1:2/n,X=x*s,Y=y*s,Z=z*s;
    return [1-Y*y-Z*z,X*y-Z*w,X*z+Y*w,0,X*y+Z*w,1-X*x-Z*z,Y*z-X*w,0,X*z-Y*w,Y*z+X*w,1-X*x-Y*y,0,...t,1];
  }
  function multiplyMatrices(a,b){const out=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)out[4*i+j]+=a[4*i+k]*b[4*k+j];return out}
  function worldMatrices(bones,poses){
    return bones.reduce((world,b,i)=>{const p=copyPose(poses[i]);if(b.parent>=0)p[1]=p[1].map((x,j)=>x+b.bindTranslation[j]);const local=poseMatrix(p);world.push(b.parent>=0?multiplyMatrices(local,world[b.parent]):local);return world},[]);
  }
  function originalPoseMatrix(pose){
    const [q,t]=copyPose(pose),[x,y,z,w]=q,n=((y*y+z*z)+w*w)+x*x,s=n===0?1:2/n;
    const X=s*x,Y=f(s*y),Z=f(s*z),XW=f(X*w),YW=f(Y*w),ZW=f(Z*w),XX=X*x,XY=Y*x,XZ=Z*x,YY=f(Y*y),YZ=f(Z*y),ZZ=Z*z;
    return [f(1-(YY+ZZ)),f(XY-ZW),f(XZ+YW),0,f(XY+ZW),f(1-(XX+ZZ)),f(YZ-XW),0,f(XZ-YW),f(YZ+XW),f(1-(XX+YY)),0,...t,1];
  }
  function originalMultiplyAffine(a,b){
    if(a.length!==16||b.length!==16||!a.every(Number.isFinite)||!b.every(Number.isFinite))throw Error('finite affine matrices required');
    const out=new Array(16).fill(0);out[15]=1;
    for(let i=0;i<4;i++)for(let j=0;j<3;j++){let v=f(f(f(f(a[4*i])*f(b[j]))+f(f(a[4*i+1])*f(b[4+j])))+f(f(a[4*i+2])*f(b[8+j])));if(i===3)v=f(v+f(b[12+j]));out[4*i+j]=v}
    return out;
  }
  function originalWorldMatrices(bones,poses){
    return bones.reduce((world,b,i)=>{const p=copyPose(poses[i]);if(b.parent>=0)p[1]=p[1].map((x,j)=>f(x+f(b.bindTranslation[j])));const local=originalPoseMatrix(p);world.push(b.parent>=0?originalMultiplyAffine(local,world[b.parent]):local);return world},[]);
  }
  class CharacterController extends PrimaryController{
    constructor(bones,clip){
      super(bones,clip);this.owners=new Uint8Array(48);this.prepared=new Uint8Array(48);
      this.layers=Array.from({length:6},()=>({active:false,bound:false,priority:0,state:new Uint8Array(0x34),mask:[],items:null}));
      this.layers[0]={active:true,bound:true,priority:0,enabled:true,state:this.state,mask:[],clip,items:new AttachmentBank(clip)};
      this.queuedStates=this.layers.map(l=>stateCopy(l.state));this.lastQueueSlots=[];
    }
    initializeOriginal(clip,start=0){
      super.initializeOriginal(clip,start);this.owners=new Uint8Array(48);this.prepared=new Uint8Array(48);
      this.layers=Array.from({length:6},()=>({active:false,bound:false,priority:0,state:new Uint8Array(0x34),mask:[],items:null}));
      this.layers[0]={active:true,bound:true,priority:-1,enabled:true,state:this.state,mask:[],clip,items:new AttachmentBank(clip,start)};
      this.queuedStates=this.layers.map(l=>stateCopy(l.state));this.lastQueueSlots=[];return this.poses();
    }
    stateFor(slot){return slot===0?this.state:this.layers[slot].state}
    rebindBone(index,slot,clip,frame,preserve=true){
      const m=this.body[index],state=this.stateFor(slot);
      if(this.owners[index]===slot){
        // +e4 SAME-state prefix temporarily swaps time/previous-time and
        // samples the OLD track/cache with previous coefficient +24. This
        // matters when canceling a prepared stop, not just ordinary replay.
        const oldFrame=f(stateView(state).getInt16(8,true)+stateFloat(state,12));
        m.target=m.sampler.sample(oldFrame);m.coefficientOnly(stateFloat(state,0x24));state[0x2b]=1;
      }else if(preserve)state[0x2b]=1;
      m.bindTarget(this.sampler(clip,this.bones[index]),frame,preserve);this.prepared[index]=0;
    }
    transitionTo(clip,start,duration,shape=.5){
      if(!Number.isInteger(start))throw Error('integer transition start required');frameValue(start);this.timer(duration,shape);
      this.state=submitTime(assignClip(this.state,clip.clipId),timeBytes(start,true));
      for(let i=1;i<48;i++)if(this.owners[i]===0)this.rebindBone(i,0,clip,start);
      this.root.transitionTo(clip,start);this.layers[0].items.bind(clip,start,true);this.clip=clip;this.layers[0].clip=clip;
    }
    request(frame,duration=1){super.request(frame,duration);this.layers[0].items.request(frame)}
    playSecondary(slot,clip,mask,{priority=10,enabled=true,duration=1,start=0}={}){
      if(!Number.isInteger(slot)||slot<1||slot>5||!Number.isInteger(priority)||priority<-2147483648||priority>2147483647||!Number.isInteger(duration)||duration<1||!Number.isInteger(start))throw Error('secondary arguments outside verified domain');
      frameValue(start);if(new Set(mask).size!==mask.length||mask.some(i=>!Number.isInteger(i)||i<1||i>=48))throw Error('nonroot unique mask required');
      const previous=this.layers[slot],state=submitTime(assignClip(previous.state,clip.clipId),timeBytes(start,true));
      const items=previous.items||new AttachmentBank(clip,start);if(previous.items)items.bind(clip,start,false);
      const layer={state,clip,mask:mask.slice(),priority,enabled:!!enabled,active:true,bound:true,initial:true,stopping:false,duration:f(duration),elapsed:0,shape:.5,items};
      this.layers[slot]=layer;
      for(const i of mask)if(priority>=this.layers[this.owners[i]].priority){this.rebindBone(i,slot,clip,start);this.owners[i]=slot}
      for(let i=1;i<48;i++)if(this.owners[i]===slot&&!mask.includes(i)){this.rebindBone(i,0,this.clip,this.frameOf(this.state));this.owners[i]=0}
    }
    frameOf(state){return f(stateView(state).getInt16(0,true)+stateFloat(state,4))}
    updateSecondaryMode1(){
      for(let slot=1;slot<6;slot++){
        const l=this.layers[slot];if(!l.active||l.stopping)continue;
        if(l.initial&&l.elapsed===l.duration)l.initial=false;
        if(!l.initial){const time=this.state.slice(0,8);l.state=submitTime(submitTime(l.state,time),time);l.duration=1;l.elapsed=0;l.shape=.5;l.items.request(this.frameOf(this.state))}
      }
    }
    stopSecondary(slot,duration=1){
      if(!Number.isInteger(slot)||slot<1||slot>5||!Number.isInteger(duration)||duration<1)throw Error('positive integer stop duration required');
      const l=this.layers[slot];if(l.active&&!l.stopping){l.duration=f(duration);l.elapsed=0;l.stopping=true}
    }
    fallback(source,bone){let winner=0;for(let i=1;i<6;i++){const l=this.layers[i];if(i!==source&&l.active&&l.priority>this.layers[winner].priority&&l.mask.includes(bone))winner=i}return winner}
    tick(delta){
      delta=f(delta);if(!Number.isFinite(delta)||delta<0)throw Error('nonnegative timer delta required');
      this.elapsed=f(Math.min(f(this.elapsed+delta),this.duration));this.state=updateProgress(this.state,f(this.elapsed*f(1/this.duration)));
      const itemWeight=timerWeight(this.elapsed,this.duration,this.shape);this.root.coefficientOnly(itemWeight);
      // Base +d0 blends EVERY bound slot's items before stopping slots clear.
      for(const l of this.layers)if(l.bound&&l.items)l.items.blend(itemWeight);
      for(let slot=1;slot<6;slot++){
        const l=this.layers[slot];if(!l.active)continue;
        if(l.stopping){
          const winners=new Map();
          for(let i=1;i<48;i++)if(this.owners[i]===slot){
            const m=this.body[i],dest=this.fallback(slot,i);winners.set(i,dest);
            if(!this.prepared[i]){m.target=m.sampler.sample(this.frameOf(l.state));m.coefficientOnly(stateFloat(l.state,0x20))}
            m.snapshot=copyPose(m.current);m.target=this.sampler(this.layers[dest].clip,this.bones[i]).sample(this.frameOf(this.stateFor(dest)));
            // +e8 restores source binding with a fresh cache after sampling destination.
            m.sampler=this.sampler(l.clip,this.bones[i]);this.prepared[i]=1;
          }
          l.duration=f(l.duration-l.elapsed);l.elapsed=0;
          l.elapsed=f(Math.min(delta,l.duration));
          if(l.elapsed===l.duration){
            for(const [i,dest] of winners){this.owners[i]=dest;this.prepared[i]=0;this.body[i].bindTarget(this.sampler(this.layers[dest].clip,this.bones[i]),this.frameOf(this.stateFor(dest)),false)}
            l.stopping=false;l.active=false;l.bound=false;
          }
        }else l.elapsed=f(Math.min(f(l.elapsed+delta),l.duration));
        l.state=updateProgress(l.state,l.duration===0?0:f(l.elapsed*f(1/l.duration)));
      }
      const queue=new Set();
      for(let i=1;i<48;i++){
        const slot=this.owners[i],state=this.stateFor(slot),m=this.body[i];
        // Original 5319cb..cf ORs the bone prepared byte with BOTH state
        // request flags. Prepared stops still evaluate if progress is equal.
        if(!state[0x28]&&!state[0x29]&&!this.prepared[i])continue;
        if(this.prepared[i])m.coefficientOnly(stateFloat(state,0x30));
        else if(state[0x28]){m.ordinaryRequest(this.frameOf(state),stateFloat(state,0x20),!!state[0x2a]);queue.add(slot)}
        else m.coefficientOnly(stateFloat(state,0x20));
      }
      for(const slot of queue)this.stateFor(slot)[0x2c]=1;
      this.queuedStates=this.layers.map((_,i)=>stateCopy(this.stateFor(i)));this.lastQueueSlots=Array.from(queue);this.lastQueueCount=queue.size;
      for(const slot of queue){if(slot===0)this.state=finishQueued(this.state);else this.layers[slot].state=finishQueued(this.layers[slot].state)}
      this.layers[0].state=this.state;return this.poses();
    }
    attachment(index=1,scanSecondary=true){
      const slots=this.layers.map(l=>({bound:l.bound,authored:!!l.items?.authored(index),enabled:l.enabled,priority:l.priority})),winner=chooseAttachmentSlot(slots,scanSecondary);
      if(winner<0)return null;
      const l=this.layers[winner],slot=l.items.authored(index),record=l.items.records.get(index),world=worldMatrices(this.bones,this.poses());
      if(!Number.isInteger(slot.boneIndex)||slot.boneIndex<0||slot.boneIndex>=48||this.bones[slot.boneIndex].name.toLowerCase()!==slot.bone.toLowerCase())throw Error('BAN attachment bone mapping mismatch');
      return {winner,slot:index,bone:slot.bone,boneIndex:slot.boneIndex,pose:copyPose(record.current),world:multiplyMatrices(poseMatrix(record.current),world[slot.boneIndex])};
    }
  }
  return Object.freeze({f,copyPose,nearestEven,lookup,interpolate,lerpXYZ,alignedPose,blendPose,bodyCoefficientBranch,blendBodyRecord,blendSlotPose,timerWeight,
    Sampler,PoseSampler,BonePose,RootSlot,assignClip,submitTime,updateProgress,finishQueued,stateFloat,timeBytes,PrimaryController,
    integerKey,sampleAttachment,AttachmentPose,AttachmentBank,chooseAttachmentSlot,poseMatrix,multiplyMatrices,worldMatrices,CharacterController,
    initialState,originalPoseMatrix,originalMultiplyAffine,originalWorldMatrices});
});
