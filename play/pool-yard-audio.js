/* Source XML event frames and original sound files. Web Audio mixing,
 * default-surface fallback and Tag->loop gate are explicit preview policies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpPoolAudio=api;
})(globalThis,function poolAudio(){'use strict';
 const yes=v=>String(v).toLowerCase()==='true';
 function validate(d){
  if(d?.kind!=='pool-yard-original-audio'||!d.events||!d.sounds||!d.default_surface||d.ambience?.bound?.['Bound Type']!=='Box'||d.ambience.transform?.length!==16)throw Error('source-bound Pool Yard audio required');
  for(const events of Object.values(d.events))for(const e of events)if(!['CharEvent_PlaySound','CharEvent_Footstep'].includes(e.kind)||!Number.isFinite(Number(e.Frame))||Number(e.Frame)<0)throw Error('source character sound frame required');
  return d;
 }
 function inside(d,position){
  if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))throw Error('finite display position required');
  const t=d.ambience.transform,p=[-position[0]-t[12],position[1]-t[13],position[2]-t[14]],b=d.ambience.bound,
   local=[0,1,2].map(i=>p.reduce((s,v,j)=>s+v*t[i*4+j],0));
  return local.every((v,i)=>Math.abs(v)<=Number(b[['Width','Height','Length'][i]])/2);
 }
 class Timeline{
  constructor(data){this.data=validate(data);this.previous=null;this.emitted=0}
  clear(){this.previous=null}
  step(view){
   if(!view||typeof view.sequence!=='string'||!Number.isInteger(view.epoch)||!Number.isInteger(view.cycle)||view.cycle<0||!Number.isFinite(view.frame)||view.frame<0||view.frame>4096||!Number.isFinite(view.start)||!Number.isFinite(view.length))throw Error('actual actor sequence/frame/cycle required');
   const old=this.previous,key=old&&old.sequence===view.sequence&&old.epoch===view.epoch,events=this.data.events[view.sequence]||[],out=[];
   if(!key&&old)for(const e of this.data.events[old.sequence]||[])if(yes(e.Exit))out.push(e);
   if(!key)for(const e of events)if(yes(e.Enter))out.push(e);
   const first=key?old.cycle:view.cycle;if(view.cycle-first>8||view.cycle<first)throw Error('bounded forward actor cycle interval required');
   for(let cycle=first;cycle<=view.cycle;cycle++){
    const from=key&&cycle===old.cycle?old.frame:view.start-1,to=cycle===view.cycle?view.frame:view.length;
    if(to<from&&key&&view.cycle===old.cycle)continue;
    for(const e of events)if(!yes(e.Enter)&&!yes(e.Exit)&&Number(e.Frame)>from&&Number(e.Frame)<=to)out.push(e);
   }
   this.previous={...view};this.emitted+=out.length;return out;
  }
 }
 function sequence(driver,resources){
  if(driver.lateral?.active)return resources.lateral.phases[driver.lateral.key].sequence;
  if(driver.customName)return (resources.wallPhases?.[driver.customName]||resources.locomotion?.phases[driver.customName]||resources.combat?.phases[driver.customName])?.sequence||'';
  if(driver.phase==='roam')return resources.normal?.phases[driver.walk.mode]?.sequence||'';
  return (driver.data.phases[driver.phase]||driver.data.ledge_phases?.[driver.phase]||driver.data.paint_phases?.[driver.phase])?.sequence||'';
 }
 class Engine{
  constructor(data,raw,createContext){this.data=validate(data);this.raw=raw;this.createContext=createContext;this.context=null;this.buffers=new Map();this.timeline=new Timeline(data);this.running=false;this.ready=false;this.errors=[];this.loops=new Map();this.voices=new Set();this.played=0;this.dropped=0;this.actor=null;this.epoch=0;this.inAmbience=false;this.sprayWanted=false}
  unlock(){
   try{
    this.context??=this.createContext();const context=this.context;
    if(this.running)context.resume().catch(e=>this.errors.push(String(e)));
    this.preparing??=Promise.all([...this.raw].map(async([key,bytes])=>{const buffer=await context.decodeAudioData(bytes.slice(0));this.buffers.set(key,buffer)})).then(()=>{this.ready=true;this.sync()}).catch(e=>this.errors.push(String(e)));
    return this.preparing;
   }catch(e){this.errors.push(String(e));return Promise.resolve()}
  }
  setRunning(value){
   if(typeof value!=='boolean')throw Error('boolean audio run state required');
   if(this.running===value)return;this.running=value;
   if(!value){this.sprayWanted=false;this.loop('spray',this.data.spray,false);this.context?.suspend().catch(e=>this.errors.push(String(e)))}
   else{this.context?.resume().then(()=>this.sync()).catch(e=>this.errors.push(String(e)))}
  }
  start(key,volume=100,loop=false){
   if(!this.context||!this.ready||!this.running||!this.buffers.has(key)){this.dropped++;return null}
   const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.buffers.get(key);source.loop=loop;gain.gain.value=Math.max(0,Math.min(1,Number(volume)/100));
   source.connect(gain);gain.connect(this.context.destination);const voice={source,gain,key};this.voices.add(voice);
   source.onended=()=>{this.voices.delete(voice);source.disconnect();gain.disconnect()};source.start();this.played++;return voice;
  }
  loop(name,key,wanted){
   const old=this.loops.get(name);
   if(old&&!wanted){old.source.stop();this.loops.delete(name)}
   if(wanted&&!old&&this.ready&&this.running){const voice=this.start(key,100,true);if(voice)this.loops.set(name,voice)}
  }
  sync(){if(!this.ready||!this.running)return;this.loop('ambience','@ambience',this.inAmbience);this.loop('spray',this.data.spray,this.sprayWanted)}
  update(driver,resources,position,spraying){
   const c=driver.controller;if(c.actor!==this.actor){this.actor=c.actor;this.epoch++}
   const view={sequence:sequence(driver,resources),epoch:this.epoch,frame:c.frameOf(c.state),cycle:c.actor.cycles||0,start:c.actor.chain.descriptors[0].start,length:c.clip.frames};
   for(const e of this.timeline.step(view)){
    const choices=e.kind==='CharEvent_PlaySound'?this.data.references[e.RefID]:this.data.default_surface[e.Type];
    if(choices?.length)this.start(choices[0],e.Volume??100);
   }
   this.inAmbience=inside(this.data,position);this.sprayWanted=!!spraying;this.sync();
  }
  reset(){this.timeline.clear();this.actor=null;this.sprayWanted=false;this.loop('spray',this.data.spray,false);for(const voice of this.voices)if(voice!==this.loops.get('ambience'))voice.source.stop()}
  snapshot(){return {unlocked:!!this.context,ready:this.ready,running:this.running,context_state:this.context?.state||'locked',active_loops:[...this.loops.keys()],played:this.played,dropped_before_ready:this.dropped,event_count:this.timeline.emitted,errors:this.errors.slice(-4),native_mixer_verified:false,native_material_query_verified:false,variant_policy:this.data.variant_policy}}
 }
 async function load(data,fetchBytes,digest,createContext){
  validate(data);const raw=new Map(),files=[...Object.entries(data.sounds),['@ambience',data.ambience]];
  await Promise.all(files.map(async([key,r])=>{const bytes=await fetchBytes(r.url);if(await digest(bytes)!==r.sha256)throw Error('Original audio SHA-256 differs: '+key);raw.set(key,bytes)}));
  return new Engine(data,raw,createContext);
 }
 return Object.freeze({validate,inside,Timeline,Engine,load,sequence,moduleSource:poolAudio.toString()});
});
