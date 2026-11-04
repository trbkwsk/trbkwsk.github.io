/* UI session reuses existing atomic seek/step/playback orchestration.
 * The controller is the independently checked original-manager episode.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const C=node?require('./gettingup-core-episode.js'):root.GettingUpCoreEpisode;
  const M=node?require('./gettingup-managed-episode.js'):root.GettingUpManagedEpisode;
  const api=factory(C,M);if(node)module.exports=api;else root.GettingUpManagedSession=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C,M){'use strict';
  const NAME='managed-superrun';
  function inputText(data,name=NAME){
    if(name!==NAME)throw Error('known original-manager episode required');
    return C.inputText(data,'default-power-superrun');
  }
  class Session extends C.Session{
    constructor(data,name=NAME){
      inputText(data,name);
      super(data,'default-power-superrun');this.caseName=NAME;
    }
    makeController(){return new M.ManagedSuperRunEpisode(this.data)}
    snapshot(){
      const result=super.snapshot(),m=this.controller;
      result.manager_snapshot={ticks:m.manager.ticks,accumulator:m.manager.accumulator,
        dt_word:0x3c888889,events:m.frameEvents.map(e=>e.slice()),evaluation:'after-manager-frame',
        frame_enter_executed:false,live_game_runtime_verified:false};
      return result;
    }
  }
  return Object.freeze({NAME,CASES:Object.freeze([NAME]),inputText,Session});
});
