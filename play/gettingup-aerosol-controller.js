/* Bounded original Aerosol body. Movement, tutorial and AV services are external.
 * Inventory effects are requests: this module never assumes damage succeeded.
 */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.GettingUpAerosol=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const f=Math.fround,eligible=id=>[36,40,42].includes(id);
 function floor(mode,upgrade){return ([9,17,22].includes(mode)||upgrade)?0.75:1.25}
 function consume(level,health,c){
  level=f(level);health=f(health);const min=floor(c.mode,c.upgrade),effects=[];
  if(!(level>min))return {level,allowed:false,effects};
  const fast=c.fast_unlocked&&([9,17].includes(c.mode)?c.primary||c.secondary:c.secondary);
  let amount=fast?f(min*f(1.4)):min;
  if(level-amount<min)amount=f(level-min);
  level=f(level-amount);
  if(eligible(c.item_id)&&health!==level)effects.push({op:health>level?'damage':'change-health',amount:f(Math.abs(health-level))});
  return {level,allowed:true,effects};
 }
 function recover(level,health,c,force=false){
  level=f(level);health=f(health);if(level<500)level=force||level+5>500?500:f(level+5);
  const effects=[];if(eligible(c.item_id)&&health!==level)effects.push({op:'change-health',amount:f(Math.abs(health-level))});
  return {level,effects};
 }
 function randomInclusive(state,lo,hi){state=(Math.imul(state,214013)+2531011)>>>0;const value=(state>>>16)&32767;return {state,value:Math.min(hi,lo+Math.trunc(value*f(1/32767)*(hi-lo+1)))}}
 function step(previous,input,c,services){
  if(typeof services?.inventory!=='function')throw Error('explicit inventory response required');
  const s={...previous},effects=[],p=!!input.primary,k=!!input.secondary;
  s.f61d=p;s.f61e=k;s.f61c=p||k;s.f550=6;s.f5a9=!!input.ready;s.f56c=input.blocked||0;
  const ready=s.f5a9&&!s.f5d8,high=s.level>floor(c.mode,c.upgrade),full=s.level>=500,healthShort=s.health<s.level,low=s.level<=50;
  let idleExpired=false;
  if(s.f61c||full)s.f5dc=0;else if(s.f5dc===0)s.f5dc=25;else if(s.f5dc>1)s.f5dc--;else idleExpired=true;
  s.f5d8=!!input.playing;s.f5d9=!!(input.playing&&!input.at_start);
  const inventory=r=>{s.level=r.level;for(const e of r.effects){effects.push(e);s.health=f(services.inventory(e,s.health))}};
  const fast=()=>s.f568&&([9,17].includes(c.mode)?p||k:k);
  if(s.f56c>0)s.f61c=false;
  else if(s.f61c&&ready&&high&&!s.f5db){
   if(!s.f559)inventory(consume(s.level,s.health,{...c,primary:p,secondary:k,fast_unlocked:s.f568}));
   if(s.f61c&&!s.f5aa){s.f5a8=true;if(!s.f2fb){s.f2fb=true;effects.push({op:'fx',event:4})}effects.push({op:'start',fast:!!fast()});s.f5aa=true}
  }else if(s.f5aa&&(!high||!s.f61c)){
   if(s.f2fb){s.f2fb=false;effects.push({op:'fx',event:5})}effects.push({op:'stop'});s.f5aa=false;
  }else if((idleExpired&&!s.f61c)||healthShort){
   if((!s.f5d8||s.f5d9)&&!healthShort){effects.push({op:'sound-play',sound:101,args:[1112014848,1,1157234688,4294967295,0,256]});effects.push({op:'animation',name:'TR_Tag_CanShake_LookF',layer:4,speed:1.5,args:[0,s.f5d9?5:15,15,0,1,4]})}
   inventory(recover(s.level,s.health,c));
  }
  const rand=(lo,hi)=>{const r=randomInclusive(s.rng,lo,hi);s.rng=r.state;return r.value};
  if(s.f5a9&&low){s.f5da=true;if(s.f5e0<150)s.f5e0++;
   if(s.f5e4===0){s.f5db=!s.f5db;s.f5e4=rand(2,7);if(s.f5db&&s.f5e0>=100&&rand(0,5)===0){const d=Math.trunc(s.f5e0/10);s.f5e4=rand(d*2,d*3)}}else s.f5e4--;
  }else{s.f5da=false;s.f5e0=0;s.f5e4=0;s.f5db=false}
  const startSound=()=>{effects.push({op:'sound-play',sound:fast()?103:102,args:[1116471296,4294967295,1145569280,4294967295,0,256]});s.f590=services.soundHandle};
  if(s.f5da){if(s.f61c&&high&&!s.f590&&!s.f5db&&!s.f5d8)startSound();else if(s.f590&&(s.f5db||s.f5d8)){effects.push({op:'sound-stop',handle:s.f590,fade:7});s.f590=0}}
  else if(s.f61c&&high&&!s.f590&&s.f5a9&&!s.f5d8)startSound();
  else if(s.f590&&(!s.f5a9||s.f5d8)){effects.push({op:'sound-stop',handle:s.f590,fade:0});s.f590=0}
  return {state:s,effects};
 }
 return Object.freeze({floor,consume,recover,randomInclusive,step});
});
