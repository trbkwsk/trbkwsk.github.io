/* TorsoIK feedback experiment: original mode3 full-weight matrix bypass,
 * partial-weight row normalization and restoration of TARGET row scales.
 * The legacy bounded correction path remains unchanged for its accepted
 * prior proofs. This adapter is enabled only by the opt-in torso-pose page.
 */
(function(root,factory){const node=typeof module==='object'&&module.exports;
 const A=node?require('./gettingup-animation.js'):root.GettingUpAnimation,H=node?require('./gettingup-correction-hierarchy.js'):root.GettingUpCorrectionHierarchy,T=node?require('./gettingup-torso-tick.js'):root.GettingUpTorsoTick;
 const api=factory(A,H,T);if(node)module.exports=api;else root.GettingUpTorsoHierarchy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A,H,T){'use strict';
 const f=Math.fround;
 function finiteMatrix(m){if(!Array.isArray(m)||m.length!==16||!m.every(v=>Number.isFinite(v)&&Number.isFinite(f(v))))throw Error('finite float32 correction matrix required')}
 function normalizeRows(m){finiteMatrix(m);const out=m.slice(),scales=[];for(let i=0;i<3;i++){const row=m.slice(4*i,4*i+3),length=Math.sqrt((row[0]*row[0]+row[1]*row[1])+row[2]*row[2]);if(!length||!Number.isFinite(f(length)))throw Error('nonzero finite partial correction rows required');scales.push(f(length));for(let j=0;j<3;j++)out[4*i+j]=f(row[j]/length)}return {matrix:out,scales}}
 function consumer(bind,correction,current,weight,flag,context10=T.identity(),diagnostic={}){
  for(const m of [bind,correction,current,context10])finiteMatrix(m);
  if(!Number.isFinite(weight)||weight<0||weight>1||![0,1].includes(flag))throw Error('bounded mode3 weight and flag required');
  let target=A.originalMultiplyAffine(T.inverse(bind),correction);if(flag)target=A.originalMultiplyAffine(target,context10);
  if(f(weight)!==1||diagnostic.recomposeFull){const a=normalizeRows(current),b=normalizeRows(target),q=T.interpolate(T.quaternion(a.matrix),T.quaternion(b.matrix),f(weight)),scales=diagnostic.restoreCurrentScales?a.scales:b.scales;target=T.quaternionMatrix(q);for(let i=0;i<3;i++)for(let j=0;j<3;j++)target[4*i+j]=f(target[4*i+j]*scales[i])}
  return [...target.slice(0,12),...current.slice(12,16)];
 }
 function evaluate(bones,poses,inverseBind,plan){
  if(!Array.isArray(plan.corrections)||plan.corrections.length>1)throw Error('single declared TorsoIK correction required');
  const correction=plan.corrections[0];
  if(correction&&(correction.bone!==2||![0,3].includes(correction.mode)))throw Error('declared Spine mode0/3 required');
  if(!correction||correction.mode===0||correction.weight===0)return H.evaluate(bones,poses,inverseBind,plan);
  if(!Number.isFinite(correction.weight)||correction.weight<0||correction.weight>1||bones.length!==48||poses.length!==48||inverseBind.length!==48||plan.context04!=null||!Array.isArray(plan.context10)||plan.context10.length!==16||!plan.context10.every((v,i)=>f(v)===T.identity()[i]))throw Error('48 bones, absent context04 and identity context10 required');
  const bind=inverseBind.map(m=>{if(m.length!==16||!m.every(Number.isFinite))throw Error('finite original inverse-bind matrix required');return m.map(f)});
  function build(flag){const result=[];
   for(let i=0;i<48;i++){
    const b=bones[i];if(!Number.isInteger(b.parent)||b.parent<-1||b.parent>=i||i===0&&b.parent!==-1||i>0&&b.parent===-1)throw Error('single-root parent-before-child hierarchy required');
    const pose=A.copyPose(poses[i]);if(b.parent>=0)pose[1]=pose[1].map((x,j)=>f(x+f(b.bindTranslation[j])));
    let current=i?A.originalMultiplyAffine(A.originalPoseMatrix(pose),result[b.parent]):A.originalPoseMatrix(pose);
    if(i===2)current=consumer(bind[2],correction.matrix,current,correction.weight,flag);
    result.push(current);
   }return result;
  }
  const world=build(0),skinWorld=build(1),skin=bind.map((b,i)=>A.originalMultiplyAffine(b,skinWorld[i]));return {world,skinWorld,skin};
 }
 return Object.freeze({evaluate,consumer,normalizeRows,xyz:H.xyz,full:H.full});
});
