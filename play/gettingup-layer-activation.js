/* Diagnostic seeds over the generic original controller, not gameplay AI. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const S=node?require('./gettingup-script-actor.js'):root.GettingUpScriptActor;
  const G=node?require('./gettingup-gear.js'):root.GettingUpGear;
  const L=node?require('./gettingup-layer-episode.js'):root.GettingUpLayerEpisode;
  const P=node?require('./gettingup-transition-parameter.js'):root.GettingUpTransitionParameter;
  const D=node?require('./gettingup-primary-diagnostics.js'):root.GettingUpPrimaryDiagnostics;
  const api=factory(S,G,L,P,D);if(node)module.exports=api;else root.GettingUpLayerActivation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(S,G,L,P,D){'use strict';
  const play=(slot=1,mask='RightHand',duration=2,mode=1,priority=10,speed=1)=>({slot,mask,duration,mode,priority,speed});
  const cases=[
    {name:'control',plays:[],warmup:0,stops:[],word:1},
    {name:'hand_settled',plays:[play(1,'RightHand',1)],warmup:0,stops:[],word:1},
    {name:'hand_initial',plays:[play(1,'RightHand',4)],warmup:0,stops:[],word:1},
    {name:'hand_independent',plays:[play(1,'RightHand',2,0,10,.5)],warmup:0,stops:[],word:1},
    {name:'hand_reverse',plays:[play(1,'RightHand',2,2)],warmup:0,stops:[],word:1},
    {name:'hand_arm_tie',plays:[play(),play(3,'RightArm')],warmup:0,stops:[],word:1},
    {name:'hand_arm_priority',plays:[play(),play(3,'RightArm',2,0,11)],warmup:0,stops:[],word:1},
    {name:'hand_stopping',plays:[play(1,'RightHand',4)],warmup:.5,stops:[{slot:1,duration:2}],word:1},
    {name:'dual_zero_parameter',plays:[play(),play(3,'RightArm',2,0)],warmup:0,stops:[],word:0},
    {name:'dual_shaped_root',plays:[play(),play(3,'RightArm',2,0)],warmup:0,stops:[],word:0x00c00001}
  ];
  const clone=v=>JSON.parse(JSON.stringify(v));
  for(const c of cases){c.plays.forEach(Object.freeze);c.stops.forEach(Object.freeze);Object.freeze(c.plays);Object.freeze(c.stops);Object.freeze(c)}Object.freeze(cases);
  class LayerActivation extends S.ScriptActorCharacterController{
    constructor(data,name){
      const plan=cases.find(c=>c.name===name);
      if(!plan||data.source.clipId!==1||data.target.clipId!==0||data.held?.clipId!==2||!data.masks||data.descriptors[2]?.start!==2||data.descriptors[2]?.end!==20)throw Error('native-validated activation seed and resources required');
      super(data.bones,data.source,data.descriptors,data.codes);this.initializeOriginal(data.source,0);
      for(const p of plan.plays)this.playSecondary(p.slot,data.held,data.masks[p.mask],{duration:p.duration,clockMode:p.mode,priority:p.priority,speed:p.speed,loop:true});
      if(plan.warmup)this.tick(plan.warmup);for(const p of plan.stops)this.stopSecondary(p.slot,p.duration);
      this.tick(1);this.preActivation=clone(this.layerSnapshot());P.activateEncoded(this,data.target,2,4,plan.word);
      const d=new DataView(this.state.buffer);this.activationBoundary={
        state_words:Array.from({length:13},(_,i)=>d.getUint32(4*i,true)),script_tick:this.actor.script_tick>>>0,
        phase:this.actor.phase,counter:this.actor.counter,period:this.actor.period,...clone(D.capture(this))};
      this.tick(.25);this.plan=plan;this.limit=24;this.stepCount=0;this.chain=this.actor.chain;this.lastSubmission=null;
    }
    continueStep(){return G.GearContinuationController.prototype.continueStep.call(this)}
    snapshot(){return G.GearContinuationController.prototype.snapshot.call(this)}
    layerSnapshot(){return L.LayerEpisodeController.prototype.layerSnapshot.call(this)}
  }
  return Object.freeze({cases,LayerActivation});
});
