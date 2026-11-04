/* OUR ledge/scene integration. Authored mode-zero motion and the sealed
 * controller remain unchanged; grip anchoring and reduced collision proxy
 * are diagnostic policies, not original IK/ledge physics or LIVE_RUNTIME.
 */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const S=node?require('./gettingup-play-simulation.js'):root.GettingUpPlaySimulation;
 const D=node?require('./gettingup-climb-driver.js'):root.GettingUpClimbDriver;
 const A=node?require('./gettingup-animation.js'):root.GettingUpAnimation;
 const P=node?require('./gettingup-scene-placement.js'):root.GettingUpScenePlacement;
 const M=node?require('./gettingup-character-motion.js'):root.GettingUpCharacterMotion;
 const Q=node?require('./gettingup-ledge-query.js'):root.GettingUpLedgeQuery;
 const api=factory(S,D,A,P,M,Q);if(node)module.exports=api;else root.GettingUpClimbSimulation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function climbSimulation(S,D,A,P,M,Q){'use strict';
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
 function direction(heading){return [Math.sin(heading),0,Math.cos(heading)]}
 function palmOffset(driver,data,heading){
  const world=A.originalWorldMatrices(data.bones,driver.controller.poses());
  const outer=P.multiply(P.actorPlacement(S.nativeRows(heading,[0,0,0]).flat()),P.REFLECT);
  const palms=['L Hand','R Hand'].map(name=>{
   const i=data.bones.findIndex(b=>b.name===name);if(i<0)throw Error('both original hand bones required');
   return P.point(P.multiply(outer,world[i]),[0,0,0]);
  });
  return palms[0].map((v,i)=>(v+palms[1][i])/2);
 }
 function motion(request,heading,p){const v=M.toWorld(request,S.nativeRows(heading,p),0).translation;return [-v[0],v[1],v[2]]}
 class Simulation extends S.Simulation{
  constructor(data,world,spawn,yaw,shape){
   super({...data,kind:'gettingup-world-play-inputs'},world,spawn,yaw,shape);this.data=data;this.driver=new D.Driver(data);
   this.anchor=null;this.awaitingLanding=null;this.grabs=0;this.climbs=0;this.drops=0;this.releaseCooldown=0;this.maxGripError=0;this.lastGripError=null;
   // OUR collision proxy, not a reading of original Coll_CapsuleScale(4,4).
   this.climbShape={...shape,radius:shape.radius*.33,height:shape.height*.95,stepHeight:0};
  }
  palms(){return add(this.position,palmOffset(this.driver,this.data,this.heading))}
  ledgeHint(){return Q.find(this.world,this.position,direction(this.heading),this.palms(),this.shape,false)}
  drop(reason,crossed=false){
   this.anchor=null;this.releaseCooldown=60;if(!crossed)this.drops++;this.vertical=-30;this.horizontal=crossed?[0,0]:direction(this.heading).filter((_,i)=>i!==1).map(v=>-v*30);
   this.lastGripError=null;
   this.driver.pending=null;this.driver.enter('stand_air');this.driver.launched=true;this.events.push(reason);
  }
  step(input){
   const {x,z,walk,jump,cameraYaw}=input;
   if(![-1,0,1].includes(x)||![-1,0,1].includes(z)||typeof walk!=='boolean'||typeof jump!=='boolean'||!Number.isFinite(cameraYaw)||Math.abs(cameraYaw)>1e7)throw Error('bounded raw keyboard input required');
   if(this.releaseCooldown)this.releaseCooldown--;
   let ledge=null;
   if(!this.anchor&&this.releaseCooldown===0&&z>0&&['stand_air','run_air'].includes(this.driver.phase))
    ledge=Q.find(this.world,this.position,direction(this.heading),this.palms(),this.shape);
   if(!this.anchor&&!ledge){
    super.step(input);
    if(this.awaitingLanding&&this.grounded){const a=this.awaitingLanding;
     if(sub(this.position,a.contact).reduce((v,p,i)=>v+p*a.outward[i],0)<-this.shape.radius){this.climbs++;this.events.push('climb-supported')}
     this.awaitingLanding=null;
    }
    return this.snapshot();
   }
   if(this.anchor&&this.driver.phase==='ledge_hang'&&z<0){this.events=[];this.drop('ledge-drop');super.step(input);this.events.push('ledge-drop');return this.snapshot()}
   if(ledge){this.anchor={...ledge,released:false};this.grabs++;this.vertical=0;this.horizontal=[0,0];this.grounded=false;this.maxGripError=0;}
   const s=this.driver.step(x||z?(walk?'walk':'run'):'idle',{grab:!!ledge,pullUp:jump||z>0,grounded:false});
   this.events=s.events.slice();if(ledge)this.events.push('ledge-caught');
   const offset=palmOffset(this.driver,this.data,this.heading),proposed=add(this.position,motion(s.request,this.heading,this.position));
   const a=this.anchor;
   // The authored mode-zero pull-up already contains the hand/body trajectory.
   // Do not keep forcing palms to the lip while ALSO consuming that motion.
   if(this.driver.phase==='ledge_up'&&!a.released){a.released=true;this.events.push('authored-pullup')}
   const desired=a.released?proposed:sub(a.contact,offset),delta=sub(desired,this.position);
   let resolved;
   if(Math.hypot(...delta)>40){this.drop('grip-out-of-reach');resolved=this.world.move(this.position,[0,-.5,0],this.climbShape)}
   else resolved=this.world.move(this.position,delta,this.climbShape);
   this.position=resolved.position;this.grounded=false;this.lastCollision={contacts:resolved.contacts,substeps:resolved.substeps,stepped:false};
   if(this.anchor&&!this.anchor.released){this.lastGripError=Math.hypot(...sub(this.palms(),this.anchor.contact));this.maxGripError=Math.max(this.maxGripError,this.lastGripError);
    if(this.lastGripError>6)this.drop('grip-obstructed');
   }else this.lastGripError=null;
   if(this.anchor&&s.pending==='roam'){
    const supported=this.world.move(this.position,[0,-this.shape.height*.3,0],{...this.shape,stopOnSupport:true});
    if(supported.grounded&&Math.abs(supported.position[1]-this.position[1])<this.shape.height*.3&&Math.hypot(supported.position[0]-this.position[0],supported.position[2]-this.position[2])<1){
     this.position=supported.position;this.grounded=true;this.vertical=0;this.climbs++;this.anchor=null;this.events.push('climb-supported');
    }else if(this.anchor.landing_drop>this.shape.height*.3){this.awaitingLanding=JSON.parse(JSON.stringify(this.anchor));this.drop('ledge-crossed',true)}
    else this.drop('climb-no-support');
   }
   this.maxHeight=Math.max(this.maxHeight,this.position[1]);
   if(this.history.length<6000)this.history.push({x,z,walk,jump,cameraYaw});
   return this.snapshot();
  }
  snapshot(){return {...super.snapshot(),ledge_anchor:this.anchor?JSON.parse(JSON.stringify(this.anchor)):null,
   ledge_grabs:this.grabs,supported_climbs:this.climbs,ledge_drops:this.drops,grip_error:this.lastGripError,
   maximum_grip_error:this.maxGripError,awaiting_climb_landing:!!this.awaitingLanding,release_cooldown:this.releaseCooldown,originalLedgePhysics:false}}
 }
 return Object.freeze({Simulation,direction,palmOffset,motion,moduleSource:climbSimulation.toString()});
});
