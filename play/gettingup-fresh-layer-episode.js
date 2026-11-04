/* Long layer schedule over the shared original constructed-actor controller.
 * No separate animation implementation or recovered engine scheduling claim.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const E=node?require('./gettingup-constructed-episode.js'):root.GettingUpConstructedEpisode;
  const L=node?require('./gettingup-layer-episode.js'):root.GettingUpLayerEpisode;
  const api=factory(E,L);if(node)module.exports=api;else root.GettingUpFreshLayerEpisode=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E,L){'use strict';
  class FreshLayerEpisode extends E.ConstructedEpisode{
    constructor(data,name){
      if(data.steps!==160||data.held?.clipId!==2||!Array.isArray(data.operations)||data.operations.length!==10||!data.masks)throw Error('native-validated long layer inputs required');
      let previous=24;
      for(const p of data.operations){
        if(!Number.isInteger(p.step)||p.step<=24||p.step<previous||p.step>160||!['play','stop'].includes(p.op)||!Number.isInteger(p.slot)||p.slot<1||p.slot>5||!Number.isInteger(p.duration)||p.duration<1||p.duration>32)throw Error('bounded ordered long layer operation required');
        if(p.op==='play'){
          const mask=data.masks[p.mask];
          if(!Array.isArray(mask)||new Set(mask).size!==mask.length||mask.some(i=>!Number.isInteger(i)||i<1||i>=48)||![0,1,2].includes(p.clockMode)||![.5,1].includes(p.speed)||!Number.isInteger(p.priority))throw Error('known unique nonroot mask and provider mode required');
        }
        previous=p.step;
      }
      super(data,name);this.limit=160;this.held=data.held;this.operations=data.operations.map(p=>({...p}));
      this.masks=Object.fromEntries(Object.entries(data.masks).map(([key,value])=>[key,value.slice()]));
    }
    continueStep(){return L.LayerEpisodeController.prototype.continueStep.call(this)}
    layerSnapshot(){return L.LayerEpisodeController.prototype.layerSnapshot.call(this)}
  }
  return Object.freeze({cases:E.cases,FreshLayerEpisode});
});
