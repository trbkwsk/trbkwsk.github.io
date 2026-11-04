/* Original map-4/InfoBound-13 Aerosol tutorial and shared body.
 * Environment/layer queries, wall readiness and inventory are explicit
 * services. This module does not poll a device or render ITip/audio/FX.
 */
(function(root,factory){const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./gettingup-aerosol-controller.js'):root.GettingUpAerosol);
 if(node)module.exports=api;else root.GettingUpAerosolTutorial=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(M){'use strict';
 const f=Math.fround,number=w=>new Float32Array(new Uint32Array([w]).buffer)[0];
 const integer=v=>Number.isInteger(v)&&v>=-2147483648&&v<=2147483647;
 function prefix(previous,env){
  const s={...previous},effects=[];
  if(!integer(s.f550)||!integer(s.f554)||typeof env.inBound!=='boolean'||
   !Number.isInteger(s.strength_word)||s.strength_word<0||s.strength_word>0xffffffff||!Number.isFinite(number(s.strength_word)))
   throw Error('signed phase/countdown, finite float32 strength and explicit InfoBound input required');
  if(!env.inBound)s.f550=6;
  if(env.identity!==78||env.mode!==4||!env.inBound||s.f550>5)return {state:s,effects};
  if(s.f5d8&&s.f550===4)s.f55e=true;
  if(s.f550<5&&s.f561){s.f561=false;s.drips_enabled=false;effects.push({op:'drips-enable',enabled:false})}
  const tip=(index,seconds)=>effects.push({op:'tip',id:'IDS_TUT_GRAFF_AEROSOL_'+index,seconds,flag:false,channel:-1});
  if(s.f554!==0){
   if(s.f554>0&&(s.f550===1||s.f550===2&&number(s.strength_word)>=f(.2)||s.f550>2&&s.f61c))s.f554--;
  }else{
   switch(s.f550){
    case 0:s.f554=30;s.f550=1;break;
    case 1:tip(1,4);s.f554=175;s.f550++;break;
    case 2:tip(2,5);s.f554=225;s.f550++;break;
    case 3:tip(3,5);s.level=250;s.f554=225;s.f550++;break;
    case 4:
     if(s.f5d8)s.f55e=true;
     if(s.f55e){tip(4,3);s.f554=200;s.f550++}break;
    case 5:tip(5,7);s.f561=true;s.drips_enabled=true;effects.push({op:'drips-enable',enabled:true});s.f554=300;s.f550++;break;
   }
  }
  if(s.f550<3)s.f61c=false;
  s.f559=s.f550<4;return {state:s,effects};
 }
 function step(previous,input,c,services){
  if(typeof services?.inventory!=='function'||typeof services?.wallReady!=='function')throw Error('explicit inventory and wall services required');
  const start=prefix(previous,c),s=start.state,effects=start.effects,p=!!s.f61d,k=!!s.f61e;
  s.f5a9=!!services.wallReady(s);
  const ready=s.f5a9&&!s.f5d8,high=s.level>M.floor(c.mode,c.upgrade),full=s.level>=500,healthShort=s.health<s.level,low=s.level<=50;
  let idleExpired=false;
  if(s.f61c||full)s.f5dc=0;else if(s.f5dc===0)s.f5dc=25;else if(s.f5dc>1)s.f5dc--;else idleExpired=true;
  s.f5d8=!!input.playing;s.f5d9=!!(input.playing&&!input.at_start);
  const inventory=r=>{s.level=r.level;for(const e of r.effects){effects.push(e);s.health=f(services.inventory(e,s.health))}};
  const fast=()=>s.f568&&([9,17].includes(c.mode)?p||k:k);
  if(s.f56c>0)s.f61c=false;
  else if(s.f61c&&ready&&high&&!s.f5db){
   if(!s.f559)inventory(M.consume(s.level,s.health,{...c,primary:p,secondary:k,fast_unlocked:s.f568}));
   if(s.f61c&&!s.f5aa){s.f5a8=true;if(!s.f2fb){s.f2fb=true;effects.push({op:'fx',event:4})}effects.push({op:'start',fast:!!fast()});s.f5aa=true}
  }else if(s.f5aa&&(!high||!s.f61c)){
   if(s.f2fb){s.f2fb=false;effects.push({op:'fx',event:5})}effects.push({op:'stop'});s.f5aa=false;
  }else if((idleExpired&&!s.f61c)||healthShort){
   if((!s.f5d8||s.f5d9)&&!healthShort){effects.push({op:'sound-play',sound:101,args:[1112014848,1,1157234688,4294967295,0,256]});effects.push({op:'animation',name:'TR_Tag_CanShake_LookF',layer:4,speed:1.5,args:[0,s.f5d9?5:15,15,0,1,4]})}
   inventory(M.recover(s.level,s.health,c));
  }
  const rand=(lo,hi)=>{const r=M.randomInclusive(s.rng,lo,hi);s.rng=r.state;return r.value};
  if(s.f5a9&&low){s.f5da=true;if(s.f5e0<150)s.f5e0++;
   if(s.f5e4===0){s.f5db=!s.f5db;s.f5e4=rand(2,7);if(s.f5db&&s.f5e0>=100&&rand(0,5)===0){const d=Math.trunc(s.f5e0/10);s.f5e4=rand(d*2,d*3)}}else s.f5e4--;
  }else{s.f5da=false;s.f5e0=0;s.f5e4=0;s.f5db=false}
  const startSound=()=>{effects.push({op:'sound-play',sound:fast()?103:102,args:[1116471296,4294967295,1145569280,4294967295,0,256]});s.f590=services.soundHandle};
  if(s.f5da){if(s.f61c&&high&&!s.f590&&!s.f5db&&!s.f5d8)startSound();else if(s.f590&&(s.f5db||s.f5d8)){effects.push({op:'sound-stop',handle:s.f590,fade:7});s.f590=0}}
  else if(s.f61c&&high&&!s.f590&&s.f5a9&&!s.f5d8)startSound();
  else if(s.f590&&(!s.f5a9||s.f5d8)){effects.push({op:'sound-stop',handle:s.f590,fade:0});s.f590=0}
  return {state:s,effects};
 }
 return Object.freeze({prefix,step});
});
