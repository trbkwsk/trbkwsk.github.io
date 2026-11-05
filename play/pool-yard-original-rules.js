/* Bounded original blackbook and trait rules. Evidence: POOL_YARD_ORIGINAL_RULES.md.
 * This is not the game's world-query, inventory ownership or movement controller.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpPoolRules=api;
})(globalThis,function poolOriginalRules(){'use strict';
 const completeDefault=Math.fround(.9);
 function sizeMode(current,delta){if(![1,2].includes(current)||![-1,1].includes(delta))throw Error('original size mode required');return 3-current}
 function dimensions(normal,mode,maps){if(![1,2].includes(mode))throw Error('original size mode required');return (mode===2?maps.find(m=>m.normal.every((n,i)=>n===normal[i]))?.big||normal:normal).slice()}
 const complete=(progress,threshold=completeDefault)=>Math.fround(progress)>=Math.fround(threshold);
 // TTaggingTrait::Render_Completing (1019d800): stored float32 sum,
 // clamped at one. In the browser this advances once per fixed simulation tick.
 function completionTimer(timer,dt){if(!Number.isFinite(timer)||timer<0||timer>1||!Number.isFinite(dt)||dt<0)throw Error('bounded completion timer required');const sum=Math.fround(timer)+Math.fround(dt);return {timer:Math.min(1,Math.fround(sum)),done:sum>=1}}
 // Blackbook_RenderSketch: no first-section restriction; native units per quad=36.
 function extent(tiles,firstSection=0){const bottom=firstSection?36*(firstSection-1):tiles[1]<3?36:0;return {width:tiles[0]*36,height:tiles[1]*36,bottom,center:bottom+tiles[1]*18}}
 return Object.freeze({completeDefault,sizeMode,dimensions,complete,completionTimer,extent,moduleSource:poolOriginalRules.toString()});
});
