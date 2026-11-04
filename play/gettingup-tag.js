/* Original complete base Tag loop + drip list semantics; bounded finite domain.
 * World placement, amount selection, random texture selection and GPU are separate. */
(function(root,factory){const G=typeof module==='object'?require('./gettingup-graffiti.js'):root.GettingUpGraffiti;
 const api=factory(G);if(typeof module==='object')module.exports=api;else root.GettingUpTag=api;
})(typeof globalThis!=='undefined'?globalThis:this,function tagRules(G){'use strict';
 const F=Math.fround,INV12=F(1/12),finite=(...xs)=>{if(!xs.every(Number.isFinite))throw Error('finite inputs required')};
 function mapPoints(points){return points.map(([x,y])=>[F(F(x)*.28125),F(F(y)*.28125)])}
 class Grid{
  constructor(tiles=[4,2],origin=null,divisor=4,capacity=32){
   if(tiles.length!==2||!tiles.every(t=>Number.isInteger(t)&&t>0&&t<=16)||!Number.isInteger(capacity)||capacity<0||capacity>32)throw Error('bounded grid required');
   [this.width,this.height]=tiles.map(t=>t*3+1);this.origin=(origin||tiles.map(t=>t*18)).map(F);this.divisor=divisor;this.capacity=capacity;
   this.values=new Float32Array(this.width*this.height);this.total=0;this.drips=[];this.selected=255;this.dripped=false;this.calls=0;
  }
  tag(point,radius,amount,enabled=true){finite(...point,radius,amount);if(radius<=0||amount<0)throw Error('positive radius / nonnegative amount required');
   const[qx,qy]=point.map(F);radius=F(radius);amount=F(amount);const r2=F(radius*radius),bx=Math.trunc((this.origin[0]-qx)*INV12),by=Math.trunc((this.origin[1]-qy)*INV12),cells=Math.trunc(radius*INV12);
   let result=1,visited=0;
   for(let y=Math.max(0,by-cells);y<=Math.min(this.height-1,by+cells+1);y++){
    const dy0=F(this.origin[1]-12*y);
    for(let x=Math.max(0,bx-cells);x<=Math.min(this.width-1,bx+cells+1);x++){
     const dx=(this.origin[0]-12*x)-qx,dy=dy0-qy,d2=dx*dx+dy*dy,flow=d2<r2?F((1-d2/r2)*amount):0,i=y*this.width+x;
     const[v,sum,overflow]=G.cell(this.values[i],flow,this.divisor,this.total,x>0&&x<this.width-1&&y>0&&y<this.height-1);
     this.values[i]=v;this.total=sum;if(overflow>0&&enabled)result=2;visited++;
    }
   }
   this.calls++;return [result,visited];
  }
  tagDrips(point,radius,amount,points,enabled=true){const result=this.tag(point,radius,amount,enabled);
   if(result[0]===2){const q=this.origin.map((o,i)=>F(o-F(point[i]))),[found,index]=G.nearest(points,q,this.selected);this.selected=index;
    if(found&&index<32&&!this.drips.some(d=>(d[1]&127)===index)&&this.drips.length<this.capacity)this.drips.unshift([0,index,255])}
   return result;
  }
  tick(dt,trigger=1){const after=[],events=[];for(const[old,flags,texture]of this.drips){
    const[t,f,state]=G.tick(old,flags,dt,trigger,(flags&127)===this.selected);
    if(state){after.push([t,f,texture]);if(state===1){events.push(f&127);this.dripped=true}}
   }this.drips=after;this.selected=255;return events;
  }
 }
 function rectangles(elapsed,flags,origin,point,definition){elapsed=F(elapsed);const trigger=F(definition.trigger),start=F(definition.spot.StartSize),end=F(definition.spot.EndSize),width=F(definition.streak.Width),length=F(definition.streak.Length),time=F(definition.streak.Time);
  const a=flags&128?1:Math.min(1,F(elapsed/trigger)),grow=!(flags&128)?0:elapsed>time+trigger?1:elapsed<trigger?0:F((elapsed-trigger)/time);
  const[x,y]=origin.map((o,i)=>F(F(o)-F(point[i]))),half=F(((end-start)*a+start)*.5);
  return [a,[F(x-half),F(y+half),F(x+half),F(y-half)],flags&128?[F(x-width),y,F(x+width),F(y-grow*length)]:null];
 }
 return Object.freeze({Grid,mapPoints,rectangles,moduleSource:tagRules.toString()});
});
