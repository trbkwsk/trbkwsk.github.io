/* OUR reach query on actual render triangles. Not original ledge tags/BSP.
 * Requires a vertical face, a flat lip, and a complete standing footprint
 * either on top or safely beyond a narrow barrier. Never fabricates support.
 */
(function(root,factory){const C=typeof module==='object'&&module.exports?require('./gettingup-world-collision.js'):root.GettingUpWorldCollision;
 const api=factory(C);if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpLedgeQuery=api;
})(typeof globalThis!=='undefined'?globalThis:this,function ledgeQuery(C){'use strict';
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(v,n)=>v.map(x=>x*n),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const dist=(a,b)=>Math.hypot(...sub(a,b));
 function vector(v){if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw Error('finite XYZ query required');return v}
 function ray(world,a,b){
  const hit=world.ray(a,b);if(!hit.hit)return hit;
  const near=world.query(hit.point.map(v=>v-.002),hit.point.map(v=>v+.002));
  const triangle=near.find(t=>dist(C.pointTriangle(hit.point,t.a,t.b,t.c),hit.point)<.005);
  if(!triangle)return {...hit,hit:false};
  const n=triangle.normal,sign=dot(n,sub(b,a))>0?-1:1;return {...hit,normal:mul(n,sign)};
 }
 function supported(world,p,r){
  return [[0,0],[r,0],[-r,0],[0,r],[0,-r]].every(([x,z])=>{
   const hit=ray(world,[p[0]+x,p[1]+3,p[2]+z],[p[0]+x,p[1]-3,p[2]+z]);
   return hit.hit&&hit.normal[1]>.9&&Math.abs(hit.point[1]-p[1])<.5;
  });
 }
 function find(world,position,forward,palms,shape,requireReach=true){
  [position,forward,palms].forEach(vector);
  if(typeof requireReach!=='boolean'||!shape||!Number.isFinite(shape.radius)||!Number.isFinite(shape.height)||shape.radius<=0||shape.height<shape.radius*2||forward[1]!==0||Math.abs(Math.hypot(forward[0],forward[2])-1)>.001)throw Error('standing shape and unit horizontal facing required');
  const p=position,r=shape.radius,h=shape.height;
  const face=ray(world,add(p,[0,h*.65,0]),add(add(p,[0,h*.65,0]),mul(forward,65)));
  if(!face.hit||Math.abs(face.normal[1])>.35||dot(face.normal,forward)>-.8)return null;
  const inside=add(face.point,mul(forward,Math.max(8,r)));
  const top=ray(world,[inside[0],p[1]+h*2.25,inside[2]],[inside[0],p[1]+18,inside[2]]);
  if(!top.hit||top.normal[1]<.9)return null;
  const contact=[face.point[0],top.point[1],face.point[2]],dy=palms[1]-contact[1],gap=Math.hypot(palms[0]-contact[0],palms[2]-contact[2]);
  if(requireReach&&(Math.abs(dy)>14||gap>32))return null;
  // Verify the face really reaches this lip, rather than a different surface.
  const lipFace=ray(world,add(contact,mul(face.normal,5)).map((v,i)=>i===1?v-3:v),add(contact,mul(face.normal,-5)).map((v,i)=>i===1?v-3:v));
  if(!lipFace.hit||Math.abs(lipFace.normal[1])>.35||dist(lipFace.point,[contact[0],contact[1]-3,contact[2]])>1)return null;
  // Both hands need actual top material along the lip, even if it is too
  // narrow in the forward direction for standing (a climb-over barrier).
  const tangent=[-forward[2],0,forward[0]];
  for(const sign of [-1,1]){
   const at=add(inside,mul(tangent,r*sign));
   const handTop=ray(world,[at[0],contact[1]+3,at[2]],[at[0],contact[1]-3,at[2]]);
   if(!handTop.hit||Math.abs(handTop.point[1]-contact[1])>.5)return null;
  }
  const standing=add(contact,mul(forward,r+20));
  const destination=ray(world,[standing[0],contact[1]+4,standing[2]],[standing[0],contact[1]-h*2.5,standing[2]]);
  if(!destination.hit||destination.normal[1]<.9)return null;
  standing[1]=destination.point[1];
  if(!supported(world,standing,r))return null;
  standing[1]-=shape.footOffset||0;standing[1]+=.004;
  const clear=world.move(standing,[0,0,0],shape);
  if(dist(clear.position,standing)>.05)return null;
  const over=[standing[0],contact[1]-(shape.footOffset||0)+.004,standing[2]];
  if(dist(world.move(over,[0,0,0],shape).position,over)>.05)return null;
  return {contact,standing,outward:face.normal,landing_drop:contact[1]-destination.point[1],hand_gap:gap,hand_height_error:dy,originalLedgeQuery:false};
 }
 return Object.freeze({find,ray,supported,moduleSource:ledgeQuery.toString()});
});
