/* Authored remaster presentation for the Pool Yard preview.
 * This is deliberately separate from recovered game data. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.PoolYardEnhancement=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
  const METAL=/(fence|gate|rail|lightpost|sewer|cap|paintcan|bridge)/i;
  const GLASS=/(glass|window)/i;
  const FOLIAGE=/(tree|weed|grass|leaf|bush)/i;
  const CONCRETE=/(pool|cement|building|bldg|knoll|roof|booth|wall|sect)/i;
  function classify(name,context){
    const value=String(name||'');
    if(context==='actor')return /head/i.test(value)?'skin':'fabric';
    if(context==='can')return'metal';
    if(GLASS.test(value))return'glass';
    if(FOLIAGE.test(value))return'foliage';
    if(METAL.test(value))return'metal';
    if(CONCRETE.test(value))return'concrete';
    return'generic';
  }
  function policy(kind){
    return({metal:{roughness:.38,metalness:.62},glass:{roughness:.16,metalness:0},foliage:{roughness:.9,metalness:0},
      concrete:{roughness:.86,metalness:0},skin:{roughness:.58,metalness:0},fabric:{roughness:.78,metalness:0},
      generic:{roughness:.74,metalness:0}})[kind]||null;
  }
  function wetPaintPolicy(){return{shininess:82,specular:0xcfe5ee};}
  function comparisonFilename(step){return`pool-yard-original-enhanced-step-${Math.max(0,Math.trunc(Number(step)||0))}.png`;}
  function create(THREE,scene,renderer,originalHemisphere,originalSun){
    let enhanced=false;const materials=new Map(),meshes=[],paintMaterials=new Map();
    const fill=new THREE.HemisphereLight(0xcfe2e8,0x302b24,.62);fill.visible=false;scene.add(fill);
    const rim=new THREE.DirectionalLight(0xa8c8d8,.46);rim.position.set(-700,500,-900);rim.visible=false;scene.add(rim);
    const contactCanvas=document.createElement('canvas');contactCanvas.width=128;contactCanvas.height=128;
    const contactContext=contactCanvas.getContext('2d'),gradient=contactContext.createRadialGradient(64,64,4,64,64,62);
    gradient.addColorStop(0,'rgba(0,0,0,.72)');gradient.addColorStop(.42,'rgba(0,0,0,.32)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    contactContext.fillStyle=gradient;contactContext.fillRect(0,0,128,128);
    const contactTexture=new THREE.CanvasTexture(contactCanvas);
    const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(58,38),new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,opacity:.42,toneMapped:false}));
    contactShadow.rotation.x=-Math.PI/2;contactShadow.renderOrder=3;contactShadow.visible=false;scene.add(contactShadow);
    function register(root,context){
      root.traverse(node=>{
        if(!node.isMesh)return;meshes.push(node);
        const list=Array.isArray(node.material)?node.material:[node.material];
        list.filter(Boolean).forEach(material=>{
          if(!materials.has(material))materials.set(material,{roughness:material.roughness,metalness:material.metalness,envMapIntensity:material.envMapIntensity});
          const p=policy(classify(`${node.name} ${material.name}`,context));
          if(p){material.userData.poolYardEnhanced=p;}
        });
      });
    }
    function apply(value){
      enhanced=!!value;
      renderer.shadowMap.enabled=enhanced;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.toneMapping=enhanced?THREE.ACESFilmicToneMapping:THREE.NoToneMapping;
      renderer.toneMappingExposure=enhanced?1.08:1;
      // Three r128 changes light units when physicallyCorrectLights is enabled;
      // keep legacy units so Original/Enhanced remain exposure-comparable.
      renderer.physicallyCorrectLights=false;
      scene.background.setHex(enhanced?0x778589:0x596363);
      originalHemisphere.intensity=enhanced?.78:1.1;originalSun.intensity=enhanced?2.45:1;
      fill.visible=enhanced;rim.visible=enhanced;
      originalSun.castShadow=enhanced;
      originalSun.shadow.mapSize.set(2048,2048);originalSun.shadow.camera.left=-1150;originalSun.shadow.camera.right=1150;
      originalSun.shadow.camera.top=1150;originalSun.shadow.camera.bottom=-1150;originalSun.shadow.camera.near=50;originalSun.shadow.camera.far=3600;
      originalSun.shadow.bias=-.00035;originalSun.shadow.normalBias=.65;
      contactShadow.visible=false;
      meshes.forEach(mesh=>{mesh.castShadow=enhanced&&!/sky|cloud|sun|halo/i.test(mesh.name);mesh.receiveShadow=enhanced&&!/sky|cloud|sun|halo/i.test(mesh.name)});
      materials.forEach((saved,material)=>{
        const p=material.userData.poolYardEnhanced;
        if(enhanced&&p){if(typeof material.roughness==='number')material.roughness=p.roughness;if(typeof material.metalness==='number')material.metalness=p.metalness;if(typeof material.envMapIntensity==='number')material.envMapIntensity=1.15;}
        else{if(typeof saved.roughness==='number')material.roughness=saved.roughness;if(typeof saved.metalness==='number')material.metalness=saved.metalness;if(typeof saved.envMapIntensity==='number')material.envMapIntensity=saved.envMapIntensity;}
        material.needsUpdate=true;
      });
      return snapshot();
    }
    function updateActor(position,grounded){
      if(!position)return;
      originalSun.position.set(position[0]+600,position[1]+1600,position[2]+300);
      originalSun.target.position.set(position[0],position[1]+35,position[2]);originalSun.target.updateMatrixWorld();
      rim.position.set(position[0]-700,position[1]+500,position[2]-900);rim.target.position.copy(originalSun.target.position);rim.target.updateMatrixWorld();
      contactShadow.position.set(position[0],position[1]+.18,position[2]);contactShadow.visible=enhanced&&!!grounded;
    }
    function updatePaint(tagRenderer){
      if(!tagRenderer)return;const active=new Set();
      for(const record of tagRenderer.records.values())for(const mesh of record.drips.values()){
        active.add(mesh);let saved=paintMaterials.get(mesh);
        if(enhanced&&!saved){
          const original=mesh.material,wetPolicy=wetPaintPolicy(),wet=new THREE.MeshPhongMaterial({map:original.map,color:original.color.clone(),transparent:true,
            opacity:original.opacity,depthWrite:false,side:original.side,polygonOffset:true,polygonOffsetFactor:original.polygonOffsetFactor,
            polygonOffsetUnits:original.polygonOffsetUnits,shininess:wetPolicy.shininess,specular:new THREE.Color(wetPolicy.specular)});
          wet.blending=original.blending;wet.blendSrc=original.blendSrc;wet.blendDst=original.blendDst;
          wet.blendSrcAlpha=original.blendSrcAlpha;wet.blendDstAlpha=original.blendDstAlpha;
          mesh.material=wet;saved={original,wet};paintMaterials.set(mesh,saved);
        }else if(!enhanced&&saved){mesh.material=saved.original;saved.wet.dispose();paintMaterials.delete(mesh);}
      }
      for(const[mesh,saved]of paintMaterials)if(!active.has(mesh)){saved.original.dispose();paintMaterials.delete(mesh);}
    }
    function snapshot(){return{mode:enhanced?'enhanced':'original',authored_remaster:true,materials:materials.size,shadow_meshes:meshes.filter(m=>m.castShadow).length,
      contact_shadow:enhanced,wet_paint_materials:paintMaterials.size,tone_mapping:enhanced?'ACESFilmic':'None'};}
    return{register,apply,updateActor,updatePaint,snapshot,get enhanced(){return enhanced}};
  }
  return{classify,policy,wetPaintPolicy,comparisonFilename,create};
});
