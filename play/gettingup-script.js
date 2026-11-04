/* Original compiled kind-0 ranges and event queue selection.
 * Metadata duration zero is preserved, never coerced to one. The existing
 * positive-duration / zero-event diagnostic actor remains a separate mode.
 * No original native construction, gameplay handler or live cadence claim.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const P=node?require('./gettingup-actor.js'):root.GettingUpActor;
  const api=factory(P);if(node)module.exports=api;else root.GettingUpScript=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(P){'use strict';
  if(!P)throw Error('Actor primitives must load before compiled scripts');
  const ints=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<hi;
  function descriptor(d){
    if(!d||Object.keys(d).some(k=>!['kind','start','end','duration','next_frame','direction','token'].includes(k)))throw Error('unsupported compiled descriptor field');
    if(d.kind!==0||d.duration!==0||!ints(d.start,0,256)||!ints(d.end,0,256)||![-1,1].includes(d.direction)||
      (d.end-d.start)*d.direction<0||!ints(d.next_frame,-32768,32768)||!ints(d.token,0,2**31))throw Error('outside verified compiled kind-0 domain');
    return {...d};
  }
  class CompiledCursor{
    constructor(options){
      this.descriptor=descriptor(options);this.kind=0;this.wrap_flag=0;
      const d=this.descriptor;this.raw=new Uint8Array(P.SIZES[0]).fill(0xa5);
      const v=new DataView(this.raw.buffer);v.setUint32(0,P.TABLES[0],true);v.setUint32(4,d.token,true);
      for(const [at,n] of [[8,d.start],[10,d.end],[12,d.next_frame],[14,d.direction]])v.setInt16(at,n,true);
      v.setInt32(0x10,(d.end-d.start)*d.direction,true);v.setFloat32(0x14,d.start,true);v.setFloat32(0x18,d.direction,true);
      this.raw[0x1c]=0;v.setFloat32(0x20,0,true);v.setFloat32(0x24,1,true);v.setFloat32(0x28,1,true);this.raw[0x2c]=0;
      // The original zero-compensation binder does not consume duration+6.
      // Build its fields directly, without changing descriptor metadata or
      // calling the positive-duration constructor with a surrogate argument.
    }
    time(){return P.Cursor.prototype.time.call(this)}
    step(delta){return P.Cursor.prototype.step.call(this,delta)}
  }
  class CompiledChain{
    constructor(descriptors){
      if(!Array.isArray(descriptors)||!ints(descriptors.length,1,33))throw Error('bounded compiled descriptor chain required');
      this.descriptors=descriptors.map(descriptor);this.cursors=[null,null,null,null];this.index=-1;this.cursor=null;
      this.previous_direction=1;this.event_counter=-1024;this.wrap_flag=0;this.bind(0);
    }
    bind(index){
      if(!ints(index,0,this.descriptors.length))throw Error('descriptor index outside compiled chain');
      this.previous_direction=this.cursor?new DataView(this.cursor.raw.buffer).getInt16(14,true):1;
      this.index=index;this.cursor=new CompiledCursor(this.descriptors[index]);this.cursors[0]=this.cursor;
      this.cursor.wrap_flag=this.wrap_flag;this.event_counter=-1024;
    }
    step(delta){return P.Chain.prototype.step.call(this,delta)}
  }
  function dispatchQueue(tokens,ticks,last,wrap,codes,initialFlag=0xa5){
    if(!Array.isArray(tokens)||!Array.isArray(ticks)||tokens.length!==ticks.length||tokens.length>1024||
      !Array.isArray(codes)||codes.length>1024||codes.some(v=>!ints(v,0,65536))||
      tokens.some(v=>!ints(v,-1,codes.length))||ticks.some(v=>!ints(v,-2147483648,2147483648))||
      !ints(last,-2147483648,2147483648)||![0,1].includes(wrap)||!ints(initialFlag,0,256))throw Error('bounded parallel event queues required');
    const calls=[];let selected=false;
    tokens.forEach((token,i)=>{
      const tick=ticks[i];if(token>=0&&(tick!==last||i===ticks.length-1)){
        const code=(codes[token]+32768)%65536-32768;
        if(code)calls.push([code,tick,Number(!wrap&&tick===last)]);
        last=tick;selected=true;
      }
    });
    return {calls,last,script_tick:ticks.length?ticks[ticks.length-1]:null,event_flag:selected?0:initialFlag};
  }
  return Object.freeze({CompiledCursor,CompiledChain,dispatchQueue});
});
