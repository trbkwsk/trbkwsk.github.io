import assert from 'node:assert/strict';
import {timeForGrid,stageProgress,STAGES,DripTracker,DRIP_MAPS,dripShape} from '../play/paint-rules.mjs';
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
