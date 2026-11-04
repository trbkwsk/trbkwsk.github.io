/* Bounded ISuperSprayPaint derived-constructor reference (SGL 100a52f0).
 * Parent-constructor bytes and a separately pre-interned string handle are
 * explicit inputs. This is not a port of the parent class or item lifecycle.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GettingUpNativeItemDefaults=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const SIZE=0xbf0;
 function word(x){if(!Number.isInteger(x)||x<=0||x>0xffffffff)throw Error('nonzero uint32 handle required');return x}
 function derived(parent,input){
  if(!(parent instanceof Uint8Array)||parent.length!==SIZE)throw Error('parent item image required');
  const vt=word(input.vtable),name=word(input.classNameHandle),a=new Uint8Array(parent),v=new DataView(a.buffer);
  const put=(at,n)=>v.setUint32(at,n>>>0,true);
  put(0,vt);put(0x10,v.getUint32(0x10,true)|1);put(0x4a4,name);
  for(const at of [0xa40,0xa44,0xa48,0xa4c])put(at,500);
  for(const at of [0x858,0x870])put(at,0);
  for(const at of [0xa11,0xbd0,0xbdc])a[at]=0;
  for(const at of [0xab4,0xa24])a[at]=1;
  for(const [at,n]of [[0x7bc,42],[0xb90,47],[0x4b4,1],[0xa5c,15],[0xa1c,0x44160000],
   [0xa20,1],[0xbd4,0x40400000],[0xbd8,3],[0xbe0,0x40a00000],[0xbe4,0x3f800000]])put(at,n);
  return a;
 }
 return Object.freeze({SIZE,derived});
});
