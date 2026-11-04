/* GScript 1019240c..10192530 only. Field names intentionally stay numeric:
 * upstream input/reach meanings and the rest of the function are not proven.
 */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.GettingUpScriptPaintGate=api;
})(typeof globalThis!=='undefined'?globalThis:this,function scriptPaintGate(){'use strict';
 function step(input,gate){const s={...input},events=[],special=s.f5a0===3;let c=false,a=!(s.f5ae||s.f5ab);
  if(!special&&gate){c=true;a=false}else if(!(special&&gate&&a))a=false;
  if(s.f56c!==0){s.f61c=false;return {state:s,events}}
  function stop(){events.push({op:'stop'});s.f5aa=false;s.f5c0=0}
  if(!c&&!a){
   if(s.f5aa)stop();else if(special){if(!s.f61d)stop()}else if(!s.f61d&&!s.f61e)stop();
  }else if(s.f5c0===0)s.f5c0=10;else if(s.f5c0>1)s.f5c0--;else if(!s.f5aa){s.f5a8=true;s.f5aa=true;events.push({op:'start',fast:!!(s.f569&&s.f61e)})}
  return {state:s,events};
 }
 return Object.freeze({step,moduleSource:scriptPaintGate.toString()});
});
