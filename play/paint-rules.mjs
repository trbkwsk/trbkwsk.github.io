// Verified reference constants; stage mapping and drip positions are SprayFight design.
export const SECONDS_PER_QUAD = 4.5;
export const STAGES = [
  {name:'SKETCH', threshold:.50, from:0, to:50},
  {name:'OUTLINE', threshold:.85, from:50, to:85},
  {name:'FILL', threshold:.85, from:85, to:100}
];
export function timeForGrid({columns,rows}) {
  if(!Number.isInteger(columns)||!Number.isInteger(rows)||columns<1||rows<1)throw new Error('Invalid paint grid');
  return columns*rows*SECONDS_PER_QUAD;
}
export function stageProgress(index,coverage,complete=false){
  if(complete)return 100;
  const stage=STAGES[index];
  return stage.from+(stage.to-stage.from)*Math.min(1,Math.max(0,coverage)/stage.threshold);
}
// Original TORB positions in normalized TEXTURE coordinates (Y points down).
// One explicit layout for the currently supported 4x2 design, not metres.
export const DRIP_MAPS = {'4x2':[
  [.12,.30],[.16,.48],[.20,.65],[.23,.38],[.27,.55],[.31,.28],
  [.34,.70],[.37,.45],[.40,.58],[.43,.23],[.46,.73],[.49,.40],
  [.52,.56],[.55,.29],[.58,.67],[.61,.43],[.64,.22],[.67,.58],
  [.70,.74],[.73,.35],[.76,.51],[.80,.66],[.83,.28],[.87,.46]
]};
export function dripShape(age){
  // Spot growth duration is a SprayFight tuning value, not established by XML.
  const spot=Math.min(1,Math.max(0,age)/.35);
  const streak=Math.min(1,Math.max(0,age-.35)/3);
  return {size:2+10*spot,width:8,length:25*streak,settled:age>=3.35};
}
export class DripTracker {
  constructor(points){this.points=points;this.reset();}
  reset(){this.anchor=null;this.held=0;this.events=[];this.used=new Set();}
  release(){this.anchor=null;this.held=0;}
  hold(x,y,dt,now,width,height){
    if(!this.anchor||Math.hypot(x-this.anchor.x,y-this.anchor.y)>12){this.anchor={x,y};this.held=0;}
    this.held+=dt;
    if(this.held<1)return false;
    let selected=-1,distance=110;
    this.points.forEach(([u,v],i)=>{const d=Math.hypot(x-u*width,y-v*height);if(!this.used.has(i)&&d<distance){selected=i;distance=d;}});
    if(selected<0)return false;
    const [u,v]=this.points[selected];
    this.events.push({x:u*width,y:v*height,started:now,index:selected});
    this.used.add(selected);this.held=0;
    return true;
  }
}
