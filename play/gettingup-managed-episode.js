/* Resource-only diagnostic original-manager episode. Interpolation and bone
 * evaluation are separate. No native readback is an animation input.
 * Native parity and browser integration are established by separate checks.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const A=node?require('./gettingup-animation.js'):root.GettingUpAnimation;
  const S=node?require('./gettingup-script-actor.js'):root.GettingUpScriptActor;
  const E=node?require('./gettingup-superrun-episode.js'):root.GettingUpSuperRunEpisode;
  const G=node?require('./gettingup-gear.js'):root.GettingUpGear;
  const L=node?require('./gettingup-layer-episode.js'):root.GettingUpLayerEpisode;
  const F=node?require('./gettingup-frame-coordinator.js'):root.GettingUpFrameCoordinator;
  const api=factory(A,S,E,G,L,F);if(node)module.exports=api;else root.GettingUpManagedEpisode=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A,S,E,G,L,F){'use strict';
  const f=Math.fround;
  class ManagedCharacterController extends S.ScriptActorCharacterController{
    interpolate(delta){
      delta=f(delta);if(!Number.isFinite(delta)||delta<0)throw Error('nonnegative interpolation coefficient required');
      // Original controller Interp mutates clocks/bindings, not body samplers.
      this.elapsed=f(Math.min(f(this.elapsed+delta),this.duration));
      const weight=A.timerWeight(this.elapsed,this.duration,this.shape);
      for(let s=1;s<6;s++)if(this.layers[s].bound&&this.roots[s])this.roots[s].coefficientOnly(weight);
      this.state=A.updateProgress(this.state,f(this.elapsed*f(1/this.duration)));
      this.root.coefficientOnly(weight);
      for(const l of this.layers)if(l.bound&&l.items)l.items.blend(weight);
      for(let slot=1;slot<6;slot++){
        const l=this.layers[slot];if(!l.active)continue;
        if(l.stopping){
          const winners=new Map();
          for(let i=1;i<48;i++)if(this.owners[i]===slot){
            const m=this.body[i],dest=this.fallback(slot,i);winners.set(i,dest);
            if(!this.prepared[i]){m.target=m.sampler.sample(this.frameOf(l.state));m.coefficientOnly(A.stateFloat(l.state,0x20))}
            m.snapshot=A.copyPose(m.current);m.target=this.sampler(this.layers[dest].clip,this.bones[i]).sample(this.frameOf(this.stateFor(dest)));
            m.sampler=this.sampler(l.clip,this.bones[i]);this.prepared[i]=1;
          }
          l.duration=f(l.duration-l.elapsed);l.elapsed=0;
          l.elapsed=f(Math.min(delta,l.duration));
          if(l.elapsed===l.duration){
            for(const [i,dest] of winners){this.owners[i]=dest;this.prepared[i]=0;this.body[i].bindTarget(this.sampler(this.layers[dest].clip,this.bones[i]),this.frameOf(this.stateFor(dest)),false)}
            l.stopping=false;l.active=false;l.bound=false;
          }
        }else l.elapsed=f(Math.min(f(l.elapsed+delta),l.duration));
        l.state=A.updateProgress(l.state,l.duration===0?0:f(l.elapsed*f(1/l.duration)));
      }
      this.layers[0].state=this.state;
    }
    evaluate(){
      // Original 005319a0 samples requested/prepared bones. 004b19b0 then
      // finishes the shared queue; an Interp call alone does not drain it.
      const queue=new Set();
      for(let i=1;i<48;i++){
        const slot=this.owners[i],state=this.stateFor(slot),m=this.body[i];
        if(!state[0x28]&&!state[0x29]&&!this.prepared[i])continue;
        if(this.prepared[i])m.coefficientOnly(A.stateFloat(state,0x30));
        else if(state[0x28]){m.ordinaryRequest(this.frameOf(state),A.stateFloat(state,0x20),!!state[0x2a]);queue.add(slot)}
        else m.coefficientOnly(A.stateFloat(state,0x20));
      }
      for(const slot of queue)this.stateFor(slot)[0x2c]=1;
      this.queuedStates=this.layers.map((_,i)=>new Uint8Array(this.stateFor(i)));
      this.lastQueueSlots=Array.from(queue);this.lastQueueCount=queue.size;
      for(const slot of queue){if(slot===0)this.state=A.finishQueued(this.state);else this.layers[slot].state=A.finishQueued(this.layers[slot].state)}
      this.layers[0].state=this.state;return this.poses();
    }
  }
  class ManagedSuperRunEpisode extends ManagedCharacterController{
    constructor(data){
      const m=data.superrun;
      if(data.source?.clipId!==1||data.source.frames!==37||data.steps!==160||data.bones?.length!==48||data.held?.clipId!==2||data.operations?.length!==10||!data.masks||
        m?.rate!==f(.8)||m.initial_power!==99.5||m.maximum_power!==100||m.prelude_tick!==33||m.first_core_skip_once!==true||
        m.descriptors?.length!==1||m.descriptors[0].start!==0||m.descriptors[0].end!==35)throw Error('original default-Power full-rig manager inputs required');
      let previous=24;
      for(const p of data.operations){
        if(!Number.isInteger(p.step)||p.step<=24||p.step<previous||p.step>160||!['play','stop'].includes(p.op)||
          !Number.isInteger(p.slot)||p.slot<1||p.slot>5||!Number.isInteger(p.duration)||p.duration<1||p.duration>32)throw Error('bounded ordered manager layer plan required');
        if(p.op==='play'){
          const mask=data.masks[p.mask];
          if(!Array.isArray(mask)||new Set(mask).size!==mask.length||mask.some(i=>!Number.isInteger(i)||i<1||i>=48)||
            ![0,1,2].includes(p.clockMode)||![.5,1].includes(p.speed)||!Number.isInteger(p.priority)||p.priority< -2147483648||p.priority>2147483647||
            typeof p.loop!=='boolean'||typeof p.enabled!=='boolean')throw Error('bounded manager layer inputs required');
        }
        previous=p.step;
      }
      super(data.bones,data.source,m.descriptors,m.codes);this.initializeOriginal(data.source,0);
      this.actor=new E.SourceActor(m.descriptors,m.codes,this.state,m.negative);this.actor.activate(0,0,0);this.actor.speed=m.rate;
      // Same declared inherited source activation as the accepted native rig.
      this.tick(1);this.actor.script_tick=m.prelude_tick;
      this.held=data.held;this.operations=data.operations.map(p=>({...p}));
      this.masks=Object.fromEntries(Object.entries(data.masks).map(([k,v])=>[k,v.slice()]));
      this.limit=160;this.stepCount=-1;this.chain=this.actor.chain;this.lastSubmission=null;
      this.manager=F.objectManager();this.skipOnce=true;this.frameEvents=[];this.continueStep();
    }
    continueStep(){
      if(this.stepCount>=this.limit)throw Error('outside bounded original manager episode');
      this.stepCount++;
      for(const p of this.operations.filter(p=>p.step===this.stepCount)){
        if(p.op==='play')this.playSecondary(p.slot,this.held,this.masks[p.mask],p);else this.stopSecondary(p.slot,p.duration);
      }
      const result=F.scheduleChunk(this.manager,F.STEP);this.manager=result.om;this.frameEvents=result.events;
      const events=[];
      for(const e of result.events){
        if(e[0]==='tick'&&e[1]==='fixed'){
          const out=this.actorStep(f(60*e[2]),{skip_once:this.skipOnce});this.skipOnce=false;
          this.lastSubmission=out.submission?.[0]?.slice()??null;
          events.push(...this.actor.events.map(row=>row.slice()));
        }else if(e[0]==='interp')this.interpolate(f(60*e[1]));
      }
      this.actor.events=events;this.evaluate();return this.snapshot();
    }
    layerSnapshot(){return L.LayerEpisodeController.prototype.layerSnapshot.call(this)}
    snapshot(){const result=G.GearContinuationController.prototype.snapshot.call(this);result.events=result.events.map(([code,tick])=>[code,tick>>>0]);return result}
  }
  return Object.freeze({ManagedCharacterController,ManagedSuperRunEpisode});
});
