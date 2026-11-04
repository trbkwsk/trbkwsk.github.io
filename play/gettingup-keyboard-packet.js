/* Original 00507940 keyboard packing: sign bit, with Caps toggle override.
 * This is a record codec, not a DirectInput provider or browser key binding.
 */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.GettingUpKeyboardPacket=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 function pack(bytes,caps){if(bytes.length!==256||!Array.from(bytes).every(x=>Number.isInteger(x)&&x>=0&&x<=255)||![0,1].includes(caps))throw Error('256 bytes and explicit Caps toggle required');
  const out=new Uint8Array(48);for(let i=0;i<256;i++)if((i===0x3a?caps<<7:bytes[i])&128)out[i>>3]|=1<<(i&7);return Array.from(out);
 }
 return Object.freeze({pack});
});
