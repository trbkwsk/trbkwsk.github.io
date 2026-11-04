/* Shared GLB placement, not a physics/movement implementation.
 * Both accepted exporters already put F=diag(-1,1,1,1) at their root.
 * An outer actor placement F*M*F preserves them: (F*M*F)*F == F*M.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GettingUpScenePlacement=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
  const REFLECT=Object.freeze([-1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  function affine(value){
    if(!Array.isArray(value)||value.length!==16||!value.every(Number.isFinite)||
      value[3]!==0||value[7]!==0||value[11]!==0||value[15]!==1)throw Error('finite column-major affine matrix required');
    return value.slice();
  }
  function multiply(left,right){
    const a=affine(left),b=affine(right),out=new Array(16).fill(0);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[4*c+r]+=a[4*k+r]*b[4*c+k];
    return affine(out);
  }
  function point(matrix,p){
    const m=affine(matrix);if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('finite XYZ point required');
    return [0,1,2].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]);
  }
  function actorPlacement(nativeSpawn){return multiply(multiply(REFLECT,nativeSpawn),REFLECT)}
  function inspect(doc,role){
    if(!['level','actor'].includes(role)||doc?.asset?.version!=='2.0'||!Array.isArray(doc.nodes)||
      !Number.isInteger(doc.scene)||doc.scenes?.[doc.scene]?.nodes?.length!==1)throw Error('one exported GLB scene root required');
    const rootIndex=doc.scenes[doc.scene].nodes[0],root=doc.nodes[rootIndex];
    if(!root||JSON.stringify(root.scale)!=='[-1,1,1]'||['matrix','rotation','translation'].some(k=>Object.hasOwn(root,k))||
      !Array.isArray(root.children)||!root.children.length)throw Error('one unchanged exporter X reflection required');
    const seen=new Set();
    function visit(index){
      if(!Number.isInteger(index)||index<0||index>=doc.nodes.length||seen.has(index))throw Error('unique acyclic scene tree required');
      seen.add(index);for(const child of doc.nodes[index].children||[])visit(child);
    }
    visit(rootIndex);if(seen.size!==doc.nodes.length)throw Error('all exported nodes must be reachable');
    if(role==='level'){
      const candidates=doc.nodes.flatMap((n,i)=>n.extras?.class==='IPointSpawnPlayer'?[i]:[]);
      if(candidates.length!==1||!root.children.includes(candidates[0]))throw Error('one direct original player-spawn marker required');
      const i=candidates[0],node=doc.nodes[i];
      if(Object.hasOwn(node,'mesh')||Object.hasOwn(node,'skin')||Object.hasOwn(node,'translation')||Object.hasOwn(node,'rotation')||Object.hasOwn(node,'scale'))throw Error('unmodified spawn matrix marker required');
      return {rootIndex,spawnIndex:i,nativeSpawn:affine(node.matrix),actorPlacement:actorPlacement(node.matrix)};
    }
    if(doc.skins?.length!==1||doc.skins[0].joints?.length!==48||new Set(doc.skins[0].joints).size!==48||
      !doc.skins[0].joints.every(i=>Number.isInteger(i)&&doc.nodes[i]?.name))throw Error('original 48-bone actor skin required');
    return {rootIndex,joints:doc.skins[0].joints.slice()};
  }
  return Object.freeze({REFLECT,affine,multiply,point,actorPlacement,inspect});
});
