import assert from 'node:assert/strict';
import {bell,particleLife,SPRAY_SPEED,CURVES,HAND_DRAWN_CURVES,TOOLS,DRIP_WARNING,toolRadiusRatio,fillRate,dripWarning,GO_BIG_MAP,goBigSize,COMPLETION_PERCENT,CAMERA_CONE_DEG,CAMERA_TURN_RATE,wrapDeg,clampCone,turnToward,SPRAY_CAM_ARCS,SPRAY_CAM_FRAMES,SPRAY_CAM_MS,SPRAY_CAM_EASEIN,sprayCamEase,timeForGrid,stageProgress,STAGES,LAST_PAINT_STAGE,COMPLETING_MS,EMIT_STEP,DripTracker,DRIP_MAPS,dripShape} from '../play/paint-rules.mjs';
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
// Порог — DripWarningTime, 1.5 с у простой работы. Шаг 0.25 с выбран потому,
// что он точен в двоичной плавающей точке: шесть шагов дают ровно 1.5,
// тогда как 90 шагов по 1/60 накапливают 1.4999999999999998 и порог не берут.
for(let i=0;i<5;i++)assert.equal(drip.hold(512,195,.25,i*250,1024,390),false);
assert.equal(drip.hold(512,195,.25,1500,1024,390),true);
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
// незаконченная работа не даёт очков вообще; порог — 100 %, как в оригинале,
// поэтому почти доведённая работа тоже не считается
assert.equal(scoreRun({coverage:84,drips:0,seconds:10,allowed:36}).total,0);
assert.equal(scoreRun({coverage:84,drips:0,seconds:10,allowed:36}).done,false);
assert.equal(scoreRun({coverage:99,drips:0,seconds:10,allowed:36}).done,false);
// база без бонусов
assert.equal(scoreRun({coverage:100,drips:3,seconds:30,allowed:36}).total,SCORE.base);
// чисто и быстро
assert.equal(scoreRun({coverage:100,drips:0,seconds:20,allowed:36}).total,SCORE.base+SCORE.bonus*2);
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

// --- Порог засчитывания и конус камеры ---
// В 244 зонах оригинала норма — 100 %; значения 85 нет ни у одной.
assert.equal(COMPLETION_PERCENT,100);
// Работа ниже порога не приносит очков, на пороге — приносит базовые.
assert.equal(scoreRun({coverage:99,drips:1,seconds:99,allowed:100}).total,0);
assert.equal(scoreRun({coverage:99,drips:1,seconds:99,allowed:100}).done,false);
assert.equal(scoreRun({coverage:100,drips:1,seconds:99,allowed:100}).done,true);
assert.equal(scoreRun({coverage:100,drips:1,seconds:99,allowed:100}).total,10);

assert.equal(CAMERA_CONE_DEG,30);
assert.equal(CAMERA_TURN_RATE,50);
// Приведение угла: границы и обороты.
assert.equal(wrapDeg(0),0);
assert.equal(wrapDeg(180),180);
assert.equal(wrapDeg(-180),180);
assert.equal(wrapDeg(190),-170);
assert.equal(wrapDeg(-190),170);
assert.equal(wrapDeg(360),0);
assert.equal(wrapDeg(720+45),45);
// Конус: внутри не трогает, снаружи зажимает, и всегда в пределах.
assert.equal(clampCone(0),0);
assert.equal(clampCone(29),29);
assert.equal(clampCone(-29),-29);
assert.equal(clampCone(45),30);
assert.equal(clampCone(-45),-30);
// Отклонение больше 180° разворачивается коротким путём, а не упирается в +30.
assert.equal(clampCone(350),-10);
assert.equal(clampCone(200),-30);
for(let a=-720;a<=720;a+=7)assert.ok(Math.abs(clampCone(a))<=CAMERA_CONE_DEG);
// Довор: за секунду не больше скорости, цель не перелетается.
assert.equal(turnToward(0,10,1,50),10);
assert.equal(turnToward(0,90,1,50),50);
assert.equal(turnToward(0,-90,1,50),-50);
assert.equal(turnToward(0,90,.5,50),25);
assert.equal(turnToward(30,30,1,50),30);
// Довор сходится к цели и не проскакивает её.
{
  let c=0;
  for(let i=0;i<200;i++){const n=turnToward(c,30,1/60,50);assert.ok(n<=30.0000001);c=n;}
  assert.ok(Math.abs(c-30)<1e-6);
}

