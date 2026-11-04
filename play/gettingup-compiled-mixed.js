/* Separate adapter for original compiled type-0 ranges and type-1 fixed-frame
 * repeats. Reuses sealed cursor/actor algorithms; never changes their domain
 * guards or coerces a type-0 zero duration into a positive number.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const P=node?require('./gettingup-actor.js'):root.GettingUpActor;
  const C=node?require('./gettingup-script.js'):root.GettingUpScript;
  const S=node?require('./gettingup-script-actor.js'):root.GettingUpScriptActor;
  const api=factory(P,C,S);if(node)module.exports=api;else root.GettingUpCompiledMixed=api;
})(typeof globalThis!=='undefined'?globalThis:this,function compiledMixed(P,C,S){'use strict';
  function descriptor(d){
    if(!d||Object.keys(d).some(k=>!['kind','start','end','duration','next_frame','direction','token','parameter8','parameter10'].includes(k)))throw Error('known compiled fields required');
    if((d.parameter8??0)!==0||(d.parameter10??0)!==0)throw Error('zero compensation metadata required');
    const clean={};for(const k of ['kind','start','end','duration','next_frame','direction','token'])clean[k]=d[k];
    if(d.kind===0){new C.CompiledCursor(clean);return clean}
    if(d.kind!==1||d.start!==d.end||d.direction!==-1)throw Error('only original single-frame rep supported beyond kind zero');
    new P.Cursor(clean);return clean;
  }
  class CompiledMixedChain{
    constructor(descriptors){
      if(!Array.isArray(descriptors)||descriptors.length<1||descriptors.length>32)throw Error('bounded compiled chain required');
      this.descriptors=descriptors.map(descriptor);this.cursors=[null,null,null,null];this.index=-1;this.cursor=null;
      this.previous_direction=1;this.event_counter=-1024;this.wrap_flag=0;this.bind(0);
    }
    bind(index){
      if(!Number.isInteger(index)||index<0||index>=this.descriptors.length)throw Error('compiled cursor index outside chain');
      this.previous_direction=this.cursor?new DataView(this.cursor.raw.buffer).getInt16(14,true):1;this.index=index;
      const d=this.descriptors[index];this.cursor=d.kind===0?new C.CompiledCursor(d):new P.Cursor(d);
      this.cursors[d.kind]=this.cursor;this.cursor.wrap_flag=this.wrap_flag;this.event_counter=-1024;
    }
    step(delta){return P.Chain.prototype.step.call(this,delta)}
  }
  class MixedScriptActor extends S.ScriptActor{
    constructor(descriptors,codes,raw){
      const chain=new CompiledMixedChain(descriptors);
      if(chain.descriptors[0].kind!==0||!Array.isArray(codes)||chain.descriptors.some(d=>d.token>=codes.length))throw Error('type-zero prefix and matching event table required');
      super([chain.descriptors[0]],codes,raw);this.chain=chain;
    }
  }
  return Object.freeze({CompiledMixedChain,MixedScriptActor,moduleSource:compiledMixed.toString()});
});
