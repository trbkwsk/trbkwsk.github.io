/* Native loading bindings, compiled ranges and initial rates. Keyboard mode
 * selection/transition periods remain the existing scene adapter. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./gettingup-compiled-mixed.js'):root.GettingUpCompiledMixed);
 if(node)module.exports=api;else root.GettingUpPoolNormalLocomotion=api;
})(globalThis,function normalLocomotion(X){'use strict';
 function validate(data){
  if(data?.kind!=='pool-yard-original-normal-inputs')throw Error('native Trane normal resources required');
  for(const [key,name,sequence,rate]of [['walk','TR_Walk','Trane_WalkF',Math.fround(1.15)],['run','TR_2nd_Gear','Trane_RunF',1]]){
   const c=data.clips?.[key],p=data.phases?.[key];
   if(c?.name!==name||c.mode!==1||p?.sequence!==sequence||p.rate!==rate||p.source_sha256!==c.source_sha256||p.source!==c.source||!p.descriptors?.length)throw Error('exact native Trane normal binding required');
  }return data;
 }
 function resources(base,data){validate(data);return {...base,clips:{...base.clips,...data.clips}}}
 function bind(walk,data){
  validate(data);const step=walk.step.bind(walk);
  walk.step=function(mode){
   if(mode!=='idle'){
    const p=data.phases[mode],c=this.controller;if(!p)throw Error('known normal mode required');
    if(this.mode!==mode){c.actor=new X.MixedScriptActor(p.descriptors,p.codes,c.state);c.activateOriginal(data.clips[mode],0,p.descriptors[0].start,this.transitionPeriod);this.mode=mode}
    c.actor.speed=p.rate;
   }return step(mode);
  };return walk;
 }
 return Object.freeze({validate,resources,bind,moduleSource:normalLocomotion.toString()});
});
