/* Bounded original modes 3/4 on rigid raw xyz matrix rows, SSE threshold 0.
 * World-matrix consumer only, not a TorsoIK target/controller or generic IK.
 */
(function(root,factory){const node=typeof module==='object'&&module.exports;
  const A=node?require('./gettingup-animation.js'):root.GettingUpAnimation;
  const api=factory(A);if(node)module.exports=api;else root.GettingUpCorrection=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A){'use strict';
  const f=Math.fround;
  function matrix(m){if(!Array.isArray(m)||m.length!==12||!m.every(Number.isFinite))throw Error('twelve finite raw xyz matrix values required');return m.map(f)}
  function rotation(m){return [m.slice(0,3),m.slice(3,6),m.slice(6,9)]}
  function transpose(a){return a[0].map((_,i)=>a.map(r=>r[i]))}
  function multiply(a,b){return a.map(r=>[0,1,2].map(j=>r.reduce((s,x,k)=>s+x*b[k][j],0)))}
  function rigid(r){const p=multiply(r,transpose(r)),det=r[0][0]*(r[1][1]*r[2][2]-r[1][2]*r[2][1])-r[0][1]*(r[1][0]*r[2][2]-r[1][2]*r[2][0])+r[0][2]*(r[1][0]*r[2][1]-r[1][1]*r[2][0]);if(Math.abs(det-1)>1e-4||p.some((row,i)=>row.some((x,j)=>Math.abs(x-(i===j?1:0))>1e-4)))throw Error('rigid proper rotation correction domain required')}
  function quaternion(m){
    const tr=m[0][0]+m[1][1]+m[2][2];let q;
    if(tr>0){const s=Math.sqrt(tr+1)*2;q=[(m[2][1]-m[1][2])/s,(m[0][2]-m[2][0])/s,(m[1][0]-m[0][1])/s,s/4]}
    else{const d=[m[0][0],m[1][1],m[2][2]],i=d.indexOf(Math.max(...d)),j=(i+1)%3,k=(i+2)%3,s=Math.sqrt(1+m[i][i]-m[j][j]-m[k][k])*2;
      q=[0,0,0,0];q[i]=s/4;q[j]=(m[j][i]+m[i][j])/s;q[k]=(m[k][i]+m[i][k])/s;q[3]=(m[k][j]-m[j][k])/s}
    if(!q.every(Number.isFinite))throw Error('finite matrix quaternion required');return q;
  }
  function apply(input){
    if(![3,4].includes(input.mode)||!Number.isFinite(input.weight)||input.weight<0||input.weight>1||!Number.isInteger(input.flag)||input.flag<0||input.flag>0xffffffff)throw Error('bounded original correction mode/weight/context word required');
    const b=matrix(input.bind),c=matrix(input.correction),current=matrix(input.current),br=rotation(b),cr=rotation(c),mr=rotation(current);
    for(const r of [br,cr,mr])rigid(r);let target=multiply(transpose(br),cr);
    if(input.mode===4)target=multiply(multiply(target,br),mr);
    else{
      if(input.context04!==null&&input.context04!==undefined){const r=rotation(matrix(input.context04));rigid(r);target=multiply(target,r)}
      // Original 5307c0 tests only BYTE context[0], not the padded DWORD.
      if(input.flag&255){const r=rotation(matrix(input.context10));rigid(r);target=multiply(target,r)}
    }
    target=target.map(row=>row.map(f));const q=A.interpolate(quaternion(mr),quaternion(target),f(input.weight));
    const out=A.originalPoseMatrix([q,[0,0,0]]);return [out[0],out[1],out[2],out[4],out[5],out[6],out[8],out[9],out[10],...current.slice(9)];
  }
  return Object.freeze({apply,quaternion});
});
