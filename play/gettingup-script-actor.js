/* Original compiled type-0 base actor, dispatch and cyclic root consumer.
 * Original gameplay callbacks are observable events, not an interpreter.
 * Descriptor zero is never coerced. No native coordinator/live-clock claim.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const A=node?require('./gettingup-animation.js'):root.GettingUpAnimation;
  const C=node?require('./gettingup-clocks.js'):root.GettingUpClocks;
  const P=node?require('./gettingup-actor.js'):root.GettingUpActor;
  const S=node?require('./gettingup-script.js'):root.GettingUpScript;
  const api=factory(A,C,P,S);if(node)module.exports=api;else root.GettingUpScriptActor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A,C,P,S){'use strict';
  if(!A||!C||!P||!S)throw Error('animation, clock, actor and compiled-script libraries required');
  function activationProfile(period){
    // Original 1033157a..95 converts the decoded period and ADDS one before
    // PriTransition. Hold +84 is not the duration at the character timer.
    // Packed high-word shape parameters remain outside this bounded API.
    if(!Number.isInteger(period)||period<0||period>32)throw Error('bounded original activation period required');
    return {duration:period+1,shape:.5,phase:Number(period>0),period,counter:period?0:1};
  }
  class ScriptActor{
    constructor(descriptors,codes,raw){
      this.chain=new S.CompiledChain(descriptors);
      if(!Array.isArray(codes)||codes.length>1024||codes.some(v=>!Number.isInteger(v)||v<0||v>=65536)||descriptors.some(d=>d.token>=codes.length))throw Error('matching original unsigned event table required');
      this.codes=codes.slice();this.speed=1;this.tick_preparations=this.cycles=this.since_end=this.delay=this.script_tick=0;
      this.event_counter=-1024;this.ended=false;this.cycle_enabled=true;this.pending_tokens=[];this.pending_ticks=[];this.raw=new Uint8Array(raw);
      this.events=[];
    }
    dispatch(){
      const r=S.dispatchQueue(this.pending_tokens,this.pending_ticks,this.event_counter,this.chain.wrap_flag,this.codes);
      if(r.script_tick!==null)this.script_tick=r.script_tick;this.event_counter=r.last;
      for(const [code,tick] of r.calls)this.events.push([-4,tick],[code,tick]);
      this.pending_tokens=[];this.pending_ticks=[];
    }
    advance(delta){return P.Actor.prototype.advance.call(this,delta)}
    bindFirst(){return P.Actor.prototype.bindFirst.call(this)}
    step(delta,controls={}){this.events=[];return P.Actor.prototype.step.call(this,delta,controls)}
    activate(index,frame,period=1){
      const profile=activationProfile(period);
      this.chain.bind(index);const d=this.chain.descriptors[index];
      if(!Number.isInteger(frame)||frame<Math.min(d.start,d.end)||frame>Math.max(d.start,d.end))throw Error('original in-range seek required');
      new DataView(this.chain.cursor.raw.buffer).setFloat32(0x14,frame,true);
      this.cycles=Number(frame>0);this.event_counter=-1024;this.script_tick=period?-period:frame;
      this.phase=profile.phase;this.period=profile.period;this.counter=profile.counter;
      // 10331465 clears cycles; 10331472..76 writes one only if start > 0.
    }
    update(delta,controls={}){
      delta=Math.fround(delta);
      if(!Number.isFinite(delta)||delta<0||delta>128||Object.keys(controls).some(k=>!['skip_once','delay','cycle_enabled','speed'].includes(k)))throw Error('bounded script actor input required');
      if(controls.delay!==undefined&&(!Number.isInteger(controls.delay)||controls.delay<0||controls.delay>32))throw Error('bounded nonnegative delay required');
      if(controls.speed!==undefined&&(!Number.isFinite(Math.fround(controls.speed))||Math.fround(controls.speed)<0||Math.fround(controls.speed)>4))throw Error('bounded nonnegative speed required');
      // Original 10331d50 consumes skip-once and delay before reaching the
      // 10331980 phase counter. Neither may silently advance the hold.
      if(controls.skip_once||(controls.delay??this.delay)>0)return this.step(delta,controls);
      if(this.phase){
        this.counter++;
        if(this.counter<=this.period+.125){
          const out=this.step(delta,{...controls,delay:1});this.script_tick=this.counter-this.period;
          this.events.push([-4,this.script_tick]);out.script_tick=this.script_tick>>>0;return out;
        }
        this.phase=0;
      }
      return this.step(delta,controls);
    }
  }
  class ScriptActorCharacterController extends C.ClockCharacterController{
    constructor(bones,clip,descriptors,codes){
      super(bones,clip);this.scriptDescriptors=descriptors.map(d=>({...d}));this.scriptCodes=codes.slice();
      this.root=new P.RootCycleTC(clip);this.roots[0]=this.root;this.actor=new ScriptActor(descriptors,codes,this.state);this.lastActorOutcome=null;
    }
    initializeOriginal(clip,start=0){
      super.initializeOriginal(clip,start);this.root=new P.RootCycleTC(clip,[start,start,0]);this.roots[0]=this.root;
      this.actor=new ScriptActor(this.scriptDescriptors,this.scriptCodes,this.state);this.lastActorOutcome=null;return this.poses();
    }
    activateOriginal(clip,index,frame,period=1){
      const profile=activationProfile(period);this.transitionTo(clip,frame,profile.duration,profile.shape);
      this.actor.raw=this.state;this.actor.activate(index,frame,period);
    }
    actorStep(delta,controls={}){
      this.actor.raw=this.state;const out=this.actor.update(delta,controls);
      if(out.submission){
        const [time,cycle]=out.submission;this.timer(1,.5);this.state=A.submitTime(this.state,C.packTC(time));
        this.root.requestCycleTC(time,cycle);this.layers[0].items.requestTC(time);
        if(this.state.some((v,i)=>v!==this.actor.raw[i]))throw Error('independent script actor/controller states differ');
      }
      if(out.secondary_update)this.updateSecondaryClocks();this.lastActorOutcome=out;return out;
    }
  }
  return Object.freeze({activationProfile,ScriptActor,ScriptActorCharacterController});
});
