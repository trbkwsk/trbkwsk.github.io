/* Unit-duration animation-origin movement request, not resolved physics.
 * Root buffers are supplied by the resource-driven controller. Original
 * movement output is never an input. Numerical parity is separately tested.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const A=node?require('./gettingup-actor.js'):root.GettingUpActor;
  const api=factory(A);if(node)module.exports=api;else root.GettingUpCharacterMotion=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A){'use strict';
  const f=Math.fround;
  function vector(v,n){if(!Array.isArray(v)||v.length!==n||v.some(x=>!Number.isFinite(x)||Math.abs(x)>1e7))throw Error('bounded finite vector required');return v.map(f)}
  function rotationMatrix(q){
    const [x,y,z,w]=vector(q,4);if(w===1)return [[1,0,0],[0,1,0],[0,0,1]];
    const norm=x*x+y*y+z*z+w*w,s=norm?2/norm:1;
    return [[1-s*(y*y+z*z),s*(x*y-z*w),s*(x*z+y*w)],
      [s*(x*y+z*w),1-s*(x*x+z*z),s*(y*z-x*w)],
      [s*(x*z-y*w),s*(y*z+x*w),1-s*(x*x+y*y)]].map(row=>row.map(f));
  }
  const transform=(v,m)=>[0,1,2].map(i=>f(v[0]*m[0][i]+v[1]*m[1][i]+v[2]*m[2][i]));
  function fromRoot(root){
    if(!root?.snapshot?.[0]||!root?.target?.[0])throw Error('cycle-adjusted origin snapshot and target required');
    const old=vector(root.snapshot[0][0],4),oldT=vector(root.snapshot[0][1],3);
    const target=[vector(root.target[0][0],4),vector(root.target[0][1],3)];
    let [rotation,translation]=A.poseOperation(target,[old,oldT],true);
    if(rotation.slice(0,3).every(x=>Math.abs(x)<f(.0001)))rotation=[0,0,0,1];
    translation=transform(translation,rotationMatrix([-old[0],-old[1],-old[2],old[3]]));
    return {rotation,translation};
  }
  function toWorld(request,world,mask=0){
    const q=vector(request.rotation,4),t=vector(request.translation,3);
    if(!Array.isArray(world)||world.length!==4)throw Error('4x4 row-vector world matrix required');
    const m=world.map(row=>vector(row,4));
    if(!Number.isInteger(mask)||mask<0||mask>0x70000||(mask&~0x70000)!==0)throw Error('recovered XYZ mask bits only');
    for(let i=0;i<3;i++)if(mask&(0x10000<<i))t[i]=0;
    let yaw=q.slice(0,3).every(x=>x===0)?0:f(2*Math.acos(Math.min(1,Math.max(-1,q[3]))));if(q[1]<0)yaw=-yaw;
    return {translation:transform(t,m),yaw};
  }
  return Object.freeze({rotationMatrix,fromRoot,toWorld});
});
