/* Original default-Power source-only Core episode over the shared controller.
 * Original negative tick/end callbacks are observable events here, not a full
 * gameplay interpreter, native scheduler, registry or physics implementation.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const S=node?require('./gettingup-script-actor.js'):root.GettingUpScriptActor;
  const Q=node?require('./gettingup-script.js'):root.GettingUpScript;
  const P=node?require('./gettingup-actor.js'):root.GettingUpActor;
  const G=node?require('./gettingup-gear.js'):root.GettingUpGear;
  const L=node?require('./gettingup-layer-episode.js'):root.GettingUpLayerEpisode;
  const api=factory(S,Q,P,G,L);if(node)module.exports=api;else root.GettingUpSuperRunEpisode=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(S,Q,P,G,L){'use strict';
  class SourceActor extends S.ScriptActor{
    constructor(descriptors,codes,raw,negative){
      super(descriptors,codes,raw);
      if(negative?.tick!==-4||negative?.end!==-1||codes.length!==1||codes[0]!==0)throw Error('original SuperRun negative-only callback metadata required');
      this.negative={...negative};this.endEmitted=false;
    }
    dispatch(){
      const tokens=this.pending_tokens,ticks=this.pending_ticks,last=this.event_counter;
      const out=Q.dispatchQueue(tokens,ticks,last,this.chain.wrap_flag,this.codes);
      // Original 10331c35..57 dispatches sequence+2e BEFORE reading a
      // positive event's code. A zero code cannot suppress this tick call.
      let previous=last;
      for(let i=0;i<tokens.length;i++)if(tokens[i]>=0&&(ticks[i]!==previous||i===ticks.length-1)){
        this.events.push([this.negative.tick,ticks[i]]);previous=ticks[i];
      }
      if(out.calls.length)throw Error('positive events outside source-only SuperRun episode');
      if(out.script_tick!==null)this.script_tick=out.script_tick;
      this.event_counter=out.last;this.pending_tokens=[];this.pending_ticks=[];
    }
    bindFirst(){
      // Original 10331ee3..ef3 sends the end sentinel before the loop
      // rebind/remainder dispatch. One end notification, not one per bind.
      if(this.ended&&!this.endEmitted){this.events.push([this.negative.end,-1]);this.endEmitted=true}
      return P.Actor.prototype.bindFirst.call(this);
    }
    step(delta,controls={}){this.endEmitted=false;return super.step(delta,controls)}
  }
  class SuperRunEpisode extends S.ScriptActorCharacterController{
    constructor(data){
      const m=data.superrun;
      if(data.source?.clipId!==1||data.source.frames!==37||data.steps!==160||data.bones?.length!==48||data.held?.clipId!==2||data.operations?.length!==10||!data.masks||
        m?.rate!==Math.fround(.8)||m.initial_power!==99.5||m.maximum_power!==100||m.prelude_tick!==33||m.first_core_skip_once!==true||
        m.descriptors?.length!==1||m.descriptors[0].start!==0||m.descriptors[0].end!==35)throw Error('original default-Power full-rig SuperRun inputs required');
      super(data.bones,data.source,m.descriptors,m.codes);this.initializeOriginal(data.source,0);
      this.actor=new SourceActor(m.descriptors,m.codes,this.state,m.negative);this.actor.activate(0,0,0);this.actor.speed=m.rate;
      this.tick(1);this.actor.script_tick=m.prelude_tick;
      this.held=data.held;this.operations=data.operations.map(p=>({...p}));this.masks=Object.fromEntries(Object.entries(data.masks).map(([k,v])=>[k,v.slice()]));
      this.limit=160;this.stepCount=0;this.initialInterp=.25;this.chain=this.actor.chain;this.lastSubmission=null;
      this.actorStep(1,{skip_once:true});this.tick(.25);
    }
    continueStep(){return L.LayerEpisodeController.prototype.continueStep.call(this)}
    layerSnapshot(){return L.LayerEpisodeController.prototype.layerSnapshot.call(this)}
    snapshot(){const result=G.GearContinuationController.prototype.snapshot.call(this);result.events=result.events.map(([code,tick])=>[code,tick>>>0]);return result}
  }
  return Object.freeze({SourceActor,SuperRunEpisode});
});
