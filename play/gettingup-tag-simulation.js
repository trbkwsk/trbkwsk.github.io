/* Validated original Tag math in OUR existing real-wall/character bridge.
 * Eligibility, world frame and amount caller remain explicit diagnostic policy. */
(function(root,factory){const node=typeof module==='object',S=node?require('./gettingup-paint-simulation.js'):root.GettingUpPaintSimulation,
 T=node?require('./gettingup-tag.js'):root.GettingUpTag,Q=node?require('./gettingup-ledge-query.js'):root.GettingUpLedgeQuery;
 const api=factory(S,T,Q);if(node)module.exports=api;else root.GettingUpTagSimulation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function tagSimulation(S,T,Q){'use strict';
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 class Panel extends T.Grid{
  constructor(data){super(data.tiles);this.data=data;this.samples=0;this.lastResult=1;this.triggerEvents=0;this.version=0}
  paint(u,v,fast){
   if(![u,v].every(Number.isFinite)||u<0||u>1||v<0||v>1||typeof fast!=='boolean')throw Error('bounded actual hit required');
   const q=[this.origin[0]-u*this.data.tiles[0]*36,this.origin[1]-(1-v)*this.data.tiles[1]*36];
   this.lastResult=this.tagDrips(q,this.data.radius,(1/60)*this.data.fill_rate*(fast?this.data.fast_multiplier:1),this.data.points)[0];
   this.samples++;this.version++;return this.lastResult;
  }
  advance(){const triggered=this.tick(1/60,this.data.definition.trigger);this.triggerEvents+=triggered.length;if(this.drips.length)this.version++;return triggered}
  summary(){let count=0,sum=0,hash=2166136261;for(const v of this.values){if(v>0)count++;sum+=v;hash=Math.imul(hash^Math.round(v*65535),16777619)>>>0}
   return {width:this.width,height:this.height,samples:this.samples,painted_nodes:count,painted_pixels:count,alpha_sum:sum,coverage:this.total/((this.width-2)*(this.height-2)),
    fnv1a:hash.toString(16),last_result:this.lastResult,drip_count:this.drips.length,trigger_events:this.triggerEvents,drips:this.drips.map(d=>d.slice())};
  }
 }
 class Simulation extends S.Simulation{
  constructor(data,...args){if(data.tagData?.kind!=='gettingup-world-tag-local')throw Error('verified local Tag inputs required');super(data,...args);this.tagData=data.tagData}
  step(input){
   // Keep old pose/collision bridge, but never execute its placeholder brush.
   // Preserve the base bridge's panel lookup origin while retaining our
   // separately validated full-size artwork placement on the same plane.
   for(const p of this.panels)if(p.searchOrigin)p.frame.origin=p.searchOrigin;
   try{super.step({...input,spray:false,fast:false})}finally{for(const p of this.panels)if(p.tagOrigin)p.frame.origin=p.tagOrigin}
   if(this.history.length)this.history[this.history.length-1]={...input};
   for(const p of this.panels){if(!(p.grid instanceof Panel)){
     const width=this.tagData.tiles[0]*36,height=this.tagData.tiles[1]*36,f=p.frame;
     const offsets=[0,...Array.from({length:6},(_,i)=>[-12*(i+1),12*(i+1)]).flat()];
     const shift=offsets.find(offset=>[[-width/2,-height/2],[width/2,-height/2],[-width/2,height/2],[width/2,height/2]].every(([x,y])=>{
       const at=f.origin.map((v,i)=>v+f.right[i]*(x+offset)+(i===1?y:0)),a=at.map((v,i)=>v+f.normal[i]*2),b=at.map((v,i)=>v-f.normal[i]*2),h=Q.ray(this.world,a,b);
       return h.hit&&Math.hypot(...h.point.map((v,i)=>v-at[i]))<.1&&dot(h.normal,f.normal)>.99;
     }));
     if(shift===undefined){this.paintAnchor=null;this.events.push('tag-surface-too-small');continue}
     p.searchOrigin=f.origin.slice();p.tagOrigin=f.origin.map((v,i)=>v+f.right[i]*shift);f.origin=p.tagOrigin;
     f.width=width;f.height=height;p.grid=new Panel(this.tagData);
    }}
   // Original can and pose -> bounded ray into the real collision surface.
   if(this.paintAnchor&&this.paintAnchor.grid instanceof Panel){
    this.events=this.events.filter(e=>!(e==='paint-ready'&&(input.spray||input.fast)));
    const hit=this.lastPaintHit;
    if((input.spray||input.fast)&&hit&&this.events.includes('paint-ready'))throw Error('invalid ready gate');
    if((input.spray||input.fast)&&hit){
     const p=this.paintAnchor,f=p.frame,rel=hit.point.map((v,i)=>v-f.origin[i]),u=dot(rel,f.right)/f.width+.5,v=rel[1]/f.height+.5;
     // Same settled-distance gate as the existing nozzle bridge, not a
     // naked coverage counter or an arbitrary cursor position.
     const distance=dot(this.position.map((v,i)=>v-f.origin[i]),f.normal);
     if(Math.abs(32-distance)<.01&&u>=0&&u<=1&&v>=0&&v<=1){p.grid.paint(u,v,input.fast);this.spraying=true;this.events.push(input.fast?'paint-fast':'paint-normal');if(p.grid.samples%30===0)this.events.push('paint-stroke')}
    }
   }
   for(const p of this.panels)if(p.grid instanceof Panel&&p.grid.advance().length)this.events.push('tag-drip-trigger');
   return this.snapshot();
  }
  snapshot(){return {...super.snapshot(),native_tag_math_verified:true,native_tag_caller_verified:false,native_d3d_verified:false,
    tag_name:this.tagData?.name||null,tag_panels:(this.panels||[]).filter(p=>p.grid instanceof Panel).map(p=>({id:p.id,...p.grid.summary()}))}}
 }
 return Object.freeze({Panel,Simulation,moduleSource:tagSimulation.toString()});
});
