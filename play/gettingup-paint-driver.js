/* Original nine Aerosol Stand bindings on the sealed controller. Selection
 * by keys is OUR input policy, not the complete original graffiti manager. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const D=node?require('./gettingup-climb-driver.js'):root.GettingUpClimbDriver;
 const X=node?require('./gettingup-compiled-mixed.js'):root.GettingUpCompiledMixed;
 const M=node?require('./gettingup-character-motion.js'):root.GettingUpCharacterMotion;
 const api=factory(D,X,M);if(node)module.exports=api;else root.GettingUpPaintDriver=api;
})(typeof globalThis!=='undefined'?globalThis:this,function paintDriver(D,X,M){'use strict';
 class Driver extends D.Driver{
  constructor(data){
   if(data?.kind!=='gettingup-world-paint-inputs'||Object.keys(data.paint_phases||{}).length!==9)throw Error('nine proven Aerosol Stand resources required');
   super({...data,kind:'gettingup-world-climb-inputs'});this.paintPhases=data.paint_phases;
   for(let i=0;i<9;i++){const name='paint_'+i,p=this.paintPhases[name],c=data.clips[name];
    if(!p||p.rate!==.5||c?.mode!==1||c.frames!==41||p.descriptors?.length!==1||p.descriptors[0].end!==39)throw Error('exact original paint rate/range required');
   }
  }
  step(mode,{paint=null,...controls}={}){
   if(paint===null){if(this.phase.startsWith('paint_')){this.pending=null;this.enter('roam')}return super.step(mode,controls)}
   if(!Number.isInteger(paint)||paint<0||paint>8)throw Error('bounded explicit paint pose required');
   const name='paint_'+paint,p=this.paintPhases[name],c=this.controller;this.events=[];
   if(this.phase!==name){c.actor=new X.MixedScriptActor(p.descriptors,p.codes,c.state);c.activateOriginal(this.data.clips[name],0,0,5);c.actor.speed=p.rate;this.phase=name;this.pending=null;this.events.push(name)}
   const out=c.actorStep(1,{speed:p.rate});this.lastRequest=out.submission?M.fromRoot(c.root):{translation:[0,0,0],rotation:[0,0,0,1]};
   c.interpolate(1);c.evaluate();this.steps++;return {...this.snapshot(),impulse:null};
  }
 }
 return Object.freeze({Driver,moduleSource:paintDriver.toString()});
});
