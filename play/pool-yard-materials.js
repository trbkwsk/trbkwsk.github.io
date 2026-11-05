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
 function overlay(material,T){
  const r=material.userData,name=(r?.stageTextures?.[0]||'').split(/[\\/]/).pop().toLowerCase();
  if(r?.mode!==1||!['pypoolcap01_m01','py_edging1_m01'].includes(name))return null;
  // Coplanar cosmetic overlays in the original pool mesh. Native depth bias
  // is not yet recovered: keep this bounded WebGL correction explicit.
  material.alphaTest=Math.max(material.alphaTest,.5/255);material.depthWrite=false;
  material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-2;
  r.poolYardVisualOverlay=true;material.needsUpdate=true;
  return {preview_depth_bias:true,original_depth_bias_verified:false,source_zwrite:r.zwrite};
 }
 return Object.freeze({apply,overlay,moduleSource:poolMaterials.toString()});
});
