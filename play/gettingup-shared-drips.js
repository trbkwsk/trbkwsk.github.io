/* Nonempty DripMap consumer. The original producer/clock queries remain inputs.
 * Separate from the sealed empty-map RN64/RD24 fixtures; no GPU equivalence claim.
 */
(function(root,factory){const node=typeof module==='object',load=p=>require('./'+p+'.js');
 const api=factory(node?load('gettingup-spray-controller'):root.GettingUpSprayController,
  node?load('gettingup-area-controller'):root.GettingUpAreaController,
  node?load('gettingup-paint-rd24'):root.GettingUpPaintRD24,
  node?load('gettingup-graffiti'):root.GettingUpGraffiti);
 if(node)module.exports=api;else root.GettingUpSharedDrips=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(S,A,R,G){'use strict';
 const f=Math.fround;
 const profile=p=>{if(!['rn64','rd24'].includes(p))throw Error('known FP profile required');return p};
 function points(input){if(!Array.isArray(input)||input.length>32||input.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw Error('bounded normalized DripMap required');return input.map(p=>p.map(f))}
 function nearest(map,query,previous=255,fp='rn64'){
  profile(fp);map=points(map);
  if(!Array.isArray(query)||query.length!==2||!query.every(Number.isFinite)||!Number.isInteger(previous)||previous<0||previous>255)throw Error('finite query / byte required');
  if(fp==='rn64')return G.nearest(map,query,previous);
  const q=query.map(f),d=R.down;let best=1e9,index=previous;
  // Original 101a1c4e/56: QUERY minus point, not the opposite sign.
  // RD24 rounds after arithmetic; dx is also spilled to float32.
  map.forEach(([x,y],i)=>{const dx=d(q[0]-x),dy=d(q[1]-y),value=d(d(dx*dx)+d(dy*dy));
   if(value<best){best=value;index=i}});
  return [!!map.length,index];
 }
 function tick(elapsed,flags,dt,warning,selected,fp='rn64'){
  profile(fp);
  if(![elapsed,dt,warning].every(Number.isFinite)||dt<0||warning<=0||!Number.isInteger(flags)||flags<0||flags>255||typeof selected!=='boolean')throw Error('bounded drip tick required');
  if(fp==='rn64')return G.tick(elapsed,flags,dt,warning,selected);
  const d=R.down;elapsed=f(elapsed);dt=f(dt);warning=f(warning);let state=2,t;
  if((flags&128)||selected){t=d(elapsed+dt);if(elapsed<warning&&warning<=t){flags|=128;state=1}}
  else{t=d(elapsed-d(dt*.25));if(t<=0)state=0}
  return [t,flags,state];
 }
 class Grid extends S.Grid{
  constructor(tiles,origin,divisor=4,capacity=32,rng=new S.Random(1),textureCount=4,fp='rn64'){
   super(tiles,origin,divisor,capacity,rng,textureCount);this.profile=profile(fp);
  }
  tag(point,radius,amount,enabled=true){return this.profile==='rd24'?R.Grid.prototype.tag.call(this,point,radius,amount,enabled):super.tag(point,radius,amount,enabled)}
  tagDrips(point,radius,amount,map,enabled=true){
   map=points(map);if(typeof enabled!=='boolean')throw Error('boolean drip enable required');
   if(!Array.isArray(point)||point.length!==2||![...point,radius,amount].every(Number.isFinite)||radius<=0||amount<0)throw Error('finite point / positive radius / nonnegative flow required');
   const result=this.tag(point,radius,amount,enabled);
   if(result[0]===2){const round=this.profile==='rd24'?R.down:f,q=this.origin.map((o,i)=>round(o-f(point[i]))),[found,index]=nearest(map,q,this.selected,this.profile);this.selected=index;
    if(found){const texture=this.rng.texture(this.textureCount); // before duplicate/pool checks
     if(index<32&&!this.drips.some(d=>(d[1]&127)===index)&&this.drips.length<this.capacity)this.drips.unshift([0,index,texture&255]);}}
   return result;
  }
  tick(dt,warning=1){if(![dt,warning].every(Number.isFinite)||dt<0||warning<=0)throw Error('bounded drip tick required');const after=[],events=[];
   for(const[elapsed,flags,texture]of this.drips){const[t,fl,state]=tick(elapsed,flags,dt,warning,(flags&127)===this.selected,this.profile);
    if(state){after.push([t,fl,texture]);if(state===1){events.push(fl&127);this.dripped=true}}}
   this.drips=after;this.selected=255;return events;
  }
 }
 class Area extends A.Area{
  constructor(options,{tiles=[4,2],map=[],fp='rn64',capacity=32,rng=new S.Random(1),textureCount=4,threshold=.98}={}){
   super(options,tiles,threshold);this.profile=profile(fp);this.points=points(map);
   this.grid=new Grid(tiles,null,4,capacity,rng,textureCount,fp);
  }
  update(dt,point){const round=this.profile==='rd24'?R.down:f;
   if(this.layer!==-1&&this.layers.includes(this.layer)&&this.character&&this.nozzle)this.grid.tagDrips(point,this.radius,round(f(dt)*this.rate),this.points,true);
   const ratio=round(this.grid.total/((this.grid.width-2)*(this.grid.height-2))),complete=ratio>=this.threshold,progress=complete?1:ratio;
   for(const p of this.percent)if(!p.fired&&(this.profile==='rd24'?R.down(p.percent*f(.01)):p.percent*.01)<progress){this.events.push([p.event,0]);p.fired=true}
   this.dripped=this.grid.dripped;return complete;
  }
  tick(dt,point=[0,0],cutscene=false){dt=f(dt);if(!Number.isFinite(dt)||dt<0)throw Error('nonnegative float32 dt required');
   this.grid.tick(dt,this.warning||1);this.dripped=this.grid.dripped;
   if(this.state===1){if(!cutscene)this.elapsed=(this.profile==='rd24'?R.down:f)(this.elapsed+dt);if(this.update(dt,point))this.finish()}
  }
 }
 return Object.freeze({Grid,Area,nearest,tick});
});
