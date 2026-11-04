/* Separate original D3D8 + EXE x87 profile: 24-significand, round downward.
 * Does not replace sealed RN fixtures. Bounded to the verified paint pipeline,
 * identity control basis and empty DripMap; full engine FP scheduling is separate.
 */
(function(root,factory){if(typeof module==='object')module.exports=factory(require('./gettingup-spray-controller.js'),require('./gettingup-area-controller.js'));
 else root.GettingUpPaintRD24=factory(root.GettingUpSprayController,root.GettingUpAreaController);
})(typeof globalThis!=='undefined'?globalThis:this,function(S,B){'use strict';
 const f=Math.fround,buffer=new ArrayBuffer(4),view=new DataView(buffer);
 function down(x){if(!Number.isFinite(x))throw Error('bounded finite arithmetic required');const q=f(x);if(q<=x)return q;view.setFloat32(0,q,true);const bits=view.getUint32(0,true);view.setUint32(0,q===0?0x80000001:bits&0x80000000?bits+1:bits-1,true);return view.getFloat32(0,true)}
 function directions(x,y){x=f(x);y=f(y);const ax=Math.abs(x),ay=Math.abs(y),p=f(.4),n=f(-.4),d=f(.2),nd=f(-.2),my=down(down(ay*.25)+d),mx=down(down(ax*.25)+d);
  const cardinal=[y>p&&ay>ax,y<n&&ay>ax,x<n&&ax>ay,x>p&&ax>ay].map(Number),u=y>p&&ax<my,b=y<n&&ax<my,l=x<n&&ay<mx,r=x>p&&ay<mx;
  return {cardinal,directions:[u,b,l,r,!u&&!l&&y>=d&&x<=nd,!u&&!r&&y>=d&&x>=d,!b&&!l&&y<=nd&&x<=nd,!b&&!r&&y<=nd&&x>=d].map(Number)};
 }
 function keyboard(keys,smooth=0){const k=new Set(keys),x=k.has('KEY_D')?1:k.has('KEY_A')?-1:0,y=k.has('KEY_W')?1:k.has('KEY_S')?-1:0,strength=Math.min(1,down(Math.sqrt(x*x+y*y)));let angle=0;
  if(strength){angle=down(Math.acos(y/strength));if(x<0)angle=-angle;angle=down(angle*f(180/Math.PI))}
  return {axes:[x,y],strength,angle,smooth:down(down(f(smooth)*.75)+down(strength*.25)),...directions(x,y)};
 }
 class Grid extends S.Grid{
  tag(point,radius,amount,enabled=true){const[qx,qy]=point.map(f);radius=f(radius);amount=f(amount);const r2=down(radius*radius),inv=f(1/12),bx=Math.trunc(down(down(this.origin[0]-qx)*inv)),by=Math.trunc(down(down(this.origin[1]-qy)*inv)),cells=Math.trunc(down(radius*inv));let result=1,visited=0;
   for(let y=Math.max(0,by-cells);y<=Math.min(this.height-1,by+cells+1);y++)for(let x=Math.max(0,bx-cells);x<=Math.min(this.width-1,bx+cells+1);x++){
    const dx=down(down(this.origin[0]-12*x)-qx),dy=down(down(this.origin[1]-12*y)-qy),d2=down(down(dx*dx)+down(dy*dy)),flow=d2<r2?down(down(1-down(d2/r2))*amount):0,i=y*this.width+x,old=this.values[i],raw=down(old+down(flow/this.divisor)),v=Math.min(1,raw);
    this.values[i]=v;if(x>0&&x<this.width-1&&y>0&&y<this.height-1)this.total=down(this.total+down(v-old));if(raw>1&&enabled)result=2;visited++;
   }this.calls++;return [result,visited];
  }
 }
 class Area extends B.Area{
  constructor(options,tiles=[4,2],threshold=.98){super(options,tiles,threshold);this.grid=new Grid(tiles,null,4,0,new S.Random(1),0)}
  update(dt,point){if(this.layer!==-1&&this.layers.includes(this.layer)&&this.character&&this.nozzle)this.grid.tagDrips(point,this.radius,down(f(dt)*this.rate),[],true);
   const ratio=down(this.grid.total/((this.grid.width-2)*(this.grid.height-2))),complete=ratio>=this.threshold,progress=complete?1:ratio;
   for(const p of this.percent)if(!p.fired&&down(p.percent*f(.01))<progress){this.events.push([p.event,0]);p.fired=true}return complete;
  }
  tick(dt,point=[0,0],cutscene=false){dt=f(dt);if(!Number.isFinite(dt)||dt<0)throw Error('nonnegative float32 dt required');this.grid.tick(dt,this.warning||1);if(this.state===1){if(!cutscene)this.elapsed=down(this.elapsed+dt);if(this.update(dt,point))this.finish()}}
 }
 const eligible=id=>[36,40,42].includes(id),floor=(mode,upgrade)=>([9,17,22].includes(mode)||upgrade)?.75:1.25;
 function consume(level,health,c){level=f(level);health=f(health);const min=floor(c.mode,c.upgrade),effects=[];if(!(level>min))return {level,allowed:false,effects};const fast=c.fast_unlocked&&([9,17].includes(c.mode)?c.primary||c.secondary:c.secondary);let amount=fast?down(min*f(1.4)):min;if(down(level-amount)<min)amount=down(level-min);level=down(level-amount);if(eligible(c.item_id)&&health!==level)effects.push({op:health>level?'damage':'change-health',amount:down(Math.abs(health-level))});return {level,allowed:true,effects}}
 function recover(level,health,c,force=false){level=f(level);health=f(health);if(level<500)level=force||down(level+5)>500?500:down(level+5);const effects=[];if(eligible(c.item_id)&&health!==level)effects.push({op:'change-health',amount:down(Math.abs(health-level))});return {level,effects}}
 function randomInclusive(state,lo,hi){state=(Math.imul(state,214013)+2531011)>>>0;const value=(state>>>16)&32767;return {state,value:Math.min(hi,lo+Math.trunc(down(down(value*f(1/32767))*(hi-lo+1))))}}
 function step(previous,input,c,services){
  if(typeof services?.inventory!=='function')throw Error('explicit inventory response required');const s={...previous},effects=[],p=!!input.primary,k=!!input.secondary;
  s.f61d=p;s.f61e=k;s.f61c=p||k;s.f550=6;s.f5a9=!!input.ready;s.f56c=input.blocked||0;
  const ready=s.f5a9&&!s.f5d8,high=s.level>floor(c.mode,c.upgrade),full=s.level>=500,healthShort=s.health<s.level,low=s.level<=50;let idleExpired=false;
  if(s.f61c||full)s.f5dc=0;else if(s.f5dc===0)s.f5dc=25;else if(s.f5dc>1)s.f5dc--;else idleExpired=true;
  s.f5d8=!!input.playing;s.f5d9=!!(input.playing&&!input.at_start);
  const inventory=r=>{s.level=r.level;for(const e of r.effects){effects.push(e);s.health=f(services.inventory(e,s.health))}},fast=()=>s.f568&&([9,17].includes(c.mode)?p||k:k);
  if(s.f56c>0)s.f61c=false;
  else if(s.f61c&&ready&&high&&!s.f5db){if(!s.f559)inventory(consume(s.level,s.health,{...c,primary:p,secondary:k,fast_unlocked:s.f568}));if(s.f61c&&!s.f5aa){s.f5a8=true;if(!s.f2fb){s.f2fb=true;effects.push({op:'fx',event:4})}effects.push({op:'start',fast:!!fast()});s.f5aa=true}}
  else if(s.f5aa&&(!high||!s.f61c)){if(s.f2fb){s.f2fb=false;effects.push({op:'fx',event:5})}effects.push({op:'stop'});s.f5aa=false}
  else if((idleExpired&&!s.f61c)||healthShort){if((!s.f5d8||s.f5d9)&&!healthShort){effects.push({op:'sound-play',sound:101,args:[1112014848,1,1157234688,4294967295,0,256]});effects.push({op:'animation',name:'TR_Tag_CanShake_LookF',layer:4,speed:1.5,args:[0,s.f5d9?5:15,15,0,1,4]})}inventory(recover(s.level,s.health,c))}
  const rand=(lo,hi)=>{const r=randomInclusive(s.rng,lo,hi);s.rng=r.state;return r.value};
  if(s.f5a9&&low){s.f5da=true;if(s.f5e0<150)s.f5e0++;if(s.f5e4===0){s.f5db=!s.f5db;s.f5e4=rand(2,7);if(s.f5db&&s.f5e0>=100&&rand(0,5)===0){const d=Math.trunc(s.f5e0/10);s.f5e4=rand(d*2,d*3)}}else s.f5e4--}else{s.f5da=false;s.f5e0=0;s.f5e4=0;s.f5db=false}
  const startSound=()=>{effects.push({op:'sound-play',sound:fast()?103:102,args:[1116471296,4294967295,1145569280,4294967295,0,256]});s.f590=services.soundHandle};
  if(s.f5da){if(s.f61c&&high&&!s.f590&&!s.f5db&&!s.f5d8)startSound();else if(s.f590&&(s.f5db||s.f5d8)){effects.push({op:'sound-stop',handle:s.f590,fade:7});s.f590=0}}
  else if(s.f61c&&high&&!s.f590&&s.f5a9&&!s.f5d8)startSound();else if(s.f590&&(!s.f5a9||s.f5d8)){effects.push({op:'sound-stop',handle:s.f590,fade:0});s.f590=0}return {state:s,effects};
 }
 return Object.freeze({down,directions,keyboard,Grid,Area,floor,consume,recover,randomInclusive,step});
});
