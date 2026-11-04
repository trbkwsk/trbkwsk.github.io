/* Semantics for this PC build's ISuperSprayPaint only. Not a pressure pump.
 * Its Shake returns false; Empty starts delayed visual fade/destruction.
 * The world viewer is deliberately not rewired from this isolated fixture.
 */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.GettingUpSprayItem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function sprayItem(){'use strict';
 const F=Math.fround,RATE=F(.2);
 class Item{
  constructor(pressure=3,timer=5,fade=1,empty=false){if(![pressure,timer,fade].every(Number.isFinite)||fade<0||fade>1||typeof empty!=='boolean')throw Error('bounded item inputs required');this.pressure=F(pressure);this.timer=F(timer);this.fade=F(fade);this.empty=empty;this.flags=0}
  shake(){return false}
  markEmpty(){this.empty=true;this.flags=(this.flags|8)>>>0}
  readPressure(){return Math.max(0,this.pressure)}
  tick(dt){if(!Number.isFinite(dt)||dt<0)throw Error('nonnegative finite dt required');dt=F(dt);let destroy=false;
   if(this.empty){const t=this.timer-dt;this.timer=F(t);if(t<0){this.fade=F(Math.max(0,Math.min(1,this.fade-dt*RATE)));destroy=this.fade<=0}}
   return destroy;
  }
  snapshot(){return {pressure:this.pressure,timer:this.timer,fade:this.fade,empty:this.empty,flags:this.flags}}
 }
 return Object.freeze({Item,moduleSource:sprayItem.toString()});
});
