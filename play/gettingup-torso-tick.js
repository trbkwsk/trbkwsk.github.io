/* Bounded TorsoIK diagnostic producer. With gettingup-torso-hierarchy.js,
 * full-skeleton world/skin poses pass the two declared native episodes.
 * Internal cache fields are NOT fully matched at the declared tolerance.
 * Only the opt-in torso-pose page uses this path; not full gameplay fidelity.
 * Original producer formula, rigid affine inputs and SSE threshold zero.
 * dt is the variable Tick input, NOT the actor's fixed-step Interp amount.
 * Declared character/model links remain outside this portable controller.
 */
(function(root,factory){const node=typeof module==='object'&&module.exports;
  const A=node?require('./gettingup-animation.js'):root.GettingUpAnimation;
  const T=node?require('./gettingup-torso-target.js'):root.GettingUpTorsoTarget;
  const api=factory(A,T);if(node)module.exports=api;else root.GettingUpTorsoTick=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A,T){'use strict';
  const f=Math.fround,identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],xyz=m=>[...m.slice(0,3),...m.slice(4,7),...m.slice(8,11),...m.slice(12,15)];
  function affine(m){if(!Array.isArray(m)||m.length!==16||!m.every(Number.isFinite))throw Error('finite affine TorsoIK matrix required');return m.map(f)}
  function inverse(m){const r=identity();for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[4*i+j]=m[4*j+i];for(let j=0;j<3;j++)r[12+j]=f(-(r[j]*m[12]+r[4+j]*m[13]+r[8+j]*m[14]));return r}
  function quaternion(m){
    const r=[m.slice(0,3),m.slice(4,7),m.slice(8,11)],trace=r[2][2]+r[1][1]+r[0][0];let q=[0,0,0,0];
    if(trace>0){const s=Math.sqrt(trace+1),k=.5/s;q=[f((r[2][1]-r[1][2])*k),f((r[0][2]-r[2][0])*k),f((r[1][0]-r[0][1])*k),f(.5*s)]}
    else{const i=r[0][0]<r[1][1]?1:0,j0=r[i][i]<r[2][2]?2:i,j=(j0+1)%3,k=(j0+2)%3,s=Math.sqrt(r[j0][j0]-(r[k][k]+r[j][j])+1),factor=s===0?s:.5/s;q[j0]=f(.5*s);q[3]=f((r[k][j]-r[j][k])*factor);q[j]=f((r[j0][j]+r[j][j0])*factor);q[k]=f((r[j0][k]+r[k][j0])*factor)}
    return q;
  }
  let tables;
  function coreLookup(table,v,scale){const shifted=f(f(f(v)*f(scale))-f(.5)),i=A.nearestEven(shifted),t=f(f(shifted+f(.5))-f(i));if(i<0||i>=table.length-1)throw Error('Core lookup outside bounded domain');return f(f(t*table[i+1])+f(f(1-t)*table[i]))}
  function interpolate(a,b,t){
    a=a.map(f);b=b.map(f);t=f(t);if(a.every((x,i)=>x===b[i]))return a.slice();
    const products=a.map((x,i)=>f(x*b[i]));let dot=f(f(products[0]+products[1])+f(products[2]+products[3]));
    if(dot<0){b=b.map(x=>-x);dot=f(-dot)}
    let wa=f(1-t),wb=t;
    if(f(1-dot)>f(1e-6)){
      if(!tables){const acos=new Float32Array(2048),sine=new Float32Array(256);for(let i=0;i<2047;i++)acos[i]=f(Math.acos(f(i/2046)));for(let i=0;i<255;i++)sine[i]=f(Math.sin(f(i*f(Math.PI)/254)));tables={acos,sine}}
      const theta=coreLookup(tables.acos,dot,2046),reciprocal=f(1/coreLookup(tables.sine,theta,80.8507080078125));
      wa=f(coreLookup(tables.sine,f(f(1-t)*theta),80.8507080078125)*reciprocal);wb=f(f(t*theta)*reciprocal);
    }
    const q=a.map((x,i)=>f(f(x*wa)+f(b[i]*wb))),sq=q.map(x=>f(x*x)),norm=f(f(f(sq[0]+sq[1])+sq[2])+sq[3]);
    if(norm===0)return a.slice();const k=f(1/Math.sqrt(norm));return q.map(x=>f(x*k));
  }
  function quaternionMatrix(q){return f(q[3])===1?identity():A.originalPoseMatrix([q,[0,0,0]])}
  function automatic(world,mx,mz,running){
    const pi=f(Math.PI),twoPi=f(2*Math.PI),degree=f(.01745329238474369);
    let moving=Math.atan2(f(mx),f(mz));if(moving<0)moving+=twoPi;moving=f(moving);
    let facing=Math.atan2(world[8],world[10]);if(facing<0)facing+=twoPi;
    const wrap=v=>{while(v>pi)v-=twoPi;while(v<-pi)v+=twoPi;return v};
    const delta=Math.max(-f(Math.PI/2),Math.min(f(Math.PI/2),wrap(wrap(moving)-wrap(facing))));
    if(Math.abs(delta)<=degree)return null;
    const angle=wrap(facing)+Math.max(-f(Math.PI/3),Math.min(f(Math.PI/3),delta)),s=f(Math.sin(angle)),c=f(Math.cos(angle));
    const heading=[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];
    return A.originalMultiplyAffine(T.generate(identity(),0,running?15:5,1),heading);
  }
  class TorsoTick {
    constructor(){this.request=new T.Request(identity(),0,0);this.cache=identity();this.ramp=0;this.mode=0;this.weight=0;this.trace=null}
    step(op,boneWorld,inverseBind,characterWorld=identity()){
      if(!op||![0,1,2].includes(op.command)||!Number.isFinite(op.dt)||op.dt<0||op.dt>.5||![0,1].includes(op.turn)||![0,1].includes(op.type12)||![0,1].includes(op.running)||![-1,2].includes(op.bone))throw Error('bounded declared TorsoIK operation required');
      this.trace=null;
      const world=affine(characterWorld);this.request.enableTurn(op.turn);
      if(op.command===1)this.request.run(world,op.yaw,op.pitch,op.reverse);if(op.command===2)this.request.stop();
      if(op.bone<0)return this.snapshot();
      const local=A.originalMultiplyAffine(affine(inverseBind),affine(boneWorld)),limit=op.type12?2:f(.25);
      let turnTarget=null;
      if(!this.request.request&&this.request.turnEnabled){turnTarget=automatic(world,op.move_x,op.move_z,op.running);if(turnTarget)this.request.target=turnTarget}
      const active=Boolean(this.request.request||turnTarget);
      if(!active&&this.ramp<=0){this.cache=local;this.mode=0;this.weight=0;return this.snapshot()}
      this.ramp=active?Math.min(limit,f(this.ramp+f(op.dt))):Math.max(0,f(this.ramp-f(op.dt)));
      const inv=inverse(local),from=A.originalMultiplyAffine(inv,this.cache),to=A.originalMultiplyAffine(inv,active?this.request.target:local);
      const qfrom=quaternion(from),qto=quaternion(to),q=interpolate(qfrom,qto,f(.4)),qm=quaternionMatrix(q);
      this.trace={local:local.slice(),inverse:inv.slice(),from:from.slice(),to:to.slice(),qfrom:qfrom.slice(),qto:qto.slice(),qblend:q.slice(),quaternion_matrix:qm.slice()};
      this.cache=A.originalMultiplyAffine(local,qm);
      this.mode=3;this.weight=f(this.ramp/limit);return this.snapshot();
    }
    snapshot(){return {target:this.request.target.slice(),cache:this.cache.slice(),ramp:this.ramp,request:this.request.request,turn:this.request.turnEnabled,mode:this.mode,weight:this.weight}}
  }
  return Object.freeze({TorsoTick,automatic,inverse,identity,xyz,quaternion,interpolate,coreLookup,quaternionMatrix});
});
