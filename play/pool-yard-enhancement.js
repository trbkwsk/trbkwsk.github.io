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
  function create(THREE,scene,renderer,originalHemisphere,originalSun){
    let enhanced=false;const materials=new Map(),meshes=[];
    const fill=new THREE.HemisphereLight(0xcfe2e8,0x302b24,.62);fill.visible=false;scene.add(fill);
    const rim=new THREE.DirectionalLight(0xa8c8d8,.46);rim.position.set(-700,500,-900);rim.visible=false;scene.add(rim);
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
      meshes.forEach(mesh=>{mesh.castShadow=enhanced&&!/sky|cloud|sun|halo/i.test(mesh.name);mesh.receiveShadow=enhanced&&!/sky|cloud|sun|halo/i.test(mesh.name)});
      materials.forEach((saved,material)=>{
        const p=material.userData.poolYardEnhanced;
        if(enhanced&&p){if(typeof material.roughness==='number')material.roughness=p.roughness;if(typeof material.metalness==='number')material.metalness=p.metalness;if(typeof material.envMapIntensity==='number')material.envMapIntensity=1.15;}
        else{if(typeof saved.roughness==='number')material.roughness=saved.roughness;if(typeof saved.metalness==='number')material.metalness=saved.metalness;if(typeof saved.envMapIntensity==='number')material.envMapIntensity=saved.envMapIntensity;}
        material.needsUpdate=true;
      });
      return snapshot();
    }
    function snapshot(){return{mode:enhanced?'enhanced':'original',authored_remaster:true,materials:materials.size,shadow_meshes:meshes.filter(m=>m.castShadow).length,tone_mapping:enhanced?'ACESFilmic':'None'};}
    return{register,apply,snapshot,get enhanced(){return enhanced}};
  }
  return{classify,policy,create};
});
