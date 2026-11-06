/* OUR Pool Yard preview policy. Not original camera/sector/lighting emulation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpPoolPreview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const finite=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
 function removeYardGate(objects){
  // Owner-requested sandbox opening. Original GLB/MSH and the rest of the fence stay intact.
  const matches=[];objects.traverse(node=>{if(node.name==='IStatic_2117374')matches.push(node)});
  const gate=matches[0],source=gate?.userData.mesh?.replace(/\\/g,'/').split('/').pop().toLowerCase();
  if(matches.length!==1||source!=='pyfence06gate_s'||!gate.parent)throw Error('Exact Pool Yard gate required');
  let triangles=0;gate.traverse(node=>{if(node.isMesh){
   const count=node.geometry.index?.count;if(!Number.isInteger(count)||count%3)throw Error('Indexed gate triangles required');triangles+=count/3;
  }});
  if(triangles!==80)throw Error('Original Pool Yard gate geometry differs');
  gate.parent.remove(gate);
  return {node:gate.name,mesh:'pyFence06Gate_S',removed_triangles:triangles,original_asset_modified:false};
 }
 function camera(world,position,yaw,pitch,distance){
  if(!finite(position)||![yaw,pitch,distance].every(Number.isFinite)||distance<1||distance>500)throw Error('bounded preview camera required');
  const target=[position[0],position[1]+48,position[2]],h=distance*Math.cos(pitch),delta=[-Math.sin(yaw)*h,Math.sin(pitch)*distance+10,-Math.cos(yaw)*h];
  const length=Math.hypot(...delta);let fraction=1;
  if(world)for(const [side,up] of [[0,0],[-6,0],[6,0],[0,6],[0,-6]]){
   const offset=[Math.cos(yaw)*side,up,-Math.sin(yaw)*side],a=target.map((v,i)=>v+offset[i]),b=a.map((v,i)=>v+delta[i]),hit=world.ray(a,b);
   if(hit.hit)fraction=Math.min(fraction,Math.max(.001,hit.fraction-7/length));
  }
  return {target,position:target.map((v,i)=>v+delta[i]*fraction),clearance:length*fraction};
 }
 function expand(showcase){
  if(showcase?.source_level!=='m01_hoo_tranes_hood_2'||!Array.isArray(showcase.commands))throw Error('Pool Yard demo required');
  const frames=[];
  for(const row of showcase.commands){const v=row.input;
   if(!Number.isInteger(row.frames)||row.frames<1||row.frames>240||![-1,0,1].includes(v.x)||![-1,0,1].includes(v.z)||
    !['walk','jump','v','spray','fast'].every(k=>typeof v[k]==='boolean')||!Number.isFinite(v.cameraYaw))throw Error('bounded demo input required');
   for(let i=0;i<row.frames;i++)frames.push({...v});
   if(frames.length>1800)throw Error('bounded preview duration required');
  }
  if(frames.length!==showcase.frames)throw Error('complete preview commands required');return frames;
 }
 return Object.freeze({camera,expand,removeYardGate});
});
