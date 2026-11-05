/* Pool Yard-only input/selection policy around the unchanged RE primitives.
 * Original clips/Tag math; preview movement, stance, rates and level boundary.
 */
(function(root,factory){const node=typeof module==='object'&&module.exports;
 const get=(file,key)=>node?require('./'+file+'.js'):root[key];
 const api=factory(get('gettingup-spray-simulation','GettingUpSpraySimulation'),get('gettingup-paint-driver','GettingUpPaintDriver'),
  get('gettingup-script-actor','GettingUpScriptActor'),get('gettingup-character-motion','GettingUpCharacterMotion'),
  get('gettingup-play-simulation','GettingUpPlaySimulation'),get('gettingup-paint-surface','GettingUpPaintSurface'),get('gettingup-ledge-query','GettingUpLedgeQuery'),
  get('gettingup-area-controller','GettingUpAreaController'),get('gettingup-wall-paint-controller','GettingUpWallPaint'),get('pool-yard-original-rules','GettingUpPoolRules'),get('gettingup-compiled-mixed','GettingUpCompiledMixed'),get('pool-yard-combat','GettingUpPoolCombat'),get('pool-yard-normal-actions','GettingUpPoolNormalActions'),get('pool-yard-turn','GettingUpPoolTurn'));
 if(node)module.exports=api;else root.GettingUpPoolControls=api;
})(typeof globalThis!=='undefined'?globalThis:this,function poolControlsModule(S,D,A,M,B,G,Q,Area,Wall,Rules,Mixed,Combat,Normal,Turn){'use strict';
 const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const zero=()=>({translation:[0,0,0],rotation:[0,0,0,1]});
 // The mission-only ladder shaft is outside this sandbox's playable domain.
 const shaft=Object.freeze({minX:860,maxX:1060,minZ:1140,maxZ:1380});
 const inShaft=p=>p[0]>shaft.minX&&p[0]<shaft.maxX&&p[2]>shaft.minZ&&p[2]<shaft.maxZ;
 class Driver extends D.Driver{
  constructor(data,clips,wallPhases,locomotion,combat){super(data);this.extraClips=clips;this.wallPhases=wallPhases;this.locomotion=locomotion;this.combat=combat;this.combatName=null;this.combatFinished=false;this.combatCount=0;this.nativeActionEvents=[];this.duckPhase='standing';this.customName=null;this.previewMode=null;this.crouchRequested=false;this.wallDirection=0}
  custom(name,phase,rate=1,{loop=true,period=5,seek=null}={}){
   const c=this.controller,clip=this.combat?.clips[name]||this.locomotion?.clips[name]||this.extraClips[name];if(!clip||![0,1].includes(clip.mode))throw Error('verified preview clip required');
   const definition=this.combat?.phases[name]||this.locomotion?.phases[name]||this.wallPhases?.[name];
   if((this.combat?.clips[name]||name.startsWith('wall_')||name.startsWith('duck_'))&&(!definition||definition.source!==clip.source||definition.source_sha256!==clip.source_sha256))throw Error('matching native action binding required');
   if(definition)rate=name===this.combatName?this.combatRate:definition.rate;
   if(this.customName!==name){c.actor=definition?new Mixed.MixedScriptActor(definition.descriptors,definition.codes,c.state):new A.ScriptActor([{token:0,kind:0,duration:0,direction:1,start:0,end:clip.frames-(name.includes('paint_')?2:1),next_frame:-1}],[0],c.state);c.activateOriginal(clip,0,seek??definition?.descriptors[0].start??0,period);this.customName=name}
   this.phase=phase;this.pending=null;this.previewMode=name;this.walk.mode='preview';this.events=[];
   const out=c.actorStep(1,{speed:rate,cycle_enabled:loop});this.customEnded=!!out.ended||!!out.submission&&out.actor_fields['0x68']===0;this.lastRequest=out.submission&&!name.endsWith('idle')?M.fromRoot(c.root):zero();
   c.interpolate(1);c.evaluate();this.steps++;return {...this.snapshot(),impulse:null};
  }
  duck(mode){
   if(!this.locomotion)throw Error('original Duck resources required');
   let seek=null;
   if(this.crouchRequested){
    if(this.duckPhase==='standing'||this.duckPhase==='duck_exit'){
     if(this.duckPhase==='duck_exit')seek=Math.floor(this.controller.frameOf(this.controller.state));
     this.duckPhase='duck_enter';
    }else if(this.duckPhase!=='duck_enter')this.duckPhase=mode==='idle'?'duck_idle':'duck_walk';
   }else if(this.duckPhase!=='duck_exit'){
    if(this.duckPhase==='duck_enter')seek=Math.floor(this.controller.frameOf(this.controller.state));
    this.duckPhase='duck_exit';
   }
   const action=this.duckPhase,loop=['duck_idle','duck_walk'].includes(action);
   const out=this.custom(action,'roam',1,{loop,period:action==='duck_idle'?0:10,seek});
   // These terminal targets come from the original -1 event handlers. The
   // Shift/collision gate selecting Duck remains the existing preview policy.
   if(!loop&&this.customEnded){this.duckPhase=action==='duck_exit'?'standing':mode==='idle'?'duck_idle':'duck_walk';if(action!=='duck_exit')this.customName=null}
   return out;
  }
  startCombat(name){
   if(!['punch','kick','evade_left','evade_right'].includes(name)||!this.combat?.phases[name])throw Error('verified targetless action required');
   if(this.phase!=='roam'||this.pending||this.duckPhase!=='standing')return false;
   this.combatName=name;this.combatRate=this.combat.phases[name].rate;this.combatFinished=false;this.phase='combat_'+name;this.combatCount++;this.customName=null;return true;
  }
  combatStep(){
   if(this.combatFinished){this.combatName=null;this.combatFinished=false;this.nativeActionEvents=[];this.phase='roam';this.customName=null;this.previewMode=null;this.walk.mode='after-combat';return null}
   const name=this.combatName,starting=this.customName!==name;
   this.custom(name,'combat_'+name,1,{loop:false,period:5});
   this.nativeActionEvents=this.controller.actor.events.map(([code])=>code);
   // Original event ticks, not wall time or a truncated rendered BNM frame.
   for(const[code,tick]of this.controller.actor.events)if(code===-4)this.combatRate=Normal.rateAtTick(name,tick,this.combatRate);
   this.turnBridge?.events(this.controller.actor.events);
   this.events=[...(starting?['combat-start']:[]),...this.nativeActionEvents.map(code=>'combat-native-event:'+code)];
   if(this.customEnded){this.combatFinished=true;this.events.push('combat-end')}
   return {...this.snapshot(),impulse:null};
  }
  collisionResolved(grounded,descending,wasGrounded){
   if(this.combatName&&!grounded){this.combatName=null;this.combatFinished=false;this.nativeActionEvents=[];this.customName=null;this.previewMode=null;this.phase='roam';this.walk.mode='after-combat';this.events.push('combat-support-lost')}
   return super.collisionResolved(grounded,descending,wasGrounded);
  }
  step(mode,controls={}){
   if(this.combatName){const action=this.combatStep();if(action)return action}
   const paint=controls.paint;
   if(Number.isInteger(paint)){
    this.duckPhase='standing';
    const pos=this.wallPosition??13,local=pos%9,row=Math.floor(local/3),stance=pos<9?'reach':pos<18?'stand':'crouch';
    if(this.wallDirection)return this.custom('wall_'+stance+'_'+(this.wallDirection<0?'left':'right')+'_'+row,'paint_'+paint);
    if(stance!=='stand')return this.custom(stance+'_paint_'+local,'paint_'+local,.5);
    controls={...controls,paint:local};
   }else if(this.phase==='roam'&&!this.pending&&(this.crouchRequested||this.duckPhase!=='standing'))return this.duck(mode);
   if(this.customName){if(this.phase.startsWith('paint_'))this.phase='paint_preview';this.customName=null;this.previewMode=null}
   return super.step(mode,controls);
  }
  snapshot(){const s=super.snapshot();return {...s,mode:this.previewMode||s.mode,preview_clip:this.customName||null,duck_animation_phase:this.duckPhase||'standing',combat_action:this.combatName,combat_actions_started:this.combatCount||0,combat_rate:this.combatName?this.combatRate:null,combat_script_tick:this.combatName?this.controller.actor.script_tick:null,normal_profile_source:'original-constructor-f6b5-1',native_action_events:(this.nativeActionEvents||[]).slice(),combat_target_selection_verified:false,combat_damage_verified:false}}
 }
 class Simulation extends S.Simulation{
  constructor(data,world,spawn,yaw,shape,resources){
   if(resources?.kind!=='pool-yard-control-resources'||resources.artworks?.length<2)throw Error('local Pool Yard controls required');
   super(data,world,spawn,yaw,shape);this.driver=new Driver(data,resources.clips,resources.wallPhases,resources.locomotion,resources.combat);this.resources=resources;this.combatInput=new Combat.Input();
   this.artworks=resources.artworks.map(a=>({...a,controllerOptions:data.tagData.controllerOptions}));this.artworkIndex=0;this.sizeIndex=0;this.sizeMode=1;this.nextPanelId=0;this.wallPosition=13;this.wallCooldown=0;this.waitRelease=false;this.completedPieces=0;
   this.tagData=this.artworks[0];this.standingShape={...shape};this.crouched=false;this.standBlocked=false;this.wallDistance=0;this.shaftBlocks=0;this.notice='';this.noticeTTL=0;
  }
  message(text){this.notice=text;this.noticeTTL=180}
  clearActionInput(){this.combatInput=new Combat.Input()}
  stepTurning(input){
   // Keep the sealed shared simulation bytes intact. In this synchronous Sns
   // interval only, hand the original matrix-transformed request to the same
   // collider. All ancestor paint/drip/history maintenance still runs.
   const world=this.world,advance=world.advance,bridge=this.turnBridge;let calls=0;
   world.advance=(position,delta,...args)=>{
    if(++calls!==1)throw Error('one movement request per bounded Sns step required');
    const wanted=bridge.motion(this.driver.lastRequest),out=advance.call(world,position,[wanted[0],delta[1],wanted[2]],...args);
    this.heading=bridge.finish();return out;
   };
   try{const result=super.step(input);if(calls!==1)throw Error('missing Sns scene movement request');return result}
   finally{world.advance=advance}
  }
  fits(frame,width,height){return [[-width/2,-height/2],[width/2,-height/2],[-width/2,height/2],[width/2,height/2]].every(([x,y])=>{
   const p=frame.origin.map((v,i)=>v+frame.right[i]*x+(i===1?y:0)),hit=Q.ray(this.world,p.map((v,i)=>v+frame.normal[i]*2),p.map((v,i)=>v-frame.normal[i]*2));
   return hit.hit&&Math.hypot(...sub(hit.point,p))<.1&&dot(hit.normal,frame.normal)>.99;
  })}
  selectedData(){const a=this.artworks[this.artworkIndex];return this.sizeMode===2?{...a,...a.big}:a}
  configureUnpainted(panel){
   if(panel.grid.samples)return false;const data=this.selectedData(),ext=Rules.extent(data.tiles);
   const base=panel.wallBase||panel.frame.origin.map((v,i)=>i===1?v-48:v),original={...panel.frame,origin:base.map((v,i)=>i===1?v+ext.center:v)};
   const offsets=[0,...Array.from({length:6},(_,i)=>[-12*(i+1),12*(i+1)]).flat()];
   const shift=offsets.find(x=>this.fits({...original,origin:original.origin.map((v,i)=>v+original.right[i]*x)},ext.width,ext.height-.2));
   if(shift===undefined){this.message('Этот размер не помещается на стене');return false}
   panel.wallBase=base;panel.tagOrigin=original.origin.map((v,i)=>v+original.right[i]*shift);panel.frame={...original,origin:panel.tagOrigin,width:ext.width,height:ext.height};
   panel.previewScale=1;panel.goBig=this.sizeMode===2;panel.grid=new S.Panel(data,this.rng);panel.area=new Area.Area(data.controllerOptions,data.tiles,data.autoComplete);panel.area.grid=panel.grid;panel.area.hasPreviousTag=false;panel.area.goBig=panel.goBig;panel.previewVisible=true;panel.renderPhase=0;panel.renderTimer=0;return true;
  }
  selectArtwork(index){
   if(!Number.isInteger(index)||index<0||index>=this.artworks.length)throw Error('known artwork required');
   this.artworkIndex=index;this.tagData=this.artworks[index];this.notice='';
   if(this.paintAnchor&&!this.configureUnpainted(this.paintAnchor)&&this.paintAnchor.grid.samples)this.message('Начатый рисунок сохранён. Выбранный эскиз — для следующей стены');
  }
  cycleArtwork(delta){this.selectArtwork((this.artworkIndex+delta+this.artworks.length)%this.artworks.length)}
  resizeArtwork(delta){this.sizeMode=Rules.sizeMode(this.sizeMode,delta);this.sizeIndex=this.sizeMode-1;this.notice='';if(this.paintAnchor&&!this.configureUnpainted(this.paintAnchor)&&this.paintAnchor.grid.samples)this.message('Размер начатой работы сохранён. Новый размер — для следующей стены')}
  canStand(){const p=this.position,s=this.standingShape;
   return [[0,0],[-s.radius*.8,0],[s.radius*.8,0],[0,-s.radius*.8],[0,s.radius*.8]].every(([x,z])=>
    !this.world.ray([p[0]+x,p[1]+s.footOffset+s.height*.65,p[2]+z],[p[0]+x,p[1]+s.footOffset+s.height,p[2]+z]).hit);
  }
  resumePanel(){
   const frame=G.find(this.world,this.position,this.heading);if(!frame)return;
   const panel=this.panels.find(p=>p.grid instanceof S.Panel&&dot(p.frame.normal,frame.normal)>.99&&
    Math.abs(dot(sub(frame.origin,p.frame.origin),p.frame.normal))<.1&&Math.abs(dot(sub(frame.origin,p.frame.origin),p.frame.right))<=p.frame.width/2+32&&Math.abs(frame.origin[1]-p.frame.origin[1])<60);
   if(!panel||panel.area?.state>=2)return;this.paintAnchor=panel;this.paintIndex=panel.lastPaintIndex??4;this.wallPosition=panel.wallPosition??13;this.paintCooldown=0;this.paintEntries++;this.vertical=0;this.horizontal=[0,0];
   this.heading=Math.atan2(-panel.frame.normal[0],-panel.frame.normal[2]);
  }
  step(input){
   if(this.noticeTTL>0&&!--this.noticeTTL)this.notice='';
   if(input.use!==undefined&&typeof input.use!=='boolean')throw Error('boolean use/evade input required');
   const enabled=!!this.resources.combat&&!input.v&&!input.crouch&&!this.paintAnchor&&this.grounded;
   const recent=this.combatInput.step({punch:input.spray,kick:input.fast,use:input.use},enabled);
   if(enabled&&this.driver.phase==='roam'&&!this.crouched){
    const action=Normal.select({...recent,speed:input.x||input.z?1:0,angle:Combat.relativeAngle(input.x,input.z,input.cameraYaw,this.heading),stateCode:input.x||input.z?input.walk?12:14:10});
    if(action&&this.driver.startCombat(action))this.combatInput.consume();
   }
   const evading=!!this.driver.combatName?.startsWith('evade_')&&!this.driver.combatFinished;
   if(evading){this.turnBridge??=new Turn.Bridge(this.heading);this.heading=this.turnBridge.begin(input);this.driver.turnBridge=this.turnBridge}
   else{this.turnBridge=null;this.driver.turnBridge=null}
   const crouch=input.v?false:(input.crouch??false)||evading;if(typeof crouch!=='boolean')throw Error('boolean crouch input required');
   this.standBlocked=!crouch&&this.crouched&&!this.canStand();this.crouched=crouch||this.standBlocked;
   this.shape=this.crouched?{...this.standingShape,height:this.standingShape.height*.5,stepHeight:Math.min(this.standingShape.stepHeight,this.standingShape.height*.2)}:{...this.standingShape};
   this.driver.crouchRequested=this.crouched&&this.grounded&&!this.driver.combatName;
   if(!input.v)this.waitRelease=false;
   const v=input.v&&!this.waitRelease;
   if(v&&!this.paintAnchor&&this.grounded&&this.driver.phase==='roam'){
    this.resumePanel();
    if(!this.paintAnchor){const frame=G.find(this.world,this.position,this.heading);if(frame){
     const overlap=this.panels.find(p=>dot(p.frame.normal,frame.normal)>.99&&Math.abs(dot(sub(frame.origin,p.frame.origin),p.frame.normal))<.1&&Math.abs(dot(sub(frame.origin,p.frame.origin),p.frame.right))<p.frame.width/2+32);
     if(overlap?.area?.state>=2){this.waitRelease=true;this.message('Граффити завершено. Выбери свободное место на стене')}
     else{const panel={id:this.nextPanelId++,frame,searchOrigin:frame.origin.slice(),grid:{samples:0}};
      if(this.configureUnpainted(panel)){this.panels.push(panel);this.paintAnchor=panel;this.wallPosition=13;this.paintEntries++;this.vertical=0;this.horizontal=[0,0];this.heading=Math.atan2(-frame.normal[0],-frame.normal[2])}
      else this.waitRelease=true;
     }
    }}
   }
   const effectiveV=v&&!this.waitRelease;
   if(this.paintAnchor&&!effectiveV){this.paintAnchor.area.stop();this.paintAnchor.previewVisible=false;
    if(!this.paintAnchor.grid.samples)this.panels=this.panels.filter(p=>p!==this.paintAnchor);
   }
   const before=this.position.slice(),wasGrounded=this.grounded;
   this.driver.wallDirection=effectiveV&&this.paintAnchor?input.x:0;
   if(effectiveV&&this.paintAnchor){const height=this.paintAnchor.grid.data.tiles[1];
    const bounds=Wall.bounds({f5a0:1,f5a4:1,f5ea:height>1,f5eb:true,f5ec:height>2,f5cc:this.wallPosition});
    if(this.wallCooldown)this.wallCooldown--;
    if(!this.wallCooldown&&(input.z||input.x)){
     const row=Math.floor(this.wallPosition/3),col=this.wallPosition%3;
     this.wallPosition=Math.max(bounds.f638,Math.min(bounds.f644,(row-input.z)*3+Math.max(0,Math.min(2,col+input.x))));this.wallCooldown=12;
    }
    this.wallPosition=Math.max(bounds.f638,Math.min(bounds.f644,this.wallPosition));
    this.paintIndex=this.wallPosition%9;this.driver.wallPosition=this.wallPosition;this.paintAnchor.wallPosition=this.wallPosition;this.paintAnchor.previewVisible=true;
   }
   // A/D move Trane, W/S select hand height. Paint is applied after movement.
   const raw={...input,v:effectiveV&&!!this.paintAnchor,jump:input.jump&&!this.crouched&&!this.driver.combatName,x:effectiveV?0:input.x,z:effectiveV?0:input.z,spray:false,fast:false};
   if(this.turnBridge)this.stepTurning(raw);else super.step(raw);
   this.spraying=false;
   for(const panel of this.panels){if(!panel.area)continue;panel.renderPhase=panel.area.state;
    if(panel.area.state===1)panel.area.elapsed=Math.fround(panel.area.elapsed+Math.fround(1/60));
    if(panel.area.state===2){const next=Rules.completionTimer(panel.renderTimer,1/60);panel.renderTimer=next.timer;if(next.done)panel.area.state=3}
   }
   if(effectiveV&&this.paintAnchor){
    const panel=this.paintAnchor,f=panel.frame;panel.lastPaintIndex=this.paintIndex;
    if(input.x){
     // Preserve the original clip's signed displacement. The former absolute
     // length followed by -input.x reversed both A and D after wall alignment.
     const vector=B.displayVector(this.driver.lastRequest,this.heading,this.position),lateral=Math.max(-3,Math.min(3,dot(vector,f.right)));
     const at=dot(sub(this.position,f.origin),f.right),next=Math.max(-f.width/2-28,Math.min(f.width/2+28,at+lateral));
     const result=this.world.advance(this.position,[f.right[0]*(next-at),-.12,f.right[2]*(next-at)],this.shape,this.grounded);
     const chest=[result.position[0],f.origin[1],result.position[2]],hit=Q.ray(this.world,chest,chest.map((v,i)=>v-f.normal[i]*55));
     if(result.grounded&&hit.hit&&dot(hit.normal,f.normal)>.99&&Math.abs(dot(sub(hit.point,f.origin),f.normal))<.1&&!inShaft(result.position)){this.wallDistance+=Math.hypot(result.position[0]-this.position[0],result.position[2]-this.position[2]);this.position=result.position;this.lastCollision={contacts:result.contacts,substeps:result.substeps,stepped:result.stepped}}
    }
    const item=this.itemMatrix();this.lastPaintHit=item?G.project(this.world,f,requirePoint(item,this.data.can.nozzle_proxy)):null;
    const distance=dot(sub(this.position,f.origin),f.normal),hit=this.lastPaintHit;
    if((input.spray||input.fast)&&hit&&Math.abs(32-distance)<.01&&panel.area.state<2){
     if(panel.area.state===0||panel.area.layer===-1)panel.area.start(input.fast,panel.grid.data.complex,4.5);
     panel.grid.paint(hit.u,hit.v,input.fast);panel.area.dripped=panel.area.dripped||panel.grid.drips.length>0;this.spraying=true;this.events.push(input.fast?'paint-fast':'paint-normal');if(panel.grid.samples%30===0)this.events.push('paint-stroke');
     if(Rules.complete(panel.grid.summary().coverage,panel.area.threshold)){
      panel.area.finish();panel.area.stop();panel.renderPhase=2;panel.renderTimer=Rules.completionTimer(0,1/60).timer;panel.previewVisible=false;this.completedPieces++;this.events.push('graffiti-complete');this.message('Граффити завершено');this.paintAnchor=null;this.waitRelease=true;
     }
    }else if(panel.area.state===1)panel.area.stop();
   }
   if(inShaft(this.position)){this.position=before;this.vertical=0;this.horizontal=[0,0];this.grounded=wasGrounded;this.driver.collisionResolved(wasGrounded,true,wasGrounded);this.shaftBlocks++;this.events.push('sandbox-shaft-closed');this.message('Служебный спуск закрыт. Продолжай прогулку по двору')}
   if(this.history.length)this.history[this.history.length-1]={...input};return this.snapshot();
  }
  snapshot(){return {...super.snapshot(),crouched:!!this.crouched,stand_blocked:!!this.standBlocked,selected_artwork:this.artworks?.[this.artworkIndex]?.name||null,
   selected_size_mode:this.sizeMode||1,selected_tiles:this.artworks?this.selectedData().tiles:null,active_artwork:this.paintAnchor?.grid.data?.name||null,wall_travel_distance:this.wallDistance||0,shaft_blocks:this.shaftBlocks||0,
   wall_pose_position:this.wallPosition??13,completed_pieces:this.completedPieces||0,
   graffiti_lifecycle:(this.panels||[]).filter(p=>p.area).map(p=>({id:p.id,name:p.grid.data.name,tiles:p.grid.data.tiles,goBig:p.goBig,threshold:p.area.threshold,state:p.area.state,render_phase:p.renderPhase,render_timer:p.renderTimer,layer:p.area.layer,elapsed:p.area.elapsed,budget:p.area.budget,score_flags:p.area.score_flags,preview:p.previewVisible,coverage:p.grid.summary().coverage})),
   active_piece_progress:this.paintAnchor?Math.min(1,Math.max(0,this.paintAnchor.grid.summary().coverage)):null,navigation_turn:this.turnBridge?.snapshot()||null,preview_controls_policy:true,notice:this.notice||''}}
 }
 function requirePoint(m,p){return [0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i])}
 return Object.freeze({Driver,Simulation,shaft,inShaft,moduleSource:poolControlsModule.toString()});
});
