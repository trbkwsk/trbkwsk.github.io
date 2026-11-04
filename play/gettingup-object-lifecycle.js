/* Original IObject activation bytes, not a full ITrane Init or world binding.
 * Base Ghost/UnGhost side effects here assume no level, physics or lights and
 * delayed-init byte 131 == 0. No model/registration/callback simulation.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GettingUpObjectLifecycle=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const FIELDS=['disabled','ghost','cinematic','field135','waiting','dormant','dirty93','render13a'];
 function byte(v){if(!Number.isInteger(v)||v<0||v>255)throw Error('activation byte required');return v}
 function copy(s){if(!s||FIELDS.some(k=>!(k in s)))throw Error('complete activation state required');return Object.fromEntries(FIELDS.map(k=>[k,byte(s[k])]))}
 function dormant(s){return Number(Boolean(byte(s.ghost)||byte(s.disabled)||(byte(s.cinematic)&&!byte(s.field135))||byte(s.waiting)))}
 function apply(input,operation,value=0){
  const s=copy(input);value=byte(value);
  switch(operation){
   case 'recompute':break;
   case 'disabled':s.disabled=value;if(value)s.dirty93=1;break;
   case 'cinematic':s.cinematic=value;break;
   case 'waiting':s.waiting=1;s.dormant=1;return s;
   case 'ghost':if(s.ghost)return s;s.ghost=1;s.render13a=0;break;
   case 'unghost':if(!s.ghost)return s;s.ghost=0;s.render13a=1;break;
   default:throw Error('known original activation operation required');
  }
  s.dormant=dormant(s);return s;
 }
 return Object.freeze({FIELDS,copy,dormant,apply});
});
