/* Original option calculation, controller amount fragment and CRT RNG.
 * The live seed, other RNG consumers, pressure and input state remain unknown. */
(function(root,factory){const node=typeof module==='object',api=factory(node?require('./gettingup-tag.js'):root.GettingUpTag,node?require('./gettingup-graffiti.js'):root.GettingUpGraffiti);if(node)module.exports=api;else root.GettingUpSprayController=api;
})(typeof globalThis!=='undefined'?globalThis:this,function sprayController(T,G){'use strict';
 const F=Math.fround;
 class Random{
  constructor(seed=1){if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('uint32 seed required');this.state=seed;this.calls=0}
  randInt(count){if(!Number.isInteger(count)||count< -2147483648||count>2147483647)throw Error('int32 count required');if(count<=0)return 0;
   this.state=(Math.imul(this.state,214013)+2531011)>>>0;this.calls++;return ((this.state>>>16)&32767)%count}
  texture(count){if(!Number.isInteger(count)||count< -2147483648||count>2147483647)throw Error('int32 count required');return count>0?this.randInt(count):-1}
 }
 function options(table,tool,complex=false,fast=false){if(!['Aerosol','Roller','Wheatpaste'].includes(tool)||typeof complex!=='boolean'||typeof fast!=='boolean')throw Error('known tool / boolean modes required');
  const r=table[tool],m=r[complex?'Complex':'Simple'];let rate=F(m.PaintFillRate),warning=F(m.DripWarningTime);if(fast){rate=F(rate*F(r.MadPaintMultiplier.PaintFillRate));warning=F(warning*F(r.MadPaintMultiplier.DripWarningTime))}
  return {rate,warning,radius:F(r.PaintRadius)};
 }
 function amount(dt,rate){if(![dt,rate].every(Number.isFinite)||dt<0||rate<0)throw Error('nonnegative finite inputs required');return F(F(dt)*F(rate))}
 class Grid extends T.Grid{
  constructor(tiles,origin,divisor=4,capacity=32,rng=new Random(1),textureCount=4){super(tiles,origin,divisor,capacity);if(!(rng instanceof Random)||!Number.isInteger(textureCount)||textureCount<0||textureCount>255)throw Error('explicit RNG / bounded texture count required');this.rng=rng;this.textureCount=textureCount}
  tagDrips(point,radius,flow,points,enabled=true){const result=this.tag(point,radius,flow,enabled);
   if(result[0]===2){const q=this.origin.map((o,i)=>F(o-F(point[i]))),[found,index]=G.nearest(points,q,this.selected);this.selected=index;
    if(found){const texture=this.rng.texture(this.textureCount); // BEFORE duplicate and pool checks, as in 1019e020.
     if(index<32&&!this.drips.some(d=>(d[1]&127)===index)&&this.drips.length<this.capacity)this.drips.unshift([0,index,texture&255]);
    }}return result;
  }
 }
 function packedColor(argb){if(argb.length!==4||!argb.every(x=>Number.isFinite(x)&&Math.abs(x)<1e6))throw Error('bounded ARGB required');return argb.reduce((v,c)=>((v<<8)|(Math.trunc(F(c)*255)&255))>>>0,0)}
 return Object.freeze({Random,Grid,options,amount,packedColor,moduleSource:sprayController.toString()});
});
