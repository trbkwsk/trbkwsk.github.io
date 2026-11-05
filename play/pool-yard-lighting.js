/* Authored source colours in a bounded night preview. The hemisphere model,
 * exposure, clear colour and key direction remain OUR renderer adapter.
 * Original shader constants/lightmaps/colour-space parity are not claimed.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpPoolLighting=api;
})(typeof globalThis!=='undefined'?globalThis:this,function poolLighting(){'use strict';
 const rgb=a=>Array.isArray(a)&&a.length===3&&a.every(v=>Number.isFinite(v)&&v>=0&&v<=1);
 function validate(data){
  const p=data?.preview,s=data?.source_properties,l=data?.source_parallel_light;
  if(data?.kind!=='pool-yard-night-presentation'||data.source_level!=='m01_hoo_tranes_hood_2'||p?.period!=='night'||
     !rgb(s?.scene_ambient)||!rgb(s?.static_ambient)||!rgb(s?.character_ambient)||!rgb(s?.player_additional_ambient)||
     !rgb(l?.color)||!Number.isFinite(l.intensity)||l.intensity<0||l.intensity>1||
     !Number.isFinite(s.far_clip)||s.far_clip<=0||s.far_clip>50000||
     !Number.isFinite(p.hemisphere_intensity)||p.hemisphere_intensity<0||p.hemisphere_intensity>.5||
     !Number.isFinite(p.exposure)||p.exposure<=0||p.exposure>1||p.fog!==null||p.sky_tone_mapping!==false||
     !Array.isArray(p.clear_color_srgb)||p.clear_color_srgb.length!==3||!p.clear_color_srgb.every(v=>Number.isInteger(v)&&v>=0&&v<=255)||
     p.sky_ambient_modulation!==false||typeof data.source_render_inputs?.url!=='string'||!/^\w{64}$/.test(data.source_render_inputs.sha256)||
     !Array.isArray(p.key_direction_display)||p.key_direction_display.length!==3||!p.key_direction_display.every(Number.isFinite)||
     !Array.isArray(data.sky)||data.sky.length!==6||new Set(data.sky.map(r=>r.name)).size!==6||!data.sky.every(r=>typeof r.name==='string'&&rgb(r.ambient)))throw Error('source-bound Pool Yard night configuration required');
  return data;
 }
 function configure(data,{scene,renderer,hemisphere,key,camera}){
  validate(data);const p=data.preview,s=data.source_properties,l=data.source_parallel_light;
  scene.fog=null;
  hemisphere.color.setRGB(...s.scene_ambient);hemisphere.groundColor.setRGB(...s.static_ambient);hemisphere.intensity=p.hemisphere_intensity;
  key.color.setRGB(...l.color);key.intensity=l.intensity;
  renderer.setClearColor((p.clear_color_srgb[0]<<16)|(p.clear_color_srgb[1]<<8)|p.clear_color_srgb[2]);
  renderer.toneMappingExposure=p.exposure;camera.far=s.far_clip;camera.updateProjectionMatrix();
  return {period:'night',source_parallel_light_id:l.id,source_parallel_intensity:l.intensity,
   hemisphere_intensity:hemisphere.intensity,exposure:renderer.toneMappingExposure,fog_enabled:false,
   authored_sky_layers:data.sky.length,original_lighting_shader_verified:false,preview_policy:true};
 }
 function sky(material,name,data){
  const row=data.sky.find(r=>r.name===name);if(!row||!rgb(row.ambient))throw Error('authored Pool Yard sky ambient required');
  // Preserve the authored texture. The previous extra ambient multiplier was
  // an unverified global darkening policy, not a recovered sky shader input.
  material.toneMapped=false;material.userData.poolYardSkyAmbient=row.ambient.slice();
  return material;
 }
 return Object.freeze({validate,configure,sky,moduleSource:poolLighting.toString()});
});
