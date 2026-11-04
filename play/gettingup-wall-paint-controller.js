/* Bounded original paint-pose selector. Requests do not move an entity or
 * activate an animation queue. Numeric Script fields retain their provenance.
 */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.GettingUpWallPaint=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const f=Math.fround;
 function distances(matrix,p,extent){
  const q=p.map((x,i)=>f(x)-f(matrix[12+i]));const local=[0,4].map(at=>f(q.reduce((s,x,i)=>s+x*f(matrix[at+i]),0)));
  return [f(f(extent[0])-local[0]),f(f(extent[1])-local[1]),f(local[0]-f(extent[2])),f(local[1]-f(extent[3]))];
 }
 const wide=s=>s.f5a0===1||![1,2].includes(s.f5a4);
 function bounds(s){
  if(s.f5a0===1){
   if(s.f5a4===3)[s.f638,s.f63c,s.f640,s.f644]=[0,2,6,8];
   else{[s.f638,s.f63c]=s.f5ea?[0,2]:s.f5eb?[9,11]:[18,20];[s.f640,s.f644]=s.f5ec?[24,26]:s.f5eb?[15,17]:[6,8]}
  }else if(s.f5a4===3)[s.f638,s.f63c,s.f640,s.f644]=[0,0,0,0];
  else{
   s.f634=[['f5ed','f5e8'],['f5ee','f5e9'],['f5ef','f5ea'],['f5f0','f5eb'],['f5f1','f5ec']].some(([a,b])=>s[a]&&!s[b]);
   s.f638=s.f63c=s.f5e8||s.f634?0:s.f5e9?1:s.f5ea?2:s.f5eb?3:4;
   s.f640=s.f644=s.f5ec?4:s.f5eb?3:s.f5ea?2:s.f5e9?1:0;
  }
  s.f648=s.f638<=s.f5cc&&s.f5cc<=s.f63c;s.f649=s.f640<=s.f5cc&&s.f5cc<=s.f644;
  s.f64d=s.f5cc%3===0;s.f64c=s.f5cc%3===2;return s;
 }
 function changePosition(s,n){if(n<101)s.f5cc=n;else if(n===101)s.f5cc-=wide(s)?3:1;else if(n===102)s.f5cc+=wide(s)?3:1;else if(wide(s)&&n===103)s.f5cc--;else if(wide(s)&&n===104)s.f5cc++;return s}
 function blocked(s,last){return !!(s.f5ab||s.f654||((s.f652||s.f653)&&s.f134<2)||(!s.f652&&s.f134<=(s.f620?-6:-3))||(s.f652&&s.f134>last-21))}
 function offset(s){
  s.f5ef=s.f5f0=s.f5f1=false;
  if([1,2].includes(s.f5a4)){s.f5ef=s.f5cc>=0&&s.f5cc<=8;s.f5f0=s.f5cc>=9&&s.f5cc<=17;s.f5f1=s.f5cc>=18&&s.f5cc<=26}else if(s.f5a4===3)s.f5f0=true;
  let y=s.f5ef?10:s.f5f0?5:s.f5f1?-10:0;if(s.f64a)y+=5;else if(s.f64b)y-=5;
  s.f64c=s.f5cc%3===2;s.f64d=s.f5cc%3===0;s.offset=[s.f64c?5:s.f64d?-5:0,y,5];return s.offset.slice();
 }
 const poseSlot=(pos,context)=>{if(context===3)return pos>=0&&pos<9?0x1f12+2*pos:0x1f1a;const base=context===1?0x1e02:0x1e98;return pos>=0&&pos<27?base+10*Math.trunc(pos/3)+2*(pos%3):base+42};
 const stepSlots=context=>{const base=context===1?0x1e08:0x1e9e;return Array.from({length:9},(_,r)=>[base+10*r,base+10*r+2])};
 function upper(previous,input,stateCode=0){
  const s={...previous,offset:previous.offset.slice()};s.f5a0=1;s.f5a4=stateCode===54?2:stateCode===70?3:1;
  const row=s.f5cc%9,col=s.f5cc%3;s.f64a=row<3;s.f64b=row>5;s.f64d=col===0;s.f64c=col===2;
  s.f62c=(s.f64a?3:0)+(s.f64b?3:0)+(col!==0?1:0)+(col===2?1:0);
  if(s.f5a4===3)s.f630=4;else if(s.f5ef)s.f630=4;else if(s.f5f0)s.f630=13;else if(s.f5f1)s.f630=22;
  if(s.f5a4===3){s.f64e=s.f60c>-15;s.f64f=s.f610>35;s.f650=s.f618>-5;s.f651=s.f614>30}
  else{s.f64e=!s.f648;s.f64f=!s.f649;s.f650=s.f618>(s.f5a4===2?input.lhug_threshold:5);s.f651=s.f614>20}
  s.f61d=!!input.primary;s.f61e=!!input.secondary;s.f61c=s.f61d||s.f61e;
  s.f61f=f(input.strength)>=f(.8);s.f620=f(input.strength)>=f(.9);
  input.directions.forEach((v,i)=>s['f'+(0x621+i).toString(16)]=!!v);
  return s;
 }
 function step(previous,env){
  const s={...previous,offset:previous.offset.slice()},effects=[];const last=env.last_frame;
  if(!s.f2fe||s.f5a4!==3&&s.current_slot===0x1cde)return {state:s,effects};
  s.f5a9=s.f61c;
  const rappel=s.f5a4===3,steps=stepSlots(s.f5a4),allSteps=[...stepSlots(1),...stepSlots(2)],left=allSteps.some(a=>a[0]===s.current_slot),right=allSteps.some(a=>a[1]===s.current_slot);
  const upSlots=[0x1f24,0x1f26,0x1f28],downSlots=[0x1f2a,0x1f2c,0x1f2e],rLeft=[0x1f30,0x1f34,0x1f38],rRight=[0x1f32,0x1f36,0x1f3a];
  const ru=upSlots.includes(s.current_slot),rd=downSlots.includes(s.current_slot),rl=rLeft.includes(s.current_slot),rr=rRight.includes(s.current_slot);
  const oldStep=s.f652,nowStep=rappel?ru||rd||rl||rr:left||right;
  if(!nowStep&&oldStep)s.f653=true;else if(s.f653&&s.f134>0)s.f653=false;
  const leftStepEnded=oldStep&&!nowStep;s.f652=nowStep;
  let l=false,r=false,u=false,d=false;
  if(s.f61f){
   const q=env.distances;s.f60c=f(Math.trunc(q[1]));s.f610=f(Math.trunc(q[3]));s.f618=f(Math.trunc(q[0]));s.f614=f(Math.trunc(q[2]));
   if(rappel){
    if((s.f621||s.f625&&!rl||s.f626&&!rr)&&q[1]>env.thresholds[0])u=true;
    else if((s.f622||s.f627&&!rl||s.f628&&!rr)&&q[3]>env.thresholds[1])d=true;
    else if((s.f623||s.f625&&!ru||s.f627&&!rd)&&q[0]>env.thresholds[2])l=true;
    else if((s.f624||s.f626&&!ru||s.f628&&!rd)&&q[2]>env.thresholds[3])r=true;
   }else if((s.f625||s.f623||s.f627)&&q[0]>5)l=true;
   else if((s.f626||s.f624||s.f628)&&q[2]>20)r=true;
  }
  if(!rappel&&leftStepEnded&&env.attached)effects.push({op:'physics',words:[10005,8]});
  if(rappel&&s.f652&&s.f134<1){if(r&&rr)effects.push({op:'nudge',xyz:[f(.7),0,0]});else if(l&&rl)effects.push({op:'nudge',xyz:[f(-.7),0,0]});else if(u&&ru)effects.push({op:'nudge',xyz:[0,f(.7),0]});else if(d&&rd)effects.push({op:'nudge',xyz:[0,f(-.7),0]})}
  if(blocked(s,last))return {state:s,effects};
  bounds(s);l=l&&s.f64d;r=r&&s.f64c;if(rappel){u=u&&s.f648;d=d&&s.f649}
  if(!rappel){if(!s.f652&&(l||r)&&s.f5d4<11){s.f5d4++;l=r=false}else if(s.f652||!l&&!r){if(s.f5d4>0)s.f5d4=0}}
  const goU=(s.f626||s.f621||s.f625)&&!s.f648,goD=(s.f628||s.f622||s.f627)&&!s.f649;
  const goL=(s.f625||s.f623||s.f627)&&!s.f64d,goR=(s.f626||s.f624||s.f628)&&!s.f64c;
  if(goU)s.f5cc-=wide(s)?3:1;else if(goD)s.f5cc+=wide(s)?3:1;
  if(wide(s)){if(goL)s.f5cc--;else if(goR)s.f5cc++}
  if(rappel)s.f5cc=Math.max(0,Math.min(8,s.f5cc));else if(s.f5cc<s.f638)changePosition(s,s.f638);else if(s.f5cc>s.f644)changePosition(s,s.f644);
  let slot=poseSlot(s.f5cc,s.f5a4),frame=0,reversal=false;
  if(rappel){
   if(l||r||u||d){const p=s.f5cc;if(p===0)slot=u?0x1f24:0x1f30;else if(p===1)slot=0x1f26;else if(p===2)slot=u?0x1f28:0x1f32;else if(p===3)slot=0x1f34;else if(p===5)slot=0x1f36;else if(p===6)slot=d?0x1f2a:0x1f38;else if(p===7)slot=0x1f2c;else if(p===8)slot=d?0x1f2e:0x1f3a;else slot=0x1f1a;
    reversal=r&&rr||l&&rl||u&&ru||d&&rd;
   }
  }else if(l||r){const p=s.f5cc;if(p>=0&&p<27&&p%3!==1)slot=steps[Math.trunc(p/3)][p%3===2?1:0];else slot=s.f5a4===1?0x1e2c:0x1ec2;reversal=r&&right||l&&left;
  }
  if(reversal&&slot!==s.current_slot)frame=(s.f134+12)%last+1;
  effects.push({op:'spray-offset',xyz:offset(s)});
  if(slot!==s.current_slot){
   if(!rappel&&reversal){const target=(s.f134+12)%(last+1);frame=target;effects.push({op:'physics',words:[target<s.f134?10006:10007,24,last,12,s.f134,target]})}
   else if(!rappel&&nowStep&&env.attached)effects.push({op:'physics',words:[10005,8]});
   effects.push({op:'transition',slot,parameter:12,frame});
  }
  return {state:s,effects};
 }
 return Object.freeze({distances,bounds,changePosition,blocked,offset,upper,step});
});
