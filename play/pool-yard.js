/* Separate Pool Yard sandbox using the shared verified animation/Tag primitives.
 * Original mission scripts are never loaded. Ladder/crawl/full engine remain open. */
/* OUR interactive bridge around sealed animation code and original local
 * assets. Geometry collisions/camera/input are diagnostic, not original AI
 * or BSP/runtime parity. Previous viewers and their episodes stay unchanged.
 */
(async function poolYardViewer(){'use strict';
  const $=id=>document.getElementById(id),P=GettingUpScenePlacement,D=GettingUpPaintDriver,
    C=GettingUpWorldCollision,S=GettingUpSpraySimulation;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x596363);
  const originalHemisphere=new THREE.HemisphereLight(0xd9e3df,0x50504a,1.1);scene.add(originalHemisphere);
  const sun=new THREE.DirectionalLight(0xfff4db,1);sun.position.set(600,1600,300);scene.add(sun);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputEncoding=THREE.sRGBEncoding;renderer.domElement.tabIndex=0;
  const enhancement=PoolYardEnhancement.create(THREE,scene,renderer,originalHemisphere,sun);
  renderer.domElement.setAttribute('aria-label','Сцена уровня: WASD, Space, Control, IJKL, Escape');$('view').appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(55,1,.5,12000);
  function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
  addEventListener('resize',resize);resize();
  const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  async function fetchBytes(url){
    const resolved=new URL(url,location.href);if(resolved.origin!==location.origin)throw Error('Игровые ресурсы должны оставаться локальными');
    const r=await fetch(resolved,{cache:'no-store'});if(!r.ok)throw Error(resolved.pathname+': HTTP '+r.status);return r.arrayBuffer();
  }
  const decoded=bytes=>JSON.parse(new TextDecoder().decode(bytes));
  const glb=bytes=>new Promise((resolve,reject)=>new THREE.GLTFLoader().parse(bytes,'',resolve,reject));
  let sandboxPlan;
  let ready=false,running=false,walk=false,driver,inputs,plan,worldPlan,inputProof,level,actor,world,can,canRoot,canPlacement,
    placement,bones,collider,capsule,spawnPosition,spawnYaw,actorRoot,levelRoot,executedJS,executedModules,sim;
  let position=[0,0,0],heading=0,vertical=0,grounded=false,cameraYaw=0,cameraPitch=.32,cameraDistance=185,accumulator=0;
  let jumpQueued=false,droppedSeconds=0,totalContacts=0,lastCollision=null,lastSnapshot;
  let tagRenderer;
  const pressed=new Set(),clock=new THREE.Clock(),cameraTarget=new THREE.Vector3(),cameraDesired=new THREE.Vector3();
  function nativeRows(){
    const x=-Math.sin(heading),z=Math.cos(heading);
    return [[z,0,-x,0],[0,1,0,0],[x,0,z,0],[-position[0],position[1],position[2],1]];
  }
  function updatePlacement(){placement.matrix.fromArray(P.actorPlacement(nativeRows().flat()));placement.matrixWorldNeedsUpdate=true}
  function applyPose(){
    driver.controller.poses().forEach(([q,t],i)=>{
      const offset=i?inputs.bones[i].bindTranslation:[0,0,0];bones[i].position.set(t[0]+offset[0],t[1]+offset[1],t[2]+offset[2]);
      bones[i].quaternion.set(-q[0],-q[1],-q[2],q[3]).normalize();
    });
    scene.updateMatrixWorld(true);paintVisuals();
  }
  function paintVisuals(){
    if(!sim||!canPlacement)return;
    const item=sim.itemMatrix();canPlacement.visible=!!item;
    if(item){canPlacement.matrix.fromArray(P.multiply(item,P.REFLECT));canPlacement.matrixWorldNeedsUpdate=true}
    if(tagRenderer){tagRenderer.update(sim.panels);enhancement.updatePaint(tagRenderer)}
    scene.updateMatrixWorld(true);
  }
  function cameraUpdate(dt=1,immediate=false){
    cameraTarget.set(position[0],position[1]+43,position[2]);
    const horizontal=cameraDistance*Math.cos(cameraPitch);
    cameraDesired.copy(cameraTarget).add(new THREE.Vector3(-Math.sin(cameraYaw)*horizontal,Math.sin(cameraPitch)*cameraDistance+20,-Math.cos(cameraYaw)*horizontal));
    if(collider){const ray=collider.ray(cameraTarget.toArray(),cameraDesired.toArray());
      if(ray.hit){const dir=cameraDesired.clone().sub(cameraTarget).normalize();cameraDesired.copy(cameraTarget).addScaledVector(dir,Math.max(0,ray.distance-7))}}
    if(immediate)camera.position.copy(cameraDesired);else camera.position.lerp(cameraDesired,1-Math.exp(-12*dt));
    if(collider){const final=collider.ray(cameraTarget.toArray(),camera.position.toArray());
      if(final.hit){const dir=camera.position.clone().sub(cameraTarget).normalize();camera.position.copy(cameraTarget).addScaledVector(dir,Math.max(0,final.distance-3))}}
    camera.lookAt(cameraTarget);
  }
  function reset(keepPaint=true){
    const kept=keepPaint&&sim?sim.panels.slice():[],random=keepPaint&&sim?sim.rng:null;
    if(!keepPaint&&tagRenderer)tagRenderer.clear();
    running=false;pressed.clear();walk=false;jumpQueued=false;sim=new S.Simulation(inputs,collider,spawnPosition,spawnYaw,capsule);driver=sim.driver;position=spawnPosition.slice();heading=spawnYaw;
    if(kept.length){sim.panels=kept;sim.rng=random}
    vertical=0;grounded=false;droppedSeconds=0;totalContacts=0;lastCollision=null;accumulator=0;$('fatal').textContent='';
    cameraYaw=spawnYaw;cameraPitch=.32;cameraDistance=185;updatePlacement();applyPose();cameraUpdate(1,true);refresh();
  }
  function refresh(){
    if(!ready)return;const s=driver.snapshot(),distance=Math.hypot(position[0]-spawnPosition[0],position[2]-spawnPosition[2]);
    $('start').textContent=running?'Пауза':'Начать прогулку';$('walk').textContent='Режим: '+(walk?'ходьба':'бег');
    const labels={idle:'ожидание',walk:'ходьба',run:'бег',stand_takeoff:'отрыв стоя',run_takeoff:'отрыв с разбега',stand_air:'полёт',run_air:'полёт с разбега',stand_land:'приземление',run_land:'приземление с разбега',ledge_grab:'захват уступа',ledge_hang:'вис на уступе',ledge_up:'подъём на уступ',...Object.fromEntries(Array.from({length:9},(_,i)=>['paint_'+i,'рисование · '+inputs.paint_phases['paint_'+i].sequence.replace('Aerosol_Stand_','')]))};
    $('stats').textContent='Действие: '+labels[s.mode]+' · кадр '+s.frame.toFixed(2)+'\n'+
      'Шагов: '+s.steps+' · от spawn: '+distance.toFixed(1)+'\n'+
      'Опора: '+(grounded?'есть':'нет')+' · Y: '+position[1].toFixed(2)+'\n'+
      'Прыжков: '+sim.jumps+' · посадок: '+sim.landings+'\n'+
      'Захватов: '+sim.grabs+' · подъёмов с опорой: '+sim.climbs+'\n'+
      'Краска: '+sim.panels.reduce((n,p)=>n+p.grid.summary().painted_pixels,0)+' узлов · '+(sim.spraying?'подача':'без подачи')+'\n'+
      'Треугольников: '+collider.triangles.length+' · костей: '+bones.length+'\nRNG вызовов: '+sim.rng.calls+' · state '+sim.rng.state;
    $('focusHint').textContent=running?'WASD — движение · у стены держи V · U/O — краска · WASD — поза кисти':'Уровень на паузе. Можно продолжить или сделать один шаг.';
    lastSnapshot={schema:1,kind:'gettingup-pool-yard-browser',running,steps:s.steps,mode:s.mode,frame:s.frame,
      position:position.slice(),spawn_position:spawnPosition.slice(),heading,grounded,vertical,
      ...sim.snapshot(),phase:s.phase,pending_phase:s.pending,launched:s.launched,style:s.style,events:sim.events.slice(),
      jumps:sim.jumps,landings:sim.landings,head_hits:sim.headHits,horizontal_velocity:sim.horizontal.slice(),
      total_collision_contacts:totalContacts,last_collision:lastCollision,
      input_history:sim.history.slice(),history_complete:sim.history.length===s.steps,dropped_seconds:droppedSeconds,
      capsule:{...capsule},camera:camera.position.toArray(),camera_target:cameraTarget.toArray(),
      model_sha256:plan.model_sha256,level_sha256:plan.level_sha256,world_sha256:worldPlan.world_sha256,
      local_inputs_sha256:inputProof.local_sidecar_sha256,tag_inputs_sha256:inputs.tagProofSHA,executed_js_sha256:executedJS,
      executed_modules_sha256:executedModules,controller_config_sha256:inputs.controllerProofSHA,
      actor_placement:placement.matrixWorld.elements.slice(),actual_bone_world:bones.map(b=>b.matrixWorld.elements.slice()),
      actual_bone_local:bones.map(b=>({quaternion:b.quaternion.toArray(),position:b.position.toArray()})),
      original_reflections_preserved:[actorRoot,levelRoot].every(n=>JSON.stringify(n.scale.toArray())==='[-1,1,1]'),
      triangle_collision_original_bsp:false,original_player_state_selection:false,live_game_runtime_verified:false,
      original_world_jump_physics_verified:false,original_ledge_physics_verified:false,hand_anchor_full_ik:false,
      climb_capsule:{...sim.climbShape},can_sha256:inputProof.can.sha256,
      actual_can_world:canPlacement.visible?canRoot.matrixWorld.elements.slice():null,
      actual_tag_panels:tagRenderer?tagRenderer.capture(sim.panels):[],
      can_reflection_preserved:JSON.stringify(canRoot.scale.toArray())==='[-1,1,1]',
      native_tag_math_verified:true,native_tag_caller_verified:false,native_d3d_verified:false,original_paint_physics_verified:false,full_remaster_complete:false,basic_actions_connected:true,
      source_level:sandboxPlan.identity.source_level,source_tagging_areas:sandboxPlan.tagging_areas.length,source_ladders:sandboxPlan.ladders.length,
      mission_scripts_enabled:false,mission_completion_required:false,complete_sandbox_verified:false,
      presentation:enhancement.snapshot(),
      pending_actions:['ladder','crawl','full-animation-selection','authored-graffiti-zones','original-BSP','lighting-parity']};
    $('diagnostics').value=JSON.stringify(lastSnapshot);
  }
  function fixed(){
    // Saved MacBook bindings; angular rates are OUR diagnostic camera policy.
    cameraYaw+=(Number(pressed.has('KeyJ'))-Number(pressed.has('KeyL')))*1.6/60;
    cameraPitch=Math.max(-.12,Math.min(1.15,cameraPitch+(Number(pressed.has('KeyI'))-Number(pressed.has('KeyK')))*1.2/60));
    const x=Number(pressed.has('KeyD'))-Number(pressed.has('KeyA')),z=Number(pressed.has('KeyW'))-Number(pressed.has('KeyS'));
    const state=sim.step({x,z,walk,jump:jumpQueued,cameraYaw,v:pressed.has('KeyV'),spray:pressed.has('KeyU'),fast:pressed.has('KeyO')});jumpQueued=false;
    position=state.position;heading=state.heading;vertical=state.vertical;grounded=state.grounded;
    lastCollision=state.last_collision;totalContacts+=lastCollision.contacts.length;
    if(position[1]<spawnPosition[1]-2000){running=false;pressed.clear();$('fatal').textContent='Выход за восстановленную поверхность. Можно вернуться к исходному spawn.'}
    updatePlacement();applyPose();
  }
  function frame(){
    requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.1);
    if(ready){
      if(running){accumulator+=dt;let count=0;try{while(accumulator>=1/60&&count<6){fixed();accumulator-=1/60;count++;
        if($('pauseOn').value&&sim.events.includes($('pauseOn').value)){running=false;pressed.clear();jumpQueued=false;accumulator=0;break}}
        if(accumulator>=1/60){droppedSeconds+=accumulator;accumulator=0}
      }catch(e){running=false;pressed.clear();$('fatal').textContent=e.stack||e.message}}
      enhancement.updateActor(position,grounded);cameraUpdate(dt);if(driver.steps%6===0||!running)refresh();
    }
    renderer.render(scene,camera);
  }
  frame();
  function toggle(){if(!ready)return;running=!running;pressed.clear();jumpQueued=false;accumulator=0;clock.getDelta();renderer.domElement.focus({preventScroll:true});refresh()}
  $('start').onclick=toggle;$('reset').onclick=()=>{if(ready)reset()};
  $('walk').onclick=()=>{if(ready){walk=!walk;renderer.domElement.focus({preventScroll:true});refresh()}};
  $('visual').onclick=()=>{if(ready){enhancement.apply(!enhancement.enhanced);$('visual').textContent='Графика: '+(enhancement.enhanced?'Enhanced':'Original');renderer.domElement.focus({preventScroll:true});refresh()}};
  $('camera').onclick=()=>{if(ready){cameraYaw=heading;cameraPitch=.32;cameraUpdate(1,true);refresh()}};
  $('street').onclick=()=>{if(ready){cameraYaw=0;cameraPitch=.32;cameraUpdate(1,true);renderer.domElement.focus({preventScroll:true});refresh()}};
  $('step').onclick=()=>{if(ready&&!running){fixed();cameraUpdate(1,true);refresh()}};
  addEventListener('keydown',e=>{
    if(!ready||['TEXTAREA','INPUT','SELECT'].includes(e.target.tagName))return;
    if(['KeyW','KeyA','KeyS','KeyD','KeyI','KeyJ','KeyK','KeyL','ControlLeft','ControlRight','Escape','Space','KeyV','KeyU','KeyO'].includes(e.code))e.preventDefault();
    if(e.code==='Escape'&&!e.repeat){toggle();return}
    if(e.code==='Space'&&!e.repeat){jumpQueued=true;renderer.domElement.focus({preventScroll:true});refresh();return}
    if(!running)return;
    if((e.code==='ControlLeft'||e.code==='ControlRight')&&!e.repeat){walk=!walk;refresh()}
    if(['KeyW','KeyA','KeyS','KeyD','KeyI','KeyJ','KeyK','KeyL','KeyV','KeyU','KeyO'].includes(e.code))pressed.add(e.code);
  });
  addEventListener('keyup',e=>pressed.delete(e.code));
  addEventListener('blur',()=>{pressed.clear();jumpQueued=false;if(ready){running=false;refresh()}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pressed.clear();jumpQueued=false;running=false;if(ready)refresh()}});
  let dragging=false,lastPointer;
  renderer.domElement.addEventListener('pointerdown',e=>{if(!ready)return;dragging=true;lastPointer=[e.clientX,e.clientY];renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.focus()});
  renderer.domElement.addEventListener('pointermove',e=>{if(dragging){cameraYaw-=(e.clientX-lastPointer[0])*.006;cameraPitch=Math.max(-.12,Math.min(1.15,cameraPitch+(e.clientY-lastPointer[1])*.004));lastPointer=[e.clientX,e.clientY]}});
  renderer.domElement.addEventListener('pointerup',()=>{dragging=false});renderer.domElement.addEventListener('pointercancel',()=>{dragging=false});
  renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();cameraDistance=Math.max(65,Math.min(350,cameraDistance*Math.exp(e.deltaY*.001)))},{passive:false});
  function chooseSpawn(){
    const index=Number($('spawn').value),entry=sandboxPlan.spawns[index];
    if(!Number.isInteger(index)||!entry)throw Error('Выбери исходную точку локации');
    spawnPosition=entry.display_position.slice();spawnYaw=Math.atan2(-entry.matrix[8],entry.matrix[10]);
  }
  $('spawn').onchange=()=>{if(ready){chooseSpawn();reset()}};
  $('erase').onclick=()=>{if(ready)reset(false)};
  $('capture').onclick=async()=>{
    if(!ready)return;running=false;pressed.clear();jumpQueued=false;refresh();
    const snapshot=JSON.parse(JSON.stringify(lastSnapshot));
    // Frozen snapshot includes density and actual GPU vertex attributes before async work.
    snapshot.tag_density_sha256=await digest(new Float32Array(snapshot.actual_tag_panels.flatMap(p=>p.values)));
    const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='world-tag-step-'+driver.steps+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  function addTriangles(root,triangles){
    root.updateMatrixWorld(true);root.traverse(n=>{
      if(!n.isMesh||n.isSkinnedMesh)return;const g=n.geometry,pos=g.getAttribute('position'),index=g.index;
      if(!pos||!index||index.count%3)throw Error('Индексированные треугольники уровня обязательны');
      const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
      for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(pos,index.getX(i)).applyMatrix4(n.matrixWorld);b.fromBufferAttribute(pos,index.getX(i+1)).applyMatrix4(n.matrixWorld);c.fromBufferAttribute(pos,index.getX(i+2)).applyMatrix4(n.matrixWorld);
        triangles.push(C.triangle(a.toArray(),b.toArray(),c.toArray()))}
    });
  }
  try{
    executedJS=await digest(new TextEncoder().encode(poolYardViewer.toString()));
    executedModules={};for(const [key,code] of Object.entries({driver:D.moduleSource,simulation:S.moduleSource,climb_driver:GettingUpClimbDriver.moduleSource,climb_simulation:GettingUpClimbSimulation.moduleSource,paint_surface:GettingUpPaintSurface.moduleSource,collision:C.moduleSource,
      base_simulation:GettingUpPlaySimulation.moduleSource,traversal:GettingUpTraversalDriver.moduleSource,walk:GettingUpWalkDriver.moduleSource,
      ledge_query:GettingUpLedgeQuery.moduleSource,
      mixed:GettingUpCompiledMixed.moduleSource,jump:GettingUpJumpRules.moduleSource,tag:GettingUpTag.moduleSource,spray_controller:GettingUpSprayController.moduleSource,tag_simulation:GettingUpSpraySimulation.moduleSource,tag_renderer:GettingUpSprayRenderer.Renderer.toString()}))executedModules[key]=await digest(new TextEncoder().encode(code));
    const poolProof=decoded(await fetchBytes('../manifests/pool-yard-scene.json'));
    const poolRaw=await fetchBytes('../artifacts/pool-yard/scene.json');
    if(await digest(poolRaw)!==poolProof.local_scene_sha256)throw Error('SHA-256 сцены Pool Yard не совпал');
    sandboxPlan=decoded(poolRaw);
    if(sandboxPlan.kind!=='gettingup-pool-yard-sandbox'||sandboxPlan.identity.source_level!=='m01_hoo_tranes_hood_2'||sandboxPlan.mission_scripts_enabled!==false)throw Error('Требуется отдельная песочница Pool Yard');
    plan={level_url:sandboxPlan.assets.objects.url,level_sha256:sandboxPlan.assets.objects.sha256,model_url:sandboxPlan.assets.actor.url,model_sha256:sandboxPlan.assets.actor.sha256,native_spawn:sandboxPlan.source_player_spawn};
    worldPlan={world_url:sandboxPlan.assets.world.url,world_sha256:sandboxPlan.assets.world.sha256};
    inputProof=decoded(await fetchBytes('../manifests/world-paint-inputs.json'));
    const [levelBytes,modelBytes,worldBytes,inputBytes,canBytes]=await Promise.all([fetchBytes(plan.level_url),fetchBytes(plan.model_url),fetchBytes(worldPlan.world_url),fetchBytes(sandboxPlan.assets.animation_inputs.url),fetchBytes(inputProof.can.url)]);
    if(await digest(canBytes)!==inputProof.can.sha256)throw Error('SHA-256 баллончика не совпал');
    if(await digest(levelBytes)!==plan.level_sha256||await digest(modelBytes)!==plan.model_sha256||await digest(worldBytes)!==worldPlan.world_sha256||await digest(inputBytes)!==inputProof.local_sidecar_sha256)throw Error('SHA-256 исходных входов не совпали');
    inputs=decoded(inputBytes);if(inputs.model_sha256!==plan.model_sha256||inputProof.model_sha256!==plan.model_sha256)throw Error('Модель и анимации не согласованы');
    const tagProof=decoded(await fetchBytes('../manifests/world-tag-inputs.json')),tagRaw=await fetchBytes(sandboxPlan.assets.tag_inputs.url);
    if(await digest(tagRaw)!==tagProof.local_inputs_sha256)throw Error('Tag sidecar SHA-256 mismatch');
    const controllerRaw=await fetchBytes('../manifests/graffiti-controller.json');inputs.controllerProofSHA=await digest(controllerRaw);
    inputs.tagData=decoded(tagRaw);inputs.tagData.controllerOptions=decoded(controllerRaw).options_table;inputs.tagProofSHA=await digest(tagRaw);const textures={};
    for(const[key,r]of Object.entries(inputs.tagData.textures)){
      const raw=await fetchBytes(r.url);if(await digest(raw)!==r.sha256)throw Error('Tag image SHA-256 mismatch: '+key);
      const url=URL.createObjectURL(new Blob([raw],{type:'image/png'})),image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url});
      const texture=new THREE.Texture(image);texture.encoding=THREE.sRGBEncoding;texture.needsUpdate=true;texture.name=key;textures[key]=texture;URL.revokeObjectURL(url);
    }
    tagRenderer=new GettingUpSprayRenderer.Renderer(scene,textures,inputs.tagData);
    [level,actor,world,can]=await Promise.all([glb(levelBytes),glb(modelBytes),glb(worldBytes),glb(canBytes)]);
    const l=P.inspect(level.parser.json,'level'),a=P.inspect(actor.parser.json,'actor');
    if(JSON.stringify(l.nativeSpawn)!==JSON.stringify(plan.native_spawn))throw Error('Исходный spawn не совпал');
    [levelRoot,actorRoot]=await Promise.all([level.parser.getDependency('node',l.rootIndex),actor.parser.getDependency('node',a.rootIndex)]);
    bones=await Promise.all(a.joints.map(i=>actor.parser.getDependency('node',i)));
    if(!bones.every((b,i)=>b.isBone&&actor.parser.json.nodes[a.joints[i]].name.toLowerCase()===inputs.bones[i].name.toLowerCase()))throw Error('48 костей не сопоставлены');
    const entity=await actor.parser.getDependency('node',0);entity.position.set(0,0,0);entity.quaternion.identity();
    actor.scene.traverse(n=>{if(n.isMesh)n.frustumCulled=false});
    canRoot=can.scene.children[0];if(can.scene.children.length!==1||JSON.stringify(canRoot.scale.toArray())!=='[-1,1,1]')throw Error('Исходное отражение предмета обязательно');
    canPlacement=new THREE.Group();canPlacement.matrixAutoUpdate=false;canPlacement.add(can.scene);scene.add(canPlacement);
    placement=new THREE.Group();placement.matrixAutoUpdate=false;placement.add(actor.scene);scene.add(level.scene,world.scene,placement);
    enhancement.register(level.scene,'level');enhancement.register(world.scene,'level');enhancement.register(actor.scene,'actor');enhancement.register(can.scene,'can');
    sandboxPlan.spawns.forEach((entry,index)=>{
      const option=document.createElement('option');option.value=String(index);
      option.textContent=entry.source_class==='IPointSpawnPlayer'?'Исходный вход · у лестницы':entry.source_id===2241669?'Двор · исходная контрольная точка':'Бассейн · исходная контрольная точка';
      $('spawn').appendChild(option);
    });
    $('spawn').value=String(sandboxPlan.default_spawn);chooseSpawn();position=spawnPosition.slice();heading=spawnYaw;
    driver=new D.Driver(inputs);updatePlacement();applyPose();
    const bounds=new THREE.Box3();bounds.makeEmpty();const v=new THREE.Vector3();
    actor.scene.traverse(n=>{if(n.isSkinnedMesh){n.skeleton.update();const attr=n.geometry.getAttribute('position');
      for(let i=0;i<attr.count;i++){v.fromBufferAttribute(attr,i);n.boneTransform(i,v);v.applyMatrix4(n.matrixWorld);bounds.expandByPoint(v)}}});
    if(bounds.isEmpty())throw Error('Не удалось измерить видимую модель');
    const height=bounds.max.y-bounds.min.y;capsule={height,radius:height*.14,footOffset:bounds.min.y-position[1],stepHeight:height*.18};
    const triangles=[];addTriangles(world.scene,triangles);addTriangles(level.scene,triangles);collider=new C.World(triangles);
    ready=true;for(const id of ['start','reset','walk','camera','visual','capture','step','street','spawn','erase'])$(id).disabled=false;reset();
    $('status').textContent='The Pool Yard · свободная прогулка\nБез миссий и обязательных целей';
  }catch(e){$('status').textContent='Сборка остановлена';$('fatal').textContent=e.stack||e.message}
})();
