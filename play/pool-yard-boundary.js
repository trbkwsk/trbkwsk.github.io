/* Explicit sandbox completion of source geometry that was open to the backdrop.
 * New infill is not claimed to be original mission geometry or native lighting. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GettingUpPoolBoundary=api;
})(globalThis,function poolBoundary(){'use strict';
 const WORLD='0c4bd5c221a1bc8b74a94f7623cb9eb5666cf65e926a2e37b1ef1d19c7606858';
 const finite=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
 function validate(data){
  if(data?.kind!=='pool-yard-sandbox-boundary-infill'||data.source_world_sha256!==WORLD||data.original_geometry_recovered!==false||
   data.original_assets_modified!==false||!Array.isArray(data.patches)||!data.patches.length||data.patches.length>64)throw Error('Explicit Pool Yard infill required');
  let count=0;
  for(const p of data.patches){
   if(!['floor','wall','roof'].includes(p.role)||!p.name||!['pyCement01_M01','pyBrick01_M01','pyRoof02_M01'].includes(p.texture)||
    !Array.isArray(p.positions)||!p.positions.length||p.positions.length%3||p.positions.length>15000||!p.positions.every(v=>finite(v,3)&&v.every(x=>Math.abs(x)<20000))||
    !Array.isArray(p.uv)||p.uv.length!==p.positions.length||!p.uv.every(v=>finite(v,2)))throw Error('Finite indexed infill required');
   if(p.role==='floor'&&p.positions.some(v=>v[1]!==-1024||v[0]>-910&&v[0]<851))throw Error('Infill must not cover the original pool');
   count+=p.positions.length/3;
  }
  if(count!==data.triangles||count>5000)throw Error('Complete bounded infill triangle count required');return data;
 }
 function install({T,objects,world,data}){
  validate(data);
  if(objects.getObjectByName('Pool Yard boundary infill'))throw Error('Pool Yard infill already installed');
  const bank=new Map();world.traverse(node=>{if(node.isMesh)for(const m of [].concat(node.material||[])){
   const name=(m.userData.stageTextures?.[0]||'').split(/[\\/]/).pop().toLowerCase();
   if(m.map&&!bank.has(name))bank.set(name,m);
  }});
  for(const row of data.patches)if(!bank.has(row.texture.toLowerCase()))throw Error('Original infill texture missing: '+row.texture);
  const group=new T.Group();group.name='Pool Yard boundary infill';group.userData={sandboxInfill:true,originalGeometry:false};
  for(const row of data.patches){
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(row.positions.flat(),3));
   g.setAttribute('uv',new T.Float32BufferAttribute(row.uv.flat(),2));g.setIndex(row.positions.map((_,i)=>i));g.computeVertexNormals();
   const material=bank.get(row.texture.toLowerCase()).clone();material.userData={...material.userData,poolSandboxInfill:true};
   material.side=T.DoubleSide;material.needsUpdate=true;
   const mesh=new T.Mesh(g,material);mesh.name='sandbox-'+row.name;mesh.userData={sandboxInfill:true,role:row.role};group.add(mesh);
  }
  // The scene is identity; its existing original root retains its -X reflection.
  objects.add(group);
  return {patches:data.patches.length,triangles:data.triangles,floor_triangles:data.floor_triangles,
   original_geometry_recovered:false,original_assets_modified:false};
 }
 function lightExposedBacks({T,world,data,config,irradiance}){
  const names=['managed-static-78','managed-static-119','managed-static-127'],p=new T.Vector3(),n=new T.Vector3(),normal=new T.Matrix3();
  let faces=0,vertices=0;world.updateMatrixWorld(true);
  for(const name of names){const node=world.getObjectByName(name);if(!node)throw Error('Original exposed building required: '+name);
   node.traverse(mesh=>{
    if(!mesh.isMesh)return;const g=mesh.geometry,c=g.attributes.color,pos=g.attributes.position,nrm=g.attributes.normal,index=g.index;
    if(!c||!pos||!nrm||!index)throw Error('Source-lit geometry required before boundary lighting');
    const black=new Set();
    for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
     if(ids.every(j=>c.getX(j)===0&&c.getY(j)===0&&c.getZ(j)===0)){faces++;ids.forEach(j=>black.add(j))}
    }
    normal.getNormalMatrix(mesh.matrixWorld);
    for(const j of black){p.fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld);n.fromBufferAttribute(nrm,j).applyMatrix3(normal).normalize();
     const rgb=irradiance(p.toArray(),n.toArray(),data,config);c.setXYZ(j,...rgb);vertices++;
    }
    if(black.size)c.needsUpdate=true;
   });
  }
  return {preview_lighting_fallback:true,black_faces:faces,vertices,source_color_bytes_modified:false};
 }
 return Object.freeze({validate,install,lightExposedBacks,moduleSource:poolBoundary.toString()});
});
