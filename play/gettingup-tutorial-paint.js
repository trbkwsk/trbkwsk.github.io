/* Dynamic original manager-level drip gate; density painting stays active.
 * Diagnostic CPU consumer, not a renderer or an animated nozzle producer.
 */
(function(root,factory){const node=typeof module==='object';
 const api=factory(node?require('./gettingup-shared-drips.js'):root.GettingUpSharedDrips);
 if(node)module.exports=api;else root.GettingUpTutorialPaint=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D){'use strict';
 class Area extends D.Area{
  constructor(options,config){super(options,config);this.dripsEnabled=true}
  update(dt,point){
   if(this.profile!=='rn64')throw Error('tutorial joint paint currently validates RN64 only');
   if(typeof this.dripsEnabled!=='boolean')throw Error('explicit manager drip gate required');
   const f=Math.fround;
   if(this.layer!==-1&&this.layers.includes(this.layer)&&this.character&&this.nozzle)
    this.grid.tagDrips(point,this.radius,f(f(dt)*this.rate),this.points,this.dripsEnabled);
   const ratio=f(this.grid.total/((this.grid.width-2)*(this.grid.height-2))),complete=ratio>=this.threshold,progress=complete?1:ratio;
   for(const p of this.percent)if(!p.fired&&p.percent*.01<progress){this.events.push([p.event,0]);p.fired=true}
   this.dripped=this.grid.dripped;return complete;
  }
 }
 return Object.freeze({Area});
});
