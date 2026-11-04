/* Bounded references for EXE 417a00, Core 100485f0 and selected
 * GScript 10192b00/1002fdf0 observations. Not the full helper or its scheduler.
 * Original string handles are inputs; unwritten constructor bytes survive.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GettingUpControllerContext=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const strings=[0,4,8,12,16,20,24,28,32,44,96,104,160,164,168,172,176,180,184,188,192,268,272,276,328,368];
 function uint(v){if(!Number.isInteger(v)||v<0||v>0xffffffff)throw Error('uint32 required');return v}
 function byte(v){if(!Number.isInteger(v)||v<0||v>255)throw Error('byte required');return v}
 function image(size,fill){return new Uint8Array(size).fill(byte(fill))}
 function put(a,at,v){new DataView(a.buffer,a.byteOffset,a.byteLength).setUint32(at,uint(v),true)}
 function config(fill,empty,d3d){uint(empty);uint(d3d);const a=image(0x180,fill);
  for(const at of strings)put(a,at,at===8?d3d:empty);
  for(const at of [0xfc,0x100,0x124,0x128,0x130])put(a,at,0);
  put(a,0x12c,1);a[0x30]=0;a.fill(1,0xcb,0xd6);put(a,0x50,0x4019999a);return a;
 }
 function map(fill,empty,debug){uint(empty);byte(debug);const a=image(0x4a0,fill);a[0]=debug;a[1]=0;
  for(const at of [0x404,0x408,0x40c,0x410,0x414,0x418,0x41c,0x420,0x424,0x428,0x42c,0x488,0x48c,0x490])put(a,at,0);
  for(const at of [0x474,0x47c,0x480])put(a,at,empty);
  for(const at of [0x470,0x471,0x472,0x473,0x478,0x479,0x484])a[at]=0;return a;
 }
 function counter(flag,word){byte(flag);uint(word);return flag===0&&(word|0)>0?word-1:word}
 function boundedCase(before,request){
  if(!(before instanceof Uint8Array)||before.length!==0x800)throw Error('bounded script image required');
  const a=before.slice(),flag=a[0x56a],word=new DataView(a.buffer).getUint32(0x56c,true);
  if(typeof request.callback!=='boolean')throw Error('callback boolean required');
  if(request.argument!==0)throw Error('only original zero-initialized argument domain is proved');
  if(!flag){const tool=new DataView(before.buffer,before.byteOffset,before.byteLength).getUint32(0x3b8,true);
   if(tool!==42)throw Error('selected original tool42 context required');
   put(a,0x564,tool);a[0x2fe]=0;a[0x2ff]=0;
  }
  put(a,0x56c,counter(flag,word));
  return {image:a,al:request.callback?a[0x2fe]:0,argument:request.argument,
          helperArgument:request.callback?0:request.argument};
 }
 return Object.freeze({config,map,counter,boundedCase,stringOffsets:Object.freeze(strings)});
});