// --- Инструменты, время до потёка, Go Big ---
// Три инструмента с убывающим радиусом: баллон, валик, расклейка.
assert.equal(TOOLS.aerosol.radius,17.5);
assert.equal(TOOLS.roller.radius,15);
assert.equal(TOOLS.wheatpaste.radius,12.5);
assert.ok(TOOLS.aerosol.radius>TOOLS.roller.radius);
assert.ok(TOOLS.roller.radius>TOOLS.wheatpaste.radius);
assert.equal(toolRadiusRatio('aerosol'),1);
assert.ok(Math.abs(toolRadiusRatio('wheatpaste')-12.5/17.5)<1e-12);
assert.throws(()=>toolRadiusRatio('brush'));
// Скорость заливки: у валика и расклейки простая работа идёт вдвое быстрее,
// чем у баллона, а сложная у всех одинакова.
assert.equal(fillRate('aerosol'),2);
assert.equal(fillRate('roller'),4);
assert.equal(fillRate('wheatpaste'),4);
assert.equal(fillRate('aerosol',true),1.5);
assert.equal(fillRate('roller',true),1.5);
assert.equal(fillRate('wheatpaste',true),1.5);
// «Mad paint» — множитель, а не отдельная скорость.
assert.equal(fillRate('aerosol',false,true),2*4);
assert.equal(fillRate('roller',false,true),4*8);
assert.throws(()=>fillRate('brush'));
// Время до потёка: сложная работа строже простой, размашистая — строже всех.
assert.equal(DRIP_WARNING.simple,1.5);
assert.equal(DRIP_WARNING.complex,1.25);
assert.equal(DRIP_WARNING.mad,0.75);
assert.equal(dripWarning(false),1.5);
assert.equal(dripWarning(true),1.25);
assert.equal(dripWarning(false,true),0.75);
assert.equal(dripWarning(true,true),0.75);
assert.ok(dripWarning(true)<dripWarning(false));
// Go Big — переход к другой сетке. Наша 4×2 растёт до 6×3.
assert.equal(GO_BIG_MAP.length,3);
assert.equal(JSON.stringify(goBigSize({columns:4,rows:2})),JSON.stringify({columns:6,rows:3}));
assert.equal(JSON.stringify(goBigSize({columns:2,rows:1})),JSON.stringify({columns:4,rows:2}));
// Для сетки без перехода — null, а не выдумка.
assert.equal(goBigSize({columns:6,rows:6}),null);
assert.equal(goBigSize({columns:3,rows:3}),null);
// Увеличение всегда даёт больше площади.
for(const m of GO_BIG_MAP)
  assert.ok(m.to.columns*m.to.rows>m.from.columns*m.from.rows);

// --- Библиотека кривых ---
// Каждая кривая закреплена на концах и не выходит за [0,1] внутри.
for(const [name,f] of Object.entries(CURVES)){
  assert.equal(f(0),0,`${name}(0)`);
  assert.ok(Math.abs(f(1)-1)<1e-12,`${name}(1)`);
  for(let i=0;i<=40;i++){
    const v=f(i/40);
    assert.ok(v>=-1e-12&&v<=1+1e-12,`${name} вне [0,1] на ${i/40}`);
  }
}
// Кубический корень раскрывается быстрее линейной, квадрат — медленнее.
assert.ok(CURVES.rootCube(.1)>CURVES.linear(.1));
assert.ok(CURVES.rootSquare(.1)>CURVES.linear(.1));
assert.ok(CURVES.rootCube(.1)>CURVES.rootSquare(.1));
assert.ok(CURVES.squared(.1)<CURVES.linear(.1));
assert.ok(CURVES.cubed(.1)<CURVES.squared(.1));
// Все строго возрастают.
for(const [name,f] of Object.entries(CURVES)){
  let prev=-1;
  for(let i=0;i<=40;i++){const v=f(i/40);assert.ok(v>prev,`${name} не возрастает`);prev=v;}
}
// f(Random) в библиотеке нет: это выборка, а не функция от t.
assert.equal(CURVES.random,undefined);
// Рисованные кривые перечислены по имени, без точек.
assert.equal(HAND_DRAWN_CURVES.includes('noise4'),true);
assert.equal(HAND_DRAWN_CURVES.includes('bell6'),true);
assert.equal(HAND_DRAWN_CURVES.length,7);

// --- Жизнь частицы и колокол ---
// Скорость ядра факела: 250 дюймов/с из слота 3.
assert.ok(Math.abs(SPRAY_SPEED-6.35)<1e-9);
// Колокол: гаснет на обоих концах, ярче всего посередине, симметричен.
assert.equal(bell(0),0);
assert.equal(bell(1),0);
assert.equal(bell(-1),0);
assert.equal(bell(2),0);
assert.ok(Math.abs(bell(.5)-1)<1e-12);
for(let i=1;i<20;i++){
  const t=i/40;
  assert.ok(Math.abs(bell(t)-bell(1-t))<1e-12,'колокол несимметричен');
  assert.ok(bell(t)>0&&bell(t)<=1);
}
// Возрастает до середины и убывает после.
for(let i=1;i<20;i++)assert.ok(bell(i/40)>bell((i-1)/40));
for(let i=21;i<40;i++)assert.ok(bell(i/40)<bell((i-1)/40));
// Срок жизни: полметра на скорости факела — примерно восьмая доля секунды,
// а не три секунды, как можно было бы прочесть слот 27.
assert.ok(Math.abs(particleLife(.5)-.5/SPRAY_SPEED)<1e-12);
assert.ok(particleLife(.5)<.1);
assert.ok(particleLife(.5)>.05);
// Дальше — дольше.
assert.ok(particleLife(1)>particleLife(.5));
// Вплотную к стене срок не обнуляется: держим минимум в кадр.
assert.equal(particleLife(0),1/60);
assert.equal(particleLife(1e-9),1/60);
