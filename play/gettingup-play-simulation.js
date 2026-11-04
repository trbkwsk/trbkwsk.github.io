/* OUR deterministic scene integration: original-resource motion and jump
 * requests, render-triangle capsule, explicit gravity/inertial policy.
 * NOT original BSP, complete player state machine or native game runtime.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const D=node?require('./gettingup-traversal-driver.js'):root.GettingUpTraversalDriver;
  const M=node?require('./gettingup-character-motion.js'):root.GettingUpCharacterMotion;
  const J=node?require('./gettingup-jump-rules.js'):root.GettingUpJumpRules;
  const api=factory(D,M,J);if(node)module.exports=api;else root.GettingUpPlaySimulation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function playSimulation(D,M,J){'use strict';
  function nativeRows(heading,p){const x=-Math.sin(heading),z=Math.cos(heading);return [[z,0,-x,0],[0,1,0,0],[x,0,z,0],[-p[0],p[1],p[2],1]]}
  function displayVector(request,heading,p){const v=M.toWorld(request,nativeRows(heading,p),0x20000).translation;return [-v[0],0,v[2]]}
  class Simulation{
    constructor(data,world,spawn,yaw,shape){
      if(!Array.isArray(spawn)||spawn.length!==3||spawn.some(v=>!Number.isFinite(v))||!Number.isFinite(yaw))throw Error('finite original scene placement required');
      this.driver=new D.Driver(data);this.world=world;this.spawn=spawn.slice();this.position=spawn.slice();this.heading=yaw;this.shape={...shape};
      this.vertical=0;this.grounded=false;this.horizontal=[0,0];this.events=[];this.history=[];this.lastCollision=null;this.maxHeight=spawn[1];this.jumps=0;this.landings=0;this.headHits=0;
    }
    clearance(){
      let value=250;const p=this.position,s=this.shape;
      for(let i=0;i<9;i++){const angle=(i-1)*Math.PI/4,r=i?s.radius*.9:0,x=p[0]+Math.cos(angle)*r,z=p[2]+Math.sin(angle)*r;
        const hit=this.world.ray([x,p[1]+s.footOffset+s.height*.5,z],[x,p[1]+250,z]);
        if(hit.hit)value=Math.min(value,Math.max(0,hit.point[1]-p[1]));}
      return value;
    }
    step(input){
      const {x,z,walk,jump,cameraYaw}=input;
      if(![-1,0,1].includes(x)||![-1,0,1].includes(z)||typeof walk!=='boolean'||typeof jump!=='boolean'||!Number.isFinite(cameraYaw)||Math.abs(cameraYaw)>1e7)throw Error('bounded normalized keyboard/camera input required');
      const mode=x||z?(walk?'walk':'run'):'idle',d=this.driver;
      if(d.phase==='roam'&&(x||z))this.heading=Math.atan2(Math.sin(cameraYaw)*z-Math.cos(cameraYaw)*x,Math.cos(cameraYaw)*z+Math.sin(cameraYaw)*x);
      const wasGrounded=this.grounded;
      const state=d.step(mode,{jump,grounded:wasGrounded,clearance:jump?this.clearance():250});this.events=state.events.slice();
      const fromRoot=displayVector(state.request,this.heading,this.position);
      if(state.impulse){
        const forward=displayVector({translation:[0,0,state.impulse.forward],rotation:[0,0,0,1]},this.heading,this.position);
        this.vertical+=state.impulse.vertical;this.horizontal=[this.horizontal[0]+forward[0],this.horizontal[1]+forward[2]];this.jumps++;
      }
      const airborne=d.launched&&!d.phase.endsWith('_land'),horizontal=airborne?[this.horizontal[0]/60,this.horizontal[1]/60]:[fromRoot[0],fromRoot[2]];
      this.vertical=Math.max(-768,this.vertical+J.fileDefaultGravity*d.gravityScale()/60);
      const result=this.world.advance(this.position,[horizontal[0],this.vertical/60,horizontal[1]],this.shape,wasGrounded);
      if(this.vertical>0&&result.contacts.some(c=>c.normal[1]<-.65)){this.vertical=0;this.headHits++;this.events.push('ceiling-hit')}
      const descending=this.vertical<=0;
      // Root-motion displacement is NOT an IObject velocity observation.
      // Do not invent takeoff momentum by multiplying it by 60. Our minimal
      // carrier starts at rest and consumes only the proven impulse request.
      if(!airborne)this.horizontal=[0,0];
      this.position=result.position;this.grounded=result.grounded;if(this.grounded&&descending)this.vertical=0;
      d.collisionResolved(this.grounded,descending,wasGrounded);
      for(const event of d.events)if(!this.events.includes(event))this.events.push(event);
      if(state.events.includes('land'))this.landings++;
      this.lastCollision={contacts:result.contacts,substeps:result.substeps,stepped:result.stepped};
      this.maxHeight=Math.max(this.maxHeight,this.position[1]);
      if(this.history.length<6000)this.history.push({x,z,walk,jump,cameraYaw});
      return this.snapshot();
    }
    snapshot(){return {...this.driver.snapshot(),position:this.position.slice(),heading:this.heading,vertical:this.vertical,grounded:this.grounded,
      horizontal_velocity:this.horizontal.slice(),events:this.events.slice(),last_collision:this.lastCollision,
      jumps:this.jumps,landings:this.landings,head_hits:this.headHits,max_height:this.maxHeight,
      history_complete:this.history.length===this.driver.steps}}
  }
  return Object.freeze({Simulation,nativeRows,displayVector,moduleSource:playSimulation.toString()});
});
