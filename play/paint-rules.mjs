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
// Готовая раскладка для 4x2 — подобрана вручную под наши рисунки.
// Точки Getting Up НЕ переносятся: там своя композиция под чужие работы.
export const DRIP_MAPS = {'4x2':[
  [.12,.30],[.16,.48],[.20,.65],[.23,.38],[.27,.55],[.31,.28],
  [.34,.70],[.37,.45],[.40,.58],[.43,.23],[.46,.73],[.49,.40],
  [.52,.56],[.55,.29],[.58,.67],[.61,.43],[.64,.22],[.67,.58],
  [.70,.74],[.73,.35],[.76,.51],[.80,.66],[.83,.28],[.87,.46]
]};

// Плотность из оригинала: у него на зону 1x2 (2 квада) приходится 18 точек,
// на 3x2 (6 квадов) — 32. То есть точки растут медленнее площади, примерно как
// корень: густо на мелкой зоне, разреженно на крупной.
const DRIPS_PER_QUAD = 12;

/** Сколько точек полагается сетке. */
export function dripCountFor({columns,rows}){
  return Math.max(8,Math.round(DRIPS_PER_QUAD*Math.sqrt(columns*rows)));
}

/**
 * Раскладка точек потёков для ЛЮБОЙ сетки.
 *
 * Раньше карта существовала только для 4x2, и стена другого размера молча
 * оставалась вообще без потёков — без ошибки, просто механика не работала.
 *
 * Генератор детерминированный (сетка → всегда одна и та же раскладка) и
 * раскидывает точки дрожащей решёткой: равномерно по площади, но без видимых
 * рядов. Свободные поля по краям — потёк у самой кромки выглядит обрезанным.
 */
export function dripMapFor(grid){
  const key=`${grid.columns}x${grid.rows}`;
  if(DRIP_MAPS[key])return DRIP_MAPS[key];
  const n=dripCountFor(grid);
  const cols=Math.max(1,Math.round(Math.sqrt(n*grid.columns/grid.rows)));
  const rowsN=Math.max(1,Math.ceil(n/cols));
  const pts=[];
  // Дрожание детерминированное: целочисленный хеш вместо Math.random,
  // иначе раскладка менялась бы при каждой загрузке.
  const jitter=(i,salt)=>{
    let h=(i*2654435761+salt*40503)>>>0;
    h^=h>>>15; h=(h*2246822519)>>>0; h^=h>>>13;
    return (h>>>8)/16777216;
  };
  for(let k=0;k<n;k++){
    const cx=k%cols, cy=Math.floor(k/cols);
    const u=.10+.80*((cx+.25+.5*jitter(k,1))/cols);
    const v=.18+.62*((cy+.25+.5*jitter(k,2))/rowsN);
    pts.push([Number(u.toFixed(4)),Number(v.toFixed(4))]);
  }
  DRIP_MAPS[key]=pts;
  return pts;
}

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
