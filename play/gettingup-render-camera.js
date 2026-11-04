/* Diagnostic EXE camera consumers: 4f21b0/4f2690/4f1cb0/50b18a.
 * Zero driver origin, perspective, explicit viewport and rigid affine inputs.
 * Math.tan/atan are bounded host intrinsics, not a general x87 libm emulator.
 * No live input, camera gameplay, depth-bias or GPU pixel parity claim.
 */
(function(root,factory){const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./gettingup-frame-coordinator.js'):root.GettingUpFrameCoordinator,
                   node?require('./gettingup-paint-rd24.js'):root.GettingUpPaintRD24);
 if(node)module.exports=api;else root.GettingUpRenderCamera=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(F,R){'use strict';
 const f=Math.fround,identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 function math(profile){
  if(profile==='rn64'){const a=F.arithmetic;return {...a,load:a.fromNumber,number:v=>typeof v==='number'?v:Number(v.n)*2**v.e,neg:v=>a.sub(0,v)}}
  if(profile==='rd24')return {load:x=>x,number:x=>x,add:(a,b)=>R.down(a+b),sub:(a,b)=>R.down(a-b),
   mul:(a,b)=>R.down(a*b),div:(a,b)=>R.down(a/b),store:R.down,neg:x=>-x};
  throw Error('known camera FP profile required');
 }
 function vector(v,n){if(!Array.isArray(v)||v.length!==n||!v.every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6))throw Error('bounded finite camera vector required');return v.map(f)}
 function affine(v){v=vector(v,16);if(v[3]!==0||v[7]!==0||v[11]!==0||v[15]!==1)throw Error('explicit affine padding required');return v}
 function inverseUnit(input,profile='rn64'){
  const m=affine(input),out=identity(),a=math(profile),{mul,add,neg,store}=a;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)out[4*i+j]=m[4*j+i];
  for(let j=0;j<3;j++){const p=[0,1,2].map(i=>mul(out[4*i+j],m[12+i]));
   out[12+j]=store(neg(j===0?add(add(p[2],p[0]),p[1]):add(add(p[2],p[1]),p[0])))}return out;
 }
 function multiply(left,right,profile='rn64'){
  left=vector(left,16);right=vector(right,16);const {mul,add,store}=math(profile),out=[];
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
   let v=mul(left[4*i],right[j]);for(let k=1;k<4;k++)v=add(v,mul(left[4*i+k],right[4*k+j]));out.push(store(v));
  }return out;
 }
 function affineSSE(left,right){
  left=affine(left);right=affine(right);const out=identity();
  for(let i=0;i<4;i++)for(let j=0;j<3;j++){
   const v=f(f(f(left[4*i]*right[j])+f(left[4*i+1]*right[4+j]))+f(left[4*i+2]*right[8+j]));
   out[4*i+j]=i===3?f(v+right[12+j]):v;
  }return out;
 }
 function projection(config,profile='rn64'){
  const {viewport,fov_y,near,far}=config;
  if(!Array.isArray(viewport)||viewport.length!==4||viewport.some(x=>!Number.isInteger(x)||x<0||x>8192)||viewport[2]<2||viewport[3]<2)throw Error('bounded positive integer viewport required');
  if(![fov_y,near,far].every(Number.isFinite)||fov_y<.1||fov_y>2.8||f(near)<=0||f(near)*5>=Math.min(f(far),65536))throw Error('bounded perspective parameters required');
  const {load,number,add,sub,mul,div,neg,store}=math(profile),w=viewport[2],h=viewport[3];
  const halfY=store(mul(f(fov_y),.5));
  const halfX=store(load(Math.atan(number(mul(load(Math.tan(halfY)),div(w,h))))));
  const dx=store(mul(mul(div(1,load(Math.tan(halfX))),sub(w,f(.1))),.5));
  const dy=store(mul(mul(div(1,load(Math.tan(halfY))),sub(h,f(.1))),.5));
  const cx=store(mul(w,.5)),cy=store(mul(h,.5)),iy=div(1,dy);
  const ix=store(div(1,dx)),ny=store(neg(iy)),bx=store(mul(div(-1,dx),cx)),by=store(mul(sub(h,cy),iy));
  const plane=(p,s,b)=>store(add(mul(p,s),b));
  const l=store(mul(plane(f(.05),ix,bx),5)),r=store(mul(plane(sub(w,f(.05)),ix,bx),5));
  const t=store(mul(plane(f(.05),ny,by),5)),b=store(mul(plane(sub(h,f(.05)),ny,by),5));
  const n=store(mul(f(near),5)),zfar=Math.min(f(far),65536),rx=div(1,sub(r,l)),ry=div(1,sub(t,b)),z=div(zfar,sub(zfar,n));
  const matrix=[store(mul(mul(rx,n),2)),0,0,0,0,store(mul(mul(ry,n),2)),0,0,
   store(neg(mul(add(l,r),rx))),store(neg(mul(add(b,t),ry))),store(z),1,0,0,store(neg(mul(z,n))),0];
  return {half_fov:[halfX,halfY],projection:matrix,near:f(near),far:zfar,viewport:[...viewport,0,1]};
 }
 function camera(config,profile='rn64'){
  const base=inverseUnit(config.world,profile),view=config.modifier?affineSSE(config.modifier,base):base;
  const result=projection(config,profile),position=inverseUnit(base,profile).slice(12,15);
  return {...result,view,c8:[...position,0],view_projection:multiply(view,result.projection,profile)};
 }
 function columns(matrix){return [0,1,2,3].map(j=>[0,4,8,12].map(i=>matrix[i+j]))}
 return Object.freeze({identity,inverseUnit,multiply,affineSSE,projection,camera,columns});
});
