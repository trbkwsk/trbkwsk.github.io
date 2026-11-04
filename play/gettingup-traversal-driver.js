/* OUR action selection around sealed controller algorithms and recovered jump
 * bindings. No claim of original complete input/state/collision semantics.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const W=node?require('./gettingup-walk-driver.js'):root.GettingUpWalkDriver;
  const X=node?require('./gettingup-compiled-mixed.js'):root.GettingUpCompiledMixed;
  const J=node?require('./gettingup-jump-rules.js'):root.GettingUpJumpRules;
  const M=node?require('./gettingup-character-motion.js'):root.GettingUpCharacterMotion;
  const api=factory(W,X,J,M);if(node)module.exports=api;else root.GettingUpTraversalDriver=api;
})(typeof globalThis!=='undefined'?globalThis:this,function traversalDriver(W,X,J,M){'use strict';
  const zero=()=>({translation:[0,0,0],rotation:[0,0,0,1]});
  class Driver{
    constructor(data){
      if(data?.schema!==1||data.kind!=='gettingup-world-play-inputs'||Object.keys(data.phases||{}).sort().join()!=='run_air,run_land,run_takeoff,stand_air,stand_land,stand_takeoff')throw Error('validated six-phase jump resources required');
      this.data=data;this.walk=new W.Driver({...data,kind:'gettingup-world-walk-inputs',clips:Object.fromEntries(['idle','walk','run'].map(k=>[k,data.clips[k]]))});
      this.controller=this.walk.controller;this.phase='roam';this.pending=null;this.steps=0;this.launched=false;this.style='stand';this.events=[];this.launch=null;this.lastRequest=zero();
    }
    enter(phase){
      if(phase==='roam'){this.phase='roam';this.walk.mode='after-jump';this.launched=false;this.events.push('roam');return}
      const clip=this.data.clips[phase],p=this.data.phases[phase],c=this.controller;
      if(!clip||!p)throw Error('known original jump phase required');
      c.actor=new X.MixedScriptActor(p.descriptors,p.codes,c.state);c.activateOriginal(clip,0,0,5);c.actor.speed=p.rate;
      this.phase=phase;this.events.push(phase.endsWith('_air')?'air':phase.endsWith('_land')?'land':'takeoff');
    }
    startJump(mode,grounded,clearance){
      if(this.phase!=='roam'||!grounded)return false;
      this.style=mode==='run'?'run':'stand';this.launch=J.launch(clearance,this.style==='run',false,false);this.launched=false;
      this.enter(this.style+'_takeoff');this.events.push('jump-start');return true;
    }
    step(mode,{jump=false,grounded=false,clearance=250}={}){
      if(!['idle','walk','run'].includes(mode)||typeof jump!=='boolean'||typeof grounded!=='boolean')throw Error('known input mode and explicit action/support required');
      this.events=[];let impulse=null;
      if(this.pending){const next=this.pending;this.pending=null;this.enter(next)}
      if(jump)this.startJump(mode,grounded,clearance);
      if(this.phase==='roam'){const s=this.walk.step(mode);this.lastRequest=s.request}
      else{
        const c=this.controller,air=this.phase.endsWith('_air');
        // OUR prolonged-fall continuation: repeat the authored fixed-frame
        // descriptor, not the entire in-air clip. Original virtual +a50 is
        // deliberately not claimed as fully reproduced by this policy.
        const last=c.actor.chain.descriptors.length-1,t=c.actor.chain.cursor.time();
        if(air&&c.actor.chain.index===last&&t[1]<0&&t[2]>=1)c.actor.chain.bind(last);
        const out=c.actorStep(1,{speed:this.data.phases[this.phase].rate,cycle_enabled:!air});
        this.lastRequest=out.submission?M.fromRoot(c.root):zero();
        const launchEvent=this.style==='run'?!!out.ended:c.actor.events.some(([code])=>code===54);
        if(this.phase.endsWith('_takeoff')&&!this.launched&&launchEvent){this.launched=true;impulse={...this.launch};this.events.push('launch')}
        if(out.ended&&this.phase.endsWith('_takeoff'))this.pending=this.style+'_air';
        if(out.ended&&this.phase.endsWith('_land'))this.pending='roam';
        c.interpolate(1);c.evaluate();
      }
      this.steps++;return {...this.snapshot(),impulse};
    }
    collisionResolved(grounded,descending,wasGrounded){
      if(this.launched&&grounded&&descending&&!this.phase.endsWith('_land')&&!this.pending?.endsWith('_land'))this.pending=this.style+'_land';
      if(this.phase==='roam'&&wasGrounded&&!grounded){this.style='stand';this.launched=true;this.pending='stand_air';this.events.push('fall')}
    }
    gravityScale(){return this.phase.endsWith('_air')?J.gravityScale(this.phase,true):1}
    snapshot(){const c=this.controller;return {steps:this.steps,phase:this.phase,pending:this.pending,mode:this.phase==='roam'?this.walk.mode:this.phase,
      frame:c.frameOf(c.state),cycles:c.actor.cycles,launched:this.launched,style:this.style,
      events:this.events.slice(),request:{translation:this.lastRequest.translation.slice(),rotation:this.lastRequest.rotation.slice()},poses:c.poses()}}
  }
  return Object.freeze({Driver,moduleSource:traversalDriver.toString()});
});
