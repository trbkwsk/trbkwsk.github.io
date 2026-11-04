/* Bounded signed/paired consumers and secondary provider, validated separately.
 * Normal x87 64-bit-significand dyadic arithmetic; explicit f32 stores.
 * Not primary cycle/event scheduling, original caller cadence, IK or live game.
 */
(function(root,factory){
  const A=typeof module==='object'&&module.exports?require('./gettingup-animation.js'):root.GettingUpAnimation;
  const api=factory(A);if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GettingUpClocks=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A){'use strict';
  if(!A)throw Error('GettingUpAnimation must load first');
  const f=Math.fround,view=a=>new DataView(a.buffer,a.byteOffset,a.byteLength);
  const short=n=>((n+32768)%65536+65536)%65536-32768;
  function tc(v){
    if(!v||v.length!==3||v.slice(0,2).some(x=>!Number.isInteger(x)||x<-32768||x>=32768))throw Error('signed short TC endpoints required');
    const frac=f(v[2]);if(!Number.isFinite(frac)||frac<-1||frac>1)throw Error('TC fraction outside [-1,1]');
    return [v[0],v[1],frac];
  }
  function packTC(v){v=tc(v);const a=new Uint8Array(8),d=view(a);d.setInt16(0,v[0],true);d.setInt16(2,v[1],true);d.setFloat32(4,v[2],true);return a}
  function readTC(a,offset=0){const d=view(a);return tc([d.getInt16(offset,true),d.getInt16(offset+2,true),d.getFloat32(offset+4,true)])}
  function scalarTC(v){v=tc(v);return f(v[0]+v[2])}
  function scalarFrame(v){v=f(v);if(!Number.isFinite(v)||v<=-32768||v>=32768)throw Error('signed scalar outside bounded domain');return v}
  function frameTC(v){v=scalarFrame(v);const lo=Math.trunc(v);return tc([lo,short(lo+1),f(v-lo)])}
  function normalizeTC(v,frames){
    v=tc(v);if(!Number.isInteger(frames)||frames<1||frames>=32768)throw Error('frame count outside bounded domain');
    let [lo,hi,frac]=v;if(lo>=frames)lo=frames-1;if(hi>=frames)hi=frames-1;
    if(hi===-1)hi=lo===0||lo===1?0:short(lo+1);return [lo,hi,frac];
  }
  // All provider operands are dyadic. Round after every x87 add/mul to 64
  // significand bits, and round f32 stores directly instead of via double.
  const bitLength=n=>n.toString(2).length;
  function roundedShift(n,shift){
    if(shift<=0)return n<<BigInt(-shift);
    const s=BigInt(shift),q=n>>s,r=n-(q<<s),half=1n<<(s-1n);
    return q+(r>half||r===half&&(q&1n)?1n:0n);
  }
  function extended(n,e){
    if(n===0n)return {n:0n,e:0};const sign=n<0n?-1n:1n;n*=sign;
    const bits=bitLength(n),exponent=e+bits-1;
    if(exponent<=-1000||exponent>=1000)throw Error('outside bounded normal x87 domain');
    const shift=bits-64;return {n:sign*roundedShift(n,Math.max(0,shift)),e:e+Math.max(0,shift)};
  }
  function dyadic(v){
    v=f(v);if(!Number.isFinite(v))throw Error('finite f32 operand required');
    const a=new Float32Array([v]),bits=new Uint32Array(a.buffer)[0],sign=bits>>>31?-1n:1n,exp=(bits>>>23)&255,mant=bits&0x7fffff;
    return extended(sign*BigInt(exp?mant|0x800000:mant),exp?exp-150:-149);
  }
  const neg=a=>({n:-a.n,e:a.e});
  function add(a,b){const e=Math.min(a.e,b.e);return extended((a.n<<BigInt(a.e-e))+(b.n<<BigInt(b.e-e)),e)}
  const mul=(a,b)=>extended(a.n*b.n,a.e+b.e);
  function trunc(a){return Number(a.e>=0?a.n<<BigInt(a.e):a.n/ (1n<<BigInt(-a.e)))}
  function storeF32(a){
    if(a.n===0n)return 0;const sign=a.n<0n?-1:1,n=a.n<0n?-a.n:a.n,bits=bitLength(n),exp=a.e+bits-1;
    if(exp>127)throw Error('f32 overflow outside provider domain');
    const shift=exp<-126?-149-a.e:bits-24,q=roundedShift(n,shift),e=a.e+shift;
    return f(sign*Number(q)*2**e);
  }
  function secondaryTime(mode,base,current,frames,speed=1,loop=true){
    base=tc(base);current=tc(current);speed=f(speed);
    if(![0,1,2].includes(mode)||!Number.isInteger(frames)||frames<2||frames>=32768||!Number.isFinite(speed)||Math.abs(speed)>1024)throw Error('outside verified provider domain');
    if(mode===1)return {time:base,stopDuration:null,wrapped:false};
    if(mode===2)return {time:[short(frames-1-base[0]),short(frames-1-base[1]),base[2]],stopDuration:null,wrapped:false};
    const k=dyadic(f(1/60)),hz=dyadic(60);
    let seconds=add(mul(add(dyadic(current[0]),dyadic(current[2])),k),mul(dyadic(speed),k));
    let integer=trunc(mul(seconds,hz)),lo=short(integer);
    if(integer!==lo)throw Error('mode-0 ftol overflow outside domain');
    let frac=storeF32(mul(add(seconds,neg(mul(dyadic(lo),k))),hz));
    if(lo<frames-1)return {time:tc([lo,short(lo+1),frac]),stopDuration:null,wrapped:false};
    if(!loop)return {time:current,stopDuration:10,wrapped:false};
    seconds=add(mul(add(dyadic(lo),dyadic(frac)),k),neg(mul(dyadic(frames-1),k)));
    integer=trunc(mul(seconds,hz));lo=short(integer);if(integer!==lo)throw Error('wrapped ftol overflow outside domain');
    frac=storeF32(add(seconds,neg(mul(dyadic(lo),k))));
    return {time:tc([lo,short(lo+1),frac]),stopDuration:null,wrapped:true};
  }
  let signedTables;
  function extrapolate(a,b,t){
    a=A.copyPose([a,[0,0,0]])[0];b=A.copyPose([b,[0,0,0]])[0];t=tc([0,0,t])[2];
    for(const q of [a,b]){const n=q.reduce((s,x)=>s+x*x,0);if(n<.99||n>1.01)throw Error('raw quaternion norm outside verified domain')}
    if(a.every((x,i)=>Object.is(x,b[i])))return a.slice();
    const p=a.map((x,i)=>f(x*b[i]));let dot=f(f(p[0]+p[1])+f(p[2]+p[3]));
    if(dot<0){b=b.map(x=>-x);dot=f(-dot)}let wa,wb;
    if(f(1-dot)<=f(1e-6)){wa=f(1-t);wb=t}
    else{
      if(!signedTables){
        const acos=new Float32Array(2048),sine=new Float32Array(256),pi=f(Math.PI);
        for(let i=0;i<2047;i++)acos[i]=f(Math.acos(f(i/2046)));
        for(let i=0;i<255;i++)sine[i]=f(Math.sin(f(i*pi/254)));signedTables={acos,sine};
      }
      const {acos,sine}=signedTables,theta=A.lookup(acos,dot,2046),r=f(1/A.lookup(sine,theta,80.8507080078125));
      wa=f(A.lookup(sine,f(f(1-t)*theta),80.8507080078125)*r);wb=f(f(t*theta)*r);
    }
    let out=a.map((x,i)=>f(f(x*wa)+f(b[i]*wb))),sq=out.map(x=>f(x*x)),n=f(f(f(sq[0]+sq[1])+sq[2])+sq[3]);
    if(n!==0){const r=f(1/Math.sqrt(n));out=out.map(x=>f(x*r))}return out;
  }
  class SignedSampler extends A.Sampler{
    sample(frame){
      if(this.keys.length<2)return this.sampleSmall();
      frame=scalarFrame(frame);const n=this.keys.length;
      if(!this.initialized){this.lower=0;this.upper=1;this.previousFrame=this.keys[0].frame;this.current=this.value(0);this.initialized=true}
      const eps=f(1e-4);
      if(Math.abs(frame-this.previousFrame)<eps){this.lastBranch='previous_integer_frame';return this.current.slice()}
      if(Math.abs(frame-this.keys[this.upper].frame)<eps){this.previousFrame=this.keys[this.upper].frame;this.current=this.value(this.upper);this.lastBranch='cached_upper_key';return this.current.slice()}
      if(Math.abs(frame-this.keys[this.lower].frame)<eps){this.previousFrame=this.keys[this.lower].frame;this.current=this.value(this.lower);this.lastBranch='cached_lower_key';return this.current.slice()}
      if(frame<=this.keys[this.lower].frame||frame>=this.keys[this.upper].frame){
        if(frame<=this.previousFrame){
          let found=null;if(Math.trunc(frame)===0)found=0;else for(let i=this.lower-1;i>=0;i--)if(this.keys[i].frame<=frame){found=i;break}
          if(found===null){this.previousFrame=Math.trunc(frame)&0xffff;this.current=this.value(0);this.initialized=false;this.lastBranch='before_first';return this.current.slice()}
          this.lower=found;this.upper=found+1;
        }else{
          let found=null;for(let i=this.lower+2;i<n;i++)if(frame<=this.keys[i].frame){found=i;break}
          if(found===null){this.previousFrame=Math.trunc(frame)&0xffff;this.current=this.value(n-1);this.initialized=false;this.lastBranch='after_last';return this.current.slice()}
          this.lower=found-1;this.upper=found;
        }this.lastBranch='new_interval';
      }else this.lastBranch='cached_interval';
      this.previousFrame=Math.trunc(frame)&0xffff;
      const a=this.keys[this.lower],b=this.keys[this.upper],w=f(f(frame-a.frame)*f(1/(b.frame-a.frame))),va=this.value(this.lower),vb=this.value(this.upper);
      this.current=this.kind==='xyzw'?extrapolate(va,vb,w):A.lerpXYZ(va,vb,w);return this.current.slice();
    }
  }
  class SignedPoseSampler extends A.PoseSampler{
    constructor(track,fallback){super(track,fallback);this.samplers=track?[new SignedSampler(track.rotations,'xyzw'),new SignedSampler(track.translations,'xyz')]:null}
  }
  function signedSlotBlend(a,b,w){
    a=A.copyPose(a);b=A.copyPose(b);w=tc([0,0,w])[2];if(w===0)return a;if(w===1)return A.alignedPose(b,a);
    const left=1-w,t=[f(left*a[1][0]+w*b[1][0]),f(f(left*a[1][1])+w*b[1][1]),f(f(left*a[1][2])+f(w*b[1][2]))];
    return [extrapolate(a[0],b[0],w),t];
  }
  function unsignedIntegerKey(keys,kind,frame){
    if(!['xyzw','xyz'].includes(kind))throw Error('unknown sample kind');
    if(!Number.isInteger(frame)||frame<-32768||frame>65535)throw Error('16-bit integer key frame required');
    frame&=0xffff;if(keys.length&&(keys[0].frame!==0||keys[keys.length-1].frame>=32768))throw Error('bounded key times required');
    keys.forEach((k,i)=>{if(!Number.isInteger(k.frame)||k.frame<0||i&&keys[i-1].frame>=k.frame||!k[kind]||k[kind].length!==(kind==='xyzw'?4:3)||!k[kind].every(Number.isFinite))throw Error('finite strictly increasing integer keys required')});
    if(keys.length&&frame>=32767)return keys[keys.length-1][kind].map(f);
    return A.integerKey(keys,kind,frame>=32767?0:frame);
  }
  function sampleAttachmentTC(slot,time,frames){
    const [lo,hi,frac]=normalizeTC(time,frames),pose=k=>[unsignedIntegerKey(slot.rotations,'xyzw',k),unsignedIntegerKey(slot.translations,'xyz',k)];
    return signedSlotBlend(pose(lo),pose(hi),frac);
  }
  class RootTC extends A.RootSlot{
    constructor(clip,time=[0,0,0]){
      super(clip);this.samplers=clip.tracks.slice(0,2).map(t=>new SignedPoseSampler(t,[[0,0,0,1],[0,0,0]]));
      this.height=new SignedSampler(clip.curve.map(([frame,v])=>({frame,xyz:[v,0,0]})),'xyz');
      this.target=this.sampleTC(time);this.snapshot=this.target.map(A.copyPose);this.current=this.target.map(A.copyPose);
    }
    sample(frame){return this.sampleTC(frameTC(frame))}
    sampleTC(time){
      const frame=scalarTC(normalizeTC(time,this.clip.frames)),[origin,root]=this.samplers.map(s=>s.sample(frame));
      if(this.clip.mode===0){origin[1][1]=f(origin[1][1]+this.height.sample(frame)[0]);root[1][1]=f(root[1][1]-this.height.sample(frame)[0])}
      else if(this.clip.mode===1)root[1][1]=f(root[1][1]-this.first);
      else if(this.clip.mode===2){origin[1][1]=f(origin[1][1]+this.rootHeight+this.first);root[1]=[0,-this.first,0]}
      return [origin,root];
    }
    requestTC(time){this.snapshot=this.current.map(A.copyPose);this.target=this.sampleTC(time).map((p,i)=>A.alignedPose(p,this.snapshot[i]))}
    request(frame){this.requestTC(frameTC(frame))}
    transitionTo(clip,frame){
      const oldMode=this.clip.mode,old=this.current.map(A.copyPose),next=new RootTC(clip,[frame,frame,0]);
      this.clip=next.clip;this.samplers=next.samplers;this.height=next.height;this.rootHeight=next.rootHeight;this.first=next.first;
      this.target=next.target.map((p,i)=>A.alignedPose(p,old[i]));let ot;
      if([1,10].includes(oldMode)&&[1,10].includes(clip.mode))ot=clip.originZero?[0,0,0]:this.target[0][1].slice();
      else{const a=this.target[1][1],b=old[1][1],c=this.target[0][1];ot=[f(a[0]-b[0]+c[0]),f(a[1]-b[1]+c[1]),f(f(a[2]-b[2])+c[2])]}
      this.snapshot=[[this.target[0][0].slice(),ot],old[1]];this.current=this.snapshot.map(A.copyPose);
    }
  }
  class AttachmentTCBank extends A.AttachmentBank{
    sampleAuthored(frame){this.sampleTC(frameTC(frame))}
    sampleTC(time){
      for(const slot of this.clip.attachments||[]){
        let r=this.records.get(slot.slot);const target=sampleAttachmentTC(slot,time,this.clip.frames);
        if(!r){r=new A.AttachmentPose(slot,this.clip.frames);r.target=target;r.snapshot=A.copyPose(target);r.current=A.copyPose(target);this.records.set(slot.slot,r)}
        else{r.slot=slot;r.frames=this.clip.frames;r.target=A.alignedPose(target,r.snapshot)}
      }
    }
    requestTC(time){this.snapshotAll();this.sampleTC(time)}
    request(frame){this.requestTC(frameTC(frame))}
  }
  class ClockCharacterController extends A.CharacterController{
    constructor(bones,clip){super(bones,clip);this.layers[0].items=new AttachmentTCBank(clip);this.root=new RootTC(clip);this.roots=[this.root];this.clockModes=new Uint8Array(6);this.lastClockActions=[]}
    sampler(clip,bone){const track=clip.tracks.find(t=>t.bone?.toLowerCase()===bone.name.toLowerCase());return new SignedPoseSampler(track,[bone.bindQuaternion,[0,0,0]])}
    initializeOriginal(clip,start=0){
      super.initializeOriginal(clip,start);this.layers[0].items=new AttachmentTCBank(clip,start);this.root=new RootTC(clip,[start,start,0]);this.roots=[this.root];this.clockModes=new Uint8Array(6);this.lastClockActions=[];return this.poses();
    }
    playSecondary(slot,clip,mask,options={}){
      const mode=options.clockMode??this.clockModes[slot],speed=f(options.speed??1),loop=options.loop??true;
      secondaryTime(mode,[0,0,0],[0,0,0],clip.frames,speed,loop); // validate before mutation
      super.playSecondary(slot,clip,mask,options);this.clockModes[slot]=mode;
      const l=this.layers[slot];if(!(l.items instanceof AttachmentTCBank))l.items=new AttachmentTCBank(clip,options.start??0);
      l.speed=speed;l.loop=!!loop;this.roots[slot]=new RootTC(clip,[options.start??0,options.start??0,0]);
    }
    requestTC(time,duration=1){
      time=tc(time);this.timer(duration,.5);this.state=A.submitTime(this.state,packTC(time));this.root.requestTC(time);this.layers[0].items.requestTC(time);
    }
    request(frame,duration=1){this.requestTC(frameTC(frame),duration)}
    requestSecondaryTC(slot,time,duration=1){
      if(!Number.isInteger(slot)||slot<1||slot>5)throw Error('secondary slot required');
      time=tc(time);duration=f(duration);if(!Number.isFinite(duration)||duration<=0)throw Error('positive duration required');
      const l=this.layers[slot];if(!l.active)return;
      const bytes=packTC(time);l.state=A.submitTime(A.submitTime(l.state,bytes),bytes);l.duration=duration;l.elapsed=0;l.shape=.5;
      // +104 is disabled. Explicit SecTweenTo does not sample root/items.
    }
    updateSecondaryClocks(){
      const actions=[];
      for(let slot=1;slot<6;slot++){
        const l=this.layers[slot];if(!l.active||l.stopping){actions.push({slot,action:'skipped'});continue}
        if(l.initial&&l.elapsed===l.duration)l.initial=false;
        if(l.initial){actions.push({slot,action:'skipped'});continue}
        const r=secondaryTime(this.clockModes[slot],readTC(this.state),readTC(l.state),l.clip.frames,l.speed,l.loop);
        if(r.stopDuration!==null){this.stopSecondary(slot,r.stopDuration);actions.push({slot,action:'auto_stop'});continue}
        this.requestSecondaryTC(slot,r.time);this.roots[slot].requestTC(r.time);l.items.requestTC(r.time);
        actions.push({slot,action:r.wrapped?'wrapped':'submitted',time:r.time});
      }
      this.lastClockActions=actions;return actions;
    }
    tick(delta){
      delta=f(delta);if(!Number.isFinite(delta)||delta<0)throw Error('nonnegative timer delta required');
      const elapsed=f(Math.min(f(this.elapsed+delta),this.duration)),weight=A.timerWeight(elapsed,this.duration,this.shape);
      // Secondary root buffers are independent of body ownership/base root
      // and receive the same base +d0 weight before any stop clears binding.
      for(let s=1;s<6;s++)if(this.layers[s].bound&&this.roots[s])this.roots[s].coefficientOnly(weight);
      return super.tick(delta);
    }
    attachment(index=1,scanSecondary=true){
      const slots=this.layers.map(l=>({bound:l.bound,authored:!!l.items?.authored(index),enabled:l.enabled,priority:l.priority})),winner=A.chooseAttachmentSlot(slots,scanSecondary);
      if(winner<0)return null;const l=this.layers[winner],slot=l.items.authored(index),record=l.items.records.get(index),world=A.originalWorldMatrices(this.bones,this.poses());
      if(!Number.isInteger(slot.boneIndex)||slot.boneIndex<0||slot.boneIndex>=48||this.bones[slot.boneIndex].name.toLowerCase()!==slot.bone.toLowerCase())throw Error('BAN attachment bone mapping mismatch');
      return {winner,slot:index,bone:slot.bone,boneIndex:slot.boneIndex,pose:A.copyPose(record.current),world:A.originalMultiplyAffine(A.originalPoseMatrix(record.current),world[slot.boneIndex])};
    }
  }
  return Object.freeze({tc,short,packTC,readTC,scalarTC,frameTC,normalizeTC,secondaryTime,SignedSampler,SignedPoseSampler,
    signedSlotBlend,unsignedIntegerKey,sampleAttachmentTC,RootTC,AttachmentTCBank,ClockCharacterController,extrapolate});
});
