/* Bounded independent port; proof: manifests/graffiti-original-primitives.json.
 * Does not implement D3D blending, tool-rate selection or whole Tag()/AI logic. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.GettingUpGraffiti=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const F=Math.fround,SCALE=F(1/255);
  const finite=(...v)=>{if(!v.every(Number.isFinite))throw Error('finite values required')};
  function tables(under=.5,fill=.85){
    const u=F(under),f=F(fill);if(!(u>0&&u<f&&f<=1))throw Error('ordered thresholds required');
    const a=[],b=[];for(let i=0;i<256;i++){const p=i*SCALE;
      a.push(p>=u?255:Math.trunc(p/u*255)&255);
      b.push(p<u?0:F(p)>=f?255:Math.trunc((F(p)-u)/(f-u)*255)&255)}return [a,b];
  }
  function alpha(density,layer,lut){finite(density);density=F(density);if(density<0||density>1)throw Error('density range');
    return layer===1||layer===2?F(lut[layer-1][Math.trunc(density*255)]*SCALE):0;
  }
  function nearest(points,query,previous=165){
    if(points.length>32||!Number.isInteger(previous)||previous<0||previous>255)throw Error('bounded map/byte required');
    finite(...query,...points.flat());const [qx,qy]=query.map(F);let best=1e9,index=previous;
    points.forEach(([x,y],i)=>{const dx=F(F(x)-qx),dy=F(y)-qy,d=dx*dx+dy*dy;if(d<best){best=F(d);index=i}});
    return [!!points.length,index];
  }
  function tick(elapsed,flags,dt,trigger,selected){finite(elapsed,dt,trigger);
    if(dt<0||trigger<=0||!Number.isInteger(flags)||flags<0||flags>255||typeof selected!=='boolean')throw Error('bounded drip inputs required');
    elapsed=F(elapsed);dt=F(dt);trigger=F(trigger);let state=2,newTime;
    if((flags&128)||selected){newTime=elapsed+dt;if(elapsed<trigger&&trigger<=newTime){flags|=128;state=1}}
    else{newTime=elapsed-dt*.25;if(newTime<=0)state=0}return [F(newTime),flags,state];
  }
  function cell(old,amount,divisor,total,interior){finite(old,amount,total);
    if(old<0||old>1||amount<0||!Number.isInteger(divisor)||divisor<=0)throw Error('bounded cell inputs required');
    old=F(old);amount=F(amount);total=F(total);const raw=old+amount/divisor,v=Math.min(1,raw);
    return [F(v),interior?F(total+(v-old)):total,F(Math.max(0,raw-1))];
  }
  return {tables,alpha,nearest,tick,cell,SCALE};
});
