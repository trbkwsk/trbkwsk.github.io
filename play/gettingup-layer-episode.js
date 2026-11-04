/* Independent diagnostic schedule over the validated generic controller.
 * Inputs come from the ignored local sidecar, never bundled original keys.
 * Not recovered gameplay scheduling or a separate animation implementation.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const G=node?require('./gettingup-gear.js'):root.GettingUpGear;
  const api=factory(G);if(node)module.exports=api;else root.GettingUpLayerEpisode=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(G){'use strict';
  const words=bytes=>{const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return Array.from({length:13},(_,i)=>d.getUint32(4*i,true))};
  class LayerEpisodeController extends G.GearContinuationController{
    constructor(bones,source,target,descriptors,codes,held,operations,masks){
      if(held?.clipId!==2||!Array.isArray(operations)||operations.length>32||!masks)throw Error('identified held clip and bounded layer plan required');
      let previous=24;
      for(const p of operations){
        if(!Number.isInteger(p.step)||p.step<=24||p.step<previous||p.step>160||!['play','stop'].includes(p.op)||!Number.isInteger(p.slot)||p.slot<1||p.slot>5||!Number.isInteger(p.duration)||p.duration<1||p.duration>32)throw Error('bounded ordered layer operation required');
        if(p.op==='play'&&(!Array.isArray(masks[p.mask])||![0,1,2].includes(p.clockMode)||![.5,1].includes(p.speed)))throw Error('known bone mask and provider mode required');
        previous=p.step;
      }
      super(bones,source,target,descriptors,codes,160);this.held=held;this.operations=operations.map(p=>({...p}));
      this.masks=Object.fromEntries(Object.entries(masks).map(([name,mask])=>[name,mask.slice()]));
    }
    continueStep(){
      if(this.stepCount>=this.limit)throw Error('outside native-validated episode length');
      for(const p of this.operations.filter(p=>p.step===this.stepCount+1)){
        if(p.op==='play')this.playSecondary(p.slot,this.held,this.masks[p.mask],p);else this.stopSecondary(p.slot,p.duration);
      }
      return super.continueStep();
    }
    layerSnapshot(){
      return {queued:this.queuedStates.map(words),queue:this.lastQueueSlots.slice(),states:this.layers.map((l,s)=>words(this.stateFor(s))),
        owners:Array.from(this.owners),prepared:Array.from(this.prepared),
        layers:this.layers.map((l,s)=>({active:+l.active,initial:+!!l.initial,stopping:+!!l.stopping,bound:+l.bound,
          timer:s?[l.duration??1,l.duration?Math.fround(1/l.duration):1,l.elapsed??0,.5]:[this.duration,Math.fround(1/this.duration),this.elapsed,this.shape]})),
        body_buffers:this.body.slice(1).map(b=>[b.snapshot,b.current,b.target]),
        roots:this.layers.map((l,s)=>l.bound&&this.roots[s]?[this.roots[s].current,this.roots[s].snapshot,this.roots[s].target]:null),
        item_buffers:this.layers.map(l=>l.bound&&l.items?Array.from(l.items.records,([id,b])=>({id,buffers:[b.current,b.snapshot,b.target]})):[]),
        attachment:this.attachment(1,true)};
    }
  }
  return Object.freeze({LayerEpisodeController});
});
