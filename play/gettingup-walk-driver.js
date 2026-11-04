/* OUR input-to-animation bridge. Original player/AI selection is not ported.
 * Keep all 48 bones on the existing resource-driven controller; no mixer,
 * root-motion speed constants, native pose inputs or finite episode loops.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const M=node?require('./gettingup-managed-episode.js'):root.GettingUpManagedEpisode;
  const S=node?require('./gettingup-script-actor.js'):root.GettingUpScriptActor;
  const P=node?require('./gettingup-character-motion.js'):root.GettingUpCharacterMotion;
  const api=factory(M,S,P);if(node)module.exports=api;else root.GettingUpWalkDriver=api;
})(typeof globalThis!=='undefined'?globalThis:this,function walkDriverModule(M,S,P){'use strict';
  const descriptors=c=>[{token:0,kind:0,duration:0,direction:1,start:0,end:c.frames-1,next_frame:-1}];
  class Driver{
    constructor(data){
      if(data?.schema!==1||data.kind!=='gettingup-world-walk-inputs'||data.bones?.length!==48||
         Object.keys(data.clips||{}).sort().join()!=='idle,run,walk')throw Error('exact 48-bone locomotion resources required');
      this.data=data;this.mode='idle';this.steps=0;this.transitionPeriod=5;
      for(const c of Object.values(data.clips))if(c.mode!==1||!Number.isInteger(c.frames)||c.frames<2||c.frames>256)throw Error('bounded root-mode-1 stream required');
      const clip=data.clips.idle;this.controller=new M.ManagedCharacterController(data.bones,clip,descriptors(clip),[0]);
      this.controller.initializeOriginal(clip,0);
      // Settle the actual initial transition before exposing the character.
      this.controller.interpolate(1);this.controller.evaluate();this.lastRequest={rotation:[0,0,0,1],translation:[0,0,0]};
    }
    select(mode){
      if(!Object.hasOwn(this.data.clips,mode))throw Error('known locomotion mode required');
      if(mode===this.mode)return false;
      const clip=this.data.clips[mode],c=this.controller;
      c.actor=new S.ScriptActor(descriptors(clip),[0],c.state);
      c.activateOriginal(clip,0,0,this.transitionPeriod);this.mode=mode;return true;
    }
    step(mode=this.mode){
      this.select(mode);const c=this.controller,out=c.actorStep(1);
      // A held transition or idle input must not replay a stale world delta.
      // This gate is OUR mode-selection policy, not an original AI claim.
      this.lastRequest=mode!=='idle'&&out.submission?P.fromRoot(c.root):{rotation:[0,0,0,1],translation:[0,0,0]};
      c.interpolate(1);c.evaluate();this.steps++;
      return this.snapshot();
    }
    snapshot(){return {steps:this.steps,mode:this.mode,clip:this.controller.clip.source,
      frame:this.controller.frameOf(this.controller.state),cycles:this.controller.actor.cycles,
      request:{rotation:this.lastRequest.rotation.slice(),translation:this.lastRequest.translation.slice()},
      poses:this.controller.poses(),originalPlayerStateSelection:false}}
  }
  return Object.freeze({Driver,descriptors,moduleSource:walkDriverModule.toString()});
});
