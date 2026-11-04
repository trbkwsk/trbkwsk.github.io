/* OUR explicit ledge action coordinator around the sealed 48-bone controller.
 * Original loading descriptors/rates and mode-zero resources, NOT original
 * ledge detection, physics controller, input AI or geometry integration.
 */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const D=node?require('./gettingup-traversal-driver.js'):root.GettingUpTraversalDriver;
 const X=node?require('./gettingup-compiled-mixed.js'):root.GettingUpCompiledMixed;
 const M=node?require('./gettingup-character-motion.js'):root.GettingUpCharacterMotion;
 const api=factory(D,X,M);if(node)module.exports=api;else root.GettingUpClimbDriver=api;
})(typeof globalThis!=='undefined'?globalThis:this,function climbDriver(D,X,M){'use strict';
 const names=['ledge_grab','ledge_hang','ledge_up'];
 class Driver extends D.Driver{
  constructor(data){
   if(data?.schema!==1||data.kind!=='gettingup-world-climb-inputs'||Object.keys(data.ledge_phases||{}).sort().join()!==names.join())throw Error('three proven ledge phases required');
   for(const name of names){const c=data.clips?.[name],p=data.ledge_phases[name];
    if(c?.mode!==0||!Number.isInteger(c.frames)||c.frames<2||c.frames>256||!Number.isFinite(p.rate)||p.rate<=0||p.rate>4)throw Error('bounded mode-zero ledge resource required');
   }
   super({...data,kind:'gettingup-world-play-inputs'});this.ledgePhases=data.ledge_phases;this.completedClimbs=0;
  }
  enter(phase){
   if(!names.includes(phase))return super.enter(phase);
   const c=this.controller,p=this.ledgePhases[phase];
   c.actor=new X.MixedScriptActor(p.descriptors,p.codes,c.state);c.activateOriginal(this.data.clips[phase],0,0,5);c.actor.speed=p.rate;
   this.phase=phase;this.launched=false;this.events.push(phase);
  }
  step(mode,{grab=false,pullUp=false,...controls}={}){
   if(typeof grab!=='boolean'||typeof pullUp!=='boolean'||!['idle','walk','run'].includes(mode))throw Error('explicit bounded ledge action inputs required');
   // `grab` is an explicit reach/detection result supplied by the future
   // geometry coordinator, not simply the Space key or a grounded flag.
   const canGrab=['roam','stand_air','run_air'].includes(this.phase);
   if(this.pending==='roam'||!names.includes(this.phase)&&!names.includes(this.pending)&&!(grab&&canGrab))return super.step(mode,controls);
   this.events=[];
   if(this.pending){const next=this.pending;this.pending=null;this.enter(next)}
   if(grab&&canGrab)this.enter('ledge_grab');
   if(pullUp&&this.phase==='ledge_hang')this.enter('ledge_up');
   const c=this.controller,p=this.ledgePhases[this.phase];
   if(!p)throw Error('explicit known ledge phase required');
   // OUR coordinator holds nonlooping actions at their terminal TC. It
   // must not render one wrapped frame from the start before changing phase.
   const out=c.actorStep(1,{speed:p.rate,cycle_enabled:this.phase==='ledge_hang'});
   this.lastRequest=out.submission?M.fromRoot(c.root):{translation:[0,0,0],rotation:[0,0,0,1]};
   const terminal=out.submission&&out.actor_fields['0x68']===0;
   if(terminal&&this.phase==='ledge_grab')this.pending='ledge_hang';
   if(terminal&&this.phase==='ledge_up'){this.pending='roam';this.completedClimbs++;this.events.push('climb-animation-complete')}
   c.interpolate(1);c.evaluate();this.steps++;
   return {...this.snapshot(),impulse:null};
  }
  snapshot(){return {...super.snapshot(),completed_climb_animations:this.completedClimbs,
   originalLedgeSelection:false,originalLedgePhysics:false}}
 }
 return Object.freeze({Driver,moduleSource:climbDriver.toString()});
});
