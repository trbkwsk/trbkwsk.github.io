/* Original non-AI, non-tutorial paint/freeform/LHug/rappel input branch.
 * Keyboard records are not a claim of macOS/DirectInput polling.
 */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.GettingUpPaintInput=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const f=Math.fround;
 function directions(x,y){x=f(x);y=f(y);const ax=Math.abs(x),ay=Math.abs(y),p=f(.4),n=f(-.4),d=f(.2),nd=f(-.2);
  const cardinal=[y>p&&ay>ax,y<n&&ay>ax,x<n&&ax>ay,x>p&&ax>ay].map(Number);
  const u=y>p&&ax<ay*.25+d,b=y<n&&ax<ay*.25+d,l=x<n&&ay<ax*.25+d,r=x>p&&ay<ax*.25+d;
  return {cardinal,directions:[u,b,l,r,!u&&!l&&y>=d&&x<=nd,!u&&!r&&y>=d&&x>=d,!b&&!l&&y<=nd&&x<=nd,!b&&!r&&y<=nd&&x>=d].map(Number)};
 }
 function keyboard(keys,smooth=0){
  const k=new Set(keys),x=k.has('KEY_D')?1:k.has('KEY_A')?-1:0,y=k.has('KEY_W')?1:k.has('KEY_S')?-1:0;
  const strength=Math.min(1,Math.hypot(x,y));let angle=0;
  if(strength){angle=y===0?90:y>0?0:180;if(x<0)angle=-angle}
  return {axes:[x,y],strength,angle,smooth:f(f(smooth)*.75+strength*.25),...directions(x,y)};
 }
 return Object.freeze({directions,keyboard});
});
