/* Bounded original default Trane profile (native constructor f6b5=1).
 * Weapon/world/target helper effects and multi-candidate arbitration excluded.
 * The scene adapter supplies the separately verified Sns turn delivery.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpPoolNormalActions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function normalActions(){'use strict';
 const f=Math.fround;
 function candidates({punch=false,kick=false,use=false,jump=false,speed=0,angle=0,blocked=false,f724=false,stateCode=10}){
  if(![10,12,14,24,30].includes(stateCode)||!Number.isFinite(speed)||speed<0||!Number.isFinite(angle)||Math.abs(angle)>180)throw Error('bounded original default Trane action profile required');
  if(blocked)return [];
  const a=f(angle),moving=f(speed)>=f(.05),stalk=stateCode===24&&moving&&jump,rows=[];
  const add=(offset,on,p3,p4,p5)=>rows.push({offset,on:!!on,args:[p3,p4,p5]});
  // Optional Sns requests precede the four stalking dodges in the native list.
  if(f(speed)>=f(.8)&&!f724){
   add('32d2',use&&moving&&a>=-180&&a<0,4,3,5);
   add('32d4',use&&moving&&a>=0&&a<=180,4,3,5);
  }
  add('327e',stalk&&a>=-45&&a<=45,2,0,1);
  add('3280',stalk&&(a<=-135||a>=135),2,0,1);
  add('3282',stalk&&a>=-180&&a<0,2,0,1);
  add('3284',stalk&&a>=0&&a<=180,2,0,1);
  add('3298',punch,4,3,1);add('32b2',kick,4,3,1);
  return rows;
 }
 function selectLateral(v){
  if([v.punch,v.kick,v.use].filter(Boolean).length!==1)return null;
  // Historical lateral-only experiment. The scene now uses select() together
  // with the separately validated turn bridge; retain this bounded adapter.
  if(v.use&&!(Math.abs(v.angle)>45&&Math.abs(v.angle)<135))return null;
  const names={'32d2':'evade_left','32d4':'evade_right','3298':'punch','32b2':'kick'};
  return candidates(v).filter(r=>r.on&&names[r.offset]).map(r=>names[r.offset])[0]||null;
 }
 function select(v){
  if([v.punch,v.kick,v.use].filter(Boolean).length!==1)return null;
  const names={'32d2':'evade_left','32d4':'evade_right','3298':'punch','32b2':'kick'};
  return candidates(v).filter(r=>r.on&&names[r.offset]).map(r=>names[r.offset])[0]||null;
 }
 function rateAtTick(name,tick,previous){
  if(!Number.isInteger(tick)||tick< -32||tick>256||!Number.isFinite(previous)||previous<0||previous>4)throw Error('bounded original callback tick/rate required');
  if(name!=='evade_left'&&name!=='evade_right')return f(previous);
  if(tick===27||tick===64)return f(1.1);
  if(tick===36)return 1;
  if(tick===57)return f(1.3);
  return f(previous);
 }
 return Object.freeze({candidates,select,selectLateral,rateAtTick,moduleSource:normalActions.toString()});
});
