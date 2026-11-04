/* Original public RunTorsoIK target and request bytes, not TorsoIK tick.
 * Raw original matrix convention; no target-time or smoothing substitute.
 */
(function(root,factory){const node=typeof module==='object'&&module.exports,A=node?require('./gettingup-animation.js'):root.GettingUpAnimation;
  const api=factory(A);if(node)module.exports=api;else root.GettingUpTorsoTarget=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A){'use strict';
  const f=Math.fround,degree=f(.01745329238474369);
  function generate(world,yaw,pitch,reverse){
    if(!Array.isArray(world)||world.length!==16||!world.every(Number.isFinite)||!Number.isFinite(yaw)||!Number.isFinite(pitch)||Math.abs(yaw)>180||Math.abs(pitch)>180||![0,1,false,true].includes(reverse))throw Error('bounded original torso target inputs required');
    world=world.map(f);if(!world.every(Number.isFinite))throw Error('finite float32 world matrix required');const x=f(f(pitch)*degree),y=f(f(yaw)*degree),cx=f(Math.cos(x)),sx=f(Math.sin(x)),cy=f(Math.cos(y)),sy=f(Math.sin(y));
    const rx=[1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1],ry=[cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1];
    const w=world.slice();w[12]=w[13]=w[14]=0;w[3]=w[7]=w[11]=0;w[15]=1;
    return A.originalMultiplyAffine(A.originalMultiplyAffine(reverse?rx:ry,reverse?ry:rx),w);
  }
  class Request{
    constructor(target,request=0,turnEnabled=0){if(!Array.isArray(target)||target.length!==16||![request,turnEnabled].every(v=>Number.isInteger(v)&&v>=0&&v<=255))throw Error('complete target and raw request bytes required');this.target=target.slice();this.request=request;this.turnEnabled=turnEnabled}
    run(world,yaw,pitch,reverse){this.target=generate(world,yaw,pitch,reverse);this.request=1;return this.target.slice()}
    stop(){this.request=0}
    enableTurn(enabled){if(![0,1,false,true].includes(enabled))throw Error('typed EnableTurnIK bool required');this.turnEnabled=Number(enabled)}
  }
  return Object.freeze({generate,Request});
});
