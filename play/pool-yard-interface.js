/* Original XML coordinates, ST images and bitmap glyphs. Browser adapter only:
 * no claim to native GUI animation, event interpreter, ownership or D3D pixels.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpPoolInterface=api;
})(globalThis,function poolInterface(){'use strict';
 const selections=new Set(['MainMenuSelection','PauseSelection']);
 function glyph(font,c){return font.glyphs[c]||font.glyphs[c.toUpperCase()]||font.glyphs['?']}
 function textPlan(data,text,fontId,x,y,alpha=1){const font=data.fonts[fontId],result=[];if(!font)throw Error('original bitmap font required');
  for(const c of text){const box=glyph(font,c);if(!box)continue;const w=box[2]-box[0],h=box[3]-box[1];
   if(c!==' ')result.push({kind:'image',texture:font.texture,source:box,x,y,width:w,height:h,alpha});x+=(c===' '?font.space:w)+font.kern;
  }return result;
 }
 function menuPlan(data,screen,focus,enabled){const commands=[],buttons=[];
  function walk(n,selection=null){
   if(n.type==='PauseStatisticsDisplay'||n.type==='PauseSubSelection'||n.name.endsWith('SubMenu')||n.name==='IPodText'||n.name==='IPodButton')return;
   const isSelection=selections.has(n.type);if(!isSelection&&!n.visible)return;
   if(isSelection){selection=n;buttons.push(n)}
   const selected=selection?.name===focus,alpha=(selection&&!enabled.includes(selection.name)?0.35:1)*n.alpha;
   // The source contains both ordinary and selected flip images; the renderer
   // uses the settled authored image, without manufacturing flip timing.
   if(selection&&(['RedLight','RedLightGlow','RightRedLight','YellowFlipper'].includes(n.name))&&!selected)return;
   if(n.texture){
    if(n.type==='DarkeningVeil')commands.push({kind:'veil',...n,alpha});
    else for(let row=0;row<(n.rows||1);row++)for(let col=0;col<(n.cols||1);col++)commands.push({kind:'image',texture:n.texture,x:n.x+col*(n.width+(n.dx||0)),y:n.y+row*(n.height+(n.dy||0)),width:n.width,height:n.height,alpha,additive:n.type==='AdditiveBlendingTexture'});
   }
   for(const c of n.children)walk(c,selection);
   if(n.label)commands.push(...textPlan(data,n.label,n.font,n.x,n.y,alpha));
  }
  walk(data.menus[screen]);return {commands,buttons};
 }
 function navigate(menu,current,direction,enabled){
  const all=[];const scan=n=>{if(selections.has(n.type))all.push(n);for(const c of n.children)scan(c)};scan(menu);
  let name=current;for(let i=0;i<all.length;i++){
   const n=all.find(n=>n.name===name);if(!n)return enabled[0]||null;
   name=n[direction==='up'?'navigateup':'navigatedown'];if(enabled.includes(name))return name;
  }return current;
 }
 class Interface{
  constructor(canvas,overlay,data,images,activate){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.overlay=overlay;this.data=data;this.images=images;this.activate=activate;this.screen='main';this.focus=data.menus.main.firstFocus;this.ready=false;this.wheel=false;this.buttons=[]}
  enabled(){return this.ready?(this.screen==='main'?['Select']:['Resume','Quit']):[]}
  show(screen){const changed=this.screen!==screen||this.buttonStamp!==[screen,this.ready,this.wheel].join(':')||this.lastCompletion!==this.completion;this.lastCompletion=this.completion;if(this.screen!==screen){this.screen=screen;if(screen)this.focus=this.data.menus[screen].firstFocus}this.syncButtons();if(changed)this.draw()}
  syncButtons(){
   const stamp=[this.screen,this.ready,this.wheel].join(':');if(stamp===this.buttonStamp)return;this.buttonStamp=stamp;
   this.overlay.replaceChildren();this.buttons=[];if(!this.screen||this.wheel)return;
   const plan=menuPlan(this.data,this.screen,this.focus,this.enabled());
   for(const node of plan.buttons){const button=document.createElement('button');button.type='button';button.textContent=node.label;button.className='original-menu-hit';button.dataset.menuItem=node.name;button.disabled=!this.enabled().includes(node.name);button.title=button.disabled?'Not implemented in this preview':'';
    button.style.left=(node.x-3)+'px';button.style.top=(node.y-1)+'px';button.style.width='190px';button.style.height=this.data.fonts[node.font].cell[1]+'px';
    button.onfocus=button.onpointerenter=()=>{if(!button.disabled){this.focus=node.name;this.draw()}};
    button.onclick=()=>{if(!button.disabled)this.activate(this.screen,node.name)};this.overlay.append(button);this.buttons.push(button);
   }
  }
  key(code){if(!this.screen||this.wheel)return false;
   if(code==='Escape'){if(this.screen==='pause'&&this.ready)this.activate(this.screen,'Resume');return true}
   if(['ArrowUp','ArrowDown'].includes(code)){this.focus=navigate(this.data.menus[this.screen],this.focus,code==='ArrowUp'?'up':'down',this.enabled());this.draw();return true}
   if(code==='Enter'){if(this.enabled().includes(this.focus))this.activate(this.screen,this.focus);return true}return false;
  }
  image(c){const im=this.images.get(c.texture);if(!im)throw Error('verified local interface image required');const ctx=this.ctx;
   ctx.globalAlpha=c.alpha??1;ctx.globalCompositeOperation=c.additive?'lighter':'source-over';
   if(c.source){const[u0,v0,u1,v1]=c.source;ctx.drawImage(im,u0,v0,u1-u0,v1-v0,c.x,c.y,c.width,c.height)}else ctx.drawImage(im,c.x,c.y,c.width,c.height);
  }
  draw(){const canvas=this.canvas,ctx=this.ctx,w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2),scale=Math.min(w/640,h/480),x=(w-640*scale)/2,y=(h-480*scale)/2;
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);if(this.screen==='main'&&!this.wheel){ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height)}ctx.setTransform(scale*dpr,0,0,scale*dpr,x*dpr,y*dpr);ctx.imageSmoothingEnabled=true;
   this.overlay.style.transform=`translate(${x}px,${y}px) scale(${scale})`;this.overlay.hidden=!this.screen||this.wheel;
   ctx.save();ctx.beginPath();ctx.rect(0,0,640,480);ctx.clip();
   if(this.wheel){
    const bg=this.data.wheel.background,box=bg.uv,bw=box[2]-box[0],bh=box[3]-box[1];
    for(const slot of this.data.wheel.slots){const item=this.items[slot.slot];this.image({texture:bg.texture,source:box,x:320+slot.x-bw/2,y:240+slot.y-bh/2,width:bw,height:bh,alpha:slot.slot===2?1:.25,additive:slot.additive});
     this.image({texture:item.key,x:320+slot.x-32,y:240+slot.y-32,width:64,height:64,alpha:slot.slot===2?1:.25});}
   }else if(this.screen){for(const c of menuPlan(this.data,this.screen,this.focus,this.enabled()).commands){
     if(c.kind==='veil'){ctx.globalCompositeOperation='source-over';ctx.globalAlpha=c.alpha;const v=c.corners,horizontal=v[0]!==v[1],gradient=ctx.createLinearGradient(c.x,c.y,c.x+(horizontal?c.width:0),c.y+(horizontal?0:c.height));gradient.addColorStop(0,'rgba(0,0,0,'+v[0]+')');gradient.addColorStop(1,'rgba(0,0,0,'+(horizontal?v[1]:v[2])+')');ctx.fillStyle=gradient;ctx.fillRect(c.x,c.y,c.width,c.height)}else this.image(c);
    }
   }else{const b=this.data.held.background,box=b.uv,w=box[2]-box[0],h=box[3]-box[1],pos=this.data.held.position;
    this.image({texture:b.texture,source:box,x:640+pos[0]-w,y:pos[1],width:w,height:h,alpha:this.data.held.alpha});
    if(this.items)this.image({texture:this.items[2].key,x:640-70-22.4,y:72-22.4,width:44.8,height:44.8,alpha:1});
    if(this.completion){const c=this.data.completion;for(const g of textPlan(this.data,c.label,c.font,c.x,c.y))this.image(g)}
   }ctx.restore();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
 }
 return Object.freeze({textPlan,menuPlan,navigate,Interface,moduleSource:poolInterface.toString()});
});
