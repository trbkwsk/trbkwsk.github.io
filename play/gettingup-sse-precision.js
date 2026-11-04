/* Experimental bounded model of the measured CrossOver RCPSS backend.
 * Not a universal Intel/AMD/ARM instruction specification or live-game proof.
 * Validate against independent original instruction results before enabling.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GettingUpSSEPrecision=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const f=Math.fround;
 function reciprocal(v){
  v=f(v);if(!Number.isFinite(v)||v<f(1e-5)||v>4)throw Error('reciprocal outside declared positive normal domain');
  const word=new Uint32Array(new Float32Array([v]).buffer)[0],exponent=(word>>>23)&255,
   bucket=(word&0x7fffff)>>>11,denominator=8193+2*bucket;
  // Exact integer quotient/remainder; no intermediate f32 division or
  // double-rounding assumption. The midpoint denominator is always odd.
  let significand=Math.floor(67108864/denominator);
  if(2*(67108864-significand*denominator)>denominator)significand++;
  const out=((253-exponent)<<23)|((significand-4096)<<11);
  return new Float32Array(new Uint32Array([out>>>0]).buffer)[0];
 }
 return Object.freeze({reciprocal});
});
