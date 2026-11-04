/* Separate packed API: existing plain-period API stays intentionally bounded.
 * Original 10331400 semantics; no generic gameplay request interpreter.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const S=node?require('./gettingup-script-actor.js'):root.GettingUpScriptActor;
  const api=factory(S);if(node)module.exports=api;else root.GettingUpTransitionParameter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(S){'use strict';
  if(!S)throw Error('original script actor library required');
  function decode(value,start=4){
    if(!Number.isInteger(value)||value< -2147483648||value>4294967295)throw Error('signed or unsigned 32-bit parameter required');
    if(!Number.isInteger(start)||start<0||start>255)throw Error('bounded in-range start required');
    const raw=value>>>0,shapeByte=(raw<<8)>>24,period=raw?((raw&65535)||1):0;
    return {raw,period,shape:raw?(shapeByte+128)/256:.5,duration:period+1,
      phase:Number(raw!==0),counter:raw?0:1,script_tick:raw?(-raw)|0:start,cycles:Number(start>0)};
  }
  function diagnosticWord(period,shapeIndex){
    if(!Number.isInteger(period)||period<0||period>65535||!Number.isInteger(shapeIndex)||shapeIndex<0||shapeIndex>255)throw Error('16-bit period and 8-bit quantized shape required');
    return ((((shapeIndex-128)&255)<<16)|period)>>>0;
  }
  function queueParameter(request,minimum=0,override=null){
    // Virtual minimum belongs to caller's actor class. Zero is proved only
    // for the declared base-vtable diagnostic fixture, not every subclass.
    const a=decode(request).raw|0,b=decode(minimum).raw|0;
    let effective=Math.max(a,b)>>>0;
    if(override!==null){const raw=decode(override).raw;if(raw!==4294967295)effective=raw;}
    return effective;
  }
  function activateEncoded(controller,clip,index,frame,word){
    if(!(controller instanceof S.ScriptActorCharacterController))throw Error('script character controller required');
    const profile=decode(word,frame),actor=controller.actor,d=actor.chain.descriptors[index];
    // Validate before mutating the skeletal controller or cursor.
    if(!Number.isInteger(index)||!d||!Number.isInteger(frame)||frame<Math.min(d.start,d.end)||frame>Math.max(d.start,d.end))throw Error('original in-range seek required');
    controller.transitionTo(clip,frame,profile.duration,profile.shape);actor.raw=controller.state;
    actor.chain.bind(index);new DataView(actor.chain.cursor.raw.buffer).setFloat32(0x14,frame,true);
    actor.cycles=profile.cycles;actor.event_counter=-1024;actor.script_tick=profile.script_tick;
    actor.phase=profile.phase;actor.period=profile.period;actor.counter=profile.counter;
    return profile;
  }
  return Object.freeze({decode,diagnosticWord,queueParameter,activateEncoded});
});
