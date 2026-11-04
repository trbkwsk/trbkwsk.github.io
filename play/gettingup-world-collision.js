/* OUR diagnostic capsule against actual render triangles. NOT original BSP
 * filtering/physics. Pure geometry, shared by Node tests and the live page.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GettingUpWorldCollision=api;
})(typeof globalThis!=='undefined'?globalThis:this,function collisionModule(){'use strict';
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const length=a=>Math.sqrt(dot(a,a)),clamp=x=>Math.min(1,Math.max(0,x));
  function finite(p){if(!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v)||Math.abs(v)>1e7))throw Error('bounded finite XYZ required');return p}
  function edgePoint(p,a,b){const d=sub(b,a),s=dot(d,d);return add(a,mul(d,s?clamp(dot(sub(p,a),d)/s):0))}
  function inside(p,a,b,c){
    const u=sub(b,a),v=sub(c,a),w=sub(p,a),uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),wu=dot(w,u),wv=dot(w,v),d=uu*vv-uv*uv;
    if(Math.abs(d)<1e-12)return false;const s=(vv*wu-uv*wv)/d,t=(uu*wv-uv*wu)/d;
    return s>=-1e-8&&t>=-1e-8&&s+t<=1+1e-8;
  }
  function pointTriangle(p,a,b,c){
    const n=cross(sub(b,a),sub(c,a)),nn=dot(n,n);
    if(nn>1e-12){const q=sub(p,mul(n,dot(sub(p,a),n)/nn));if(inside(q,a,b,c))return q}
    return [[a,b],[b,c],[c,a]].map(([u,v])=>edgePoint(p,u,v)).sort((u,v)=>dot(sub(p,u),sub(p,u))-dot(sub(p,v),sub(p,v)))[0];
  }
  function segmentPair(p,q,a,b){
    const d1=sub(q,p),d2=sub(b,a),r=sub(p,a),aa=dot(d1,d1),ee=dot(d2,d2),ff=dot(d2,r);let s,t;
    if(aa<1e-12&&ee<1e-12)return [p.slice(),a.slice()];
    if(aa<1e-12){s=0;t=clamp(ff/ee)}
    else{const cc=dot(d1,r);if(ee<1e-12){t=0;s=clamp(-cc/aa)}
      else{const bb=dot(d1,d2),den=aa*ee-bb*bb;s=den>1e-12?clamp((bb*ff-cc*ee)/den):0;t=(bb*s+ff)/ee;
        if(t<0){t=0;s=clamp(-cc/aa)}else if(t>1){t=1;s=clamp((bb-cc)/aa)}}}
    return [add(p,mul(d1,s)),add(a,mul(d2,t))];
  }
  function segmentTriangle(p,q,a,b,c){
    const n=cross(sub(b,a),sub(c,a)),d=sub(q,p),den=dot(n,d);
    if(Math.abs(den)>1e-12){const t=dot(n,sub(a,p))/den;if(t>=0&&t<=1){const v=add(p,mul(d,t));if(inside(v,a,b,c))return [v,v.slice()]}}
    const candidates=[[p,pointTriangle(p,a,b,c)],[q,pointTriangle(q,a,b,c)],
      ...[[a,b],[b,c],[c,a]].map(([u,v])=>segmentPair(p,q,u,v))];
    return candidates.sort((x,y)=>dot(sub(x[0],x[1]),sub(x[0],x[1]))-dot(sub(y[0],y[1]),sub(y[0],y[1])))[0];
  }
  function triangle(a,b,c){
    [a,b,c].forEach(finite);const n=cross(sub(b,a),sub(c,a)),size=length(n);
    return {a:a.slice(),b:b.slice(),c:c.slice(),normal:size?mul(n,1/size):[0,1,0],
      min:[0,1,2].map(i=>Math.min(a[i],b[i],c[i])),max:[0,1,2].map(i=>Math.max(a[i],b[i],c[i])),degenerate:size<1e-8};
  }
  class World{
    constructor(triangles,cellSize=128){
      if(!Array.isArray(triangles)||!triangles.length||!Number.isFinite(cellSize)||cellSize<1)throw Error('nonempty triangle world required');
      this.triangles=triangles;this.cellSize=cellSize;this.grid=new Map();this.large=[];
      triangles.forEach((t,i)=>{if(t.degenerate)return;
        const x0=Math.floor(t.min[0]/cellSize),x1=Math.floor(t.max[0]/cellSize),z0=Math.floor(t.min[2]/cellSize),z1=Math.floor(t.max[2]/cellSize);
        if((x1-x0+1)*(z1-z0+1)>4096){this.large.push(i);return}
        for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=x+','+z;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(i)}
      });
    }
    query(min,max){
      finite(min);finite(max);if(min.some((v,i)=>v>max[i]))throw Error('ordered world query required');
      const ids=new Set(this.large),s=this.cellSize;
      // Very long camera rays must not enumerate millions of empty cells.
      if((Math.floor(max[0]/s)-Math.floor(min[0]/s)+1)*(Math.floor(max[2]/s)-Math.floor(min[2]/s)+1)>4096)
        return this.triangles.filter(t=>!t.degenerate&&t.min.every((v,i)=>v<=max[i])&&t.max.every((v,i)=>v>=min[i]));
      for(let x=Math.floor(min[0]/s);x<=Math.floor(max[0]/s);x++)for(let z=Math.floor(min[2]/s);z<=Math.floor(max[2]/s);z++)
        for(const i of this.grid.get(x+','+z)||[])ids.add(i);
      return Array.from(ids).map(i=>this.triangles[i]).filter(t=>t.min.every((v,i)=>v<=max[i])&&t.max.every((v,i)=>v>=min[i]));
    }
    ray(start,end){
      finite(start);finite(end);const d=sub(end,start),total=length(d);let result=1;
      const min=start.map((v,i)=>Math.min(v,end[i])),max=start.map((v,i)=>Math.max(v,end[i]));
      for(const t of this.query(min,max)){
        const den=dot(t.normal,d);if(Math.abs(den)<1e-10)continue;const f=dot(t.normal,sub(t.a,start))/den;
        if(f>=0&&f<result&&inside(add(start,mul(d,f)),t.a,t.b,t.c))result=f;
      }
      return {fraction:result,distance:total*result,point:add(start,mul(d,result)),hit:result<1};
    }
    move(position,delta,{radius=12,height=82,footOffset=0,stopOnSupport=false}={}){
      finite(position);finite(delta);if(!([radius,height,footOffset].every(Number.isFinite)&&radius>0&&height>=2*radius&&height<1e5&&Math.abs(footOffset)<1e5))throw Error('valid capsule dimensions required');
      let p=position.slice(),grounded=false;const contacts=[],steps=Math.max(1,Math.ceil(length(delta)/(radius/3)));
      if(steps>128)throw Error('movement outside bounded substep domain');const part=mul(delta,1/steps);
      let used=0;for(let j=0;j<steps;j++){
        used++;
        const previous=p.slice();p=add(p,part);
        for(let iteration=0;iteration<6;iteration++){
          let moved=false;const min=[p[0]-radius,p[1]+footOffset-1,p[2]-radius],max=[p[0]+radius,p[1]+footOffset+height+1,p[2]+radius];
          for(const t of this.query(min,max)){
            const a=add(p,[0,footOffset+radius,0]),b=add(p,[0,footOffset+height-radius,0]);
            const [onCapsule,onTriangle]=segmentTriangle(a,b,t.a,t.b,t.c),v=sub(onCapsule,onTriangle),distance=length(v);
            if(distance>=radius-.0001)continue;let normal;
            if(distance>1e-8)normal=mul(v,1/distance);
            else{const center=add(previous,[0,footOffset+height/2,0]);normal=mul(t.normal,dot(t.normal,sub(center,t.a))>=0?1:-1)}
            const correction=radius-distance+.001;p=add(p,mul(normal,correction));moved=true;
            if(normal[1]>.65&&delta[1]<=0)grounded=true;
            contacts.push({normal,depth:correction});
          }
          if(!moved)break;
        }
        if(stopOnSupport&&delta[1]<0&&contacts.some(c=>c.normal[1]>.2))break;
      }
      return {position:p,grounded,contacts,substeps:used,originalPhysics:false};
    }
    advance(position,delta,shape,wasGrounded=false){
      if(!shape||!Number.isFinite(shape.stepHeight??0)||shape.stepHeight<0||shape.stepHeight>shape.height/2)throw Error('bounded step height required');
      const result=this.move(position,delta,shape),distance=Math.hypot(delta[0],delta[2]),h=shape.stepHeight||0;
      if(wasGrounded&&delta[1]<=0&&result.position[1]>=position[1]-.25&&result.contacts.some(c=>c.normal[1]>.2))result.grounded=true;
      if(!wasGrounded||delta[1]>0||!distance||h<=0)return {...result,stepped:false};
      if(!Number.isFinite(h)||h>shape.height/2)throw Error('bounded step height required');
      const progress=p=>((p[0]-position[0])*delta[0]+(p[2]-position[2])*delta[2])/distance;
      if(progress(result.position)>=distance-.01)return {...result,stepped:false};
      const ahead=[position[0]+delta[0]/distance*(shape.radius+distance),position[1]+(shape.footOffset||0),position[2]+delta[2]/distance*(shape.radius+distance)];
      const top=this.ray(add(ahead,[0,shape.height,0]),add(ahead,[0,-.1,0]));
      if(!top.hit||top.point[1]-ahead[1]>h+.01)return {...result,stepped:false};
      // OUR three-part step test: lift with ceiling collision, move above
      // the lip, then find actual triangle support. Never fabricate a floor.
      const up=this.move(position,[0,h,0],shape);
      if(up.position[1]<position[1]+h-.01)return {...result,stepped:false};
      const across=this.move(up.position,[delta[0],0,delta[2]],shape),down=this.move(across.position,[0,-h+delta[1],0],{...shape,stopOnSupport:true});
      const supported=down.grounded||down.contacts.some(c=>c.normal[1]>.2);
      if(supported&&down.position[1]<=position[1]+h+.01&&progress(down.position)>progress(result.position)+.01)
        return {...down,grounded:true,stepped:true,contacts:[...up.contacts,...across.contacts,...down.contacts]};
      return {...result,stepped:false};
    }
  }
  return Object.freeze({triangle,pointTriangle,segmentPair,segmentTriangle,World,moduleSource:collisionModule.toString()});
});
