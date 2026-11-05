/* Original GCore navigation turn primitive, for diagnostic use.
 * Intended facing and the forward vector are caller inputs. This does not
 * reproduce their game-state producers or the world's MoveRelative call.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpNavigationTurn=api;
})(typeof globalThis!=='undefined'?globalThis:this,function navigationTurn(){'use strict';
 const f=Math.fround,constants=Object.freeze({step:f(1/60),degreesToRadians:f(Math.PI/180),radiansToDegrees:f(180/Math.PI),pi:f(Math.PI),tau:f(2*Math.PI),minimumLengthSquared:f(.01),minimumControlSpeed:f(.1)});
 const vector=v=>{if(!Array.isArray(v)||v.length!==4||!v.every(Number.isFinite)||!v.map(f).every(Number.isFinite))throw Error('four finite native TVector lanes required');return v.map(f)};
 function queueFacing(intended,speed,negative=false,positive=false){
  if(!Number.isFinite(speed)||Math.abs(speed)>10000||typeof negative!=='boolean'||typeof positive!=='boolean')throw Error('bounded player turn request required');
  return {intended:vector(intended),offset:0,rate:f(f(speed)*constants.degreesToRadians),mode:negative?-1:Number(positive)};
 }
 function navigation({intended,forward,offset=0,rate,mode=0},profile='rn64'){
  if(!['rn64','rn24'].includes(profile))throw Error('explicit tested x87 arithmetic profile required');
  if(!Number.isFinite(rate)||Math.abs(rate)>200||!Number.isFinite(offset)||Math.abs(offset)>32||![-1,0,1].includes(mode))throw Error('bounded original navigation fields required');
  const op=profile==='rn24'?f:x=>x,a=vector(intended),b=vector(forward),r=f(rate);
  const lengthSquared=v=>op(op(op(v[0]*v[0])+op(v[1]*v[1]))+op(v[2]*v[2]));
  const normalize=v=>{const n=lengthSquared(v);if(n===0)return [0,0,0];const inv=op(1/op(Math.sqrt(n)));return v.slice(0,3).map(x=>f(op(x*inv)))};
  if(r===0||lengthSquared(a)<=constants.minimumLengthSquared)return {issued:false,pan:0,rate:r,resetIntended:false};
  const n=normalize(a),g=normalize([b[0],0,b[2],0]);
  // The dot and cross are stored as floats before the original clamped acos.
  const dot=f(op(op(op(n[1]*g[1])+op(g[0]*n[0]))+op(n[2]*g[2])));
  const cross=f(op(op(n[2]*g[0])-op(n[0]*g[2])));
  let delta=op(Math.acos(Math.max(-1,Math.min(1,dot))));
  if(cross<0)delta=op(-delta);
  delta=op(delta+f(offset));
  while(delta < -constants.pi)delta=op(delta+constants.tau);
  while(delta > constants.pi)delta=op(delta-constants.tau);
  if(mode<0&&delta>0)delta=op(delta-constants.tau);
  else if(mode>0&&delta<0)delta=op(delta+constants.tau);
  const limit=op(r*constants.step),resetIntended=Math.abs(limit)>Math.abs(delta);
  // Equality takes the limit branch and deliberately does NOT reset facing.
  const angle=resetIntended?delta:(delta<=0?-f(limit):f(limit));
  return {issued:true,pan:f(op(angle*constants.radiansToDegrees)),rate:0,resetIntended};
 }
 function snsRequest(tick,relativeFacingAngle){
  if(!Number.isInteger(tick)||tick< -32||tick>256||!Number.isFinite(relativeFacingAngle)||Math.abs(relativeFacingAngle)>181)throw Error('bounded native Sns tick and facing angle required');
  return tick<5&&relativeFacingAngle!==0;
 }
 function relativeFacingAngle(intended,reference,profile='rn64'){
  if(!['rn64','rn24'].includes(profile))throw Error('explicit tested x87 arithmetic profile required');
  const op=profile==='rn24'?f:x=>x,a=vector(intended),b=vector(reference);
  if(a.slice(0,3).every(x=>x===0))return 0;
  const normalize=v=>{const length=op(op(op(v[0]*v[0])+op(v[1]*v[1]))+op(v[2]*v[2]));if(length===0)return [0,0,0];const inv=op(1/op(Math.sqrt(length)));return v.slice(0,3).map(x=>f(op(x*inv)))};
  const n=normalize(a),g=normalize(b);
  const dot=f(op(op(op(n[1]*g[1])+op(g[2]*n[2]))+op(n[0]*g[0])));
  let angle=op(Math.acos(Math.max(-1,Math.min(1,dot))));
  if(angle!==0&&op(op(n[2]*g[0])-op(n[0]*g[2]))<0)angle=op(-angle);
  return f(op(angle*constants.radiansToDegrees));
 }
 function controlFacing(x,z,rows,profile='rn64',sse=false){
  if(![x,z].every(Number.isFinite)||!Array.isArray(rows)||rows.length!==16||!rows.every(Number.isFinite)||!['rn64','rn24'].includes(profile)||typeof sse!=='boolean')throw Error('finite native control matrix and explicit profile required');
  const op=profile==='rn24'?f:a=>a,v=[f(x),0,f(z)];
  const length=op(op(v[0]*v[0])+op(v[2]*v[2]));
  if(length===0)v[2]=1;
  else{const inv=op(1/op(Math.sqrt(length)));v[0]=f(op(v[0]*inv));v[2]=f(op(v[2]*inv))}
  // Only the three defined vector components are used by navigation. The
  // source API copies a fourth stack lane whose provenance is not modeled.
  return [0,1,2].map(i=>{
   const x=f(rows[i])*v[0],y=f(rows[4+i])*v[1],z=f(rows[8+i])*v[2];
   if(sse)return f(f(f(x)+f(y))+f(z));
   return f(i===0?op(op(op(y)+op(z))+op(x)):op(op(op(y)+op(x))+op(z)));
  });
 }
 function maintainIntended({enabled,player,categories,speed,x,z,rows,previous,forward,sse=false},profile='rn64'){
  if(typeof enabled!=='boolean'||typeof player!=='boolean'||typeof categories!=='boolean'||!Number.isFinite(speed)||speed<0)throw Error('explicit prepared state-manager queries required');
  let intended=vector(previous).slice(0,3),reset=false,set=false;
  if(enabled){
   if(player&&categories){intended=vector(forward).slice(0,3);reset=true}
   if(f(speed)>constants.minimumControlSpeed){intended=controlFacing(x,z,rows,profile,sse);set=true}
  }
  return {intended,reset,set};
 }
 return Object.freeze({constants,queueFacing,navigation,snsRequest,relativeFacingAngle,controlFacing,maintainIntended,moduleSource:navigationTurn.toString()});
});
