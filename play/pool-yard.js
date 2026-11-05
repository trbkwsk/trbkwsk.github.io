/* Separate Pool Yard sandbox using the shared verified animation/Tag primitives.
 * Original mission scripts are never loaded. Ladder/crawl/full engine remain open. */
/* OUR interactive bridge around sealed animation code and original local
 * assets. Geometry collisions/camera/input are diagnostic, not original AI
 * or BSP/runtime parity. Previous viewers and their episodes stay unchanged.
 */
(async function poolYardViewer(){'use strict';
  const $=id=>document.getElementById(id),P=GettingUpScenePlacement,D=GettingUpPaintDriver,
    C=GettingUpWorldCollision,S=GettingUpPoolControls,Preview=GettingUpPoolPreview,Lighting=GettingUpPoolLighting;
  const scene=new THREE.Scene(),skyScene=new THREE.Scene();
  const hemisphere=new THREE.HemisphereLight(0,0,0);scene.add(hemisphere);
  const keyLight=new THREE.DirectionalLight(0,0);scene.add(keyLight,keyLight.target);
  keyLight.castShadow=true;keyLight.shadow.mapSize.set(1024,1024);keyLight.shadow.camera.left=-160;keyLight.shadow.camera.right=160;
  keyLight.shadow.camera.top=160;keyLight.shadow.camera.bottom=-160;keyLight.shadow.camera.near=1;keyLight.shadow.camera.far=650;
  keyLight.shadow.bias=-.0003;keyLight.shadow.normalBias=.2;
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.autoClear=false;renderer.setClearColor(0);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.NoToneMapping;
  renderer.outputEncoding=THREE.sRGBEncoding;renderer.domElement.tabIndex=0;
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
  const artTitle=name=>name?.startsWith('AT_TraneM01_')?'New Radius · '+name.slice(-2):name||'Trane';
  const glb=bytes=>new Promise((resolve,reject)=>new THREE.GLTFLoader().parse(bytes,'',resolve,reject));
  let sandboxPlan,previewConfig,controlResources,lightingConfig,lightingConfigSHA,lightingState,sourceLighting,sourceRenderData,sourceVertexBytes,skyGroup,skyScroll=[],skyMeshCount=0,previewSeconds=0,originalUI=null,menuScreen='main',uiCompletedCount=0,uiCompletionUntil=0;
  let demoFrames=null,demoCursor=-1,demoComplete=false,resumeAfterHelp=false,resumeAfterPicker=false,cameraClearance=205;
  const actorMaterials=[],nativeMaterials=new Map();
  let ready=false,running=false,walk=false,driver,inputs,plan,worldPlan,inputProof,level,actor,world,can,canRoot,canPlacement,
    placement,bones,collider,capsule,spawnPosition,spawnYaw,actorRoot,levelRoot,executedJS,executedModules,sim;
  let position=[0,0,0],heading=0,vertical=0,grounded=false,cameraYaw=0,cameraPitch=.17,cameraDistance=205,accumulator=0;
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
    if(tagRenderer)tagRenderer.update(sim.panels);
    scene.updateMatrixWorld(true);
  }
  function cameraUpdate(dt=1,immediate=false){
    const view=Preview.camera(collider,[position[0],position[1]-(sim?.crouched?16:0),position[2]],cameraYaw,cameraPitch,cameraDistance);
    cameraTarget.fromArray(view.target);cameraDesired.fromArray(view.position);
    if(immediate)camera.position.copy(cameraDesired);else camera.position.lerp(cameraDesired,1-Math.exp(-12*dt));
    if(collider){const final=collider.ray(cameraTarget.toArray(),camera.position.toArray());
      if(final.hit){const dir=camera.position.clone().sub(cameraTarget).normalize();camera.position.copy(cameraTarget).addScaledVector(dir,Math.max(0,final.distance-3))}}
    camera.lookAt(cameraTarget);
    cameraClearance=camera.position.distanceTo(cameraTarget);
    const fade=THREE.MathUtils.clamp((cameraClearance-20)/34,0,1);
    for(const row of actorMaterials){row.material.opacity=row.opacity*fade;row.material.transparent=row.transparent||fade<.99;row.material.depthWrite=row.depthWrite&&fade>.99}
    if(ready){const direction=lightingConfig.preview.key_direction_display;keyLight.target.position.set(position[0],position[1]+30,position[2]);keyLight.position.set(position[0]+direction[0],position[1]+30+direction[1],position[2]+direction[2])}
    if(skyGroup){const anchor=previewConfig.sky.native_anchor;skyGroup.position.set(-camera.position.x-anchor[0],camera.position.y-anchor[1],camera.position.z-anchor[2])}
  }
  function reset(keepPaint=true,settle=true){
    const kept=keepPaint&&sim?sim.panels.slice():[],random=keepPaint&&sim?sim.rng:null;
    const chosen=sim?.artworkIndex||0,size=sim?.sizeMode??1;
    if(!keepPaint&&tagRenderer)tagRenderer.clear();
    running=false;pressed.clear();sim?.clearActionInput?.();walk=false;jumpQueued=false;sim=new S.Simulation(inputs,collider,spawnPosition,spawnYaw,capsule,controlResources);sim.selectArtwork(chosen);sim.sizeMode=size;sim.sizeIndex=size-1;driver=sim.driver;position=spawnPosition.slice();heading=spawnYaw;
    if(kept.length){sim.panels=kept.filter(p=>p.grid.samples);sim.rng=random;sim.nextPanelId=Math.max(0,...kept.map(p=>p.id+1));sim.completedPieces=kept.filter(p=>p.area?.state>=2).length;for(const p of kept){p.previewVisible=false;p.area?.stop()}}
    vertical=0;grounded=false;droppedSeconds=0;totalContacts=0;lastCollision=null;accumulator=0;$('fatal').textContent='';
    demoCursor=-1;demoFrames=null;demoComplete=false;
    resumeAfterHelp=false;resumeAfterPicker=false;
    cameraYaw=spawnYaw;cameraPitch=.17;cameraDistance=205;
    if(settle){let supported=0;for(let i=0;i<180&&supported<3;i++){fixed({x:0,z:0,walk:false,jump:false,cameraYaw:spawnYaw,v:false,spray:false,fast:false});supported=grounded?supported+1:0}}
    updatePlacement();applyPose();cameraUpdate(1,true);refresh();
  }
  function refresh(){
    if(!ready)return;const s=driver.snapshot(),distance=Math.hypot(position[0]-spawnPosition[0],position[2]-spawnPosition[2]);
    document.body.dataset.ready='true';document.body.dataset.running=String(running);
    $('entry').hidden=running||!$('help').hidden||!$('artPicker').hidden;
    $('enter').textContent=s.steps>60?'Продолжить прогулку':'Войти во двор';
    $('entryTitle').textContent='The Pool Yard';
    $('entryText').textContent='Локальная песочница. Справка и инструменты проверки: F2.';
    $('modeLabel').textContent=demoCursor>=0?'Демонстрация · '+Math.round(demoCursor/demoFrames.length*100)+'%':sim.paintAnchor?'У стены · аэрозоль':sim.crouched?'Приседание · крадучись':walk?'Свободная прогулка · ходьба':'Свободная прогулка · бег';
    const piece=sim.paintAnchor,tiles=piece?.grid.data.tiles||sim.selectedData().tiles;
    $('artHUD').textContent=artTitle(piece?.grid.data.name||sim.tagData.name)+' · '+tiles.join('×')+((piece?.goBig||!piece&&sim.sizeMode===2)?' · Go Big':'')+(piece?' · '+Math.min(100,Math.round(piece.grid.summary().coverage*100))+'% / '+Math.round(piece.area.threshold*100)+'%':' · Tab — инвентарь');
    $('start').textContent=running?'Пауза':'Начать прогулку';$('walk').textContent='Режим: '+(walk?'ходьба':'бег');
    const labels={punch:'удар рукой · CrossR',kick:'удар ногой · SnapKickL',evade_left:'уход влево · SnsL',evade_right:'уход вправо · SnsR',duck_enter:'опуститься в присед',duck_exit:'подняться из приседа',duck_idle:'ожидание в приседе',duck_walk:'движение в приседе',idle:'ожидание',walk:'ходьба',run:'бег',sneak_idle:'приседание',sneak_forward:'красться',stand_takeoff:'отрыв стоя',run_takeoff:'отрыв с разбега',stand_air:'полёт',run_air:'полёт с разбега',stand_land:'приземление',run_land:'приземление с разбега',ledge_grab:'захват уступа',ledge_hang:'вис на уступе',ledge_up:'подъём на уступ',...Object.fromEntries(Array.from({length:9},(_,i)=>['paint_'+i,'рисование · '+inputs.paint_phases['paint_'+i].sequence.replace('Aerosol_Stand_','')]))};
    const stanceName={reach:'вытянуться',stand:'стоя',crouch:'наклон'},custom=/^(?:wall_)?(reach|stand|crouch)_/.exec(s.mode||'');
    const action=labels[s.mode]||(custom?(s.mode.startsWith('wall_')?'Шаг вдоль стены':'Рисование')+' · '+stanceName[custom[1]]:s.mode);
    $('stats').textContent='Действие: '+action+' · кадр '+s.frame.toFixed(2)+'\n'+
      'Шагов: '+s.steps+' · от spawn: '+distance.toFixed(1)+'\n'+
      'Опора: '+(grounded?'есть':'нет')+' · Y: '+position[1].toFixed(2)+'\n'+
      'Прыжков: '+sim.jumps+' · посадок: '+sim.landings+'\n'+
      'Захватов: '+sim.grabs+' · подъёмов с опорой: '+sim.climbs+'\n'+
      'Краска: '+sim.panels.reduce((n,p)=>n+p.grid.summary().painted_pixels,0)+' узлов · '+(sim.spraying?'подача':'без подачи')+'\n'+
      'Треугольников: '+collider.triangles.length+' · костей: '+bones.length+'\nRNG вызовов: '+sim.rng.calls+' · state '+sim.rng.state;
    $('focusHint').textContent=running?'WASD — движение · у стены держи V · U/O — краска · WASD — поза кисти':'Уровень на паузе. Можно продолжить или сделать один шаг.';
    if(demoCursor>=0)$('focusHint').textContent='Трейн идёт к стене · WASD — перехватить управление';
    else if(!running)$('focusHint').textContent='Pool Yard · без миссий и обязательных целей';
    else if(sim.paintAnchor)$('focusHint').textContent='U/O — краска · A/D — шаги · W/S — от наклона до вытянутой руки · отпустить V — выйти';
    else $('focusHint').textContent='U — удар рукой · O — ногой · E/Q + направление — уклонение · V у стены — граффити';
    if(sim.notice)$('focusHint').textContent=sim.notice;
    if(originalUI){if(sim.completedPieces>uiCompletedCount)uiCompletionUntil=previewSeconds+originalUI.data.completion.holdingTime;uiCompletedCount=sim.completedPieces;
      originalUI.completion=previewSeconds<uiCompletionUntil;originalUI.ready=ready;originalUI.wheel=!$('artPicker').hidden;originalUI.show(running?null:menuScreen)}
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
      pool_control_inputs_sha256:inputs.poolControlProofSHA,pool_lighting_config_sha256:lightingConfigSHA,pool_lighting:lightingState,
      pool_combat_inputs_sha256:controlResources.combatSHA,pool_locomotion_inputs_sha256:controlResources.locomotionSHA,native_material_state_count:nativeMaterials.size,
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
      pending_actions:['full-animation-selection','authored-graffiti-zones','original-BSP','lighting-parity']};
    Object.assign(lastSnapshot,{presentation:'pool-yard-preview-v1',preview_sky_meshes:skyMeshCount,preview_shadow_map:true,
      camera_clearance:cameraClearance,preview_camera_policy:true,preview_lighting_policy:true,
      showcase_active:demoCursor>=0,showcase_complete:demoComplete,showcase_frame:demoCursor});
    $('diagnostics').value=JSON.stringify(lastSnapshot);
  }
  function fixed(override=null){
    // Saved MacBook bindings; angular rates are OUR diagnostic camera policy.
    cameraYaw+=(Number(pressed.has('KeyJ'))-Number(pressed.has('KeyL')))*1.6/60;
    cameraPitch=Math.max(-.12,Math.min(1.15,cameraPitch+(Number(pressed.has('KeyI'))-Number(pressed.has('KeyK')))*1.2/60));
    const x=Number(pressed.has('KeyD'))-Number(pressed.has('KeyA')),z=Number(pressed.has('KeyW'))-Number(pressed.has('KeyS'));
    if(!override&&demoCursor>=0){override=demoFrames[demoCursor++];cameraYaw=override.cameraYaw}
    const state=sim.step(override||{x,z,walk,jump:jumpQueued,cameraYaw,v:pressed.has('KeyV'),spray:pressed.has('KeyU'),fast:pressed.has('KeyO'),crouch:pressed.has('ShiftLeft')||pressed.has('ShiftRight'),use:pressed.has('KeyE')||pressed.has('KeyQ')});jumpQueued=false;
    position=state.position;heading=state.heading;vertical=state.vertical;grounded=state.grounded;
    lastCollision=state.last_collision;totalContacts+=lastCollision.contacts.length;
    if(position[1]<spawnPosition[1]-2000){running=false;pressed.clear();sim?.clearActionInput?.();$('fatal').textContent='Выход за восстановленную поверхность. Можно вернуться к исходному spawn.'}
    updatePlacement();applyPose();
    if(demoCursor>=0&&demoCursor===demoFrames.length){demoCursor=-1;demoComplete=true;running=false;pressed.clear();sim?.clearActionInput?.();refresh()}
  }
  function frame(){
    requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.1);previewSeconds+=dt;
    if(ready){
      if(running){accumulator+=dt;let count=0;try{while(accumulator>=1/60&&count<6){fixed();accumulator-=1/60;count++;
        if(!running||$('pauseOn').value&&sim.events.includes($('pauseOn').value)){running=false;pressed.clear();sim?.clearActionInput?.();jumpQueued=false;accumulator=0;break}}
        if(accumulator>=1/60){droppedSeconds+=accumulator;accumulator=0}
      }catch(e){running=false;pressed.clear();sim?.clearActionInput?.();$('fatal').textContent=e.stack||e.message}}
      cameraUpdate(dt);if(driver.steps%6===0||!running)refresh();
      for(const row of skyScroll)row.texture.offset.set(previewSeconds*row.u,previewSeconds*row.v);
    }
    if(ready&&sourceLighting)sourceLighting.update(position,collider);
    renderer.clear();renderer.render(skyScene,camera);renderer.clearDepth();renderer.render(scene,camera);
  }
  frame();
  function toggle(){if(!ready)return;running=!running;if(!running)menuScreen='pause';pressed.clear();sim?.clearActionInput?.();jumpQueued=false;accumulator=0;clock.getDelta();renderer.domElement.focus({preventScroll:true});refresh()}
  $('start').onclick=toggle;$('enter').onclick=toggle;$('reset').onclick=()=>{if(ready){$('help').hidden=true;reset()}};
  function help(open){
    if(open){resumeAfterHelp=running;if(running)menuScreen='pause';running=false;pressed.clear();sim?.clearActionInput?.();jumpQueued=false;$('help').hidden=false;$('helpClose').focus()}
    else{$('help').hidden=true;running=resumeAfterHelp&&ready;pressed.clear();sim?.clearActionInput?.();accumulator=0;renderer.domElement.focus({preventScroll:true})}
    if(ready)refresh();
  }
  $('helpOpen').onclick=()=>help(true);$('helpClose').onclick=()=>help(false);
  function picker(open){
    if(!ready)return;
    if(open&&!$('artPicker').hidden)return;
    if(open){resumeAfterPicker=running;running=false;pressed.clear();sim?.clearActionInput?.();jumpQueued=false;demoCursor=-1;demoFrames=null;$('help').hidden=true;$('artPicker').hidden=false;$('artClose').focus()}
    else{$('artPicker').hidden=true;running=resumeAfterPicker;pressed.clear();sim?.clearActionInput?.();accumulator=0;renderer.domElement.focus({preventScroll:true})}
    refresh();
  }
  $('artOpen').onclick=()=>picker(true);$('artClose').onclick=()=>picker(false);
  $('labOpen').onclick=()=>{$('help').hidden=true;$('lab').hidden=false;if(ready)refresh()};$('labClose').onclick=()=>{$('lab').hidden=true};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch(e){$('status').textContent='Полный экран недоступен в этом браузере.'}};
  $('demo').onclick=()=>{
    if(!ready)return;$('help').hidden=true;$('spawn').value=String(sandboxPlan.default_spawn);chooseSpawn();reset(true,false);
    demoFrames=Preview.expand(previewConfig.showcase);const preroll=previewConfig.showcase.preroll_frames;
    for(let i=0;i<preroll;i++)fixed(demoFrames[i]);
    demoCursor=preroll;cameraYaw=demoFrames[preroll].cameraYaw;cameraUpdate(1,true);
    running=true;pressed.clear();sim?.clearActionInput?.();accumulator=0;clock.getDelta();renderer.domElement.focus({preventScroll:true});refresh();
  };
  $('walk').onclick=()=>{if(ready){walk=!walk;renderer.domElement.focus({preventScroll:true});refresh()}};
  $('camera').onclick=()=>{if(ready){cameraYaw=heading;cameraPitch=.17;cameraUpdate(1,true);refresh()}};
  $('street').onclick=()=>{if(ready){cameraYaw=0;cameraPitch=.17;cameraUpdate(1,true);renderer.domElement.focus({preventScroll:true});refresh()}};
  $('step').onclick=()=>{if(ready&&!running){fixed();cameraUpdate(1,true);refresh()}};
  addEventListener('keydown',e=>{
    if(!ready||['TEXTAREA','INPUT','SELECT'].includes(e.target.tagName))return;
    if(e.metaKey||e.altKey||e.ctrlKey&&!['ControlLeft','ControlRight'].includes(e.code))return;
    if($('help').hidden&&$('lab').hidden&&originalUI?.key(e.code)){e.preventDefault();return}
    if(e.code==='Tab'){e.preventDefault();if(!e.repeat&&running)picker(true);return}
    if(!$('artPicker').hidden&&e.code==='Escape'){e.preventDefault();picker(false);return}
    if(['Digit1','Digit2','Digit3','Digit4'].includes(e.code)){e.preventDefault();if(!e.repeat&&pressed.has('KeyV')&&$('artPicker').hidden){
      if(e.code==='Digit1')sim.resizeArtwork(1);if(e.code==='Digit3')sim.resizeArtwork(-1);
      if(e.code==='Digit2')sim.cycleArtwork(1);if(e.code==='Digit4')sim.cycleArtwork(-1);paintVisuals();refresh()}return}
    if(!$('artPicker').hidden)return;
    if(e.code==='KeyH'&&!e.repeat){e.preventDefault();help($('help').hidden);return}
    if(e.code==='F2'&&!e.repeat){e.preventDefault();$('lab').hidden=!$('lab').hidden;return}
    if(!$('help').hidden){if(e.code==='Escape'){e.preventDefault();help(false)}return}
    if(['KeyW','KeyA','KeyS','KeyD','KeyI','KeyJ','KeyK','KeyL','ControlLeft','ControlRight','Escape','Space','KeyV','KeyU','KeyO','KeyE','KeyQ'].includes(e.code))e.preventDefault();
    if(e.code==='Escape'&&!e.repeat){toggle();return}
    if(e.code==='KeyR'&&!e.repeat){e.preventDefault();$('help').hidden=true;reset();return}
    if(!running)return;
    if(['KeyW','KeyA','KeyS','KeyD','Space','KeyV','KeyU','KeyO','KeyE','KeyQ','ShiftLeft','ShiftRight'].includes(e.code)&&demoCursor>=0){demoCursor=-1;demoFrames=null}
    if(e.code==='Space'&&!e.repeat){jumpQueued=true;renderer.domElement.focus({preventScroll:true});refresh();return}
    if((e.code==='ControlLeft'||e.code==='ControlRight')&&!e.repeat){walk=!walk;refresh()}
    if(['KeyW','KeyA','KeyS','KeyD','KeyI','KeyJ','KeyK','KeyL','KeyV','KeyU','KeyO','KeyE','KeyQ','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();pressed.add(e.code)}
  });
  addEventListener('keyup',e=>{pressed.delete(e.code);if(e.code==='Tab'&&ready&&!$('artPicker').hidden){e.preventDefault();picker(false)}});
  addEventListener('blur',()=>{pressed.clear();sim?.clearActionInput?.();jumpQueued=false;if(ready){if(!$('artPicker').hidden)picker(false);if(running)menuScreen='pause';running=false;refresh()}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pressed.clear();sim?.clearActionInput?.();jumpQueued=false;if(running)menuScreen='pause';running=false;if(ready)refresh()}});
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
    if(!ready)return;running=false;pressed.clear();sim?.clearActionInput?.();jumpQueued=false;refresh();
    const snapshot=JSON.parse(JSON.stringify(lastSnapshot));
    // Frozen snapshot includes density and actual GPU vertex attributes before async work.
    snapshot.tag_density_sha256=await digest(new Float32Array(snapshot.actual_tag_panels.flatMap(p=>p.values)));
    const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='world-tag-step-'+driver.steps+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  function addTriangles(root,triangles){
    root.updateMatrixWorld(true);root.traverse(n=>{
      if(!n.isMesh||n.isSkinnedMesh||n.userData.previewSkybox)return;const g=n.geometry,pos=g.getAttribute('position'),index=g.index;
      if(!pos||!index||index.count%3)throw Error('Индексированные треугольники уровня обязательны');
      const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
      for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(pos,index.getX(i)).applyMatrix4(n.matrixWorld);b.fromBufferAttribute(pos,index.getX(i+1)).applyMatrix4(n.matrixWorld);c.fromBufferAttribute(pos,index.getX(i+2)).applyMatrix4(n.matrixWorld);
        triangles.push(C.triangle(a.toArray(),b.toArray(),c.toArray()))}
    });
  }
  try{
    const interfaceProof=decoded(await fetchBytes('../manifests/pool-yard-interface-inputs.json')),interfaceRaw=await fetchBytes(interfaceProof.url);
    if(await digest(interfaceRaw)!==interfaceProof.sha256)throw Error('Original interface layout SHA-256 mismatch');
    const interfaceData=decoded(interfaceRaw),interfaceImages=new Map();
    for(const[key,r]of Object.entries(interfaceData.textures)){
      const raw=await fetchBytes(r.url);if(await digest(raw)!==r.sha256)throw Error('Original interface image SHA-256 mismatch');
      const url=URL.createObjectURL(new Blob([raw],{type:'image/png'}));const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url});URL.revokeObjectURL(url);interfaceImages.set(key,image);
    }
    originalUI=new GettingUpPoolInterface.Interface($('originalUI'),$('originalMenuButtons'),interfaceData,interfaceImages,(screen,name)=>{
      if(name==='Select'||name==='Resume'){running=false;toggle()}
      else if(name==='Quit'){running=false;menuScreen='main';pressed.clear();sim?.clearActionInput?.();jumpQueued=false;refresh()}
    });originalUI.show('main');
    addEventListener('resize',()=>originalUI.draw());
    executedJS=await digest(new TextEncoder().encode(poolYardViewer.toString()));
    executedModules={};for(const [key,code] of Object.entries({driver:D.moduleSource,simulation:S.moduleSource,climb_driver:GettingUpClimbDriver.moduleSource,climb_simulation:GettingUpClimbSimulation.moduleSource,paint_surface:GettingUpPaintSurface.moduleSource,collision:C.moduleSource,
      base_simulation:GettingUpPlaySimulation.moduleSource,traversal:GettingUpTraversalDriver.moduleSource,walk:GettingUpWalkDriver.moduleSource,
      ledge_query:GettingUpLedgeQuery.moduleSource,
      mixed:GettingUpCompiledMixed.moduleSource,jump:GettingUpJumpRules.moduleSource,tag:GettingUpTag.moduleSource,spray_controller:GettingUpSprayController.moduleSource,tag_simulation:GettingUpSpraySimulation.moduleSource,tag_renderer:GettingUpSprayRenderer.Renderer.toString(),pool_artwork_renderer:GettingUpPoolArtworkRenderer.moduleSource,pool_original_rules:GettingUpPoolRules.moduleSource,pool_combat:GettingUpPoolCombat.moduleSource,pool_normal_actions:GettingUpPoolNormalActions.moduleSource,pool_turn:GettingUpPoolTurn.moduleSource,navigation_turn:GettingUpNavigationTurn.moduleSource,pool_materials:GettingUpPoolMaterials.moduleSource,pool_lighting:Lighting.moduleSource,pool_source_lights:GettingUpPoolSourceLights.moduleSource,area_controller:GettingUpAreaController.moduleSource}))executedModules[key]=await digest(new TextEncoder().encode(code));
    const poolProof=decoded(await fetchBytes('../manifests/pool-yard-scene.json'));
    const controlProof=decoded(await fetchBytes('../manifests/pool-yard-control-inputs.json'));
    const controlRaw=await fetchBytes(controlProof.url);if(await digest(controlRaw)!==controlProof.sha256)throw Error('SHA-256 ресурсов управления не совпал');
    controlResources=decoded(controlRaw);
    const wallBindings=decoded(await fetchBytes('../manifests/pool-yard-wall-bindings.json'));
    if(wallBindings.kind!=='pool-yard-native-wall-bindings'||wallBindings.control_resource_sha256!==controlProof.sha256||Object.keys(wallBindings.phases).length!==18)throw Error('Native wall step resource binding mismatch');
    controlResources.wallPhases=wallBindings.phases;
    const locomotionProof=decoded(await fetchBytes('../manifests/pool-yard-locomotion-inputs.json')),locomotionRaw=await fetchBytes(locomotionProof.url);
    if(await digest(locomotionRaw)!==locomotionProof.sha256)throw Error('Original locomotion resource SHA-256 mismatch');
    controlResources.locomotion=decoded(locomotionRaw);
    controlResources.locomotionSHA=locomotionProof.sha256;
    if(controlResources.locomotion.kind!=='pool-yard-original-locomotion-inputs'||controlResources.locomotion.model_sha256!==controlResources.model_sha256)throw Error('Locomotion model binding differs');
    const combatProof=decoded(await fetchBytes('../manifests/pool-yard-combat-inputs.json')),combatRaw=await fetchBytes(combatProof.url);
    if(await digest(combatRaw)!==combatProof.sha256)throw Error('Original combat resource SHA-256 mismatch');
    controlResources.combat=decoded(combatRaw);controlResources.combatSHA=combatProof.sha256;
    if(controlResources.combat.kind!=='pool-yard-original-combat-inputs'||controlResources.combat.model_sha256!==controlResources.model_sha256||controlResources.combat.bones_sha256!==controlResources.locomotion.bones_sha256)throw Error('Combat model/rig binding differs');
    previewConfig=decoded(await fetchBytes('pool-yard-preview.json'));
    if(previewConfig.kind!=='pool-yard-browser-preview'||previewConfig.source_level_sha256!==poolProof.source_level_sha256)throw Error('Требуются исходные настройки Pool Yard');
    const lightingRaw=await fetchBytes('pool-yard-lighting.json');lightingConfig=decoded(lightingRaw);lightingConfigSHA=await digest(lightingRaw);
    if(lightingConfig.source_level_sha256!==poolProof.source_level_sha256)throw Error('Освещение должно соответствовать исходной Pool Yard');
    lightingState=Lighting.configure(lightingConfig,{scene,renderer,hemisphere,key:keyLight,camera});
    const sourceRenderRaw=await fetchBytes(lightingConfig.source_render_inputs.url);
    if(await digest(sourceRenderRaw)!==lightingConfig.source_render_inputs.sha256)throw Error('Source render input SHA-256 mismatch');
    sourceRenderData=GettingUpPoolSourceLights.validate(decoded(sourceRenderRaw));
    if(sourceRenderData.source_level_sha256!==poolProof.source_level_sha256)throw Error('Source render map mismatch');
    sourceVertexBytes=await fetchBytes(sourceRenderData.managed_vertices.url);
    if(await digest(sourceVertexBytes)!==sourceRenderData.managed_vertices.sha256)throw Error('Native vertex color SHA-256 mismatch');
    const poolRaw=await fetchBytes('../artifacts/pool-yard/scene.json');
    if(await digest(poolRaw)!==poolProof.local_scene_sha256)throw Error('SHA-256 сцены Pool Yard не совпал');
    sandboxPlan=decoded(poolRaw);
    if(sandboxPlan.kind!=='gettingup-pool-yard-sandbox'||sandboxPlan.identity.source_level!=='m01_hoo_tranes_hood_2'||sandboxPlan.mission_scripts_enabled!==false)throw Error('Требуется отдельная песочница Pool Yard');
    plan={level_url:sandboxPlan.assets.objects.url,level_sha256:sandboxPlan.assets.objects.sha256,model_url:sandboxPlan.assets.actor.url,model_sha256:sandboxPlan.assets.actor.sha256,native_spawn:sandboxPlan.source_player_spawn};
    worldPlan={world_url:sandboxPlan.assets.world.url,world_sha256:sandboxPlan.assets.world.sha256};
    inputProof=decoded(await fetchBytes('../manifests/world-paint-inputs.json'));
    const [levelBytes,modelBytes,worldBytes,inputBytes,canBytes]=await Promise.all([fetchBytes(plan.level_url),fetchBytes(plan.model_url),fetchBytes(worldPlan.world_url),fetchBytes(sandboxPlan.assets.animation_inputs.url),fetchBytes(inputProof.can.url)]);
    if(await digest(canBytes)!==inputProof.can.sha256)throw Error('SHA-256 баллончика не совпал');
    if(await digest(levelBytes)!==plan.level_sha256||await digest(modelBytes)!==plan.model_sha256||await digest(worldBytes)!==worldPlan.world_sha256||await digest(inputBytes)!==inputProof.local_sidecar_sha256||worldPlan.world_sha256!==sourceRenderData.world_sha256)throw Error('SHA-256 исходных входов не совпали');
    inputs=decoded(inputBytes);if(inputs.model_sha256!==plan.model_sha256||inputProof.model_sha256!==plan.model_sha256)throw Error('Модель и анимации не согласованы');
    const tagProof=decoded(await fetchBytes('../manifests/world-tag-inputs.json')),tagRaw=await fetchBytes(sandboxPlan.assets.tag_inputs.url);
    if(await digest(tagRaw)!==tagProof.local_inputs_sha256)throw Error('Tag sidecar SHA-256 mismatch');
    const controllerRaw=await fetchBytes('../manifests/graffiti-controller.json');inputs.controllerProofSHA=await digest(controllerRaw);
    inputs.tagData=decoded(tagRaw);inputs.tagData.controllerOptions=decoded(controllerRaw).options_table;inputs.tagProofSHA=await digest(tagRaw);inputs.poolControlProofSHA=controlProof.sha256;
    if(controlResources.model_sha256!==inputs.model_sha256)throw Error('Ресурсы приседания должны соответствовать модели');
    const artworkTextures=new Map(),textureCache=new Map();
    for(const artwork of controlResources.artworks){const textures={};for(const[key,r]of Object.entries(artwork.textures)){
      const cacheKey=r.url+':'+r.sha256;if(!textureCache.has(cacheKey)){
        const raw=await fetchBytes(r.url);if(await digest(raw)!==r.sha256)throw Error('Tag image SHA-256 mismatch: '+key);
        const url=URL.createObjectURL(new Blob([raw],{type:'image/png'})),image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url});
        const texture=new THREE.Texture(image);texture.encoding=THREE.sRGBEncoding;texture.needsUpdate=true;texture.name=key;textureCache.set(cacheKey,texture);URL.revokeObjectURL(url);
      }textures[key]=textureCache.get(cacheKey);
    }artworkTextures.set(artwork.name,textures);
    }
    const labels={Marker:'Маркер',Sticker:'Стикер',SuperSprayPaint:'Аэрозоль',StencilPaintCan:'Трафарет',Squeegee:'Ракель',CombatPaintRoller:'Валик',Crowbar:'Лом',BoltCutter:'Болторез'};
    for(const slot of controlResources.wheelSlots){
      const bytes=await fetchBytes(slot.icon.url);if(await digest(bytes)!==slot.icon.sha256)throw Error('Inventory image SHA-256 mismatch');
      const key='pickup-'+slot.pickup_id,url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
      const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url});URL.revokeObjectURL(url);interfaceImages.set(key,image);slot.key=key;
      const label=document.createElement('span');label.textContent=labels[slot.name]+(slot.pickup_id===42?'':' — не подключён');$('artChoices').appendChild(label);
    }
    originalUI.items=controlResources.wheelSlots;
    tagRenderer=new GettingUpPoolArtworkRenderer.Renderer(scene,controlResources.artworks,artworkTextures);
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
    for(const root of [level.scene,world.scene,actor.scene,can.scene])root.traverse(n=>{
      if(!n.isMesh)return;n.castShadow=root===actor.scene||root===can.scene;n.receiveShadow=true;
      for(const material of [].concat(n.material||[])){
        if(Number.isInteger(material.userData.mode)&&!nativeMaterials.has(material))nativeMaterials.set(material,GettingUpPoolMaterials.apply(material,THREE));
        if(material.map)material.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
        if(!material.map&&(material.userData.stageTextures||[]).some(s=>/mblack$/i.test(s)))material.color.setRGB(0,0,0);
        if(root===actor.scene&&!actorMaterials.some(r=>r.material===material))actorMaterials.push({material,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});
      }
    });
    skyGroup=new THREE.Group();skyGroup.name='Pool Yard preview sky';const skyReflection=new THREE.Group();skyReflection.scale.set(-1,1,1);skyReflection.add(skyGroup);skyScene.add(skyReflection);
    for(const row of previewConfig.sky.objects){
      const node=level.scene.getObjectByName(row.name);if(!node)throw Error('Не найден исходный слой неба: '+row.name);
      skyGroup.add(node);node.traverse(n=>{if(!n.isMesh)return;skyMeshCount++;n.userData.previewSkybox=true;n.castShadow=false;n.receiveShadow=false;n.frustumCulled=false;n.renderOrder=-100+row.priority;
        n.material=[].concat(n.material).map(old=>{const m=new THREE.MeshBasicMaterial({map:old.map?.clone()||null,color:old.color,opacity:old.opacity,transparent:old.transparent,alphaTest:old.alphaTest,side:THREE.DoubleSide,depthWrite:false,depthTest:false,fog:false});
          m.userData={...old.userData};GettingUpPoolMaterials.apply(m,THREE);m.depthWrite=false;
          Lighting.sky(m,row.name,lightingConfig);
          if(m.map){const motion=Lighting.skyMotion(row);
            if(motion.clamp_u)m.map.wrapS=THREE.ClampToEdgeWrapping;
            if(motion.clamp_v)m.map.wrapT=THREE.ClampToEdgeWrapping;
            m.map.needsUpdate=true;skyScroll.push({texture:m.map,u:motion.u,v:motion.v});
          }return m});if(n.material.length===1)n.material=n.material[0];
      });
    }
    const glowTextures={};
    await Promise.all(Object.entries(sourceRenderData.textures).map(async([name,r])=>{
      const bytes=await fetchBytes(r.url);if(await digest(bytes)!==r.sha256)throw Error('Original glow texture SHA-256 mismatch');
      const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
      try{const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url});
        const texture=new THREE.Texture(image);texture.encoding=THREE.sRGBEncoding;texture.needsUpdate=true;glowTextures[name]=texture;
      }finally{URL.revokeObjectURL(url)}
    }));
    sourceLighting=GettingUpPoolSourceLights.install({T:THREE,scene,world:world.scene,objects:level.scene,
      actor:actor.scene,can:can.scene,camera,data:sourceRenderData,config:lightingConfig,vertexBytes:sourceVertexBytes,textures:glowTextures});
    lightingState.source_render=sourceLighting.report;
    // Camera fade must reference the replacement actor materials.
    actorMaterials.length=0;actor.scene.traverse(n=>{if(n.isMesh)for(const material of [].concat(n.material))
      if(!actorMaterials.some(r=>r.material===material))actorMaterials.push({material,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite})});
    // Visible cover identifies the closed mission-only ladder shaft.
    const closed=S.shaft,cover=new THREE.Group();cover.name='Closed service shaft';
    let metal;world.scene.traverse(n=>{if(!metal&&n.isMesh)for(const m of [].concat(n.material))if(m.map&&(m.userData.stageTextures||[]).some(t=>/metal|steel|plate/i.test(t)))metal=m.clone()});
    metal=metal||new THREE.MeshStandardMaterial({color:0x525850,roughness:.85,metalness:.4});
    const width=closed.maxX-closed.minX,depth=closed.maxZ-closed.minZ;
    const lid=new THREE.Mesh(new THREE.BoxGeometry(width,3,depth),metal);lid.receiveShadow=true;cover.add(lid);
    const stripeMaterial=new THREE.MeshStandardMaterial({color:0xbaa54a,roughness:.9});
    for(const sign of [-1,1]){const stripe=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(width-12,depth-12),.8,4),stripeMaterial);stripe.position.y=2;stripe.rotation.y=sign*Math.atan2(depth-12,width-12);cover.add(stripe)}
    cover.position.set((closed.minX+closed.maxX)/2,-1021,(closed.minZ+closed.maxZ)/2);scene.add(cover);
    sandboxPlan.spawns.forEach((entry,index)=>{
      if(entry.source_class==='IPointSpawnPlayer')return;
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
    ready=true;for(const id of ['start','enter','demo','artOpen','reset','walk','camera','capture','step','street','spawn','erase'])$(id).disabled=false;reset();
    $('status').textContent='Локация готова · WASD / Space / V';
  }catch(e){$('status').textContent='Сборка остановлена';$('fatal').textContent=e.stack||e.message}
})();
