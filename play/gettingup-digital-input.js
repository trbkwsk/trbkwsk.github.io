/* Independently compared with original x86. Digital records, not OS polling. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.GettingUpDigitalInput=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 function digital(device,pressed,connected,multiplier=1){
  if(device!==0&&device!==1)throw Error('only keyboard/mouse proved');
  const on=!!(pressed&&connected);return {on,amount:on?Math.fround(multiplier):0,device:on?device:255};
 }
 function upper(tool,punch,kick,filtered=false){
  if(![0,1,2].includes(tool))throw Error('known original tool required');
  const p=!filtered&&punch>0,k=!filtered&&kick>0;
  return {tool:tool+1,punch:p,kick:k,paint:tool===2?p:p||k};
 }
 function empty(){return {stamp:0,on:0,off:0,repeats:0,edge:false}}
 function transition(previous,down,tick,frequency,delay,rate){
  const s={...previous},u16=n=>n&65535;
  if(!down)return {...s,stamp:0,on:0,off:u16(s.off+1),repeats:0,edge:false};
  const elapsed=Math.fround(((tick-s.stamp)>>>0)/frequency);
  const repeat=s.on===0||(s.repeats===1?elapsed>Math.fround(delay):s.repeats>1&&elapsed>Math.fround(rate));
  s.on=u16(s.on+1);s.off=0;s.edge=repeat;
  if(repeat){s.stamp=tick>>>0;s.repeats=u16(s.repeats+1)}return s;
 }
 return Object.freeze({digital,upper,empty,transition});
});
