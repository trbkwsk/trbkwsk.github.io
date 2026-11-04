/* Diagnostic episode wrapper; all pose/actor work uses generic controller. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const S=node?require('./gettingup-script-actor.js'):root.GettingUpScriptActor;
  const G=node?require('./gettingup-gear.js'):root.GettingUpGear;
  const P=node?require('./gettingup-transition-parameter.js'):root.GettingUpTransitionParameter;
  const api=factory(S,G,P);if(node)module.exports=api;else root.GettingUpParameterEpisode=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(S,G,P){'use strict';
  const words=Object.freeze([...[0,64,127,128,129,192,255].map(i=>P.diagnosticWord(1,i)),0,0x00800000,0x007f0000,0x01000000,0x80000000]);
  class ParameterEpisode extends S.ScriptActorCharacterController{
    constructor(data,word){
      if(!words.includes(word)||data.source.clipId!==1||data.target.clipId!==0||data.descriptors[2]?.start!==2||data.descriptors[2]?.end!==20||data.descriptors[2]?.direction!==1)throw Error('native-validated packed episode input required');
      super(data.bones,data.source,data.descriptors,data.codes);this.initializeOriginal(data.source,0);this.tick(1);
      P.activateEncoded(this,data.target,2,4,word);this.tick(.25);this.initialInterp=.25;this.limit=24;this.stepCount=0;
      this.word=word;this.chain=this.actor.chain;this.lastSubmission=null;
    }
    continueStep(){return G.GearContinuationController.prototype.continueStep.call(this)}
    snapshot(){return G.GearContinuationController.prototype.snapshot.call(this)}
  }
  return Object.freeze({words,ParameterEpisode});
});
