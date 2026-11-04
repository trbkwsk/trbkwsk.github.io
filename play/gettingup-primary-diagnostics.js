/* Read-only controller buffers for Node/browser comparison, not animation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GettingUpPrimaryDiagnostics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
  const words=bytes=>{const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return Array.from({length:13},(_,i)=>v.getUint32(i*4,true))};
  function capture(m){
    return {queued:m.queuedStates.map(words),states:m.layers.map((l,s)=>words(m.stateFor(s))),queue:m.lastQueueSlots.slice(),
      owners:Array.from(m.owners),prepared:Array.from(m.prepared),timer:[m.duration,Math.fround(1/m.duration),m.elapsed,m.shape],
      body_buffers:m.body.slice(1).map(b=>[b.snapshot,b.current,b.target]),root_buffers:[m.root.current,m.root.snapshot,m.root.target]};
  }
  return Object.freeze({capture});
});
