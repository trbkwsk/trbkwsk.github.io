/* Original nozzle formulas, separate from item placement and animation.
 * Inputs are original-space row-vector matrices, not reflected GLTF space.
 * Only xyz is defined; the copied/temporary fourth lane is not geometry.
 */
(function(root,factory){if(typeof module==='object')module.exports=factory(require('./gettingup-paint-rd24.js').down);
 else root.GettingUpPaintNozzle=factory(root.GettingUpPaintRD24.down);
})(typeof globalThis!=='undefined'?globalThis:this,function(down){'use strict';
 const f=Math.fround;
 function point(world,bonePosition,offset,attachment=[0,0,0],profile='rn64'){
  if(!['rn64','rd24'].includes(profile))throw Error('unknown x87 profile');
  for(const [v,n] of [[world,16],[bonePosition,3],[offset,3],[attachment,3]])
   if(v.length!==n||!Array.from(v).every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6))throw Error('bounded finite matrix/vector required');
  world=Array.from(world,f);bonePosition=Array.from(bonePosition,f);offset=Array.from(offset,f);attachment=Array.from(attachment,f);
  const rd=profile==='rd24',r=rd?down:x=>x;
  // The scalar vector helper evaluates X,Z,Y; point helper uses X,Y,Z,T.
  const delta=[0,1,2].map(i=>f(r(r(r(world[i]*offset[0])+r(world[i+8]*offset[2]))+r(world[i+4]*offset[1]))));
  return {nozzle:delta.map((d,i)=>f(r(bonePosition[i]+d))),attachment:[0,1,2].map(i=>f(r(r(r(r(world[i]*attachment[0])+r(world[i+4]*attachment[1]))+r(world[i+8]*attachment[2]))+world[i+12])))};
 }
 return Object.freeze({point});
});
