/* Bounded original area lifecycle, not the live character input machine.
 * Preloaded Aerosol trait, event callback sink, no GUI/FX/resource loader.
 */
(function(root,factory){const node=typeof module==='object',api=factory(node?require('./gettingup-spray-controller.js'):root.GettingUpSprayController);if(node)module.exports=api;else root.GettingUpAreaController=api;
})(typeof globalThis!=='undefined'?globalThis:this,function areaController(C){'use strict';
 const F=Math.fround;
 class Area{
  constructor(options,tiles=[4,2],threshold=.98){this.options=options;this.tiles=tiles;this.threshold=F(threshold);this.grid=new C.Grid(tiles,null,4,0,new C.Random(1),0);this.state=0;this.layer=1;this.score_flags=0;this.elapsed=0;this.budget=0;this.rate=2;this.radius=17.5;this.completeEvents={done:[],fast:[],slow:[],dry:[],wet:[],big:[],small:[]};this.percent=[];this.events=[];this.dripped=false;this.goBig=false;this.hasPreviousTag=true;this.nozzle=true;this.character=true;this.layers=[0,1,2]}
  start(fast=false,complex=false,timePerQuad=4.5){const r=C.options(this.options,'Aerosol',complex,fast);this.layer=1;this.state=1;this.radius=r.radius;this.rate=r.rate;this.warning=r.warning;this.budget=F(timePerQuad*this.tiles[0]*this.tiles[1]);if(this.elapsed<0)this.elapsed=0}
  stop(){this.layer=-1}
  update(dt,point){if(this.layer!==-1&&this.layers.includes(this.layer)&&this.character&&this.nozzle)this.grid.tagDrips(point,this.radius,C.amount(dt,this.rate),[],true);
   const ratio=F(this.grid.total/((this.grid.width-2)*(this.grid.height-2))),complete=ratio>=this.threshold,progress=complete?1:ratio;
   for(const p of this.percent)if(!p.fired&&p.percent*.01<progress){this.events.push([p.event,0]);p.fired=true}
   return complete;
  }
  finish(){this.state=2;this.completeState=3;const emit=k=>this.completeEvents[k].forEach(v=>this.events.push([v,0]));emit('done');
   if(this.elapsed>0&&this.budget>this.elapsed){this.score_flags|=4;emit('fast')}else emit('slow');
   if(!this.dripped){this.score_flags|=8;emit('dry')}else emit('wet');
   if(this.goBig){this.score_flags|=1;emit('big')}else emit('small');if(this.hasPreviousTag)this.score_flags|=2;
  }
  tick(dt,point=[0,0],cutscene=false){dt=F(dt);if(!Number.isFinite(dt)||dt<0)throw Error('nonnegative float32 dt required');this.grid.tick(dt,this.warning||1);
   if(this.state===1){if(!cutscene)this.elapsed=F(this.elapsed+dt);if(this.update(dt,point))this.finish()}
  }
  snapshot(){return {state:this.state,layer:this.layer,score_flags:this.score_flags,budget:this.budget,elapsed:this.elapsed,radius:this.radius,rate:this.rate,total:this.grid.total,values:Array.from(this.grid.values),events:this.events.map(e=>e.slice())}}
 }
 function worldToWall(matrix,p){if(matrix.length!==16||p.length!==3||![...matrix,...p].every(Number.isFinite))throw Error('finite rigid transform required');const q=p.map((x,i)=>F(x)-F(matrix[12+i]));return [0,4].map(at=>F(q.reduce((s,x,i)=>s+x*F(matrix[at+i]),0)))}
 return Object.freeze({Area,worldToWall,moduleSource:areaController.toString()});
});
