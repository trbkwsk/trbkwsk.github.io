/* Original constructed actor comparison episode. Shared skeletal algorithms
 * remain in the generic controller; no engine/world simulation is implied.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const S=node?require('./gettingup-script-actor.js'):root.GettingUpScriptActor;
  const G=node?require('./gettingup-gear.js'):root.GettingUpGear;
  const P=node?require('./gettingup-transition-parameter.js'):root.GettingUpTransitionParameter;
  const D=node?require('./gettingup-derived-policy.js'):root.GettingUpDerivedPolicy;
  const B=node?require('./gettingup-primary-diagnostics.js'):root.GettingUpPrimaryDiagnostics;
  const api=factory(S,G,P,D,B);if(node)module.exports=api;else root.GettingUpConstructedEpisode=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(S,G,P,D,B){'use strict';
  const cases=Object.freeze(['base','derived'].flatMap(actorClass=>[0,3].map(minimum=>Object.freeze({name:actorClass+'-'+minimum,actorClass,minimum}))));
  const words=state=>{const v=new DataView(state.buffer,state.byteOffset,state.byteLength);return Array.from({length:13},(_,i)=>v.getUint32(4*i,true))};
  class ConstructedEpisode extends S.ScriptActorCharacterController{
    constructor(data,name){
      const plan=cases.find(c=>c.name===name);
      if(!plan||data.source.clipId!==1||data.target.clipId!==0||data.source_flags!==0x2000800||data.target_flags!==0x2000800||data.descriptors[2]?.start!==2||data.descriptors[2]?.end!==20||data.descriptors[2]?.direction!==1)throw Error('constructed actor native-validated input required');
      super(data.bones,data.source,data.descriptors,data.codes);this.initializeOriginal(data.source,0);this.tick(1);
      this.plan=plan;this.word=D.selection(1,1,data.target_flags,data.source_flags,plan.minimum,null,plan.actorClass);
      P.activateEncoded(this,data.target,2,4,this.word);
      this.activationDiagnostic={state_words:words(this.state),script_tick:this.actor.script_tick>>>0,phase:this.actor.phase,counter:this.actor.counter,period:this.actor.period,...B.capture(this)};
      this.tick(.25);this.initialInterp=.25;this.limit=24;this.stepCount=0;this.chain=this.actor.chain;this.lastSubmission=null;
    }
    continueStep(){return G.GearContinuationController.prototype.continueStep.call(this)}
    snapshot(){
      const result=G.GearContinuationController.prototype.snapshot.call(this);
      // Native diagnostic ABI serializes event tick as DWORD. Preserve bits
      // for negative waiting ticks; the internal actor clock stays signed.
      result.events=result.events.map(([code,tick])=>[code,tick>>>0]);return result;
    }
  }
  return Object.freeze({cases,ConstructedEpisode});
});
