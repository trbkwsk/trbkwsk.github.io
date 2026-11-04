/* Original Engine API bias stack and D3D8 state-5 consumer.
 * 41e110/41e140 -> 4ddfb0/4ddfe0/4de050 -> 4ddda0 -> state47.
 * Safe nonnegative signed-long domain; no original under/overflow claim.
 * Device state deltas, not WebGL polygonOffset or hardware Z quantization.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GettingUpRenderBias=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 function value(v){if(!Number.isInteger(v)||v<0||v>0x7fffffff)throw Error('nonnegative signed-long bias required');return v}
 class Stack{
  #current;#stack=[];
  constructor(initial=0){this.#current=value(initial)}
  snapshot(){return {current:this.#current,depth:this.#stack.length,stack:this.#stack.slice()}}
  set(next){next=value(next);if(next===this.#current)return [];this.#current=next;return [{state:47,value:Math.min(next,16)}]}
  push(next){next=value(next);if(this.#stack.length>=64)throw Error('bounded bias stack capacity exceeded');
   this.#stack.push(this.#current);return this.set(next)}
  pop(){if(!this.#stack.length)throw Error('nonempty bias stack required');return this.set(this.#stack.pop())}
 }
 return Object.freeze({Stack});
});
