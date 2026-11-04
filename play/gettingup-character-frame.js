/* ICharacter wrapper effects in the validated non-shutdown/zero-world-drift
 * domain. Script, camera, animation Interp and bone-update effects are caller
 * events, not replaced physics, scripting, sampling or skeletal evaluation.
 */
(function(root,factory){
  const F=typeof module==='object'&&module.exports?require('./gettingup-frame-coordinator.js'):root.GettingUpFrameCoordinator;
  const api=factory(F);if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpCharacterFrame=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(F){'use strict';
  if(!F)throw Error('original frame coordinator required');const M=F.arithmetic,f=Math.fround;
  function byte(v){if(!Number.isInteger(v)||v<0||v>255)throw Error('raw byte required');return v}
  function word(v){if(!Number.isInteger(v)||v<0||v>0xffffffff)throw Error('DWORD required');return v}
  function scalar(v){if(typeof v!=='number'||!Number.isFinite(v)||!Number.isFinite(f(v)))throw Error('finite float32 required');return f(v)}
  function vector(v,n,check){if(!Array.isArray(v)||v.length!==n)throw Error('complete vector required');return v.map(check)}
  function copy(input){
    const s={...input};for(const k of ['field9be','field550','cinematic','init762','d90'])s[k]=byte(s[k]);
    for(const k of ['counter340','counter344','counter614','field3e8','type214'])s[k]=word(s[k]);
    if(!Number.isInteger(s.countdown864)||s.countdown864<0||s.countdown864>0x7fffffff)throw Error('nonnegative countdown required');
    if(!Number.isInteger(s.mode)||s.mode< -2147483648||s.mode>2147483647)throw Error('signed mode required');
    s.elapsed5d8=scalar(s.elapsed5d8);s.motion=vector(s.motion,3,scalar);s.velocity=vector(s.velocity,3,scalar);
    s.flags23=vector(s.flags23,23,byte);s.camera_row=vector(s.camera_row,4,word);return s;
  }
  function motion(dt,velocity){
    dt=scalar(dt);velocity=vector(velocity,3,scalar);const inverse=M.div(1,F.STEP),stored=M.store(inverse);
    const result=[M.store(M.mul(inverse,M.mul(dt,velocity[0]))),
      M.store(M.mul(stored,M.store(M.mul(dt,velocity[1])))),
      M.store(M.mul(stored,M.store(M.mul(dt,velocity[2]))))];
    return result.map((r,i)=>dt===0||velocity[i]===0?f(dt*velocity[i]):r);
  }
  function stateInterp(mode,amount){const events=[];if(mode===1)events.push({call:'prepare'});
    if(mode===1||mode===2)events.push({call:'anim_interp',amount:scalar(amount)});return events;}
  function apply(input,request){
    const s=copy(input),events=[],dt=scalar(request.dt);
    if(!['fixed','interp'].includes(request.kind))throw Error('fixed or interp character request required');
    if(s.field9be)return {state:s,events};
    if(request.kind==='fixed'){
      const fixed=byte(request.fixed),last=byte(request.last),carry=scalar(request.carry);
      const listener=byte(request.listener),flag=word(request.listener_flag),global=byte(request.global_pose);
      if(s.countdown864>0)s.countdown864--;s.init762=1;
      if(s.cinematic||s.mode===3||s.field550)return {state:s,events};
      for(const k of ['counter340','counter344','counter614'])s[k]=(s[k]+1)>>>0;s.elapsed5d8=0;
      events.push({call:'script',dt,fixed,last,carry});s.d90=1;s.camera_row=vector(request.camera_row,4,word);s.flags23.fill(0);
      if(s.type214!==5)s.field3e8=0;
      if(last&&listener&&(flag||global)){if(flag)events.push(...stateInterp(s.mode,M.store(M.mul(60,carry))));events.push({call:'update_bones'})}
    }else{
      if(s.mode===3||s.field550)return {state:s,events};const movement=motion(dt,s.velocity);
      s.motion=s.motion.map((v,i)=>f(v+movement[i]));events.push({call:'camera',movement});
      s.elapsed5d8=f(s.elapsed5d8+dt);events.push(...stateInterp(s.mode,M.store(M.mul(60,dt))));
    }
    return {state:s,events};
  }
  return Object.freeze({copy,motion,stateInterp,apply});
});
