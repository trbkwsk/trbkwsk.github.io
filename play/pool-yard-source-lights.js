/* Source records are exact; attenuation, gamma and glow occlusion below are
 * OUR bounded WebGL adapter. This is not a claim of D3D8 pixel equivalence. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpPoolSourceLights=api;
})(globalThis,function poolSourceLights(){'use strict';
 const finite=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
 function validate(data){
  if(data?.kind!=='pool-yard-source-render-inputs'||data.source_level!=='m01_hoo_tranes_hood_2'||
   !Array.isArray(data.lights)||data.lights.length!==150||new Set(data.lights.map(l=>l.id)).size!==150||
   !data.lights.every(l=>finite(l.position)&&finite(l.color)&&l.color.every(v=>v>=0&&v<=1)&&l.range>0&&Number.isInteger(l.range)&&l.intensity>=0&&Number.isFinite(l.intensity)&&l.flags===0&&l.mask_flags===3)||
   !Array.isArray(data.glows)||data.glows.length!==107||!data.glows.every(g=>finite(g.position)&&finite(g.color)&&g.size>0&&g.aspect>0&&g.alpha>=0&&g.alpha<=1&&g.frame===0&&!!data.textures?.[g.texture])||
   data.managed_vertices?.instances?.length!==130)throw Error('complete source Pool Yard render inputs required');
  return data;
 }
 function irradiance(p,n,data,config){
  const s=config.source_properties,l=config.source_parallel_light,k=config.preview.key_direction_display;
  const rgb=s.static_ambient.slice(),length=Math.hypot(...k),sun=Math.max(0,n.reduce((a,v,i)=>a+v*k[i],0)/length)*l.intensity;
  for(let i=0;i<3;i++)rgb[i]+=sun*l.color[i];
  for(const row of data.lights){
   const d=[-row.position[0]-p[0],row.position[1]-p[1],row.position[2]-p[2]],distance=Math.hypot(...d);
   if(distance>=row.range)continue;
   const cosine=distance>1e-6?Math.max(0,n.reduce((a,v,i)=>a+v*d[i],0)/distance):1;
   const weight=cosine*row.intensity*Math.pow(1-distance/row.range,2);
   for(let i=0;i<3;i++)rgb[i]+=row.color[i]*weight;
  }
  return rgb.map(v=>Math.min(1,Math.max(0,v)));
 }
 function basic(old,T,colors){
  const m=new T.MeshBasicMaterial({map:old.map,color:old.color,opacity:old.opacity,transparent:old.transparent,
   alphaTest:old.alphaTest,side:old.side,depthWrite:old.depthWrite,vertexColors:colors,toneMapped:false});
  for(const key of ['name','blending','blendSrc','blendDst','blendEquation','blendSrcAlpha','blendDstAlpha','blendEquationAlpha','depthTest','polygonOffset','polygonOffsetFactor','polygonOffsetUnits'])m[key]=old[key];
  m.userData={...old.userData,poolSourceLighting:true};return m;
 }
 function install({T,scene,world,objects,actor,can,camera,data,config,vertexBytes,textures}){
  validate(data);if(data.source_level_sha256!==config.source_level_sha256)throw Error('source lighting level mismatch');
  const bytes=new Uint8Array(vertexBytes);
  if(bytes.byteLength!==data.managed_vertices.bytes)throw Error('complete native vertex buffer required');
  const assigned=new Set(),p=new T.Vector3(),n=new T.Vector3(),normalMatrix=new T.Matrix3();let bakedVertices=0,computedVertices=0;
  world.updateMatrixWorld(true);objects.updateMatrixWorld(true);
  for(const row of data.managed_vertices.instances){
   const node=world.getObjectByName(row.node);if(!node)throw Error('native lighting node missing: '+row.node);
   const meshes=[];node.traverse(x=>{if(x.isMesh)meshes.push(x)});
   if(meshes.length!==row.blocks.length||row.offset<0||row.offset+row.count*4>bytes.length)throw Error('native lighting block mismatch');
   let at=row.offset;
   meshes.forEach((mesh,i)=>{
    if(mesh.geometry.attributes.position.count!==row.blocks[i])throw Error('native/GLB vertex count differs');
    const colors=new Float32Array(row.blocks[i]*3);
    for(let v=0;v<row.blocks[i];v++,at+=4){colors[v*3]=bytes[at+2]/255;colors[v*3+1]=bytes[at+1]/255;colors[v*3+2]=bytes[at]/255}
    // GLTF reuses geometry across instances. A private clone is essential.
    mesh.geometry=mesh.geometry.clone();mesh.geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    mesh.material=[].concat(mesh.material).map(m=>basic(m,T,true));if(mesh.material.length===1)mesh.material=mesh.material[0];
    assigned.add(mesh);bakedVertices+=row.blocks[i];
   });
   if(at!==row.offset+row.count*4)throw Error('native vertex buffer was not consumed exactly');
  }
  for(const root of [world,objects])root.traverse(mesh=>{
   if(!mesh.isMesh||assigned.has(mesh)||mesh.userData.previewSkybox)return;
   const mats=[].concat(mesh.material),unlit=mats.every(m=>[13,14,15].includes(m.userData.mode));
   if(!unlit){
    if(!mesh.geometry.attributes.normal)mesh.geometry.computeVertexNormals();
    const pos=mesh.geometry.attributes.position,nrm=mesh.geometry.attributes.normal,colors=new Float32Array(pos.count*3);
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for(let i=0;i<pos.count;i++){
     p.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);n.fromBufferAttribute(nrm,i).applyMatrix3(normalMatrix).normalize();
     colors.set(irradiance(p.toArray(),n.toArray(),data,config),i*3);
    }
    mesh.geometry=mesh.geometry.clone();mesh.geometry.setAttribute('color',new T.BufferAttribute(colors,3));computedVertices+=pos.count;
   }
   mesh.material=mats.map(m=>basic(m,T,!unlit));if(mesh.material.length===1)mesh.material=mesh.material[0];
  });
  // Static geometry now carries its own lighting. Ambient/near lights illuminate
  // the moving actor and item without tinting the whole world blue.
  const ambient=config.source_properties.character_ambient.map((v,i)=>v+config.source_properties.player_additional_ambient[i]);
  const fill=new T.AmbientLight(new T.Color(...ambient),1);scene.add(fill);
  for(const root of [actor,can])root.traverse(mesh=>{
   if(!mesh.isMesh)return;
   mesh.material=[].concat(mesh.material).map(old=>{
    const m=new T.MeshLambertMaterial({map:old.map,color:old.color,skinning:!!mesh.isSkinnedMesh,opacity:old.opacity,
     transparent:old.transparent,alphaTest:old.alphaTest,side:old.side,depthWrite:old.depthWrite,toneMapped:false});
    m.skinning=!!mesh.isSkinnedMesh;m.userData={...old.userData};return m;
   });if(mesh.material.length===1)mesh.material=mesh.material[0];
  });
  const points=Array.from({length:4},()=>{const light=new T.PointLight(0xffffff,0,1,2);scene.add(light);return light});
  const group=new T.Group();group.name='Original Pool Yard lamp glows';scene.add(group);
  const glows=data.glows.filter(g=>g.alpha>0).map(g=>{
   const texture=textures[g.texture];if(!texture)throw Error('source glow texture missing');
   const material=new T.SpriteMaterial({map:texture,color:new T.Color(...g.color),opacity:g.alpha,
    blending:T.AdditiveBlending,depthTest:true,depthWrite:false,toneMapped:false,rotation:g.angle});
   const sprite=new T.Sprite(material);sprite.scale.set(g.size*g.aspect,g.size,1);sprite.frustumCulled=true;group.add(sprite);
   return {source:g,sprite,position:new T.Vector3(-g.position[0],g.position[1],g.position[2]),visible:true};
  });
  const report={source_lights:data.lights.length,source_glows:data.glows.length,active_glows:glows.length,
   source_baked_instances:data.managed_vertices.instances.length,source_baked_vertices:bakedVertices,
   preview_computed_vertices:computedVertices,character_ambient:ambient,original_d3d_parity:false};
  let tick=0;const frustum=new T.Frustum(),viewProjection=new T.Matrix4(),sphere=new T.Sphere();
  function update(position,collider){
   const nearest=data.lights.map(l=>({l,d:Math.hypot(-l.position[0]-position[0],l.position[1]-position[1]-45,l.position[2]-position[2])}))
    .filter(x=>x.d<x.l.range).sort((a,b)=>(1-b.d/b.l.range)*b.l.intensity-(1-a.d/a.l.range)*a.l.intensity).slice(0,4);
   points.forEach((p,i)=>{const l=nearest[i]?.l;p.intensity=l?l.intensity:0;if(l){p.color.setRGB(...l.color);p.position.set(-l.position[0],l.position[1],l.position[2]);p.distance=l.range}});
   const check=!(tick++%6),rayCache=new Map();camera.updateMatrixWorld(true);
   frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
   for(const row of glows){const {source:g,sprite}=row,delta=camera.position.clone().sub(row.position),distance=delta.length();
    const pull=Math.min(Math.max(0,g.pull_distance),distance*.25);
    sprite.position.copy(row.position);if(distance>0)sprite.position.addScaledVector(delta,pull/distance);
    sphere.center.copy(sprite.position);sphere.radius=g.size*Math.max(1,g.aspect)*.75;
    if(!frustum.intersectsSphere(sphere)){sprite.visible=false;continue}
    if(check&&collider){const key=sprite.position.toArray().join(',');
     if(!rayCache.has(key)){const hit=collider.ray(camera.position.toArray(),sprite.position.toArray());rayCache.set(key,!hit.hit||hit.distance>=camera.position.distanceTo(sprite.position)-3)}
     row.visible=rayCache.get(key);
    }
    sprite.visible=row.visible;
    // Near fade avoids a full-screen sprite when approaching its source.
    sprite.material.opacity=g.alpha*(g.fade_distance>0?Math.min(1,distance/g.fade_distance):1);
   }
  }
  return {report,update,points,glows,group};
 }
 return Object.freeze({validate,irradiance,install,moduleSource:poolSourceLights.toString()});
});
