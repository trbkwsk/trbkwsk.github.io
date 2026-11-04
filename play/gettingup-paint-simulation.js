/* OUR minimal wall painting around original pose/attachment resources.
 * Eligibility, alignment, projection and alpha coverage are NOT original
 * BSP, graffiti scoring, pressure, drips, ink simulation or full hand IK. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const S=node?require('./gettingup-climb-simulation.js'):root.GettingUpClimbSimulation;
 const D=node?require('./gettingup-paint-driver.js'):root.GettingUpPaintDriver;
 const B=node?require('./gettingup-play-simulation.js'):root.GettingUpPlaySimulation;
 const P=node?require('./gettingup-scene-placement.js'):root.GettingUpScenePlacement;
 const G=node?require('./gettingup-paint-surface.js'):root.GettingUpPaintSurface;
 const api=factory(S,D,B,P,G);if(node)module.exports=api;else root.GettingUpPaintSimulation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function paintSimulation(S,D,B,P,G){'use strict';
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 class Simulation extends S.Simulation{
  constructor(data,world,spawn,yaw,shape){
   super({...data,kind:'gettingup-world-climb-inputs'},world,spawn,yaw,shape);this.data=data;this.driver=new D.Driver(data);
   this.paintAnchor=null;this.panels=[];this.paintIndex=4;this.paintCooldown=0;this.heldV=false;this.paintEntries=0;this.paintExits=0;this.lastPaintHit=null;this.spraying=false;
  }
  itemMatrix(){
   if(!this.paintAnchor)return null;const item=this.driver.controller.attachment(1,true);if(!item)return null;
   const placement=P.actorPlacement(B.nativeRows(this.heading,this.position).flat());
   return P.multiply(P.multiply(placement,P.REFLECT),item.world);
  }
  step(input){
   const {x,z,walk,jump,cameraYaw,v,spray,fast}=input;
   if(![-1,0,1].includes(x)||![-1,0,1].includes(z)||![walk,jump,v,spray,fast].every(b=>typeof b==='boolean')||!Number.isFinite(cameraYaw)||Math.abs(cameraYaw)>1e7)throw Error('bounded raw MacBook inputs required');
   const wasPainting=!!this.paintAnchor;this.lastPaintHit=null;this.spraying=false;
   if(!v&&this.paintAnchor){this.paintAnchor=null;this.paintExits++}
   if(v&&!this.paintAnchor&&this.grounded&&this.driver.phase==='roam'){
    const frame=G.find(this.world,this.position,this.heading);
    if(frame){
     let panel=this.panels.find(p=>Math.hypot(...sub(p.frame.origin,frame.origin))<1&&dot(p.frame.normal,frame.normal)>.999);
     if(!panel&&this.panels.length<8){panel={id:this.panels.length,frame,grid:new G.Grid()};this.panels.push(panel)}
     if(panel){this.paintAnchor=panel;this.paintIndex=4;this.paintCooldown=12;this.paintEntries++;this.vertical=0;this.horizontal=[0,0];
      this.heading=Math.atan2(-frame.normal[0],-frame.normal[2]);}
    }
   }
   if(!this.paintAnchor){
    super.step(input);if(this.history.length)this.history[this.history.length-1]={...input};
    if(wasPainting)this.events.push('paint-exit');
    if(v&&!this.heldV&&!this.paintAnchor)this.events.push('paint-unavailable');
    this.heldV=v;return this.snapshot();
   }
   const panel=this.paintAnchor,frame=panel.frame;
   // OUR bounded wall approach correction, collision-resolved, never a
   // teleport or authored original player movement observation.
   const distance=dot(sub(this.position,frame.origin),frame.normal),correction=Math.max(-1,Math.min(1,32-distance));
   const resolved=this.world.advance(this.position,[frame.normal[0]*correction,-.12,frame.normal[2]*correction],this.shape,true);
   this.position=resolved.position;this.grounded=resolved.grounded;
   this.lastCollision={contacts:resolved.contacts,substeps:resolved.substeps,stepped:resolved.stepped};
   if(this.paintCooldown)this.paintCooldown--;
   if(!this.paintCooldown&&(x||z)){
    const row=Math.max(0,Math.min(2,Math.floor(this.paintIndex/3)-z)),col=Math.max(0,Math.min(2,this.paintIndex%3+x));
    this.paintIndex=row*3+col;this.paintCooldown=12;
   }
   const s=this.driver.step('idle',{paint:this.paintIndex});this.events=s.events.slice();
   if(!wasPainting)this.events.push('paint-enter');
   const matrix=this.itemMatrix();
   if(matrix){const nozzle=P.point(matrix,this.data.can.nozzle_proxy);this.lastPaintHit=G.project(this.world,frame,nozzle);
    if(this.lastPaintHit&&Math.abs(correction)<.01&&s.frame>=15&&!spray&&!fast)this.events.push('paint-ready');
    if((spray||fast)&&this.lastPaintHit&&Math.abs(correction)<.01){panel.grid.paint(this.lastPaintHit.u,this.lastPaintHit.v,fast);this.spraying=true;this.events.push(fast?'paint-fast':'paint-normal');if(panel.grid.samples%30===0)this.events.push('paint-stroke')}
   }
   if(!this.grounded){this.paintAnchor=null;this.paintExits++;this.events.push('paint-support-lost')}
   if(this.history.length<6000)this.history.push({...input});this.heldV=v;return this.snapshot();
  }
  snapshot(){return {...super.snapshot(),painting:!!this.paintAnchor,paint_index:this.paintIndex,paint_entries:this.paintEntries||0,paint_exits:this.paintExits||0,
   active_panel:this.paintAnchor?.id??null,paint_panels:(this.panels||[]).map(p=>({id:p.id,frame:JSON.parse(JSON.stringify(p.frame)),...p.grid.summary()})),
   paint_hit:this.lastPaintHit?JSON.parse(JSON.stringify(this.lastPaintHit)):null,spraying:!!this.spraying,
   can_world:this.itemMatrix(),originalPaintPhysics:false,originalSprayOffset:false}}
 }
 return Object.freeze({Simulation,moduleSource:paintSimulation.toString()});
});
