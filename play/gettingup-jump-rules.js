/* Original takeoff scalar/event rules. Ceiling is an explicit input, not a
 * recovered collision query. This module does not implement world physics.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpJumpRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function jumpRules(){'use strict';
  function launch(clearance,running,specialMap=false,parent=false){
    if(!Number.isFinite(clearance)||clearance<0||clearance>1e6||[running,specialMap,parent].some(x=>typeof x!=='boolean'))throw Error('bounded finite ceiling and boolean launch inputs required');
    clearance=Math.fround(clearance); // Original Script field +340 is float32.
    const vertical=clearance<125?(running?126:120):clearance<150||specialMap&&parent?(running?220.5:210):(running?315:300);
    return {vertical,forward:running?215:0};
  }
  function shouldLaunch(running,event){
    if(typeof running!=='boolean'||!Number.isInteger(event)||event< -32768||event>32767)throw Error('boolean mode and signed 16-bit event required');
    return event===(running?-1:54);
  }
  function gravityScale(phase,entering){
    if(!['stand_takeoff','run_takeoff','stand_air','run_air'].includes(phase)||typeof entering!=='boolean')throw Error('verified jump phase and explicit enter/exit required');
    return entering&&phase.endsWith('_air')?2:1;
  }
  return Object.freeze({launch,shouldLaunch,gravityScale,fileDefaultGravity:-384,moduleSource:jumpRules.toString()});
});
