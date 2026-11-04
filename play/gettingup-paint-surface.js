/* OUR wall eligibility and finite alpha grid, not original TagZone/PTM rules. */
(function(root,factory){const Q=typeof module==='object'&&module.exports?require('./gettingup-ledge-query.js'):root.GettingUpLedgeQuery;
 const api=factory(Q);if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpPaintSurface=api;
})(typeof globalThis!=='undefined'?globalThis:this,function paintSurface(Q){'use strict';
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 function find(world,p,heading){
  const forward=[Math.sin(heading),0,Math.cos(heading)],start=add(p,[0,48,0]),hit=Q.ray(world,start,add(start,mul(forward,55)));
  if(!hit.hit||Math.abs(hit.normal[1])>.1||dot(hit.normal,forward)>-.85)return null;
  const frame={origin:hit.point,normal:hit.normal,right:[hit.normal[2],0,-hit.normal[0]],width:96,height:78};
  for(const [x,y] of [[-48,-39],[48,-39],[-48,39],[48,39],[0,0]]){
   const at=add(add(frame.origin,mul(frame.right,x)),[0,y,0]),a=Q.ray(world,add(at,mul(frame.normal,2)),add(at,mul(frame.normal,-2)));
   if(!a.hit||Math.hypot(...sub(a.point,at))>.1||dot(a.normal,frame.normal)<.99)return null;
  }
  return frame;
 }
 function project(world,frame,source){
  const distance=dot(sub(source,frame.origin),frame.normal);
  if(!Number.isFinite(distance)||distance<=.1||distance>80)return null;
  const hit=Q.ray(world,source,add(source,mul(frame.normal,-(distance+1))));
  if(!hit.hit||Math.abs(dot(sub(hit.point,frame.origin),frame.normal))>.05||dot(hit.normal,frame.normal)<.99)return null;
  const rel=sub(hit.point,frame.origin),u=dot(rel,frame.right)/frame.width+.5,v=rel[1]/frame.height+.5;
  if(u<0||u>1||v<0||v>1)return null;return {point:hit.point,u,v,distance};
 }
 class Grid{
  constructor(){this.width=256;this.height=208;this.alpha=new Uint8Array(this.width*this.height);this.samples=0;this.changed=0}
  paint(u,v,fast){
   if(![u,v].every(Number.isFinite)||u<0||u>1||v<0||v>1||typeof fast!=='boolean')throw Error('bounded actual paint hit required');
   const cx=u*(this.width-1),cy=(1-v)*(this.height-1),radius=13,amount=fast?28:14;let changed=0;
   for(let y=Math.max(0,Math.floor(cy-radius));y<=Math.min(this.height-1,Math.ceil(cy+radius));y++)for(let x=Math.max(0,Math.floor(cx-radius));x<=Math.min(this.width-1,Math.ceil(cx+radius));x++){
    const fall=Math.max(0,1-Math.hypot(x-cx,y-cy)/radius),i=y*this.width+x,old=this.alpha[i];
    this.alpha[i]=Math.min(255,old+Math.round(amount*fall));if(this.alpha[i]!==old)changed++;
   }
   this.samples++;this.changed+=changed;this.cached=null;return changed;
  }
  summary(){if(this.cached)return {...this.cached};let filled=0,total=0,hash=2166136261;for(const a of this.alpha){if(a)filled++;total+=a;hash=Math.imul(hash^a,16777619)>>>0}
   this.cached={width:this.width,height:this.height,samples:this.samples,painted_pixels:filled,alpha_sum:total,fnv1a:hash.toString(16).padStart(8,'0')};return {...this.cached};}
 }
 return Object.freeze({find,project,Grid,moduleSource:paintSurface.toString()});
});
