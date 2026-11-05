/* Bounded Sns input/navigation/movement bridge. Source math and event ticks;
 * the scene collision and the decision to enter Sns remain preview adapters.
 */
(function(root,factory){const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./gettingup-navigation-turn.js'):root.GettingUpNavigationTurn,node?require('./gettingup-core-matrix.js'):root.GettingUpCoreMatrix,node?require('./gettingup-character-motion.js'):root.GettingUpCharacterMotion);
 if(node)module.exports=api;else root.GettingUpPoolTurn=api;
})(typeof globalThis!=='undefined'?globalThis:this,function poolTurn(N,C,M){'use strict';
 const f=Math.fround;
 function worldRows(heading){const s=f(Math.sin(heading)),c=f(Math.cos(heading));return [c,0,s,0,0,1,0,0,-s,0,c,0,0,0,0,1]}
 const cameraRows=heading=>worldRows(heading);
 const forward=rows=>[rows[8],rows[9],rows[10],0];
 function applyPan(rows,degrees){
  if(!Array.isArray(rows)||rows.length!==16||!rows.every(Number.isFinite)||!Number.isFinite(degrees)||Math.abs(degrees)>361)throw Error('bounded native yaw placement required');
  if(degrees===0)return rows.slice();
  const radians=f(f(degrees)*N.constants.degreesToRadians),half=radians*.5;
  const q=[0,f(Math.sin(half)),0,f(Math.cos(half))],rotation=C.quaternionMatrix(q),out=rows.map(f);
  // Original 102de100 operation/store order, nine defined matrix lanes.
  for(let i=0;i<3;i++){
   const x=f(rows[4*i]),y=f(rows[4*i+1]),z=f(rows[4*i+2]);
   out[4*i]=f((y*rotation[4]+rotation[0]*x)+z*rotation[8]);
   out[4*i+1]=f((y*rotation[5]+z*rotation[9])+rotation[1]*x);
   out[4*i+2]=f((y*rotation[6]+rotation[2]*x)+z*rotation[10]);
  }
  return out;
 }
 class Bridge{
  constructor(heading){if(!Number.isFinite(heading))throw Error('finite initial heading required');this.rows=worldRows(heading);this.intended=forward(this.rows);this.rate=0;this.offset=0;this.mode=0;this.commands=0;this.applied=0;this.pan=0;this.rootPan=0;this.lastRequest=null}
  heading(){return Math.atan2(-this.rows[8],this.rows[10])}
  begin(input){
   if(![-1,0,1].includes(input.x)||![-1,0,1].includes(input.z)||!Number.isFinite(input.cameraYaw))throw Error('bounded scene control input required');
   const r=N.navigation({intended:this.intended,forward:forward(this.rows),offset:this.offset,rate:this.rate,mode:this.mode});
   this.pan=r.issued?r.pan:0;this.rate=r.rate;
   if(r.issued){this.rows=applyPan(this.rows,r.pan);this.applied++;if(r.resetIntended)this.intended=forward(this.rows)}
   // Native Sns flags 0x42 keep state switching disabled and match mask0x68.
   // The player query is true in this targetless browser character adapter.
   const u=N.maintainIntended({enabled:true,player:true,categories:true,speed:input.x||input.z?1:0,x:input.x,z:input.z,rows:cameraRows(input.cameraYaw),previous:this.intended,forward:forward(this.rows)});
   this.intended=[...u.intended,0];this.rootPan=0;return this.heading();
  }
  events(events){
   for(const[code,tick]of events)if(code===-4&&N.snsRequest(tick,N.relativeFacingAngle(this.intended,forward(this.rows)))){
    const q=N.queueFacing(this.intended,2000,false,false);this.offset=q.offset;this.rate=q.rate;this.mode=q.mode;this.commands++;
   }
  }
  motion(request){
   this.lastRequest=request;
   const v=M.toWorld(request,[0,1,2,3].map(i=>this.rows.slice(i*4,i*4+4)),0x20000);
   this.rootPan=f(v.yaw*N.constants.radiansToDegrees);
   return [-v.translation[0],0,v.translation[2]];
  }
  finish(){if(this.rootPan)this.rows=applyPan(this.rows,this.rootPan);return this.heading()}
  snapshot(){return {pan:this.pan,root_pan:this.rootPan,pending_rate:this.rate,commands:this.commands,applied:this.applied,intended:this.intended.slice(0,3),matrix_xyz:this.rows.filter((_,i)=>i%4<3).slice(0,9)}}
 }
 return Object.freeze({worldRows,cameraRows,applyPan,Bridge,moduleSource:poolTurn.toString()});
});
