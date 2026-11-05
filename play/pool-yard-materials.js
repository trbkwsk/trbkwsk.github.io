/* Original stored blend/depth flags. Shader lighting, depth bias, material
 * ordering and multi-texture composition remain separate RE questions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpPoolMaterials=api;
})(globalThis,function poolMaterials(){'use strict';
 function apply(material,T){
  const r=material.userData;
  if(!Number.isInteger(r?.mode)||typeof r.zwrite!=='boolean')throw Error('original material metadata required');
  const factors={ZERO:T.ZeroFactor,ONE:T.OneFactor,SRCALPHA:T.SrcAlphaFactor,INVSRCALPHA:T.OneMinusSrcAlphaFactor};
  if(r.blend!==null&&(!Array.isArray(r.blend)||r.blend.length!==2||r.blend.some(x=>factors[x]===undefined)))throw Error('unrecovered blend factor');
  material.depthWrite=r.zwrite;
  if(r.blend){material.transparent=true;material.blending=T.CustomBlending;material.blendEquation=T.AddEquation;material.blendEquationAlpha=T.AddEquation;
   [material.blendSrc,material.blendDst]=r.blend.map(k=>factors[k]);material.blendSrcAlpha=material.blendSrc;material.blendDstAlpha=material.blendDst;
  }
  material.needsUpdate=true;
  return {mode:r.mode,depth_write:material.depthWrite,blend:r.blend?.slice()||null,transparent:material.transparent};
 }
 return Object.freeze({apply,moduleSource:poolMaterials.toString()});
});
