/* Compatibility episode wrapper around the generic compiled-script actor.
 * Real cycle handling lives in gettingup-script-actor.js, not this UI mode.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const C=node?require('./gettingup-clocks.js'):root.GettingUpClocks;
  const S=node?require('./gettingup-script-actor.js'):root.GettingUpScriptActor;
  const api=factory(C,S);if(node)module.exports=api;else root.GettingUpGear=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C,S){'use strict';
  if(!C||!S)throw Error('Clock and compiled-script actor modules required');
  class GearContinuationController extends S.ScriptActorCharacterController{
    constructor(bones,source,target,descriptors,codes,limit=24,initialInterp=2){
      if(source.clipId!==1||target.clipId!==0)throw Error('declared native fixture clip IDs 1 -> 0 required');
      if(!Array.isArray(codes)||codes.some(n=>!Number.isInteger(n)||n<0||n>=65536))throw Error('original unsigned event table required');
      if(descriptors.length<3||descriptors[2].start!==2||descriptors[2].end!==20||descriptors[2].direction!==1)throw Error('verified original Run return range required');
      if(![24,160].includes(limit))throw Error('native-validated episode length 24 or 160 required');
      if(![0,.125,.25,.5,1,2].includes(initialInterp)||initialInterp!==2&&limit!==24)throw Error('native-validated in-flight prefix requires 24 steps');
      super(bones,source,descriptors,codes);this.initializeOriginal(source,0);this.tick(1);
      this.activateOriginal(target,2,4,1);this.tick(initialInterp);this.initialInterp=initialInterp;this.limit=limit;this.stepCount=0;
      this.chain=this.actor.chain;this.lastSubmission=null;
    }
    continueStep(){
      if(this.stepCount>=(this.limit??24))throw Error('outside native-validated episode length');
      this.stepCount++;const outcome=this.actorStep(1);this.lastSubmission=outcome.submission?.[0]?.slice()??null;this.tick(.25);
      return this.snapshot();
    }
    snapshot(){
      const d=new DataView(this.state.buffer,this.state.byteOffset,this.state.byteLength);
      return {step:this.stepCount,script_tick:this.actor.script_tick>>>0,actor_phase:this.actor.phase,
        state_words:Array.from({length:13},(_,i)=>d.getUint32(4*i,true)),time:C.readTC(this.state),
        submission:this.lastSubmission?.slice()??null,events:this.actor.events.map(r=>r.slice()),poses:this.poses(),
        cycle_argument:this.lastActorOutcome?.submission?.[1]??0,cycles:this.actor.cycles};
    }
  }
  return Object.freeze({GearContinuationController});
});
