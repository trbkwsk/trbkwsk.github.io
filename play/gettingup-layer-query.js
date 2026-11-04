/* Bounded original SecIsPlaying query. Strict means NOT STOPPING, not frame 0.
 * No clock/skin/scheduling implementation; ASCII original C-locale names.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpLayerQuery=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const ascii=s=>typeof s==='string'&&s.length<=256&&/^[\x20-\x7e]*$/.test(s);
 function isPlaying(s,q={}){
  const strict=q.strict??false,name=q.name??null,frame=q.frame??-1,speed=Math.fround(q.speed??-1);
  if(!s||typeof s.active!=='boolean'||typeof s.stopping!=='boolean'||typeof strict!=='boolean'||!ascii(s.name)||(name!==null&&!ascii(name))||
     !Number.isInteger(s.frame)||s.frame< -32768||s.frame>32767||!Number.isInteger(frame)||frame< -32768||frame>32767||
     !Number.isFinite(Math.fround(s.speed))||!Number.isFinite(speed))throw Error('bounded original layer query required');
  return s.active&&(!strict||!s.stopping)&&(name===null||name.toLowerCase()===s.name.toLowerCase())&&(frame<0||s.frame===frame)&&(speed<0||Math.fround(s.speed)===speed);
 }
 function feedback(s,name){return {playing:isPlaying(s,{name}),nonstopping:isPlaying(s,{name,strict:true})}}
 function legacyFeedback(s,name){const q=feedback(s,name);return {playing:q.playing,at_start:q.nonstopping}}
 return Object.freeze({isPlaying,feedback,legacyFeedback});
});
