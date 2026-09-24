import assert from 'node:assert/strict';
import {SPRAY_CAM_ARCS,SPRAY_CAM_FRAMES,SPRAY_CAM_MS,SPRAY_CAM_EASEIN,sprayCamEase,timeForGrid,stageProgress,STAGES,LAST_PAINT_STAGE,COMPLETING_MS,EMIT_STEP,DripTracker,DRIP_MAPS,dripShape} from '../play/paint-rules.mjs';
assert.equal(timeForGrid({columns:4,rows:2}),36);
assert.equal(timeForGrid({columns:2,rows:1}),9);
assert.equal(timeForGrid({columns:6,rows:3}),81);
assert.throws(()=>timeForGrid({columns:0,rows:2}));
assert.equal(stageProgress(0,.5),50);
assert.equal(stageProgress(1,0),50);
assert.equal(stageProgress(1,.85),85);
assert.equal(stageProgress(2,0),85);
assert.equal(stageProgress(2,.85),100);
const drip=new DripTracker([[.5,.5]]);
for(let i=0;i<59;i++)assert.equal(drip.hold(512,195,1/60,i*1000/60,1024,390),false);
assert.equal(drip.hold(512,195,1/60,1000,1024,390),true);
assert.equal(drip.events.length,1);
for(let i=0;i<120;i++)drip.hold(512,195,1/60,1000+i*1000/60,1024,390);
assert.equal(drip.events.length,1,'fixed point cannot stack penalties');
drip.reset();drip.hold(512,195,.9,0,1024,390);drip.release();
assert.equal(drip.hold(512,195,.2,1000,1024,390),false,'release resets dwell');
drip.reset();
for(let i=0;i<100;i++)drip.hold(512+i*2,195,.02,i*20,1024,390);
assert.equal(drip.events.length,0,'slow continuous movement is not stationary');
assert.equal(dripShape(0).size,2);
assert.equal(dripShape(.35).size,12);
assert.equal(dripShape(3.35).length,25);
assert.equal(dripShape(3.35).settled,true);
assert.equal(DRIP_MAPS['4x2'].length,24);
console.log('PASS: grid time, stage thresholds, deterministic drips, dwell/release, animation timing');

// Раскладка потёков для ЛЮБОЙ сетки: до этого карта была только для 4x2,
// и стена другого размера молча оставалась без потёков вовсе.
import {dripMapFor,dripCountFor} from '../play/paint-rules.mjs';
assert.equal(dripMapFor({columns:4,rows:2}).length,24);           // ручная раскладка уцелела
for(const g of [{columns:2,rows:1},{columns:6,rows:3},{columns:1,rows:2},{columns:6,rows:6}]){
  const m=dripMapFor(g);
  assert.equal(m.length,dripCountFor(g));
  assert.equal(m.length>=8,true,'у любой сетки есть точки');
  assert.equal(m.every(([u,v])=>u>.05&&u<.95&&v>.10&&v<.90),true,'точки не липнут к кромке');
  assert.equal(JSON.stringify(m),JSON.stringify(dripMapFor(g)),'раскладка детерминирована');
}

// Палитра и очки по схеме оригинала
import {PALETTE,dripColorsFor,scoreRun,SCORE} from '../play/paint-rules.mjs';
assert.equal(PALETTE.length,8,'ровно восемь цветов, как в FreeFormColors');
assert.equal(PALETTE.every(c=>c.length===3&&c.every(v=>v>=0&&v<=255)),true);
assert.equal(dripColorsFor(0).length,2);
assert.equal(dripColorsFor(0)[0].startsWith('#'),true);
assert.equal(JSON.stringify(dripColorsFor(2)),JSON.stringify(dripColorsFor(2)),'детерминировано');
// незаконченная работа не даёт очков вообще
assert.equal(scoreRun({coverage:84,drips:0,seconds:10,allowed:36}).total,0);
assert.equal(scoreRun({coverage:84,drips:0,seconds:10,allowed:36}).done,false);
// база без бонусов
assert.equal(scoreRun({coverage:90,drips:3,seconds:30,allowed:36}).total,SCORE.base);
// чисто и быстро
assert.equal(scoreRun({coverage:90,drips:0,seconds:20,allowed:36}).total,SCORE.base+SCORE.bonus*2);
// все бонусы разом
const full=scoreRun({coverage:100,drips:0,seconds:10,allowed:36,goBig:true,goOver:true,heaven:true});
assert.equal(full.total,SCORE.base+SCORE.bonus*5);
assert.equal(full.parts.length,6);

