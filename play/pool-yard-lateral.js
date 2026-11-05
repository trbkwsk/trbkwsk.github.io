/* Original eight mode-zero ledge-side resources and native callback periods.
 * Key arbitration and collision eligibility remain OUR Pool Yard adapter. */
(function(root,factory){const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./gettingup-compiled-mixed.js'):root.GettingUpCompiledMixed,
  node?require('./gettingup-character-motion.js'):root.GettingUpCharacterMotion);
 if(node)module.exports=api;else root.GettingUpPoolLateral=api;
})(globalThis,function poolLateral(X,M){'use strict';
 const names=['left_enter','left_loop','left_exit','left_end','right_enter','right_loop','right_exit','right_end'];
 function validate(data){
  if(data?.kind!=='pool-yard-original-lateral-inputs'||!names.every(k=>data.clips?.[k]?.mode===0&&data.phases?.[k]?.rate===1&&data.phases[k].source_sha256===data.clips[k].source_sha256))throw Error('eight source-bound mode-zero lateral clips required');
  for(const side of ['left','right'])for(const part of ['enter','exit','end']){
   const t=data.transitions.find(t=>t.key===side+'_'+part&&t.event===-1);
   if(t?.calls?.length!==1||t.calls[0].target!==(part==='enter'?side+'_loop':'ledge_hang')||t.calls[0].period!==(part==='exit'&&side==='right'?12:0)||t.calls[0].flags!==0)throw Error('native lateral callback transition required');
  }return data;
 }
 class Driver{
  constructor(owner,data){this.owner=owner;this.data=validate(data);this.active=false;this.key=null;this.pending=null;this.side=0;this.input=0;this.blockedSide=0;this.blocks=0;this.starts=0;this.lastPeriod=null;this.accept=null}
  setInput(x){if(![-1,0,1].includes(x))throw Error('normalized lateral input required');this.input=x;if(x!==this.blockedSide)this.blockedSide=0}
  next(key){return this.data.transitions.find(t=>t.key===key&&t.event===-1).calls[0]}
  activate(key,period){
   const d=this.owner,c=d.controller,p=this.data.phases[key];
   c.actor=new X.MixedScriptActor(p.descriptors,p.codes,c.state);c.activateOriginal(this.data.clips[key],0,p.descriptors[0].start,period);c.actor.speed=p.rate;
   d.phase='ledge_'+key;d.pending=null;d.launched=false;d.customName=null;d.previewMode=null;
   this.key=key;this.pending=null;this.lastPeriod=period;
  }
  start(side){
   if(![-1,1].includes(side)||this.active||this.blockedSide===side||this.owner.phase!=='ledge_hang')return false;
   this.active=true;this.side=side;this.starts++;this.activate((side<0?'left':'right')+'_enter',5);return true;
  }
  cancel(){this.active=false;this.key=null;this.pending=null;this.side=0}
  finish(period){
   const d=this.owner,c=d.controller,p=d.data.ledge_phases.ledge_hang;
   c.actor=new X.MixedScriptActor(p.descriptors,p.codes,c.state);c.activateOriginal(d.data.clips.ledge_hang,0,p.descriptors[0].start,period);c.actor.speed=p.rate;
   d.phase='ledge_hang';d.pending=null;d.lastRequest={translation:[0,0,0],rotation:[0,0,0,1]};this.lastPeriod=period;this.cancel();
  }
  step(){
   if(!this.active)return null;
   if(this.pending){const next=this.pending;if(next.target==='ledge_hang'){this.finish(next.period);return null}this.activate(next.target,next.period)}
   const side=this.side<0?'left':'right';
   // Start/stop/reversal selection is the scene adapter. Callback endpoints
   // and asymmetrical return-to-hang periods come from original x86 handlers.
   if(this.key.endsWith('_loop')&&this.input!==this.side)this.activate(side+'_exit',5);
   const d=this.owner,c=d.controller,p=this.data.phases[this.key],loop=this.key.endsWith('_loop');
   const out=c.actorStep(1,{speed:p.rate,cycle_enabled:loop});d.lastRequest=out.submission?M.fromRoot(c.root):{translation:[0,0,0],rotation:[0,0,0,1]};
   c.interpolate(1);c.evaluate();d.steps++;d.events=[];
   const moved=!this.accept||this.accept(d.lastRequest);
   if(!moved&&!this.key.endsWith('_end')){this.blocks++;this.blockedSide=this.side;this.pending={target:side+'_end',period:5};d.events.push('ledge-side-blocked')}
   const ended=!!out.ended||out.submission&&out.actor_fields['0x68']===0;
   if(ended&&!loop&&!this.pending)this.pending=this.next(this.key);
   if(moved)d.events.push('ledge-side-motion');
   return {...d.snapshot(),impulse:null};
  }
  snapshot(){return {active:this.active,key:this.key,pending:this.pending,side:this.side,input:this.input,
   blocked_side:this.blockedSide,blocked_steps:this.blocks,starts:this.starts,last_transition_period:this.lastPeriod,
   native_resources:true,native_callback_periods:true,original_key_arbitration:false,original_geometry_controller:false}}
 }
 return Object.freeze({Driver,validate,moduleSource:poolLateral.toString()});
});
