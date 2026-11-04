/* Original hierarchy order with bounded numeric correction at world stage.
 * Inputs are declared targets/context; this is not their gameplay producer.
 */
(function(root,factory){const node=typeof module==='object'&&module.exports;
  const A=node?require('./gettingup-animation.js'):root.GettingUpAnimation,C=node?require('./gettingup-correction.js'):root.GettingUpCorrection;
  const api=factory(A,C);if(node)module.exports=api;else root.GettingUpCorrectionHierarchy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A,C){'use strict';
  const xyz=m=>[...m.slice(0,3),...m.slice(4,7),...m.slice(8,11),...m.slice(12,15)];
  function affine(m){if(!Array.isArray(m)||m.length!==16||!m.every(Number.isFinite))throw Error('finite affine hierarchy matrix required');return m.map(Math.fround)}
  function full(m){return [...m.slice(0,3),0,...m.slice(3,6),0,...m.slice(6,9),0,...m.slice(9,12),1]}
  function evaluate(bones,poses,inverseBind,plan){
    if(bones.length!==48||poses.length!==48||inverseBind.length!==48||!Array.isArray(plan.corrections)||plan.corrections.length>2)throw Error('bounded 48-bone hierarchy and correction plan required');
    const inverse=inverseBind.map(affine),targets=new Map();
    for(const p of plan.corrections){if(!Number.isInteger(p.bone)||p.bone<0||p.bone>=48||targets.has(p.bone)||![0,3,4].includes(p.mode)||!Number.isFinite(p.weight)||p.weight<0||p.weight>1)throw Error('unique bounded hierarchy correction required');targets.set(p.bone,{...p,matrix:affine(p.matrix)})}
    const context04=plan.context04==null?null:xyz(affine(plan.context04)),context10=xyz(affine(plan.context10));
    function build(flag){const result=[];
      for(let i=0;i<48;i++){
        const b=bones[i];if(!Number.isInteger(b.parent)||b.parent<-1||b.parent>=i||i===0&&b.parent!==-1||i>0&&b.parent===-1)throw Error('validated single-root parent-before-child hierarchy required');
        const pose=A.copyPose(poses[i]);if(b.parent>=0)pose[1]=pose[1].map((x,j)=>Math.fround(x+Math.fround(b.bindTranslation[j])));
        let current=i?A.originalMultiplyAffine(A.originalPoseMatrix(pose),result[b.parent]):A.originalPoseMatrix(pose);
        const target=targets.get(i);if(target?.mode&&target.weight!==0)current=full(C.apply({mode:target.mode,weight:target.weight,flag,bind:xyz(inverse[i]),correction:xyz(target.matrix),current:xyz(current),context04,context10}));
        result.push(current);
      }return result;
    }
    const world=build(0),skinWorld=build(1),skin=inverse.map((b,i)=>A.originalMultiplyAffine(b,skinWorld[i]));
    return {world,skinWorld,skin};
  }
  return Object.freeze({evaluate,xyz,full});
});