// --- Четвёртая стадия и шаг эмиссии ---
// Стадий ровно четыре, последняя — терминальный коммит без собственного слоя.
assert.equal(STAGES.length,4);
assert.equal(STAGES[3].name,'COMPLETING');
assert.equal(LAST_PAINT_STAGE,2);
// У COMPLETING нет прогресса для набора: она начинается и кончается на 100.
assert.equal(STAGES[3].from,100);
assert.equal(STAGES[3].to,100);
assert.equal(stageProgress(3,0),100);
assert.equal(stageProgress(3,1),100);
// Слои рисунка идут подряд и покрывают шкалу без разрывов.
for(let i=1;i<=LAST_PAINT_STAGE;i++)assert.equal(STAGES[i].from,STAGES[i-1].to);
assert.equal(STAGES[0].from,0);
assert.equal(STAGES[LAST_PAINT_STAGE].to,100);
// Коммит длится заметное, но конечное время.
assert.ok(COMPLETING_MS>0&&COMPLETING_MS<5000);
// Шаг эмиссии — ровно 30 порций в секунду.
assert.ok(Math.abs(1/EMIT_STEP-30)<1e-9);
// Главное свойство: расход краски не зависит от фреймрейта. Точного равенства
// тут не добиться — сумма 1/144 за 144 кадра даёт 0.9999999999999999, и
// последняя порция приходит кадром позже. Поэтому проверяем, что за 10 секунд
// при любом фреймрейте набегает 300 порций с точностью до одной.
for(const fps of [30,60,90,144,240]){
  let acc=0,ticks=0;
  for(let f=0;f<fps*10;f++){acc+=1/fps;const n=Math.floor(acc/EMIT_STEP);acc-=n*EMIT_STEP;ticks+=n;}
  assert.ok(Math.abs(ticks-300)<=1,`при ${fps} fps порций ${ticks}`);
}
// Накопитель не растёт: остаток всегда меньше одного шага.
{
  let acc=0;
  for(let f=0;f<10000;f++){acc+=1/137;acc-=Math.floor(acc/EMIT_STEP)*EMIT_STEP;}
  assert.ok(acc<EMIT_STEP);
}

// --- Записанная дуга въезда камеры ---
assert.equal(SPRAY_CAM_FRAMES,84);
assert.ok(Math.abs(SPRAY_CAM_MS-2800)<1e-9,'дуга длится 2.8 с');
assert.ok(Math.abs(SPRAY_CAM_EASEIN*SPRAY_CAM_FRAMES-5)<1e-9,'разгон ровно пять кадров');
// Обе дуги стартуют со смещением только по глубине — X и Y нулевые.
for(const k of ['FL','FR']){
  assert.equal(SPRAY_CAM_ARCS[k].from[0],0);
  assert.equal(SPRAY_CAM_ARCS[k].from[1],0);
}
// FR почти стоит на месте, FL проезжает заметно дальше.
const len=a=>Math.hypot(a.to[0]-a.from[0],a.to[1]-a.from[1],a.to[2]-a.from[2]);
assert.ok(len(SPRAY_CAM_ARCS.FR)<1.1,'FR короткая');
assert.ok(len(SPRAY_CAM_ARCS.FL)>3,'FL длинная');
assert.ok(len(SPRAY_CAM_ARCS.FL)>len(SPRAY_CAM_ARCS.FR)*3);
// Разгон: закреплён на концах, зажат, строго возрастает и стартует с нулевой скорости.
assert.equal(sprayCamEase(0),0);
assert.equal(sprayCamEase(1),1);
assert.equal(sprayCamEase(-1),0);
assert.equal(sprayCamEase(2),1);
let prev=-1;
for(let i=0;i<=SPRAY_CAM_FRAMES;i++){
  const v=sprayCamEase(i/SPRAY_CAM_FRAMES);
  assert.ok(v>prev,`разгон не возрастает на кадре ${i}`);
  assert.ok(v>=0&&v<=1);
  prev=v;
}
// Первые пять кадров идут медленнее ровного хода — это и есть EASEIN.
assert.ok(sprayCamEase(SPRAY_CAM_EASEIN)<SPRAY_CAM_EASEIN);
// Скорость в начале близка к нулю, а на разгоне уже нет.
const d=(t)=>(sprayCamEase(t+1e-4)-sprayCamEase(t))/1e-4;
assert.ok(d(0)<.05,'старт с места');
assert.ok(d(SPRAY_CAM_EASEIN)>.5,'после разгона камера едет');
