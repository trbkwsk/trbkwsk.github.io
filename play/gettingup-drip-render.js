/* Original drip CPU geometry/color consumer. No GPU/camera equivalence claim.
 * Source: manifests/graffiti-shared-render.json. Input maps/palettes stay local.
 */
(function(root,factory){const api=factory(typeof module==='object'?require('./gettingup-paint-rd24.js'):root.GettingUpPaintRD24);
 if(typeof module==='object')module.exports=api;else root.GettingUpDripRender=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(R){'use strict';
 const f=Math.fround;
 function rounding(profile){if(!['rn64','rd24'].includes(profile))throw Error('known FP profile required');return profile==='rd24'?R.down:x=>x}
 function vector(p,n){if(!Array.isArray(p)||p.length!==n||!p.every(x=>Number.isFinite(x)&&Number.isFinite(f(x))))throw Error('finite float32 vector required');return p.map(f)}
 function parameters(d){const v=[d?.trigger,d?.spot?.StartSize,d?.spot?.EndSize,d?.streak?.Width,d?.streak?.Length,d?.streak?.Time];
  if(!v.every(x=>Number.isFinite(x)&&Number.isFinite(f(x)))||v[0]<=0||v[5]<=0||v.slice(1,5).some(x=>x<0)||v[2]<v[1])throw Error('bounded drip definition required');return v.map(f)}
 function geometry(elapsed,flags,origin,point,definition,profile='rn64'){
  const round=rounding(profile);elapsed=f(elapsed);
  if(!Number.isFinite(elapsed)||elapsed<0||!Number.isInteger(flags)||flags<0||flags>255)throw Error('nonnegative elapsed / packed flags required');
  origin=vector(origin,2);point=vector(point,2);const[trigger,start,end,width,length,time]=parameters(definition),triggered=!!(flags&128);
  const alpha=triggered?1:Math.min(1,f(round(elapsed/trigger)));
  const growth=!triggered||elapsed<trigger?0:elapsed>round(time+trigger)?1:f(round(round(elapsed-trigger)/time));
  const x=f(round(origin[0]-point[0])),y=f(round(origin[1]-point[1]));
  // RN64 retains half-size on x87 until each corner spill; do not fround it.
  const half=round(round(round(round(end-start)*alpha)+start)*.5);
  return {alpha,spot:[f(round(x-half)),f(round(y+half)),f(round(x+half)),f(round(y-half))],
   streak:triggered?[f(round(x-width)),y,f(round(x+width)),f(round(y-round(growth*length)))]:null};
 }
 function color(elapsed,flags,alpha,palette,tint,ignoreTint=false,profile='rn64'){
  const round=rounding(profile);elapsed=f(elapsed);alpha=f(alpha);
  if(!Number.isFinite(elapsed)||elapsed<0||!Number.isFinite(alpha)||alpha<0||alpha>1||!Number.isInteger(flags)||flags<0||flags>255||typeof ignoreTint!=='boolean')throw Error('bounded color inputs required');
  if(!Array.isArray(palette)||palette.length!==4)throw Error('four-color palette required');
  palette=palette.map(p=>vector(p,4));tint=vector(tint,4);
  if(!(flags&128)){const pulse=f(round(Math.sin(round(elapsed*10))));return [alpha,1,pulse,pulse]}
  const out=palette[flags&3].map((x,i)=>ignoreTint?x:f(round(x*tint[i])));out[0]=alpha;return out;
 }
 function packed(argb,profile='rn64'){
  const round=rounding(profile);return vector(argb,4).reduce((n,x)=>((n<<8)|(Math.trunc(round(x*255))&255))>>>0,0);
 }
 function vertices(rect,argb,z=.02,profile='rn64'){
  const[x1,y1,x2,y2]=vector(rect,4);z=f(z);if(!Number.isFinite(z))throw Error('finite depth required');const value=packed(argb,profile);
  return [[x1,y1,z,0,0,0,value],[x1,y2,z,0,0,1,value],[x2,y1,z,0,1,0,value],[x2,y2,z,0,1,1,value]];
 }
 function quads(node,context){
  const {elapsed,flags,texture}=node,{origin,points,definition,palette,tint,ignoreTint=false,profile='rn64',depth=.02}=context;
  if(!Number.isInteger(texture)||texture<0||texture>3||!Array.isArray(points)||points.length>32||!points[flags&127])throw Error('bounded map / texture-pair index required');
  const g=geometry(elapsed,flags,origin,points[flags&127],definition,profile),rgba=color(elapsed,flags,g.alpha,palette,tint,ignoreTint,profile);
  return (g.streak?[['streak',g.streak],['spot',g.spot]]:[['spot',g.spot]]).map(([kind,rect])=>({kind,rect,color:rgba.slice(),texture_index:texture,
   pair_member:kind==='spot'?0:1,packed_argb:packed(rgba,profile),vertices:vertices(rect,rgba,depth,profile)}));
 }
 return Object.freeze({geometry,color,packed,vertices,quads});
});
