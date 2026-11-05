/* Original Trane candidate predicates for the bounded f6b5=0 profile.
 * Empty-world arbitration and input consumption are the sandbox adapter.
 * No claim of original combat target selection, hit resolution or ROLL #34.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpPoolCombat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function poolCombat(){'use strict';
 const f=Math.fround;
 function candidates({punch=false,kick=false,use=false,speed=0,angle=0,blocked=false,f724=false,f6b5=0}){
  if(f6b5!==0||!Number.isFinite(speed)||!Number.isFinite(angle)||Math.abs(angle)>180||speed<0)throw Error('bounded original non-target action profile required');
  if(blocked)return [];
  const moving=f(speed)>=f(.05),a=f(angle),rows=[];
  const add=(offset,on,p3,p4,p5)=>rows.push({offset,on:!!on,args:[p3,p4,p5]});
  if(!f724){add('32d2',use&&moving&&a>-135&&a< -45,4,3,5);add('32d4',use&&moving&&a>45&&a<135,4,3,5)}
  add('328e',punch,2,0,2);add('32ae',kick,2,0,2);
  add('3296',punch,5,0,2);add('3298',punch,2,0,1);add('32b2',kick,5,0,1);
  return rows;
 }
 class Input{
  constructor(){this.tick=0;this.down={punch:false,kick:false,use:false};this.edges={punch:-Infinity,kick:-Infinity,use:-Infinity}}
  step(values,enabled){
   this.tick++;const recent={};
   for(const name of Object.keys(this.down)){
    const down=!!values[name];if(enabled&&down&&!this.down[name])this.edges[name]=this.tick;
    this.down[name]=down;if(!enabled)this.edges[name]=-Infinity;
    recent[name]=enabled&&this.tick-this.edges[name]<10;
   }
   return recent;
  }
  consume(){for(const key of Object.keys(this.edges))this.edges[key]=-Infinity}
 }
 // Exactly one physical action at a time avoids inventing the unported
 // multi-candidate ranking. p5=2 is rejected by original AI_Trans without
 // prospects; p5=1 supports air strikes. Sns uses a valid dodge-table entry.
 function select(input){
  if([input.punch,input.kick,input.use].filter(Boolean).length!==1)return null;
  const names={'32d2':'evade_left','32d4':'evade_right','3298':'punch','32b2':'kick'};
  return candidates(input).filter(r=>r.on&&names[r.offset]).map(r=>names[r.offset])[0]||null;
 }
 function relativeAngle(x,z,cameraYaw,heading){
  if(![-1,0,1].includes(x)||![-1,0,1].includes(z)||![cameraYaw,heading].every(Number.isFinite))throw Error('finite camera-relative controls required');
  if(!x&&!z)return 0;
  // Original grCharToCtrl_Angle normalizes float32 vectors, stores the dot
  // product as float32, takes acos, and signs it with the cross-product Y.
  // atan2 hides the original near-parallel float error and can move a gate.
  const normalize=(x,z)=>{const inv=f(1/f(Math.sqrt(f(f(x*x)+f(z*z)))));return [f(x*inv),f(z*inv)]};
  // The rear camera looks towards +Z at yaw zero: its screen right is -X.
  // Reflect that display-space control vector once into the native basis.
  const [cx,cz]=normalize(f(Math.cos(cameraYaw)*x-Math.sin(cameraYaw)*z),f(Math.cos(cameraYaw)*z+Math.sin(cameraYaw)*x));
  const [hx,hz]=normalize(f(-Math.sin(heading)),f(Math.cos(heading)));
  const cosine=Math.max(-1,Math.min(1,f(f(cx*hx)+f(cz*hz)))),degrees=f(f(Math.acos(cosine))*f(180/Math.PI));
  return f(f(cz*hx)-f(cx*hz))>0?-degrees:degrees;
 }
 return Object.freeze({candidates,Input,select,relativeAngle,moduleSource:poolCombat.toString()});
});
