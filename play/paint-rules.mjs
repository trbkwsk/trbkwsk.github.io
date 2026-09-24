// Verified reference constants; stage mapping and drip positions are SprayFight design.
export const SECONDS_PER_QUAD = 4.5;
// Четыре стадии отрисовки, как в оригинале. Первые три — реальные слои рисунка,
// COMPLETING — терминальное состояние: слои дописаны, работа коммитится.
// Собственной маски у неё нет, поэтому прогресс уже 100.
export const STAGES = [
  {name:'SKETCH', threshold:.50, from:0, to:50},
  {name:'OUTLINE', threshold:.85, from:50, to:85},
  {name:'FILL', threshold:.85, from:85, to:100},
  {name:'COMPLETING', threshold:1, from:100, to:100}
];
// Последняя стадия, у которой есть слой рисунка.
export const LAST_PAINT_STAGE = 2;
// Сколько длится коммит работы, мс.
export const COMPLETING_MS = 900;
// Шаг эмиссии краски. В оригинале баллон выпускает краску фиксированными
// порциями 1/30 с, а не раз в кадр — иначе на быстром мониторе красится быстрее.
export const EMIT_STEP = 1/30;
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

// ===== Палитра =====
// Восемь цветов ровно как в <FreeFormColors> оригинала. Фиксированный набор
// держит стиль: произвольный цвет быстро превращает стену в кашу.
export const PALETTE = [
  [254,244,248], [0,0,0],       [255,128,0],   [98,185,214],
  [7,2,252],     [57,181,74],   [123,97,191],  [255,232,185]
];

// У потёков в оригинале СВОЯ палитра, а не затемнённый основной цвет
// (<DripPalette> у каждой зоны). Берём соседний по кругу оттенок и гасим его —
// потёк читается как другая краска, а не как тень основной.
export function dripColorsFor(index){
  const a=PALETTE[(index+3)%PALETTE.length], b=PALETTE[(index+6)%PALETTE.length];
  const hex=(c,k)=>'#'+c.map(v=>Math.round(v*k).toString(16).padStart(2,'0')).join('');
  return [hex(a,.62), hex(b,.44)];
}

// ===== Очки =====
// Схема оригинала (<Scoring>): база 10 и бонусы РОВНО ПО 5 за риск, а не формула
// от покрытия. Площадь влияет на ВРЕМЯ, а не на награду — поэтому крупная работа
// не выгоднее мелкой сама по себе, выгоднее уложиться и не насажать потёков.
export const SCORE = { base:10, bonus:5 };

/**
 * @param {{coverage:number, drips:number, seconds:number, allowed:number,
 *          goBig:boolean, goOver:boolean, heaven:boolean}} r
 */
export function scoreRun(r){
  const done = r.coverage>=85;
  if(!done) return { total:0, parts:[], done:false };
  const parts=[['BASE',SCORE.base]];
  if(r.drips===0)               parts.push(['NO DRIPS',SCORE.bonus]);
  if(r.seconds<=r.allowed*.6)   parts.push(['FAST TIME',SCORE.bonus]);
  if(r.goBig)                   parts.push(['GO BIG',SCORE.bonus]);
  if(r.goOver)                  parts.push(['GO OVER',SCORE.bonus]);
  if(r.heaven)                  parts.push(['HEAVEN SPOT',SCORE.bonus]);
  return { total:parts.reduce((s,[,v])=>s+v,0), parts, done:true };
}

// Записанные дуги въезда камеры (§122). В оригинале это четыре файла .cin по
// 84 кадра = 2.8 с при 30 к/с; вариант выбирается по взаимной ориентации игрока
// и стены, все стартуют со смещением только по глубине. Ниже — начало и конец
// каждой дуги в метрах, как они лежат в файлах.
// Оговорка: соответствие осей движка нашим НЕ установлено, поэтому отсюда взяты
// длина и форма пути, а не точная ориентация. Наш игрок всегда подходит к стене
// спереди, поэтому из четырёх вариантов применимы только FL и FR — по стороне,
// с которой он встал к центру стены.
export const SPRAY_CAM_ARCS = {
  FL: { from:[0,0,-1.35], to:[-1.23,-2.60,-0.12] },
  FR: { from:[0,0,-2.81], to:[-0.61, 0.70,-2.55] }
};
export const SPRAY_CAM_FRAMES = 84;          // длина дуги в кадрах
export const SPRAY_CAM_MS = SPRAY_CAM_FRAMES/30*1000;   // 2.8 с при 30 к/с
export const SPRAY_CAM_EASEIN = 5/SPRAY_CAM_FRAMES;     // EASEIN=5 кадров из CC_Ins_Spray.csv

// Разгон за первые пять кадров, дальше ровный ход. Хвост слегка замедлен: в
// исходных данных концовка записана покадрово, у нас её нет, а резкая остановка
// читается как рывок.
export function sprayCamEase(t){
  if(t<=0)return 0; if(t>=1)return 1;
  const e=SPRAY_CAM_EASEIN;
  const head=t<e ? (t*t)/(2*e) : t-e/2;   // непрерывно по значению и по скорости
  const span=1-e/2;
  const u=head/span;
  return u*u*(3-2*u)*.25+u*.75;
}
