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
  hold(x,y,dt,now,width,height,warnTime=DRIP_WARNING.simple){
    if(!this.anchor||Math.hypot(x-this.anchor.x,y-this.anchor.y)>12){this.anchor={x,y};this.held=0;}
    this.held+=dt;
    // Держать на месте дольше DripWarningTime — и пойдёт потёк. Раньше здесь
    // стояла единица; в оригинале это 1.5 с у простой работы и 1.25 у сложной.
    if(this.held<warnTime)return false;
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
  const done = r.coverage>=COMPLETION_PERCENT;
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

// ===== Порог засчитывания работы =====
// `Trigger percentage level` у 244 зон рисования в .sls: 100 у подавляющего
// большинства. Значения 85 нет ни у одной зоны — работа либо доведена, либо нет.
export const COMPLETION_PERCENT = 100;

// ===== Конус обзора камеры рисования =====
// У всех 13 камер ICameraControl_GRAFF `Yaw Max` = `Pitch Max` = 30.0.
// То есть камера стоит в точке, но ей разрешено доворачивать в пределах ±30°.
// Скорость довора — `Yaw Rate` / `Pitch Rate`: 50 у шести камер, 90 у пяти,
// 75 у двух; берём самое частое.
export const CAMERA_CONE_DEG = 30;
export const CAMERA_TURN_RATE = 50;

// Приводит угол к диапазону (-180, 180].
export function wrapDeg(a){
  a=((a+180)%360+360)%360-180;
  return a===-180 ? 180 : a;
}
// Зажимает отклонение от базового направления в конус ±max.
export function clampCone(deltaDeg,maxDeg=CAMERA_CONE_DEG){
  return Math.max(-maxDeg,Math.min(maxDeg,wrapDeg(deltaDeg)));
}
// Довор с ограниченной скоростью: за dt секунд не больше rate градусов.
export function turnToward(current,target,dt,rate=CAMERA_TURN_RATE){
  const step=rate*dt, d=wrapDeg(target-current);
  return current + (Math.abs(d)<=step ? d : Math.sign(d)*step);
}

// ===== Инструменты =====
// Из <AerosolOptions>/<RollerOptions>/<WheatpasteOptions> в TagAreas.xml.
// PaintRadius — радиус факела, PaintFillRate — скорость закраски. У каждого
// инструмента свои значения для простой и сложной работы, а «mad paint»
// (быстрое размашистое) — отдельный множитель.
export const TOOLS = {
  aerosol:    { radius:17.5, fill:{ simple:2, complex:1.5 }, mad:4 },
  roller:     { radius:15,   fill:{ simple:4, complex:1.5 }, mad:8 },
  wheatpaste: { radius:12.5, fill:{ simple:4, complex:1.5 }, mad:8 }
};
// DripWarningTime — сколько можно держать факел на месте до потёка, секунды.
// Одинаково для всех трёх инструментов, различается только по сложности работы.
export const DRIP_WARNING = { simple:1.5, complex:1.25, mad:0.75 };

export function toolRadiusRatio(name){
  const t=TOOLS[name];
  if(!t) throw new Error(`Неизвестный инструмент: ${name}`);
  return t.radius/TOOLS.aerosol.radius;
}
export function fillRate(name,complex=false,mad=false){
  const t=TOOLS[name];
  if(!t) throw new Error(`Неизвестный инструмент: ${name}`);
  return t.fill[complex?'complex':'simple']*(mad?t.mad:1);
}
export function dripWarning(complex=false,mad=false){
  return mad ? DRIP_WARNING.mad : (complex?DRIP_WARNING.complex:DRIP_WARNING.simple);
}

// ===== Go Big =====
// <GoBigMap> в TagAreas.xml: увеличение — это не флаг, а переход к другому
// размеру сетки. В оригинале записаны только три перехода, и рядом лежит
// комментарий разработчиков «Go big Maps needed:» — остальные не доделали.
export const GO_BIG_MAP = [
  { from:{columns:2,rows:1}, to:{columns:4,rows:2} },
  { from:{columns:2,rows:3}, to:{columns:4,rows:2} },
  { from:{columns:4,rows:2}, to:{columns:6,rows:3} }
];
// Возвращает увеличенную сетку или null, если для этой сетки перехода нет.
export function goBigSize(grid){
  const hit=GO_BIG_MAP.find(m=>m.from.columns===grid.columns&&m.from.rows===grid.rows);
  return hit ? {...hit.to} : null;
}

// ===== Библиотека именованных кривых =====
// Полный перечень имён, встречающихся в 963 файлах .ptm. Семь из них —
// математические функции, остальные нарисованы вручную в редакторе эффектов
// и в файлах лежат только по имени, без точек, поэтому здесь их нет.
//
// В файлах самого факела (spraywide_*) встречаются: f(Random) 83 раза,
// f(Root Cube) 63, noise3 и noise4 по 21, f(Linear) 20, bell6 19,
// f(Root Square) 13, f(Squared) 10, fast_in-out 1.
//
// ОГОВОРКА: установлено, какие кривые применяются в эффектах факела и как
// часто. КАКОЙ параметр какой кривой управляется — НЕ установлено.
export const CURVES = {
  linear:      t => t,
  squared:     t => t*t,
  cubed:       t => t*t*t,
  rootSquare:  t => Math.sqrt(t),
  rootCube:    t => Math.cbrt(t),
  // «Sine Squared» трактуем как sin²(πt/2): даёт 0 в нуле и 1 в единице,
  // с пологими концами. Точная форма из данных не восстановима.
  sineSquared: t => Math.sin(t*Math.PI/2)**2
};
// f(Random) — не кривая от t, а выборка случайного значения; в CURVES её нет
// намеренно, иначе она нарушила бы свойство «функция от t».
export const HAND_DRAWN_CURVES = ['noise3','noise4','bell','bell6','ramp up3','ramp down curve','fast_in-out'];

// ===== Жизнь частицы краски =====
// Слот 21 в .ptm — градиент цвета из восьми точек BGRA, и управляет им кривая
// `bell6`. Сама кривая лежит в Effects/Modulators/bell6.mod: 64 точки по байту
// на значение. Раньше я считал, что рисованные кривые восстановить нельзя,
// потому что в .ptm лежит только имя — это было неверно, файлы кривых лежат
// отдельно, и разбор проверен на linear.mod (обязан быть прямой и является ею).
//
// Колокол НЕсимметричный: пик на t = 0.175, дальше долгий спад. Прежнее
// приближение sin(pi*t) пиковало на 0.5 — то есть капля разгоралась вдвое
// позже, чем в оригинале.
const BELL6 = [
  0.020, 0.039, 0.094, 0.180, 0.290, 0.420, 0.557, 0.686,
  0.804, 0.902, 0.965, 0.996, 0.996, 0.996, 0.992, 0.984,
  0.976, 0.969, 0.957, 0.945, 0.929, 0.914, 0.898, 0.878,
  0.855, 0.835, 0.812, 0.788, 0.761, 0.737, 0.710, 0.682,
  0.651, 0.624, 0.592, 0.565, 0.533, 0.502, 0.471, 0.443,
  0.412, 0.384, 0.353, 0.325, 0.294, 0.271, 0.243, 0.216,
  0.192, 0.169, 0.145, 0.125, 0.106, 0.086, 0.071, 0.055,
  0.043, 0.031, 0.020, 0.012, 0.008, 0.000, 0.000, 0.000
];
// Значение кривой с линейной подстановкой между точками.
export function bell(t){
  if(t<=0||t>=1)return 0;
  const x=t*(BELL6.length-1), i=Math.floor(x), f=x-i;
  return BELL6[i]+(BELL6[i+1]-BELL6[i])*f;
}
// Пик колокола — где частица ярче всего. Вынесено, чтобы тест мог его проверить.
export const BELL6_PEAK = BELL6.indexOf(Math.max(...BELL6))/(BELL6.length-1);

// Слот 3 у ядра факела: 50 → 250. Единица движка — дюйм, значит верхняя
// граница это 250 дюймов в секунду = 6.35 м/с.
export const SPRAY_SPEED = 250*0.0254;

// Сколько частица летит от сопла до стены. Считается от скорости, а НЕ от
// слота 27 (0→3.0), хотя тот и похож на время жизни: при 6.35 м/с и полуметре
// до стены перелёт занимает 0.08 с, а не три секунды. Значит слот 27 задаёт
// что-то другое, и брать его сюда было бы подгонкой.
// Нижняя граница в один кадр — чтобы частица не исчезала мгновенно вплотную
// к стене.
export function particleLife(distance,speed=SPRAY_SPEED){
  return Math.max(1/60,distance/speed);
}

// ===== Исход раунда =====
// Очки начисляются только за доведённую работу (порог 100 %), поэтому раунд,
// который оборвал таймер, штатно даёт 0:0. Таймер — наша добавка: в оригинале
// у всех зон рисования Completion Timer = 0. Чтобы раунд всё-таки разрешался,
// при равных очках исход решает закрашенная площадь.
// reason: 'player' | 'ai' — кто-то довёл работу; 'time' — вышло время.
export function decideWinner(reason, player, ai){
  if(reason==='player')return true;
  if(reason==='ai')return false;
  if(player.total!==ai.total)return player.total>ai.total;
  return player.coverage>=ai.coverage;
}

// ===== Репутация =====
// `Reputation Scoring` = 32 у всех 85 зон оригинала, где поле есть. Это
// константа, а не разброс, поэтому и у нас за доведённую работу начисляется
// ровно столько.
export const REPUTATION_PER_PIECE = 32;

// ===== Допуск на угол подхода =====
// `Offset Angle` у зон рисования: встретились 50 и 30 градусов. Берём больший
// как общий допуск — меньший, видимо, для узких мест.
// Оговорка: значений всего два, так что это слабое основание, в отличие от
// остальных чисел здесь.
export const APPROACH_ANGLE_DEG = 50;
export function facingWall(playerYawDeg, wallYawDeg, tolerance = APPROACH_ANGLE_DEG){
  return Math.abs(wrapDeg(playerYawDeg - wallYawDeg)) <= tolerance;
}

// Какие инструменты разрешены на стене. `Tag Type` в зонах принимает значения
// Any (226), Aerosol (154), Roller (76), Wheat Paste (16).
export function toolsAllowed(tagType){
  if(tagType==='Any'||!tagType)return Object.keys(TOOLS);
  const map={Aerosol:'aerosol', Roller:'roller', 'Wheat Paste':'wheatpaste'};
  const one=map[tagType];
  if(!one) throw new Error(`Неизвестный тип зоны: ${tagType}`);
  return [one];
}

