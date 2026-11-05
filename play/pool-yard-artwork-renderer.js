/* Each saved piece retains its own original textures, color and DripMap. */
(function poolArtworkRenderer(root){'use strict';
 class PieceRenderer extends root.GettingUpSprayRenderer.Renderer{
  make(panel){const scale=panel.previewScale||1;
   const record=super.make({...panel,frame:{...panel.frame,width:panel.frame.width/scale,height:panel.frame.height/scale}});
   record.mesh.scale.setScalar(scale);
   // Original Completing draws the cached Under/Fill followed by a flat Fill
   // overlay. Keep this separate: folding it into node alpha changes blending.
   const fill=record.layers[2],geometry=fill.geometry.clone(),material=fill.material.clone();
   geometry.getAttribute('tagAlpha').array.fill(1);
   material.onBeforeCompile=fill.material.onBeforeCompile;material.customProgramCacheKey=fill.material.customProgramCacheKey;
   const overlay=new THREE.Mesh(geometry,material);overlay.position.z=.036;overlay.renderOrder=13;overlay.visible=false;
   record.mesh.add(overlay);record.completion=overlay;return record;
  }
 }
 class Renderer{
  constructor(scene,artworks,textures){this.scene=scene;this.artworks=artworks;this.textures=textures;this.records=new Map()}
  clear(){for(const r of this.records.values())r.renderer.clear();this.records.clear()}
  update(panels){
   const live=new Set();
   for(const p of panels){if(!p.grid.data)continue;live.add(p.id);let entry=this.records.get(p.id);
    if(entry&&(entry.data!==p.grid.data||entry.scale!==(p.previewScale||1))){entry.renderer.clear();this.records.delete(p.id);entry=null}
    if(!entry){const data=p.grid.data,textures=this.textures.get(data.name);if(!textures)throw Error('artwork textures required');
     entry={renderer:new PieceRenderer(this.scene,textures,data),data,scale:p.previewScale||1};this.records.set(p.id,entry)}
    entry.renderer.update([p]);
    const record=entry.renderer.records.get(p.id),phase=p.renderPhase??p.area?.state??0;
    record.layers[0].visible=p.previewVisible!==false;
    record.completion.visible=phase===2;
    if(phase===2)record.completion.material.opacity=(root.GettingUpSprayController.packedColor([p.renderTimer,1,1,1])>>>24)/255;
    if(phase===3)for(const layer of [1,2]){const a=record.layers[layer].geometry.getAttribute('tagAlpha');a.array.fill(1);a.needsUpdate=true}
   }
   for(const[id,entry]of this.records)if(!live.has(id)){entry.renderer.clear();this.records.delete(id)}
  }
  capture(panels){return panels.filter(p=>p.grid.data).flatMap(p=>{const entry=this.records.get(p.id),record=entry?.renderer.records.get(p.id);return entry?.renderer.capture([p]).map(row=>({...row,artwork:p.grid.data.name,scale:p.previewScale||1,completion:{phase:p.renderPhase??p.area?.state??0,timer:p.renderTimer??0,visible:record.completion.visible,opacity:record.completion.material.opacity,uses_fill_texture:record.completion.material.map===record.layers[2].material.map}}))||[]})}
 }
 root.GettingUpPoolArtworkRenderer={Renderer,moduleSource:poolArtworkRenderer.toString()};
})(globalThis);
