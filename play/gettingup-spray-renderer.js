/* OUR Three.js material/placement bridge; node alphas and drip rectangles use
 * separately validated original rules. Not original D3D raster/blend parity. */
(function(root){'use strict';
 const G=root.GettingUpGraffiti,T=root.GettingUpTag,C=root.GettingUpSprayController;
 class Renderer{
  constructor(scene,textures,data){this.scene=scene;this.textures=textures;this.data=data;this.records=new Map();this.lut=G.tables(data.thresholds.UndersprayEndPercent,data.thresholds.FillEndPercent)}
  clear(){for(const r of this.records.values()){this.scene.remove(r.mesh);r.mesh.traverse(n=>{if(n.isMesh){n.geometry.dispose();n.material.dispose()}})}this.records.clear()}
  make(panel){const f=panel.frame,g=new THREE.Group();
   g.position.fromArray(f.origin).addScaledVector(new THREE.Vector3(...f.normal),.06);
   g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...f.right),new THREE.Vector3(0,1,0),new THREE.Vector3(...f.normal)));
   const layers=[];
   for(const[layer,key]of [[0,'sketch'],[1,'under'],[2,'fill']]){
    const geometry=new THREE.PlaneGeometry(f.width,f.height,panel.grid.width-1,panel.grid.height-1);
    geometry.setAttribute('tagAlpha',new THREE.BufferAttribute(new Float32Array(panel.grid.values.length).fill(layer?0:1),1));
    const color=layer?new THREE.Color(...this.data.color.map(x=>x/255)):0xffffff;
    const material=new THREE.MeshBasicMaterial({map:this.textures[key],color,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2-layer,polygonOffsetUnits:-2,side:THREE.DoubleSide});
    material.onBeforeCompile=shader=>{
     shader.vertexShader='attribute float tagAlpha; varying float vTagAlpha;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTagAlpha=tagAlpha;');
     shader.fragmentShader='varying float vTagAlpha;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\ndiffuseColor.a *= vTagAlpha;');
    };material.customProgramCacheKey=()=> 'gettingup-tag-node-alpha-v1';
    const mesh=new THREE.Mesh(geometry,material);mesh.position.z=layer*.012;mesh.renderOrder=10+layer;g.add(mesh);layers.push(mesh);
   }
   this.scene.add(g);const record={mesh:g,layers,drips:new Map()};this.records.set(panel.id,record);return record;
  }
  update(panels){for(const p of panels){if(!p.grid.data)continue;const r=this.records.get(p.id)||this.make(p),grid=p.grid;
    for(const layer of [1,2]){const a=r.layers[layer].geometry.getAttribute('tagAlpha');grid.values.forEach((d,i)=>a.setX(i,G.alpha(d,layer,this.lut)));a.needsUpdate=true}
    const visible=new Set();
    for(const [elapsed,flags,textureIndex]of grid.drips){const index=flags&127,point=this.data.points[index];if(!point)continue;
     const[alpha,spot,streak]=T.rectangles(elapsed,flags,grid.origin,point,this.data.definition);
     for(const[k,rect,texture]of [['spot',spot,'splotch01'],['streak',streak,'drip0'+(textureIndex+1)]]){
      if(!rect)continue;if(textureIndex<0||textureIndex>3)throw Error('invalid original texture-pair index');const id=index+':'+k;visible.add(id);let mesh=r.drips.get(id);
      if(!mesh){mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.textures[texture],transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-2}));mesh.renderOrder=15;r.mesh.add(mesh);r.drips.set(id,mesh)}
      const[x1,y1,x2,y2]=rect;mesh.position.set(-(x1+x2)/2,(y1+y2)/2,.06);mesh.scale.set(Math.abs(x2-x1),Math.abs(y1-y2),1);
      const rgb=flags&128?this.data.palette[index&3].map(c=>c/255):[1,Math.sin(elapsed*10),Math.sin(elapsed*10)],packed=C.packedColor([alpha,...rgb]);
      mesh.material.color.setRGB((packed>>>16&255)/255,(packed>>>8&255)/255,(packed&255)/255);
      mesh.material.opacity=(packed>>>24)/255;mesh.material.blending=THREE.CustomBlending;mesh.material.blendSrc=THREE.SrcAlphaFactor;mesh.material.blendDst=THREE.OneMinusSrcAlphaFactor;mesh.material.blendSrcAlpha=THREE.SrcAlphaFactor;mesh.material.blendDstAlpha=THREE.OneMinusSrcAlphaFactor;mesh.userData.nativeTextureIndex=textureIndex;mesh.userData.packedARGB=packed;mesh.visible=mesh.scale.x>0&&mesh.scale.y>0;
     }
    }
    for(const[id,mesh]of r.drips)if(!visible.has(id)){r.mesh.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();r.drips.delete(id)}
   }this.scene.updateMatrixWorld(true)}
  capture(panels){return panels.filter(p=>p.grid.data).map(p=>{const r=this.records.get(p.id);return {id:p.id,frame:JSON.parse(JSON.stringify(p.frame)),
   values:Array.from(p.grid.values),total:p.grid.total,drips:p.grid.drips.map(d=>d.slice()),
   actual_group_world:r.mesh.matrixWorld.elements.slice(),actual_layer_alpha:r.layers.map(m=>Array.from(m.geometry.getAttribute('tagAlpha').array)),
   actual_drip_quads:Array.from(r.drips,([id,m])=>({id,visible:m.visible,world:m.matrixWorld.elements.slice(),opacity:m.material.opacity,color:m.material.color.toArray(),texture_index:m.userData.nativeTextureIndex,packed_argb:m.userData.packedARGB,texture_name:m.material.map.name,blend:[m.material.blendSrc,m.material.blendDst,m.material.blendSrcAlpha,m.material.blendDstAlpha]}))}})}
 }
 root.GettingUpSprayRenderer={Renderer};
})(globalThis);
