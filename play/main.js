import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { STAGES, timeForGrid, stageProgress, DRIP_MAPS, DripTracker, dripShape } from './paint-rules.mjs';

const DEFAULT_GRID = {columns:4,rows:2};
const ROUND_SECONDS = timeForGrid(DEFAULT_GRID);
const TEX_W = 1024;
const TEX_H = 390;
const TARGET_COVERAGE = 100;
// Значения по умолчанию для стены; конкретная стена может их переопределить.
const PANEL_W = 5.12;
const PANEL_H = 1.95;
const PANEL_Y = 1.38;
const WALL_Z = -8.15;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ui = {
  game: $('#game'), scene: $('#scene'), clock: $('#clock'), sound: $('#sound'), objective: $('#objective'),
  playerProgress: $('#playerProgress'), aiProgress: $('#aiProgress'), playerCoverage: $('#playerCoverage'), aiCoverage: $('#aiCoverage'),
  pressure: $('#pressureBar'), pressureNumber: $('#pressureNumber'), clean: $('#clean'), drips: $('#drips'), shake: $('#shake'),
  startModal: $('#startModal'), start: $('#start'), countdown: $('#countdown'), countdownText: $('#countdown b'),
  resultModal: $('#resultModal'), resultCard: $('.result-card'), resultTitle: $('#resultTitle'), playerScore: $('#playerScore'),
  aiScore: $('#aiScore'), playerMeta: $('#playerMeta'), aiMeta: $('#aiMeta'), restart: $('#restart'), crosshair: $('#crosshair'),
  touchControls: $('#touchControls'), joystick: $('#joystick'), joystickStick: $('#joystickStick'),
  reachBtn: $('#reachBtn'), crouchBtn: $('#crouchBtn'), enterTagBtn: $('#enterTagBtn')
};

const state = {
  // mode: 'roam' — ходим и рисуем без таймера и счёта; 'battle' — прежний раунд.
  mode: 'roam', surface: null, panel: null, nearRival: false, talking: false,
  phase: 'idle', phaseStarted: 0, running: false, finished: false, pointerDown: false, shaking: false,
  pointerNdc: new THREE.Vector2(0, 0), pointerUv: new THREE.Vector2(.5, .5), lastUv: new THREE.Vector2(.5, .5),
  cap: 'fat', pressure: 100, drips: 0, clean: 100, coverage: 0, aiCoverage: 0, aiClean: 96, aiDrips: 0,
  remaining: ROUND_SECONDS, roundSeconds:ROUND_SECONDS, roundStarted: 0, lastFrame: 0, lastMetric: 0, stationary: 0, lastDrip: 0,
  aiRoute: [], aiIndex: 0, aiUv: new THREE.Vector2(.5, .5), aiPauseUntil: 0, sound: true,
  aiPressure: 100, aiShaking: false, aiStationary: 0, aiLastDrip: 0, aiWander: new THREE.Vector2(0, 0),
  aiApproachX: 4.05, aiNextStep: 0, aiBurstUntil: 0, aiRestUntil: 0,
  beat: null, beatsDone: {}, camShake: 0,
  // Getting Up-механика: райтер сам стоит у стены, рука достаёт не везде
  keys: {}, walkX: -4.05, standZ: 2.2, crouch: 0, tiptoe: 0, facing: 0, canUp: false,
  reachUv: new THREE.Vector2(.5, .5), aimUv: new THREE.Vector2(.5, .5), nearWall: false
};

const PLAYER_CENTER = -4.05;
const RIVAL_CENTER = 4.05;
// Свободный режим: райтер ходит по всей локации и достаёт обе панели.
// Прежние PLAYER_CENTER±3.3 запирали его у собственной стены.
const ROAM_X_MIN = PLAYER_CENTER - 3.3;
const ROAM_X_MAX = RIVAL_CENTER + 3.3;
const ROAM_Z_MAX = 7.4;
const TALK_RANGE = 1.9;       // с какого расстояния можно заговорить с соперником
// В свободном режиме соперник НЕ стоит у своей панели, иначе к ней не подойти
// порисовать — вместо этого он ждёт посреди локации как обычный NPC.
const RIVAL_IDLE_X = 0;
const RIVAL_IDLE_Z = WALL_Z + .34 + 4.6;

// Постановочные точки камеры: общий план на отсчёте и на результате
const WIDE_POS = new THREE.Vector3(0, 4.15, 3.2);
const WIDE_LOOK = new THREE.Vector3(0, 1.75, WALL_Z + .3);
const smoothstep = (t) => t * t * (3 - 2 * t);

// Высота пола под ногами: у дренажного жёлоба настил приподнят
function groundHeight(z){ return Math.abs(z + 6.1) < .34 ? .085 : 0; }
const WALL_STAND_MIN = .62;   // ближе — факел узкий, но течёт
const WALL_STAND_MAX = 2.9;   // дальше — стена вне досягаемости
const REACH_X = 1.15;         // сколько рука достаёт вбок, в метрах
const REACH_UP = 2.5;        // предел вытянутой руки по высоте
const REACH_DOWN = .55;
const TAG_STEP_X = .52;       // один законченный шаг вдоль стены
const TAG_STEP_Z = .24;       // один шаг к стене / от стены
const TAG_STEP_TIME = .56;    // совпадает с ускоренным strafe-клипом
// Соотношение бег/шаг взято из оригинальных BNM Getting Up: TR_Run проносит корень
// на 206.46 ед за 47 кадров (4.393 ед/кадр), TR_Walk — на 90.91 за 59 (1.541 ед/кадр),
// то есть бег ровно в 2.85 раза быстрее шага. Прежние 4.6/2.85 давали лишь 1.61x,
// из-за чего режимы почти не различались. Понижаем шаг, а не повышаем бег: арена
// всего ~6.6 м в ширину, на 8.1 м/с её проскакивало бы меньше чем за секунду.
const WALK_SPEED = 1.61;      // м/с
const RUN_SPEED = 4.6;        // м/с — 2.85x от шага
const CLIP_WALK_SPEED = 2.85; // скорость, при которой клип ходьбы шёл с timeScale 1

const renderer = new THREE.WebGLRenderer({ canvas: ui.scene, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .82;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040504);
scene.fog = new THREE.FogExp2(0x0a0d12, .028);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, .1, 80);
camera.position.set(-1.25, 3.55, 9.2);

const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

// Текстуры окружения (Sketchfab, CC-BY — авторы указаны в CREDITS.md)
const textureLoader = new THREE.TextureLoader();
function tiled(path, repeatX, repeatY, colorSpace = true) {
  const texture = textureLoader.load(path);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const tex = {
  concrete: tiled('assets/textures/wall_concrete.jpg', 6, 2.2),
  damaged: tiled('assets/textures/wall_damaged.jpg', 3, 1.6),
  damagedNormal: tiled('assets/textures/wall_damaged_normal.jpg', 3, 1.6, false),
  floor: tiled('assets/textures/floor.jpg', 7, 7)
};

const materials = {
  concrete: new THREE.MeshStandardMaterial({ map: tex.concrete, color: 0x9aa096, roughness: .96, metalness: .02 }),
  concreteWorn: new THREE.MeshStandardMaterial({ map: tex.damaged, normalMap: tex.damagedNormal, color: 0x8f958b, roughness: .92, metalness: .04 }),
  floor: new THREE.MeshStandardMaterial({ map: tex.floor, color: 0x767b72, roughness: .88, metalness: .06 }),
  concreteDark: new THREE.MeshStandardMaterial({ map: tex.concrete, color: 0x4a5049, roughness: 1 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x191d1a, roughness: .5, metalness: .78 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x777d73, roughness: .38, metalness: .68 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x3d2118, roughness: .9, metalness: .18 }),
  light: new THREE.MeshStandardMaterial({ color: 0xc9d3aa, emissive: 0xa9ff32, emissiveIntensity: 2.1 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xb6ff00, roughness: .7 }),
  acid: new THREE.MeshStandardMaterial({ color: 0xa9e536, emissive: 0x2d4b08, emissiveIntensity: .7, roughness: .62 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x697060, roughness: .82 }),
  black: new THREE.MeshStandardMaterial({ color: 0x090a09, roughness: .86 }),
  charcoal: new THREE.MeshStandardMaterial({ color: 0x171a17, roughness: .9 }),
  skin: new THREE.MeshStandardMaterial({ color: 0x8f7967, roughness: .92 }),
  sole: new THREE.MeshStandardMaterial({ color: 0xc7c7bc, roughness: .78 })
};

function addBox(size, position, material, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  scene.add(mesh);
  return mesh;
}

function buildEnvironment() {
  addBox([26, .35, 28], [0, -.2, -1], materials.floor, false, true);
  addBox([21, 7.2, .5], [0, 3.45, -8.45], materials.concreteWorn, false, true);
  addBox([.6, 7.2, 25], [-10.25, 3.45, 1.8], materials.concreteDark, false, true);
  addBox([.6, 7.2, 25], [10.25, 3.45, 1.8], materials.concreteDark, false, true);

  // Рёбра рольставни убраны: на свету они читались как решётка поперёк всей стены.
  // Колонны оставлены только по краям и между панелями — они держат архитектуру.
  for (const x of [-9.35, 0, 9.35]) addBox([.38, 6.5, .72], [x, 3.18, -7.98], materials.metal, true, true);
  for (const z of [-7.1, -2.6, 1.9, 6.4]) addBox([20.2, .25, .38], [0, 6.15, z], materials.metal, true, true);

  const pipeGeo = new THREE.CylinderGeometry(.1, .13, 19, 12);
  for (const y of [5.48, 5.85]) {
    const pipe = new THREE.Mesh(pipeGeo, materials.rust);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, y, -7.72);
    pipe.castShadow = true;
    scene.add(pipe);
  }

  // Drainage channel and wet floor plates create a dense, used industrial space.
  addBox([18.2, .055, .5], [0, .015, -6.1], materials.metal, false, true);
  for (let x = -8.6; x < 8.7; x += .62) addBox([.38, .065, .52], [x, .05, -6.1], materials.steel, false, true);
  const puddleGeo = new THREE.CircleGeometry(1, 28);
  const puddleMat = new THREE.MeshStandardMaterial({ color:0x111814, metalness:.86, roughness:.18, transparent:true, opacity:.62 });
  for (const [x,z,s] of [[-2.2,-3.8,1.4],[5.8,-4.3,.9],[-7.4,-1.2,.65]]) {
    const p = new THREE.Mesh(puddleGeo,puddleMat); p.rotation.x=-Math.PI/2; p.scale.set(s,.42*s,1); p.position.set(x,.006,z); scene.add(p);
  }

  for (const x of [-7.2, -2.4, 2.4, 7.2]) {
    addBox([1.6, .09, .42], [x, 5.72, -3.2], materials.light, false, false);
    const spot = new THREE.SpotLight(0xc8ffa0, 31, 17, .58, .72, 1.4);
    spot.position.set(x, 5.62, -3.15);
    spot.target.position.set(x, 1.9, -7.1);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    scene.add(spot, spot.target);
  }

  // Контровой свет от стены: очерчивает силуэты райтеров и отделяет их от фона
  for (const [x, colour] of [[PLAYER_CENTER, 0xffd9a8], [RIVAL_CENTER, 0xbfe6ff]]) {
    const rim = new THREE.SpotLight(colour, 26, 9.5, .82, .9, 1.6);
    rim.position.set(x, 2.95, WALL_Z + .95);
    rim.target.position.set(x, 1.35, WALL_Z + 3.4);
    scene.add(rim, rim.target);
  }

  // Тёплые промышленные лампы по бокам против холодного общего света
  for (const [x, z] of [[-9.1, -2.2], [9.1, -2.6], [-8.4, 4.1], [8.4, 3.6]]) {
    const warm = new THREE.PointLight(0xff9d4a, 9, 8.5, 2);
    warm.position.set(x, 3.15, z);
    scene.add(warm);
    addBox([.34, .12, .34], [x, 3.32, z], materials.rust, false, false);
  }

  scene.add(new THREE.HemisphereLight(0x5c6d78, 0x090b08, .5));
  const acidLight = new THREE.PointLight(0xa8ff34, 18, 9, 2);
  acidLight.position.set(7.8, 2.1, -2.8); scene.add(acidLight);
  const playerAccentLight = new THREE.PointLight(0xb6ff00, 11, 8, 2);
  playerAccentLight.position.set(-8.2, 1.2, -1.1); scene.add(playerAccentLight);
  const playerKey = new THREE.PointLight(0xcbd5c5, 17, 11, 2);
  playerKey.position.set(-4.2,3.25,-2.75);scene.add(playerKey);
  const rivalKey = new THREE.PointLight(0xaab69b, 14, 10, 2);
  rivalKey.position.set(4.25,3.05,-3.1);scene.add(rivalKey);

  // Workshop clutter stays on the perimeter so the walk-to-wall lane remains playable.
  for (let i = 0; i < 16; i += 1) {
    const side = Math.random() < .5 ? -1 : 1;
    const crate = addBox([.55+Math.random()*.9,.35+Math.random()*.7,.5+Math.random()*.8],[side*(8.4+Math.random()*.9),.18,-5+Math.random()*11],Math.random()>.72?materials.rust:materials.metal,true,true);
    crate.rotation.y = Math.random()*Math.PI;
  }

  // TORB-like acid wayfinding bars in the architecture, not floating fantasy neon.
  for (const x of [-9.75,9.75]) {
    const marker=addBox([.06,1.15,.08],[x,2.05,-7.63],materials.acid,false,false); marker.rotation.z=x<0?.08:-.08;
  }
}

buildEnvironment();

const imageLoad = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

// Холсты читаются каждый кадр (метрики закраса), поэтому просим у браузера
// контекст, оптимизированный под частое чтение — иначе он сыплет предупреждениями.
const ctx2d = (canvas) => canvas.__ctx2d || (canvas.__ctx2d = canvas.getContext('2d', { willReadFrequently: true }));

const newCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  return canvas;
};

class PaintSurface {
  // spec: {id, x, y, z, w, h, accent}. Всё, кроме id и accent, необязательно —
  // недостающее берётся из констант локации по умолчанию. Так новая стена
  // добавляется одной строкой в WALLS, а не правкой математики по всему файлу.
  constructor(spec) {
    this.id = spec.id;
    this.x = this.centerX = spec.x;
    this.y = spec.y ?? PANEL_Y;
    this.z = spec.z ?? WALL_Z;
    this.w = spec.w ?? PANEL_W;
    this.h = spec.h ?? PANEL_H;
    this.accent = spec.accent;
    this.grid=spec.grid ?? DEFAULT_GRID;
    this.roundSeconds=timeForGrid(this.grid);
    this.dripPalette=spec.dripPalette ?? ['#719e00','#415b05'];
    this.drips=new DripTracker(DRIP_MAPS[`${this.grid.columns}x${this.grid.rows}`] ?? []);
    this.stage=0;this.complete=false;this.progress=0;this.outside=0;
    this.layerMasks=[newCanvas(),newCanvas(),newCanvas()];
    this.layerTargets=[];
    this.dripCanvas=newCanvas();
    this.final = newCanvas();
    this.mask = this.layerMasks[0];
    this.mist = newCanvas();
    this.display = newCanvas();
    this.reveal = newCanvas();
    this.outline = newCanvas();
    this.targetData = null;
    this.texture = new THREE.CanvasTexture(this.display);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const panelMat = new THREE.MeshStandardMaterial({
      map: this.texture, roughness: .82, metalness: .04,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.w, this.h), panelMat);
    // вплотную к бетону: доски больше нет, краска ложится на саму стену
    this.mesh.position.set(this.x, this.y, this.z + .045);
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.update();
  }

  compose(images) {
    const ctx = ctx2d(this.final);
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    const image = images[0];
    const scale = Math.min((TEX_W - 48) / image.width, (TEX_H - 34) / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    const x = (TEX_W - w) / 2;
    const y = (TEX_H - h) / 2;
    images.forEach((asset) => ctx.drawImage(asset, x, y, w, h));
    this.targetData = ctx.getImageData(0, 0, TEX_W, TEX_H).data;
    this.makeOutline();
    this.layerTargets=[ctx2d(this.outline).getImageData(0,0,TEX_W,TEX_H).data,
      ctx2d(this.outline).getImageData(0,0,TEX_W,TEX_H).data,this.targetData];
    this.layerTotals=this.layerTargets.map(data=>{let count=0;for(let i=3;i<data.length;i+=4)if(data[i]>32)count++;return count;});
    this.update();
  }

  makeOutline() {
    const ctx = ctx2d(this.outline);
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    ctx.save();
    ctx.shadowBlur = 0;
    // силуэт, сдвинутый во все стороны, даёт равномерную обводку
    const width = 3;
    ctx.fillStyle = '#ffffff';
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      ctx.drawImage(this.final, Math.cos(angle) * width, Math.sin(angle) * width);
    }
    // перекрашиваем всё в белый
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#f4f7ef';
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    // вырезаем середину — остаётся только линия
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(this.final, 0, 0);
    ctx.restore();
  }

  reset() {
    this.layerMasks.forEach(mask=>ctx2d(mask).clearRect(0,0,TEX_W,TEX_H));
    this.stage=0;this.complete=false;this.progress=0;this.outside=0;
    this.mask=this.layerMasks[0];this.drips.reset();this.settledDrips=0;
    ctx2d(this.dripCanvas).clearRect(0,0,TEX_W,TEX_H);
    ctx2d(this.mist).clearRect(0, 0, TEX_W, TEX_H);
    this.update();
  }

  spray(uv, radius, strength = 1) {
    if(this.complete)return;
    const x = uv.x * TEX_W;
    const y = (1 - uv.y) * TEX_H;
    const maskCtx = ctx2d(this.mask);
    const gradient = maskCtx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${.92 * strength})`);
    gradient.addColorStop(.54, `rgba(255,255,255,${.58 * strength})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    maskCtx.fillStyle = gradient;
    maskCtx.beginPath(); maskCtx.arc(x, y, radius, 0, Math.PI * 2); maskCtx.fill();

    const mistCtx = ctx2d(this.mist);
    const mist = mistCtx.createRadialGradient(x, y, 0, x, y, radius * 1.15);
    const color = this.accent;
    mist.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${.065 * strength})`);
    mist.addColorStop(.75, `rgba(${color[0]},${color[1]},${color[2]},${.018 * strength})`);
    mist.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
    mistCtx.fillStyle = mist;
    mistCtx.beginPath(); mistCtx.arc(x, y, radius * 1.15, 0, Math.PI * 2); mistCtx.fill();
  }

  holdDrip(uv,dt,now){
    return !this.complete&&this.drips.hold(uv.x*TEX_W,(1-uv.y)*TEX_H,dt,now,TEX_W,TEX_H);
  }

  animateDrips(now){
    if(!this.drips.events.length)return;
    const signature=this.drips.events.length;
    if(this.settledDrips===signature)return;
    const ctx=ctx2d(this.dripCanvas);
    ctx.clearRect(0,0,TEX_W,TEX_H);
    for(const event of this.drips.events){
      const shape=dripShape((now-event.started)/1000);
      ctx.fillStyle=ctx.strokeStyle=this.dripPalette[event.index%this.dripPalette.length];
      ctx.lineWidth=shape.width;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(event.x,event.y);ctx.lineTo(event.x,event.y+shape.length);ctx.stroke();
      ctx.beginPath();ctx.arc(event.x,event.y,shape.size/2,0,Math.PI*2);ctx.fill();
    }
    if(this.drips.events.every(event=>now-event.started>=3350))this.settledDrips=signature;
    this.update();
  }

  update() {
    const ctx = ctx2d(this.display);
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    ctx.save();
    ctx.globalAlpha = .05;
    ctx.drawImage(this.final, 0, 0);
    ctx.globalAlpha = .16;
    ctx.drawImage(this.outline, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = .88;
    ctx.drawImage(this.mist, 0, 0);
    ctx.restore();
    for(let layer=0;layer<=this.stage;layer++){
      const art=layer===2?this.final:this.outline;
      ctx.save();ctx.globalAlpha=layer===0?.4:1;
      if(layer<this.stage||this.complete)ctx.drawImage(art,0,0);
      else {
        const revealCtx=ctx2d(this.reveal);
        revealCtx.globalCompositeOperation='source-over';
        revealCtx.clearRect(0,0,TEX_W,TEX_H);
        for(let pass=0;pass<3;pass++)revealCtx.drawImage(this.layerMasks[layer],0,0);
        revealCtx.globalCompositeOperation='source-in';revealCtx.drawImage(art,0,0);
        ctx.drawImage(this.reveal,0,0);
      }
      ctx.restore();
    }
    ctx.drawImage(this.dripCanvas,0,0);
    this.texture.needsUpdate = true;
  }

  metrics() {
    if(!this.layerTargets.length)return {coverage:0,outside:0};
    if(this.complete)return {coverage:100,outside:this.outside};
    const mask = ctx2d(this.mask).getImageData(0, 0, TEX_W, TEX_H).data;
    const data=this.layerTargets[this.stage];
    let total = 0, covered = 0, outside = 0;
    for (let i = 3; i < mask.length; i += 4) {
      const target = data[i] > 32;
      if (target) {
        total += 1;
        if (mask[i] > 35) covered += 1;
      } else if (this.targetData[i]<=32 && mask[i] > 80) outside += 1;
    }
    const fraction=total?covered/total:0;
    this.progress=stageProgress(this.stage,fraction);
    this.outside=Math.max(this.outside,outside/Math.max(1,this.layerTotals[2])*100);
    if(total&&fraction>=STAGES[this.stage].threshold){
      if(this.stage===2){this.complete=true;this.progress=100;}
      else {this.stage++;this.mask=this.layerMasks[this.stage];}
      this.update();
    }
    return {coverage:this.progress,outside:this.outside};
  }

  route() {
    const points = [];
    let row = 0;
    const spacing=this.stage<2?6:19;
    for (let y = 18; y < TEX_H - 18; y += spacing) {
      const line = [];
      for (let x = 18; x < TEX_W - 18; x += spacing) {
        const data=this.layerTargets[this.stage]||this.targetData;
        if (data[(y * TEX_W + x) * 4 + 3] > 35) line.push(new THREE.Vector2(x / TEX_W, 1 - y / TEX_H));
      }
      if (row % 2) line.reverse();
      points.push(...line);
      row += 1;
    }
    return points;
  }
}

// ===== Стены локации =====
// Каждая запись — самостоятельная поверхность со своими координатами и размером.
// Чтобы добавить стену в локацию, достаточно дописать сюда строку.
const WALLS = [
  { id:'player', x:PLAYER_CENTER, grid:{columns:4,rows:2}, accent:[182,255,0],dripPalette:['#719e00','#415b05'] },
  { id:'rival',  x:RIVAL_CENTER, grid:{columns:4,rows:2}, accent:[137,144,125],dripPalette:['#656c58','#464e3d'] }
];
const surfaces = WALLS.map(spec => new PaintSurface(spec));
const surfaceById = id => surfaces.find(s => s.id === id);
const playerSurface = surfaceById('player');
const aiSurface = surfaceById('rival');

function segment(material, radius, taper = .82) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * taper, radius, 1, 18), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function placeSegment(mesh, start, end) {
  const direction = end.clone().sub(start);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.scale.set(1, direction.length(), 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction.normalize());
}

class Mannequin {
  constructor(color, x, rival = false) {
    this.root = new THREE.Group();
    this.root.position.set(x, 0, 3.6);
    this.root.rotation.y = rival ? -.05 : .05;
    scene.add(this.root);
    this.rival = rival;
    this.rigModel = null;
    this.rigBones = {};
    this.rigBase = {};
    this.motion = { mode:'idle', speed:0, desiredYaw:0, until:0 };
    this.tagMove = { active:false, fromX:x, fromZ:0, toX:x, toZ:0, started:0, duration:TAG_STEP_TIME };
    this.tagPose = new THREE.Vector2(x, 1.62);
    this.paintBlend = 0;
    this.paintPoseCache = {};
    const primary = new THREE.MeshStandardMaterial({ color, roughness:.82 });
    const trouser = new THREE.MeshStandardMaterial({ color:rival?0x20231f:0x101210, roughness:.92 });
    this.primary = primary;
    this.trouser = trouser;

    // A layered streetwear silhouette: tapered hoodie, hood, straps, baggy trousers and long sneakers.
    this.torso = new THREE.Mesh(new THREE.SphereGeometry(.52,20,14), primary);
    this.torso.scale.set(.82,1.08,.58);
    this.torso.position.set(0,1.68,0);
    this.torso.castShadow = true;
    this.root.add(this.torso);

    this.hem = new THREE.Mesh(new THREE.CylinderGeometry(.46,.42,.18,12), materials.black);
    this.hem.scale.z=.75; this.hem.position.set(0,1.14,0); this.hem.castShadow=true; this.root.add(this.hem);
    this.pelvis = new THREE.Mesh(new THREE.CylinderGeometry(.34,.4,.34,12), trouser);
    this.pelvis.scale.z=.78; this.pelvis.position.y = .98;
    this.pelvis.castShadow = true;
    this.root.add(this.pelvis);

    this.neck = new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.2,12),materials.skin);
    this.neck.position.set(0,2.23,0); this.root.add(this.neck);
    this.head = new THREE.Mesh(new THREE.SphereGeometry(.255,20,15), materials.skin);
    this.head.scale.set(.9,1.12,.9); this.head.position.set(0,2.47,-.015);
    this.head.castShadow = true;
    this.root.add(this.head);

    this.hood = new THREE.Mesh(new THREE.TorusGeometry(.29,.075,10,20),primary);
    this.hood.rotation.x=Math.PI/2; this.hood.position.set(0,2.33,.06); this.hood.scale.y=.86; this.root.add(this.hood);
    this.cap = new THREE.Mesh(new THREE.CylinderGeometry(.25,.29,.14,18), materials.black);
    this.cap.position.set(0,2.69,-.015);
    this.root.add(this.cap);
    this.brim = new THREE.Mesh(new THREE.BoxGeometry(.31,.035,.16),materials.black);
    this.brim.position.set(0,2.68,-.23); this.brim.rotation.x=-.08; this.root.add(this.brim);

    this.leftStrap = new THREE.Mesh(new THREE.BoxGeometry(.075,.88,.045),materials.black);
    this.rightStrap = this.leftStrap.clone();
    this.leftStrap.position.set(-.27,1.7,.27); this.rightStrap.position.set(.27,1.7,.27);
    this.leftStrap.rotation.z=-.08; this.rightStrap.rotation.z=.08;
    this.root.add(this.leftStrap,this.rightStrap);
    this.chestMark = new THREE.Mesh(new THREE.BoxGeometry(.25,.055,.045),rival?materials.steel:materials.acid);
    this.chestMark.position.set(.05,1.72,.31);this.chestMark.rotation.z=-.32;this.root.add(this.chestMark);

    this.limbs = {
      leftUpper: segment(primary,.155,.72), leftLower: segment(primary,.125,.74),
      rightUpper: segment(primary,.155,.72), rightLower: segment(primary,.125,.74),
      leftThigh: segment(trouser,.22,.76), leftShin: segment(trouser,.17,.72),
      rightThigh: segment(trouser,.22,.76), rightShin: segment(trouser,.17,.72)
    };
    Object.values(this.limbs).forEach((part) => this.root.add(part));

    this.hands={left:new THREE.Mesh(new THREE.SphereGeometry(.1,12,9),materials.skin),right:new THREE.Mesh(new THREE.SphereGeometry(.1,12,9),materials.skin)};
    this.shoes={left:new THREE.Group(),right:new THREE.Group()};
    Object.values(this.hands).forEach(hand=>{hand.castShadow=true;this.root.add(hand);});
    Object.values(this.shoes).forEach(shoe=>{
      const upper=new THREE.Mesh(new THREE.BoxGeometry(.24,.15,.43),rival?materials.olive:primary);
      const sole=new THREE.Mesh(new THREE.BoxGeometry(.27,.055,.47),materials.sole);sole.position.y=-.095;
      const toe=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),rival?materials.olive:primary);toe.scale.set(1,.58,1.1);toe.position.z=-.19;
      shoe.add(upper,sole,toe);shoe.scale.set(1.05,1,1.05);this.root.add(shoe);
    });

    this.can = new THREE.Mesh(new THREE.CylinderGeometry(.033,.033,.19,14), new THREE.MeshStandardMaterial({color:0xb8b8b0,metalness:.72,roughness:.28}));
    this.can.castShadow = true;
    this.root.add(this.can);
    this.nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.013,.017,.03,10),materials.black);
    this.nozzle.position.y=.11; this.can.add(this.nozzle);
    this.beltCan1=this.can.clone();this.beltCan2=this.can.clone();
    this.beltCan1.scale.set(.82,.82,.82);this.beltCan2.scale.set(.82,.82,.82);
    this.beltCan1.position.set(-.34,1.03,.18);this.beltCan2.position.set(.34,1.03,.18);
    this.beltCan1.rotation.z=-.25;this.beltCan2.rotation.z=.25;this.root.add(this.beltCan1,this.beltCan2);
    this.targetLocal = new THREE.Vector3(.4,1.7,-1.15);
  }

  attachRig(model, clips = []) {
    this.rigModel = model;
    this.mixer = null; this.actions = {}; this.currentClip = null;
    if (clips.length) {
      this.mixer = new THREE.AnimationMixer(model);
      clips.forEach((clip) => {
        const stripped = clip.clone();
        stripped.tracks = stripped.tracks.filter((track) => !(
          track.name.endsWith('.position') && /hips/i.test(track.name)
        ));
        this.actions[clip.name.toLowerCase()] = this.mixer.clipAction(stripped);
      });
    }
    model.name = this.rival ? 'TORB_Rival_Visual' : 'TORB_Player_Visual';
    model.position.set(0, 0, 0);
    model.rotation.y = Math.PI;
    model.scale.setScalar(this.rival ? .99 : 1.02);

    // Старое тело остаётся аварийным запасом, но видимым оставляем только баллон в руке:
    // подсумочные баллоны были рассчитаны на прежние пропорции и висели за спиной.
    [...this.root.children].forEach((child) => { child.visible = child === this.can; });

    const boneNames = [
      'root','hips','spine','chest','neck','head',
      'shoulder.L','upper_arm.L','forearm.L','hand.L',
      'shoulder.R','upper_arm.R','forearm.R','hand.R',
      'thigh.L','shin.L','foot.L','thigh.R','shin.R','foot.R'
    ];
    const MIXAMO = {
      root:'Hips', hips:'Hips', spine:'Spine', chest:'Spine2', neck:'Neck', head:'Head',
      'shoulder.L':'LeftShoulder', 'upper_arm.L':'LeftArm', 'forearm.L':'LeftForeArm', 'hand.L':'LeftHand',
      'shoulder.R':'RightShoulder', 'upper_arm.R':'RightArm', 'forearm.R':'RightForeArm', 'hand.R':'RightHand',
      'thigh.L':'LeftUpLeg', 'shin.L':'LeftLeg', 'foot.L':'LeftFoot',
      'thigh.R':'RightUpLeg', 'shin.R':'RightLeg', 'foot.R':'RightFoot'
    };
    // three.js санирует имена узлов при загрузке glTF: «mixamorig7:RightHand» приходит
    // как «mixamorig7_RightHand». Поэтому ищем по хвосту имени, а не по точному совпадению.
    const bones = [];
    model.traverse((o) => { if (o.isBone) bones.push(o); });
    const tailOf = (name) => name.toLowerCase().replace(/^.*?mixamorig\d*[:_]?/, '');
    const findBone = (suffix) => bones.find((b) => tailOf(b.name) === suffix.toLowerCase()) || null;

    // Mixamo clips leave the right hand open. Keep the imported animation for
    // the body, then curl only the finger joints around the spray can.
    const chain = (name) => [1, 2, 3].map((n) => findBone(`RightHand${name}${n}`)).filter(Boolean);
    this.gripChains = {
      index: chain('Index'), middle: chain('Middle'), ring: chain('Ring'),
      pinky: chain('Pinky'), thumb: chain('Thumb')
    };
    model.traverse((object) => {
      if (object.isMesh || object.isSkinnedMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
        if (Array.isArray(object.material)) object.material = object.material.map((material) => material.clone());
        else if (object.material) object.material = object.material.clone();
        const tint = (material) => {
          if (!material?.color || !this.rival) return;
          const name = material.name || '';
          if (name.includes('Hoodie')) material.color.setHex(0x566052);
          else if (name.includes('Pants')) material.color.setHex(0x20251f);
          else if (name.includes('Shoes')) material.color.setHex(0x343a33);
          else if (name.includes('Acid')) material.color.setHex(0x8d9784);
        };
        if (Array.isArray(object.material)) object.material.forEach(tint); else tint(object.material);
      }
    });

    boneNames.forEach((name) => {
      const bone = model.getObjectByName(name) || (MIXAMO[name] ? findBone(MIXAMO[name]) : null);
      if (!bone) return;
      this.rigBones[name] = bone;
      this.rigBase[name] = bone.quaternion.clone();
    });
    const gripHand = this.rigBones['hand.R'];
    if (gripHand) {
      model.updateWorldMatrix(true, true);
      const handWorld = gripHand.getWorldQuaternion(new THREE.Quaternion());
      // The can was baked upright on the model's local Y axis in Blender.
      // Remember that axis in hand space so it can be kept upright while the
      // animation moves the forearm and wrist.
      const modelUpWorld = new THREE.Vector3(0, 1, 0).applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion()));
      this.canAxisInHand = modelUpWorld.applyQuaternion(handWorld.clone().invert()).normalize();
    }
    const found = Object.keys(this.rigBones).length;
    console.info('SprayFight: костей сопоставлено %d из %d%s', found, boneNames.length,
      found ? '' : ' — рука и баллон работать не будут, имена: ' + bones.slice(0, 3).map((b) => b.name).join(', '));
    this.root.add(model);

    // Баллон вшит в модель и жёстко привязан к RightHand в Blender.
    // three.js обновляет их вместе со скелетом сам — отдельный код на каждый кадр не нужен.
    this.can.visible = false; // старый примитив-заглушка больше не нужен
    this.canModel = model.getObjectByName('SprayCan') || null;
    this.maskModel = null;
    if (this.canModel) {
      this.canModel.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
      this.canInHand = true;
      const mesh = this.canModel.isSkinnedMesh ? this.canModel : (() => {
        let found = null;
        this.canModel.traverse((object) => { if (!found && object.isSkinnedMesh) found = object; });
        return found;
      })();
      if (mesh) {
        mesh.geometry.computeBoundingBox();
        this.canMesh = mesh;
        this.canRestCenter = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
        // The prop is skinned: its object origin does not follow the nozzle.
        mesh.updateWorldMatrix(true,false);
        mesh.skeleton.update();
        let highest=-Infinity;
        const vertices=mesh.geometry.attributes.position;
        for(let i=0;i<vertices.count;i++){
          const point=mesh.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(vertices,i));
          mesh.localToWorld(point);
          if(point.y>highest){highest=point.y;this.nozzleVertex=i;}
        }
      }
    } else {
      console.warn('SprayFight: узел SprayCan не найден в модели — остаётся примитив.');
    }
  }



  // Клипы из Mixamo: idle / walk / run / crouch. Нет клипа — работает прежняя процедурная поза.
  playClip(name, fade = .25, options = {}) {
    if (!this.mixer) return false;
    const action = this.actions[name];
    if (!action) return false;
    const { once = false, timeScale = 1, restart = false } = options;
    action.timeScale = timeScale;
    action.clampWhenFinished = once;
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    if (this.currentClip === name && !restart) return true;
    const previous = this.currentClip && this.actions[this.currentClip];
    action.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (previous && previous !== action) previous.fadeOut(fade);
    this.currentClip = name;
    return true;
  }

  updateMixer(dt) { if (this.mixer) this.mixer.update(dt); }

  resetMotion() {
    this.paintBlend=0;
    this.paintPoseCache={};
    this.armTarget=null;
    if(this.rigModel)this.rigModel.position.y=0;
    Object.assign(this.motion,{mode:'idle',speed:0,desiredYaw:0,until:0});
    Object.assign(this.tagMove,{active:false,fromX:this.root.position.x,fromZ:this.root.position.z,toX:this.root.position.x,toZ:this.root.position.z,started:0,duration:TAG_STEP_TIME});
    this.tagPose.set(this.root.position.x,1.62);
  }

  // Input only selects a movement state and desired direction. Translation is
  // accelerated in the phase of the selected clip instead of snapping directly
  // to a target coordinate, matching Getting Up's state/root-motion structure.
  updateLocomotion(inputX, inputZ, running, now, dt, xMin, xMax, zMin, zMax) {
    const input = new THREE.Vector2(inputX,inputZ);
    const moving = input.lengthSq() > .001;
    if (moving) input.normalize();
    const targetSpeed = moving ? (running ? RUN_SPEED : WALK_SPEED) : 0;

    if (moving) {
      const desiredYaw = Math.atan2(-input.x,-input.y);
      let yawDelta = Math.atan2(Math.sin(desiredYaw-this.root.rotation.y),Math.cos(desiredYaw-this.root.rotation.y));
      if (Math.abs(yawDelta)>2.45 && this.motion.speed>.65 && this.motion.mode!=='turn') {
        this.motion.mode='turn'; this.motion.until=now+650;
        this.playClip('turn_180',.12,{once:true,timeScale:1.65,restart:true});
      } else if (this.motion.mode==='idle'||this.motion.mode==='stop') {
        this.motion.mode='start'; this.motion.until=now+520;
        this.playClip('walk_start',.16,{once:true,timeScale:(this.actions.walk_start?.getClip().duration || .52)/.52,restart:true});
      } else if (now>=this.motion.until && (this.motion.mode==='start'||this.motion.mode==='turn')) {
        this.motion.mode=running?'run':'walk';
      } else if (this.motion.mode==='walk'||this.motion.mode==='run') {
        this.motion.mode=running?'run':'walk';
      }
      this.motion.desiredYaw=desiredYaw;
      const turnRate=this.motion.mode==='turn'?8.5:5.8;
      this.root.rotation.y+=yawDelta*(1-Math.exp(-turnRate*dt));
      if (this.motion.mode==='walk'||this.motion.mode==='run') {
        // Клип крутится пропорционально реальной скорости, иначе тело замедлили,
        // а ноги продолжают перебирать в прежнем темпе — ровно то проскальзывание,
        // ради устранения которого и делался BUILD 04.
        this.playClip('walk',.18,{timeScale:(running?RUN_SPEED:WALK_SPEED)/CLIP_WALK_SPEED});
      }
    } else if (!['idle','stop'].includes(this.motion.mode)) {
      this.motion.mode='stop'; this.motion.until=now+560;
      this.playClip('walk_stop',.14,{once:true,timeScale:(this.actions.walk_stop?.getClip().duration || .56)/.56,restart:true});
    } else if (this.motion.mode==='stop' && now>=this.motion.until) {
      this.motion.mode='idle'; this.playClip('idle',.24);
    } else if (this.motion.mode==='idle') {
      this.playClip('idle',.24);
    }

    // Старт по оригиналу НЕ медленнее ходьбы. В BNM Getting Up TR_IdleToWalk проходит
    // 32 ед за 19 кадров = 1.684 ед/кадр, тогда как установившийся TR_Walk — 1.525.
    // То есть стартовый клип слегка ОБГОНЯЕТ ровный шаг (толчок с места), а прежние
    // .68 делали трогание вялым. Отношение 1.684/1.525 = 1.104.
    const phaseScale=this.motion.mode==='start'?1.104:this.motion.mode==='turn'?.2:1;
    this.motion.speed=THREE.MathUtils.damp(this.motion.speed,targetSpeed*phaseScale,moving?5.2:7.5,dt);
    if (moving) {
      this.root.position.x=THREE.MathUtils.clamp(this.root.position.x+input.x*this.motion.speed*dt,xMin,xMax);
      this.root.position.z=THREE.MathUtils.clamp(this.root.position.z+input.y*this.motion.speed*dt,zMin,zMax);
    }
    this.root.position.y=THREE.MathUtils.damp(this.root.position.y,groundHeight(this.root.position.z),12,dt);
    return moving;
  }

  beginTagMove(targetX,targetZ,now) {
    if (this.tagMove.active) return false;
    const dx=targetX-this.root.position.x, dz=targetZ-this.root.position.z;
    if (Math.hypot(dx,dz)<.035) return false;
    // One locomotion cycle per committed step; longer approaches take longer.
    const duration=TAG_STEP_TIME*Math.max(1,Math.abs(dx)/TAG_STEP_X,Math.abs(dz)/TAG_STEP_Z);
    Object.assign(this.tagMove,{active:true,fromX:this.root.position.x,fromZ:this.root.position.z,toX:targetX,toZ:targetZ,started:now,duration});
    let clip='walk';
    if (Math.abs(dx)>=Math.abs(dz)) clip=dx<0?'strafe_left':'strafe_right';
    else if (dz>0) clip='walk_back';
    const clipDuration=this.actions[clip]?.getClip().duration || duration;
    const cycles=Math.max(1,Math.round(duration/TAG_STEP_TIME));
    this.playClip(clip,.1,{once:cycles===1,timeScale:clipDuration*cycles/duration,restart:true});
    return true;
  }

  updateTagMove(now) {
    if (!this.tagMove.active) return false;
    const raw=THREE.MathUtils.clamp((now-this.tagMove.started)/(this.tagMove.duration*1000),0,1);
    const t=smoothstep(raw);
    this.root.position.x=THREE.MathUtils.lerp(this.tagMove.fromX,this.tagMove.toX,t);
    this.root.position.z=THREE.MathUtils.lerp(this.tagMove.fromZ,this.tagMove.toZ,t);
    if (raw>=1) {
      this.tagMove.active=false;
      this.playClip('idle',.16);
    }
    return true;
  }

  applyCanGrip() {
    const hand = this.rigBones?.['hand.R'];
    if (hand && this.canAxisInHand) {
      hand.updateWorldMatrix(true, false);
      const worldQ = hand.getWorldQuaternion(new THREE.Quaternion());
      const currentUp = this.canAxisInHand.clone().applyQuaternion(worldQ).normalize();
      // At the wall the whole wrist/can assembly leans slightly toward the
      // surface, matching the trigger grip used in Getting Up.
      const wantedUp = state.phase === 'paint'
        ? new THREE.Vector3(0, .985, -.17).normalize()
        : new THREE.Vector3(0, 1, 0);
      const correction = new THREE.Quaternion().setFromUnitVectors(currentUp, wantedUp);
      const correctedWorld = worldQ.clone().premultiply(correction);
      const parentWorld = hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      hand.quaternion.copy(parentWorld.multiply(correctedWorld));
      hand.updateWorldMatrix(false, true);
    }
    if (!hand || !this.canMesh || !this.canRestCenter || !this.gripChains) return;

    // Read the current skinned position, not the raw object transform. The
    // latter is in armature coordinates and produced targets tens of metres
    // away from the hand.
    this.canMesh.skeleton.update();
    const canCenter = this.canMesh.applyBoneTransform(0, this.canRestCenter.clone());
    this.canMesh.localToWorld(canCenter);
    const canUp = state.phase === 'paint'
      ? new THREE.Vector3(0, .985, -.17).normalize()
      : new THREE.Vector3(0, 1, 0);
    const aimJoint = (bone, target, strength, maxAngle) => {
      const child = bone.children.find((item) => item.isBone);
      if (!child) return;
      bone.updateWorldMatrix(true, true);
      const pivot = bone.getWorldPosition(new THREE.Vector3());
      const current = child.getWorldPosition(new THREE.Vector3()).sub(pivot);
      const wanted = target.clone().sub(pivot);
      if (current.lengthSq() < 1e-7 || wanted.lengthSq() < 1e-7) return;
      const full = new THREE.Quaternion().setFromUnitVectors(current.normalize(), wanted.normalize());
      const angle = full.angleTo(new THREE.Quaternion());
      const amount = angle > 1e-5 ? Math.min(strength, maxAngle / angle) : 0;
      const delta = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), full, amount);
      const world = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta);
      const parentInverse = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      bone.quaternion.copy(parentInverse.multiply(world));
      bone.updateWorldMatrix(false, true);
    };
    const surfaceTarget = (bone, yOffset = 0) => {
      const pivot = bone.getWorldPosition(new THREE.Vector3());
      const radial = pivot.clone().sub(canCenter).addScaledVector(canUp, -pivot.clone().sub(canCenter).dot(canUp));
      if (radial.lengthSq() < 1e-7) radial.set(1, 0, 0);
      return canCenter.clone().add(radial.normalize().multiplyScalar(.035)).addScaledVector(canUp, yOffset);
    };
    const wrapTarget = (bone, jointIndex) => {
      const pivot = bone.getWorldPosition(new THREE.Vector3());
      const radial = pivot.clone().sub(canCenter).addScaledVector(canUp, -pivot.clone().sub(canCenter).dot(canUp));
      if (radial.lengthSq() < 1e-7) radial.set(1, 0, 0);
      radial.normalize();
      const angle = [.22, .72, 1.22][jointIndex] ?? 1.22;
      // Fixed right-hand curl: never flip the fingers when the camera changes.
      const wrapped = radial.applyAxisAngle(canUp, angle);
      // Every following joint sits lower on the cylinder. This is the actual
      // gripping direction; positive values made the open fingers point up.
      const height = [-.07, -.092, -.108][jointIndex] ?? -.108;
      return canCenter.clone().add(wrapped.multiplyScalar(.036)).addScaledVector(canUp, height);
    };

    // Three lower fingers wrap the upper cylinder surface.
    for (const name of ['middle', 'ring', 'pinky']) {
      const bones = this.gripChains[name];
      bones.forEach((bone, i) => aimJoint(bone, wrapTarget(bone, i), 1, 2.35));
    }
    // Thumb braces the near surface instead of opening above the cap.
    const thumbHeights = [-.055, -.06, -.065];
    this.gripChains.thumb.forEach((bone, i) => aimJoint(bone, surfaceTarget(bone, thumbHeights[i] ?? -.065), 1, 2.35));
    // Trigger finger lies across the neck of the can. Each joint receives its
    // own low target; aiming the whole chain at the top created two antennas.
    const indexHeights = [-.035, -.015, .005];
    this.gripChains.index.forEach((bone, i) => aimJoint(bone, surfaceTarget(bone, indexHeights[i] ?? .005), 1, 2.35));

  }

  // Двухкостное наведение: разворачиваем плечо так, чтобы кисть смотрела в точку на стене,
  // затем доводим предплечье. Вызывать строго после mixer.update.
  aimArmAt(targetWorld, dt, weight = 1) {
    const upper = this.rigBones['upper_arm.R'];
    const fore = this.rigBones['forearm.R'];
    const hand = this.rigBones['hand.R'];
    if (!upper || !fore || !hand) return false;

    upper.updateWorldMatrix(true,true);
    const shoulder=upper.getWorldPosition(new THREE.Vector3());
    const elbow=fore.getWorldPosition(new THREE.Vector3());
    const wrist=hand.getWorldPosition(new THREE.Vector3());
    const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist);
    if(a<1e-5||b<1e-5)return false;
    this.armTarget ||= wrist.clone();
    this.armTarget.lerp(targetWorld,1-Math.exp(-12*dt));
    const direction=this.armTarget.clone().sub(shoulder);
    if(direction.lengthSq()<1e-8)return false;
    // Solve the actual two-bone triangle. Keep a slight elbow bend at full
    // reach, and never scale bones to reach a point outside the arm radius.
    const distance=THREE.MathUtils.clamp(direction.length(),Math.abs(a-b)+.001,(a+b)*.97);
    direction.normalize();
    const target=shoulder.clone().addScaledVector(direction,distance);
    const pole=new THREE.Vector3(.75,-1,.3).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()));
    pole.addScaledVector(direction,-pole.dot(direction));
    if(pole.lengthSq()<1e-6){pole.set(0,0,1);pole.addScaledVector(direction,-pole.dot(direction));}
    pole.normalize();
    const along=(a*a-b*b+distance*distance)/(2*distance);
    const elbowTarget=shoulder.clone().addScaledVector(direction,along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
    const aim=(bone,child,point)=>{
      bone.updateWorldMatrix(true,true);
      const pivot=bone.getWorldPosition(new THREE.Vector3());
      const current=child.getWorldPosition(new THREE.Vector3()).sub(pivot).normalize();
      const desired=point.clone().sub(pivot).normalize();
      const world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(current,desired));
      const local=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world);
      bone.quaternion.slerp(local,THREE.MathUtils.clamp(weight,0,1));
      bone.updateWorldMatrix(false,true);
    };
    aim(upper,fore,elbowTarget);
    aim(fore,hand,target);
    return true;
  }

  poseRig(pose, dt = .016, speed = 11) {
    if (!this.rigModel) return;
    const alpha = 1 - Math.exp(-speed * dt);
    Object.entries(pose).forEach(([name, angles]) => {
      const bone = this.rigBones[name];
      const base = this.rigBase[name];
      if (!bone || !base) return;
      const offset = new THREE.Quaternion().setFromEuler(new THREE.Euler(angles[0] || 0, angles[1] || 0, angles[2] || 0, 'XYZ'));
      const target = base.clone().multiply(offset);
      bone.quaternion.slerp(target, alpha);
    });
  }

  animateRigWalk(t) {
    if (!this.rigModel) return;
    const swing = Math.sin(t * 7.2);
    const liftL = Math.max(0, -swing);
    const liftR = Math.max(0, swing);
    this.rigModel.position.y = Math.abs(swing) * .026;
    this.poseRig({
      hips: [0, swing * .035, swing * .025],
      spine: [0, -swing * .025, -swing * .018],
      chest: [0, swing * .035, swing * .025],
      head: [0, -swing * .05, -swing * .025],
      'upper_arm.L': [swing * .14, 0, -1.08 + swing * .19],
      'forearm.L': [0, 0, -.18 - liftL * .22],
      'upper_arm.R': [-swing * .14, 0, 1.08 + swing * .19],
      'forearm.R': [0, 0, .18 + liftR * .22],
      'thigh.L': [swing * .34, 0, 0],
      'shin.L': [-liftL * .46, 0, 0],
      'foot.L': [liftL * .17, 0, 0],
      'thigh.R': [-swing * .34, 0, 0],
      'shin.R': [-liftR * .46, 0, 0],
      'foot.R': [liftR * .17, 0, 0]
    }, .016, 14);
  }

  animateRigPaint(wallY, targetX, spraying, dt) {
    if (!this.rigModel) return;
    this.paintBlend=THREE.MathUtils.damp(this.paintBlend,this.tagMove.active?.22:1,7,dt);
    const height = THREE.MathUtils.clamp((wallY - 2.45) / 1.45, -1, 1);
    const reach = THREE.MathUtils.clamp(targetX / 3, -1, 1);
    const crouch = Math.max(0, -height) * .11;
    const pulse = spraying ? Math.sin(performance.now() * .045) * .025 : 0;
    this.rigModel.position.y = THREE.MathUtils.damp(this.rigModel.position.y,this.tagMove.active?0:-crouch,10,dt);
    const pose = {
      hips: [.05 + crouch * .7, reach * .05, -reach * .035],
      spine: [-.09, -reach * .08, reach * .045],
      chest: [-.12 + height * .045, -reach * .12, reach * .07],
      neck: [.05, reach * .11, -reach * .03],
      head: [.02 - height * .08, reach * .18, -reach * .045],
      // Keep the free arm in the authored idle/step clip. The old offsets
      // were for the mannequin axes and held this Mixamo arm out sideways.
      'upper_arm.R': [-.72 - height * .38, -.22 - reach * .2, .34 + reach * .12],
      'forearm.R': [-.62 + height * .18, -.08, .18 + pulse],
      'hand.R': [0, 0, pulse * 1.8],
      'thigh.L': [-crouch * 1.8, 0, -.08],
      'shin.L': [-crouch * 2.4, 0, 0],
      'thigh.R': [-crouch * 1.2, 0, .08],
      'shin.R': [-crouch * 1.9, 0, 0]
    };
    // A committed tag step owns the pelvis and legs. The procedural spray
    // pose only keeps the torso, aiming arm and grip on target until the step
    // clip finishes; otherwise the step animation is flattened into a slide.
    if (this.tagMove.active) {
      delete pose.hips;
      delete pose['thigh.L']; delete pose['shin.L'];
      delete pose['thigh.R']; delete pose['shin.R'];
    }
    // Keep a persistent pose across mixer updates: damping from the freshly
    // reset idle every frame never actually completes the raising motion.
    const alpha=1-Math.exp(-10*dt);
    for(const [name,angles] of Object.entries(pose)){
      const bone=this.rigBones[name],base=this.rigBase[name];
      if(!bone||!base)continue;
      const target=base.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles)));
      const cached=this.paintPoseCache[name] ||= bone.quaternion.clone();
      cached.slerp(target,alpha);
      bone.quaternion.slerp(cached,this.paintBlend);
    }
  }

  body(drop=0, lean=0) {
    this.torso.position.y=1.68-drop; this.hem.position.y=1.14-drop; this.pelvis.position.y=.98-drop*.55;
    this.neck.position.y=2.23-drop; this.head.position.y=2.47-drop; this.hood.position.y=2.33-drop;
    this.cap.position.y=2.69-drop; this.brim.position.y=2.68-drop;
    this.leftStrap.position.y=this.rightStrap.position.y=1.7-drop;this.chestMark.position.y=1.72-drop;
    this.torso.rotation.x=lean;this.hem.rotation.x=lean*.5;
  }

  poseLimb(name,start,end){placeSegment(this.limbs[name],start,end);}
  setExtremities(handL,handR,footL,footR){
    this.hands.left.position.copy(handL);this.hands.right.position.copy(handR);
    this.shoes.left.position.copy(footL);this.shoes.right.position.copy(footR);
  }

  walk(t, z) {
    this.root.position.z = z;
    const swing = Math.sin(t * 7.2) * .48;
    const bounce=Math.abs(Math.sin(t*7.2))*.035;this.body(bounce,-.07);
    const hipL = new THREE.Vector3(-.2,1.02,0), hipR = new THREE.Vector3(.2,1.02,0);
    const kneeL = new THREE.Vector3(-.24,.56, swing*.24), kneeR = new THREE.Vector3(.24,.56,-swing*.24);
    const footL = new THREE.Vector3(-.25,.12,-swing*.42), footR = new THREE.Vector3(.25,.12,swing*.42);
    this.poseLimb('leftThigh',hipL,kneeL);this.poseLimb('leftShin',kneeL,footL);
    this.poseLimb('rightThigh',hipR,kneeR);this.poseLimb('rightShin',kneeR,footR);
    const shoulderL = new THREE.Vector3(-.42,2.04,0), shoulderR = new THREE.Vector3(.42,2.04,0);
    const elbowL = new THREE.Vector3(-.52,1.62,-swing*.22), elbowR = new THREE.Vector3(.52,1.62,swing*.22);
    const handL = new THREE.Vector3(-.43,1.28,-swing*.34), handR = new THREE.Vector3(.43,1.28,swing*.34);
    this.poseLimb('leftUpper',shoulderL,elbowL);this.poseLimb('leftLower',elbowL,handL);
    this.poseLimb('rightUpper',shoulderR,elbowR);this.poseLimb('rightLower',elbowR,handR);
    this.setExtremities(handL,handR,footL,footR);
    this.can.position.copy(handR);
    this.can.rotation.z = .1; this.can.rotation.x=.18;
    this.root.rotation.z = Math.sin(t*7.2)*.018;
    this.animateRigWalk(t);
  }

  paint(uv, panel, spraying, dt, autoMove = true) {
    const centerX = panel.x;
    this.root.position.y = THREE.MathUtils.damp(this.root.position.y, groundHeight(this.root.position.z), 12, dt);
    const wallX = centerX + (uv.x - .5) * panel.w;
    const wallY = panel.y + (uv.y - .5) * panel.h;
    this.updateTagMove(performance.now());
    if (autoMove) {
      // The rival uses the same complete step clips as the player. It cannot
      // slide continuously after the cursor/path target.
      const desiredX = THREE.MathUtils.clamp(wallX - .42, centerX - 2.8, centerX + 2.8);
      const desiredZ=WALL_Z+.34+1.35;
      if (!this.tagMove.active && Math.abs(this.root.position.x-desiredX)>.38) {
        const stepX=THREE.MathUtils.clamp(desiredX-this.root.position.x,-TAG_STEP_X,TAG_STEP_X);
        this.beginTagMove(this.root.position.x+stepX,desiredZ,performance.now());
      }
    }
    const localHand = new THREE.Vector3(wallX - this.root.position.x, wallY, -1.12);
    this.targetLocal.lerp(localHand, Math.min(1,dt*12));
    const crouch = Math.max(0,1.38-wallY)*.28;
    this.body(crouch,-.13);
    const shoulderR = new THREE.Vector3(.41,2.04-crouch,0);
    const elbowR = shoulderR.clone().lerp(this.targetLocal,.54).add(new THREE.Vector3(.22,.05,.23));
    this.poseLimb('rightUpper',shoulderR,elbowR);this.poseLimb('rightLower',elbowR,this.targetLocal);
    if(!this.canInHand){
      this.can.position.copy(this.targetLocal).add(new THREE.Vector3(0,-.03,.04));
      this.can.rotation.set(Math.PI/2,0,0);
    }
    const shoulderL = new THREE.Vector3(-.41,2.02-crouch,0);
    const handL = new THREE.Vector3(-.04,1.34-crouch*.5,-.36);
    const elbowL = new THREE.Vector3(-.34,1.57-crouch*.75,-.12);
    this.poseLimb('leftUpper',shoulderL,elbowL);this.poseLimb('leftLower',elbowL,handL);
    const hipL = new THREE.Vector3(-.2,1.02-crouch*.5,0), hipR = new THREE.Vector3(.2,1.02-crouch*.5,0);
    const stance=(this.targetLocal.x-.2)*.04;
    const kneeL = new THREE.Vector3(-.3,.56,-.13-crouch), kneeR = new THREE.Vector3(.29,.56,-.08-crouch*.8);
    const footL = new THREE.Vector3(-.34,.12,.09+stance), footR = new THREE.Vector3(.34,.12,.02-stance);
    this.poseLimb('leftThigh',hipL,kneeL);this.poseLimb('leftShin',kneeL,footL);
    this.poseLimb('rightThigh',hipR,kneeR);this.poseLimb('rightShin',kneeR,footR);
    this.setExtremities(handL,this.targetLocal,footL,footR);
    this.torso.rotation.z = (this.targetLocal.x-.3)*-.055;
    this.head.rotation.y = THREE.MathUtils.clamp((this.targetLocal.x)/3,-.35,.35);
    // Interaction root stays square to the wall. Reach is carried by authored
    // torso/arm poses and never rotates the whole player away from the plane.
    this.root.rotation.y=THREE.MathUtils.damp(this.root.rotation.y,0,8,dt);
    if (spraying) this.can.rotation.z = Math.sin(performance.now()*.04)*.018;
    // Getting Up uses a 3x3 pose grid per stance. Snap the authored body pose
    // to a row/column, then allow only a small IK correction to the live point.
    const column=THREE.MathUtils.clamp(Math.round((wallX-this.root.position.x)/.72),-1,1);
    const poseY=wallY<1.18?.9:(wallY>2.03?2.34:1.62);
    const poseX=this.root.position.x+column*.72;
    this.tagPose.x=THREE.MathUtils.damp(this.tagPose.x,poseX,11,dt);
    this.tagPose.y=THREE.MathUtils.damp(this.tagPose.y,poseY,11,dt);
    this.animateRigPaint(this.tagPose.y,this.tagPose.x-this.root.position.x,spraying,dt);
    const aimWorld = new THREE.Vector3(
      THREE.MathUtils.lerp(this.tagPose.x,wallX,.36),
      THREE.MathUtils.lerp(this.tagPose.y,wallY,.36),
      // Leave space between nozzle and wall instead of extending the wrist
      // all the way into the concrete.
      WALL_Z + .70
    );
    this.aimArmAt(aimWorld,dt,this.paintBlend);
  }

  nozzleWorld() {
    if(this.canMesh&&this.nozzleVertex!==undefined){
      this.canMesh.updateWorldMatrix(true,false);
      this.canMesh.skeleton.update();
      const point=new THREE.Vector3().fromBufferAttribute(this.canMesh.geometry.attributes.position,this.nozzleVertex);
      return this.canMesh.localToWorld(this.canMesh.applyBoneTransform(this.nozzleVertex,point));
    }
    if (this.canModel) return this.canModel.localToWorld(new THREE.Vector3(0, .11, 0));
    return this.root.localToWorld(this.can.position.clone().add(new THREE.Vector3(0,-.15,0)));
  }
}

const player = new Mannequin(0x303730,-4.05,false);
const opponent = new Mannequin(0x747d69,4.05,true);

async function loadCharacters() {
  const loader = new GLTFLoader();
  // Баллон уже вшит в эти файлы (собрано в Blender): у соперника
  // своя модель с другими анимациями, чтобы силуэты различались, а не только оттенок.
  const [playerGltf, opponentGltf] = await Promise.all([
    loader.loadAsync('assets/characters/writer_torb_final.glb?v=can-no-mask-7'),
    loader.loadAsync('assets/characters/writer_rival_final.glb?v=can-no-mask-7').catch(() => loader.loadAsync('assets/characters/writer_torb_final.glb?v=can-no-mask-7'))
  ]);
  player.attachRig(playerGltf.scene, playerGltf.animations || []);
  opponent.attachRig(opponentGltf.scene, opponentGltf.animations || []);
  player.playClip('idle',0); opponent.playClip('idle',0);
  if (opponent.actions.idle) { opponent.actions.idle.timeScale = .88; opponent.actions.idle.time = 1.4; }
  if (opponent.actions.walk) opponent.actions.walk.timeScale = 1.12;
  const names=(playerGltf.animations||[]).map(c=>c.name).join(', ');
  console.info(names?`SprayFight: клипы анимаций — ${names}`:'SprayFight: в GLB нет анимаций, работает процедурная поза.');
}

// Мягкая круглая точка для струи — иначе THREE.Points рисует квадраты
let sprayDot = null;
function sprayDotTexture() {
  if (sprayDot) return sprayDot;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = ctx2d(canvas);
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  gradient.addColorStop(0, 'rgba(255,255,255,.95)');
  gradient.addColorStop(.45, 'rgba(255,255,255,.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  sprayDot = new THREE.CanvasTexture(canvas);
  return sprayDot;
}

function createSprayParticles(color) {
  const count = 30;
  const positions = new Float32Array(count*3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material = new THREE.PointsMaterial({
    color, size:.03, transparent:true, opacity:.5, depthWrite:false,
    map: sprayDotTexture(), blending: THREE.AdditiveBlending, sizeAttenuation:true
  });
  const points = new THREE.Points(geometry,material);
  points.visible=false;
  scene.add(points);
  return points;
}

const playerSpray = createSprayParticles(0xb6ff00);
const aiSpray = createSprayParticles(0xaab09e);

function updateSprayParticles(points,start,end,visible) {
  points.visible=visible;
  if(!visible) return;
  const array=points.geometry.attributes.position.array;
  for(let i=0;i<array.length/3;i+=1){
    const t=Math.random();
    const spread=t*.12;
    array[i*3]=THREE.MathUtils.lerp(start.x,end.x,t)+(Math.random()-.5)*spread;
    array[i*3+1]=THREE.MathUtils.lerp(start.y,end.y,t)+(Math.random()-.5)*spread;
    array[i*3+2]=THREE.MathUtils.lerp(start.z,end.z,t)+(Math.random()-.5)*spread;
  }
  points.geometry.attributes.position.needsUpdate=true;
}

function worldToUv(x,y,panel){ return new THREE.Vector2((x-panel.x)/panel.w+.5,(y-panel.y)/panel.h+.5); }

// Центр зоны досягаемости: где сейчас стоит райтер и на какой высоте держит баллон
function reachCenter(){
  const handY=THREE.MathUtils.clamp(1.42-state.crouch*.5+state.tiptoe*.34,REACH_DOWN,REACH_UP);
  const standingX=(typeof player!=='undefined'&&player.root)?player.root.position.x:state.walkX;
  return worldToUv(standingX,handY,state.panel||playerSurface);
}

// Прицел ограничен вытянутой рукой: до остального нужно дойти или присесть
function clampToReach(uv){
  const center=reachCenter();
  const panel=state.panel||playerSurface;
  const dx=(uv.x-center.x)*panel.w, dy=(uv.y-center.y)*panel.h;
  const rx=REACH_X, ry=1.02+state.tiptoe*.22;
  const k=Math.hypot(dx/rx,dy/ry);
  if(k<=1) return uv.clone();
  return new THREE.Vector2(center.x+(dx/k)/panel.w,center.y+(dy/k)/panel.h);
}

function uvToWorld(uv,panel){ return new THREE.Vector3(panel.x+(uv.x-.5)*panel.w,panel.y+(uv.y-.5)*panel.h,panel.z+.34); }

let audio=null;
function ensureAudio(){
  if(audio){ if(audio.ctx.state==='suspended')audio.ctx.resume(); return; }
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  const ctx=new AC(); const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate); const data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i+=1)data[i]=Math.random()*2-1;
  const source=ctx.createBufferSource(); source.buffer=buffer; source.loop=true;
  const filter=ctx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.value=3900; filter.Q.value=.72;
  const gain=ctx.createGain(); gain.gain.value=0; source.connect(filter).connect(gain).connect(ctx.destination); source.start();
  audio={ctx,gain,lastShake:0,noise:buffer};
}
function spraySound(active){ if(!audio)return; audio.gain.gain.setTargetAtTime(active && state.sound ? .075 : 0,audio.ctx.currentTime,.025); }
function rattle(){
  if(!audio||!state.sound)return;
  const ctx=audio.ctx, t=ctx.currentTime;
  // удар шарика о стенку: два коротких металлических тона
  for(const [freq,gainValue,decay] of [[2100+Math.random()*900,.06,.018],[4300+Math.random()*1200,.03,.012]]){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(freq,t);
    o.frequency.exponentialRampToValueAtTime(freq*.72,t+decay);
    g.gain.setValueAtTime(gainValue,t); g.gain.exponentialRampToValueAtTime(.0005,t+decay);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t+decay+.01);
  }
  // и лёгкий шорох краски внутри
  const src=ctx.createBufferSource(); src.buffer=audio.noise;
  const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1500+Math.random()*800; bp.Q.value=1.4;
  const g=ctx.createGain(); g.gain.setValueAtTime(.035,t); g.gain.exponentialRampToValueAtTime(.0005,t+.05);
  src.connect(bp).connect(g).connect(ctx.destination); src.start(t,Math.random()*1.5,.06);
}

function hit(freq=120){ if(!audio||!state.sound)return; const o=audio.ctx.createOscillator(),g=audio.ctx.createGain(); o.type='square'; o.frequency.value=freq; g.gain.setValueAtTime(.055,audio.ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001,audio.ctx.currentTime+.14); o.connect(g).connect(audio.ctx.destination); o.start(); o.stop(audio.ctx.currentTime+.15); }

async function loadArt(){
  const [aFill,bFinal,bLines]=await Promise.all([
    imageLoad('assets/spray-green.png'),
    imageLoad('assets/writer-b-final.png'), imageLoad('assets/writer-b-lines.png')
  ]);
  // Player follows the current SPRAY artwork only. The old writer-a-base had
  // a different silhouette and created the wrong combined sketch.
  playerSurface.compose([aFill]);
  aiSurface.compose([bFinal,bLines]);
  state.aiRoute=aiSurface.route();
}

function setCap(cap){ state.cap=cap; $$('.cap').forEach(b=>b.classList.toggle('is-active',b.dataset.cap===cap)); ui.game.classList.toggle('skinny',cap==='skinny'); }

function reset(){
  surfaces.forEach(s=>s.reset());
  Object.assign(state,{phase:'idle',running:false,finished:false,pointerDown:false,shaking:false,cap:'fat',pressure:100,drips:0,clean:100,coverage:0,aiCoverage:0,aiClean:96,aiDrips:0,remaining:ROUND_SECONDS,stationary:0,lastDrip:0,aiIndex:0,aiUv:new THREE.Vector2(.5,.5),aiPauseUntil:0,aiPressure:100,aiShaking:false,aiStationary:0,aiLastDrip:0,aiWander:new THREE.Vector2(0,0),aiApproachX:RIVAL_CENTER,aiNextStep:0,aiBurstUntil:0,aiRestUntil:0,beat:null,beatsDone:{},camShake:0});
  player.root.position.set(PLAYER_CENTER,0,WALL_Z+.34+7.2); opponent.root.position.set(RIVAL_IDLE_X,0,RIVAL_IDLE_Z);
  player.root.rotation.y=0; opponent.root.rotation.y=Math.PI;  // повёрнут к игроку
  player.resetMotion(); opponent.resetMotion();
  state.aiApproachX=RIVAL_IDLE_X;
  Object.assign(state,{keys:{},walkX:PLAYER_CENTER,standZ:7.2,crouch:0,tiptoe:0,nearWall:false,canUp:false,
    mode:'roam',panel:null,nearRival:false,talking:false});
  state.aimUv.set(.5,.5); state.reachUv.set(.5,.5);
  ui.game.classList.remove('can-tag','can-talk','out-of-reach');
  ui.game.classList.add('roam-mode');
  camera.position.set(-1.25,3.55,9.2);
  ui.clock.classList.remove('critical'); ui.game.classList.remove('paint-mode','spraying','skinny');
  ui.resultModal.classList.remove('is-visible'); ui.resultCard.classList.remove('loss');
  state.aiRoute=aiSurface.route();state.roundSeconds=playerSurface.roundSeconds;
  state.remaining=state.roundSeconds;
  setCap('fat'); updateHud();updateTimer();
}

async function start(){
  try { reset(); } catch (error) { console.error('SprayFight reset failed; starting with current state.', error); }
  ui.startModal.classList.remove('is-visible');
  try { ensureAudio(); } catch (error) { console.warn('Audio unavailable; continuing silently.', error); }
  state.phase='approach'; state.phaseStarted=performance.now(); ui.objective.textContent='WALK — W A S D · SHIFT TO RUN';
}

async function beginCountdown(){
  if(state.phase==='countdown')return;
  state.phase='countdown'; state.phaseStarted=performance.now();
  camera.position.copy(WIDE_POS); state.cameraLook=WIDE_LOOK.clone();
  ui.countdown.classList.add('visible');
  for(const value of ['3','2','1','GO']){
    ui.countdownText.textContent=value; hit(value==='GO'?210:110);
    await new Promise(r=>setTimeout(r,value==='GO'?500:720));
  }
  ui.countdown.classList.remove('visible');
  state.phase='paint'; state.running=true; state.roundStarted=performance.now(); state.lastMetric=state.roundStarted;
  ui.game.classList.add('paint-mode'); ui.objective.textContent='A/D STEP · W/S DISTANCE · C CROUCH · HOLD TO SPRAY';
}

// Короткие акценты камеры между ключевыми моментами раунда
function triggerBeat(kind, now){
  if(state.beatsDone[kind])return;
  state.beatsDone[kind]=true;
  const beats={
    // соперник вырвался вперёд — показываем его работу
    rivalLead:{
      position:new THREE.Vector3(RIVAL_CENTER+1.35,2.2,WALL_Z+2.6),
      look:new THREE.Vector3(RIVAL_CENTER,PANEL_Y,WALL_Z+.3),
      hold:1700
    },
    // половина работы — нижний ракурс вдоль стены
    halfway:{
      position:new THREE.Vector3(PLAYER_CENTER-2.5,.92,WALL_Z+1.5),
      look:new THREE.Vector3(PLAYER_CENTER+1.2,PANEL_Y,WALL_Z+.3),
      hold:1500
    },
    // последние секунды — отход назад, видно обе стены
    finalTen:{
      position:new THREE.Vector3(PLAYER_CENTER+1.9,2.75,WALL_Z+4.4),
      look:new THREE.Vector3(PLAYER_CENTER+1.4,PANEL_Y,WALL_Z+.3),
      hold:2200
    }
  };
  const beat=beats[kind];
  if(!beat)return;
  state.beat={...beat,until:now+beat.hold};
  hit(320);
}

function updateApproach(now,dt){
  // Свободный подход: райтер идёт к стене сам, раунд стартует по E
  const k=state.keys;
  const speedX=(k.KeyD?1:0)-(k.KeyA?1:0);
  const speedZ=(k.KeyS?1:0)-(k.KeyW?1:0);
  const running=!!(k.ShiftLeft||k.ShiftRight);
  const moving=player.updateLocomotion(
    speedX,speedZ,running,now,dt,
    ROAM_X_MIN,ROAM_X_MAX,
    WALL_Z+.34+WALL_STAND_MIN,WALL_Z+.34+ROAM_Z_MAX
  );
  state.walkX=player.root.position.x;
  state.standZ=player.root.position.z-(WALL_Z+.34);
  // The rival is already at his panel. He waits, shifts his weight and only
  // occasionally takes one or two slow lateral steps instead of marching
  // straight into the wall.
  if(now>=state.aiNextStep){
    const takeStep=Math.random()<.58;
    const home=state.mode==='battle'?RIVAL_CENTER:RIVAL_IDLE_X;
    state.aiApproachX=takeStep
      ? THREE.MathUtils.clamp(home+(Math.random()-.5)*1.1,home-.75,home+.75)
      : opponent.root.position.x;
    state.aiNextStep=now+1800+Math.random()*3200;
  }
  if(!opponent.tagMove.active&&Math.abs(opponent.root.position.x-state.aiApproachX)>.12){
    const dx=THREE.MathUtils.clamp(state.aiApproachX-opponent.root.position.x,-TAG_STEP_X,TAG_STEP_X);
    opponent.beginTagMove(opponent.root.position.x+dx,state.mode==='battle'?WALL_Z+.34+1.5:RIVAL_IDLE_Z,now);
  }
  const rivalMoving=opponent.updateTagMove(now);
  if(!rivalMoving)opponent.playClip('idle',.35);

  // Рядом ли хоть одна стена локации (раньше проверялся только отход по Z
  // от единственной панели, из-за чего вторая стена была «недостижима»).
  state.nearWall=nearestPanel().distance<=WALL_STAND_MAX;
  // Подошёл к сопернику — можно заговорить; это единственный вход в батл.
  state.nearRival=player.root.position.distanceTo(opponent.root.position)<TALK_RANGE;
  ui.game.classList.toggle('can-talk',state.nearRival&&state.mode==='roam');
  ui.game.classList.toggle('can-tag',state.nearWall&&!state.nearRival);
  ui.objective.textContent=
      state.nearRival ? 'PRESS E TO TALK'
    : state.nearWall  ? 'PRESS E TO TAG THIS WALL'
    : 'WALK — W A S D · SHIFT TO RUN';
  // Подпись тач-кнопки следует за тем же выбором
  ui.enterTagBtn.textContent=state.nearRival?'TALK':'TAP TO TAG';

  // Камера через плечо
  const z=player.root.position.z;
  const target=new THREE.Vector3(state.walkX-.35,2.05,z+3.15);
  camera.position.lerp(target,Math.min(1,dt*3.4));
  state.cameraLook=new THREE.Vector3(state.walkX,1.85,z-1.4);
}

// Ближайшая стена локации. Перебирается весь список WALLS, расстояние — по
// горизонтали до центра панели плюс отход от её плоскости, поэтому добавление
// новой стены ничего здесь менять не требует.
function panelDistance(surface){
  const pos=player.root.position;
  const dx=Math.max(0,Math.abs(pos.x-surface.x)-surface.w/2);
  const dz=Math.abs(pos.z-surface.z);
  return Math.hypot(dx,dz);
}
function nearestPanel(){
  let best=surfaces[0],bestD=Infinity;
  for(const surface of surfaces){
    const d=panelDistance(surface);
    if(d<bestD){bestD=d;best=surface;}
  }
  return {surface:best,distance:bestD};
}

function enterTagging(){
  if(state.phase!=='approach'||!state.nearWall||state.nearRival)return;
  state.panel=nearestPanel().surface;
  state.standZ=Math.min(state.standZ,1.35);
  ui.game.classList.remove('can-tag'); // иначе кнопка TAP TO TAG виснет и во время рисования
  player.root.rotation.y=0;
  player.beginTagMove(player.root.position.x,WALL_Z+.34+state.standZ,performance.now());
  state.aimUv.set(.5,.5); state.reachUv.set(.5,.5); state.lastUv.copy(state.reachUv);
  if(state.mode==='battle'){ beginCountdown(); return; }
  // Свободный режим: рисуем сразу, без отсчёта, таймера и счёта.
  state.phase='paint'; state.running=true; state.roundStarted=performance.now(); state.lastMetric=state.roundStarted;
  ui.game.classList.add('paint-mode'); ui.enterTagBtn.textContent='STEP BACK';
  ui.objective.textContent='A/D STEP · W/S DISTANCE · C CROUCH · HOLD TO SPRAY · E TO STEP BACK';
}

// Отойти от стены и вернуться к свободному перемещению
function exitTagging(){
  if(state.phase!=='paint'||state.mode==='battle')return;
  state.phase='approach'; state.running=false; state.pointerDown=false; state.shaking=false;
  spraySound(false); playerSpray.visible=false;
  ui.game.classList.remove('paint-mode','spraying','out-of-reach');
  player.beginTagMove(player.root.position.x,WALL_Z+.34+2.6,performance.now());
}

// Шаги вдоль стены и приседание уже во время раунда
function updateTagMovement(now,dt){
  const k=state.keys;
  const strafe=(k.KeyD?1:0)-(k.KeyA?1:0);
  const depth=(k.KeyS?1:0)-(k.KeyW?1:0);
  player.updateTagMove(now);
  if(!player.tagMove.active&&(strafe||depth)){
    const nextX=THREE.MathUtils.clamp(player.root.position.x+strafe*TAG_STEP_X,(state.panel||playerSurface).x-(state.panel||playerSurface).w/2+.5,(state.panel||playerSurface).x+(state.panel||playerSurface).w/2-.5);
    const currentStand=player.root.position.z-(WALL_Z+.34);
    const nextStand=THREE.MathUtils.clamp(currentStand+depth*TAG_STEP_Z,WALL_STAND_MIN,2.15);
    player.beginTagMove(nextX,WALL_Z+.34+nextStand,now);
  }
  // Reach and spray width follow the actual body, not the pending step target.
  state.walkX=player.root.position.x;
  state.standZ=player.root.position.z-(WALL_Z+.34);
  const wantCrouch=k.KeyC||k.ControlLeft?1:0;
  const wantTiptoe=(k.ShiftLeft||k.ShiftRight)?1:0;
  state.crouch=THREE.MathUtils.damp(state.crouch,wantCrouch,9,dt);
  state.tiptoe=THREE.MathUtils.damp(state.tiptoe,wantTiptoe,9,dt);
}

function stepAi(now,dt){
  if(!state.aiRoute.length||aiSurface.complete)return false;

  // Short painting bursts separated by observation pauses make the rival read
  // as another writer, not a path-following machine.
  if(now<state.aiRestUntil){aiSurface.drips.release();return false;}
  if(!state.aiBurstUntil)state.aiBurstUntil=now+1100+Math.random()*1500;
  if(now>=state.aiBurstUntil){
    aiSurface.drips.release();
    state.aiRestUntil=now+420+Math.random()*1050;
    state.aiBurstUntil=state.aiRestUntil+900+Math.random()*1800;
    return false;
  }

  // Пауза: соперник трясёт баллон, пока не наберёт давление
  if(now<state.aiPauseUntil){
    aiSurface.drips.release();
    state.aiShaking=true;
    state.aiPressure=Math.min(100,state.aiPressure+46*dt);
    return false;
  }
  state.aiShaking=false;

  // Баллон кончился — уходит трясти
  if(state.aiPressure<10){
    state.aiPauseUntil=now+1100+Math.random()*700;
    return false;
  }

  const target=state.aiRoute[state.aiIndex%state.aiRoute.length];

  // Рука не идеальна: лёгкое блуждание вокруг линии
  state.aiWander.set(
    THREE.MathUtils.damp(state.aiWander.x,(Math.random()-.5)*.012,2.2,dt),
    THREE.MathUtils.damp(state.aiWander.y,(Math.random()-.5)*.012,2.2,dt)
  );
  const aim=target.clone().add(state.aiWander);

  const speed=(.34+Math.random()*.18)*dt;
  const before=state.aiUv.clone();
  state.aiUv.lerp(aim,Math.min(1,speed));
  const moved=state.aiUv.distanceTo(before);

  state.aiPressure=Math.max(0,state.aiPressure-8.4*dt);
  const strength=Math.max(.32,state.aiPressure/100);
  const radius=44+ (1-strength)*14;

  // Непрерывный след, как у игрока
  const stepUv=(radius*.25)/TEX_W;
  const steps=Math.min(18,Math.max(1,Math.ceil(moved/Math.max(stepUv,1e-4))));
  const point=new THREE.Vector2();
  for(let i=1;i<=steps;i+=1){
    point.copy(before).lerp(state.aiUv,i/steps);
    aiSurface.spray(point,radius,strength/Math.sqrt(steps));
  }

  // Залипание на месте — потёк, как и у игрока
  state.aiStationary=moved<.004?state.aiStationary+dt:Math.max(0,state.aiStationary-dt*3);
  if(aiSurface.holdDrip(state.aiUv,dt,now))state.aiDrips+=1;

  if(state.aiUv.distanceTo(aim)<.015){
    state.aiIndex+=1;
    // иногда останавливается посмотреть на работу
    if(state.aiIndex%24===0)state.aiPauseUntil=now+520+Math.random()*900;
  }
  return true;
}

function stepPlayer(now,dt){
  const surface=state.panel||playerSurface;
  const spraying=state.pointerDown&&!state.shaking&&state.pressure>1&&!player.tagMove.active&&player.paintBlend>.92&&!surface.complete;
  ui.game.classList.toggle('spraying',spraying); spraySound(spraying);
  if(state.shaking&&!state.pointerDown){ state.pressure=Math.min(100,state.pressure+43*dt); if(audio&&now-audio.lastShake>(75+Math.random()*40)){audio.lastShake=now;rattle();} }
  if(!spraying){ surface.drips.release(); state.stationary=0; state.lastUv.copy(state.reachUv); return false; }
  state.pressure=Math.max(0,state.pressure-(state.cap==='fat'?7:4.6)*dt);

  // Дистанция до стены: вплотную — узкая плотная линия, издалека — широкий мягкий факел
  const near=THREE.MathUtils.clamp((state.standZ-WALL_STAND_MIN)/(2.15-WALL_STAND_MIN),0,1);
  const base=state.cap==='fat'?31:17;
  const radius=base*(.62+near*.85);
  const strength=Math.max(.35,state.pressure/100)*(1-near*.34);

  const distance=state.reachUv.distanceTo(state.lastUv);
  state.stationary=distance<.012?state.stationary+dt:Math.max(0,state.stationary-dt*3);

  // Непрерывная линия вместо отпечатков: шаг по следу — четверть радиуса факела
  const stepUv=(radius*.25)/TEX_W;
  const steps=Math.min(24,Math.max(1,Math.ceil(distance/Math.max(stepUv,1e-4))));
  const point=new THREE.Vector2();
  for(let i=1;i<=steps;i++){
    point.copy(state.lastUv).lerp(state.reachUv,i/steps);
    (state.panel||playerSurface).spray(point,radius,strength/Math.sqrt(steps));
  }

  // Continuous dwell selects a fixed point from this wall's original DripMap.
  if(surface.holdDrip(state.reachUv,dt,now)){state.drips+=1;hit(60);state.camShake=.22;}
  state.lastUv.copy(state.reachUv);
  return true;
}

function updateMetrics(){
  const previousStage=aiSurface.stage;
  const p=(state.mode==='battle'?playerSurface:(state.panel||playerSurface)).metrics(),a=aiSurface.metrics();
  if(aiSurface.stage!==previousStage){state.aiRoute=aiSurface.route();state.aiIndex=0;}
  state.coverage=p.coverage; state.aiCoverage=a.coverage; state.clean=Math.max(0,100-state.drips*3.2-p.outside*.12); state.aiClean=Math.max(0,98-state.aiDrips*3.2-a.outside*.1);
  updateHud();
  if(state.mode!=='battle')return;   // в свободном режиме никто не побеждает
  if(state.coverage>=TARGET_COVERAGE&&state.clean>=70)finish('player');
  else if(state.aiCoverage>=TARGET_COVERAGE&&state.aiClean>=70)finish('ai');
}

function updatePaint(now,dt){
  const battle=state.mode==='battle';
  if(battle)state.remaining=Math.max(0,state.roundSeconds-(now-state.roundStarted)/1000);
  updateTagMovement(now,dt);
  state.reachUv.copy(clampToReach(state.aimUv));
  state.canUp=state.aimUv.distanceTo(state.reachUv)>.004;
  ui.game.classList.toggle('out-of-reach',state.canUp);
  const playerActive=stepPlayer(now,dt),aiActive=battle?stepAi(now,dt):false;
  if(!player.tagMove.active)player.playClip(state.crouch>.5?'crouch':'idle',.2,{timeScale:state.crouch>.5?.22:1});
  if(!opponent.tagMove.active)opponent.playClip('idle',.2);
  player.paint(state.reachUv,state.panel||playerSurface,playerActive,dt,false);
  if(state.mode==='battle')opponent.paint(state.aiUv,aiSurface,aiActive,dt);
  const playerTarget=uvToWorld(state.reachUv,state.panel||playerSurface),aiTarget=uvToWorld(state.aiUv,aiSurface);
  updateSprayParticles(playerSpray,player.nozzleWorld(),playerTarget,playerActive);
  updateSprayParticles(aiSpray,opponent.nozzleWorld(),aiTarget,aiActive);
  if(playerActive||state.shaking)(state.panel||playerSurface).update();
  if(aiActive)aiSurface.update();
  if(now-state.lastMetric>430){state.lastMetric=now;updateMetrics();}
  if(battle){
    if(state.aiCoverage>state.coverage+8&&state.coverage>4)triggerBeat('rivalLead',now);
    if(state.coverage>=50)triggerBeat('halfway',now);
    if(state.remaining<=10)triggerBeat('finalTen',now);
    if(state.remaining<=0)finish('time');
    updateTimer();
  }
}

// Разговор с соперником — единственный вход в соревнование.
// Пока это заглушка на одну реплику; сюда встанет нормальная диалоговая система.
async function talkToRival(){
  if(state.talking||state.mode!=='roam'||!state.nearRival)return;
  state.talking=true;
  const lines=['— Ты кто такой?','— Хочешь стену? Забирай. Если возьмёшь.','— Тогда батл. Погнали.'];
  for(const line of lines){
    ui.objective.textContent=line;
    await new Promise(r=>setTimeout(r,1500));
  }
  state.talking=false;
  startBattle();
}

// Переход из песочницы в прежний соревновательный раунд
function startBattle(){
  state.mode='battle';
  surfaces.forEach(s=>s.reset());
  Object.assign(state,{coverage:0,aiCoverage:0,clean:100,aiClean:96,drips:0,aiDrips:0,
    pressure:100,aiPressure:100,roundSeconds:playerSurface.roundSeconds,remaining:playerSurface.roundSeconds,finished:false,beatsDone:{},beat:null});
  state.aiRoute=aiSurface.route();state.aiIndex=0;
  state.aiRestUntil=state.aiBurstUntil=state.aiPauseUntil=0;
  updateTimer();
  ui.game.classList.remove('can-talk','roam-mode');
  state.panel=playerSurface;
  player.root.position.x=THREE.MathUtils.clamp(player.root.position.x,PLAYER_CENTER-2.2,PLAYER_CENTER+2.2);
  opponent.root.position.set(RIVAL_CENTER,0,WALL_Z+.34+1.5);
  state.nearWall=true; state.nearRival=false;
  enterTagging();
}

function updateTimer(){ const seconds=Math.ceil(state.remaining); ui.clock.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; ui.clock.classList.toggle('critical',seconds<=10&&state.running); }
function updateHud(){
  const panel=state.panel||playerSurface;
  $('#playerLayer').textContent=panel.complete?'COMPLETE':STAGES[panel.stage].name;
  $('#aiLayer').textContent=aiSurface.complete?'COMPLETE':STAGES[aiSurface.stage].name;
  $('#battleTime').textContent=`${playerSurface.roundSeconds} SECONDS / BATTLE`;
  ui.playerCoverage.textContent=Math.floor(state.coverage); ui.aiCoverage.textContent=Math.floor(state.aiCoverage); ui.playerProgress.style.width=`${Math.min(100,state.coverage)}%`; ui.aiProgress.style.width=`${Math.min(100,state.aiCoverage)}%`; ui.pressure.style.width=`${state.pressure}%`; ui.pressure.classList.toggle('low',state.pressure<25); ui.pressureNumber.textContent=Math.round(state.pressure); ui.clean.textContent=Math.round(state.clean); ui.drips.textContent=state.drips; ui.shake.classList.toggle('active',state.shaking);
}
function score(coverage,clean,drips,bonus=0){return Math.max(0,Math.round(coverage*.58+clean*.32-drips*1.4+bonus));}

function finish(reason){
  if(state.finished)return; state.finished=true; state.running=false; state.pointerDown=false; state.shaking=false; state.phase='result'; spraySound(false); playerSpray.visible=false; aiSpray.visible=false; updateMetrics();
  const timeBonus=Math.min(10,10*state.remaining/state.roundSeconds);
  const ps=score(state.coverage,state.clean,state.drips,reason==='player'?timeBonus:0); const as=score(state.aiCoverage,state.aiClean,state.aiDrips,reason==='ai'?timeBonus:0);
  const win=reason==='player'||(reason==='time'&&ps>=as); ui.resultTitle.textContent=win?'YOU WIN':'OPPONENT WINS'; ui.resultCard.classList.toggle('loss',!win); ui.playerScore.textContent=ps; ui.aiScore.textContent=as; ui.playerMeta.textContent=`${Math.floor(state.coverage)}% / ${state.drips} DRIPS`; ui.aiMeta.textContent=`${Math.floor(state.aiCoverage)}% / ${state.aiDrips} DRIPS`;
  setTimeout(()=>ui.resultModal.classList.add('is-visible'),600); hit(win?260:75);
}

function updatePointer(event){
  const rect=ui.scene.getBoundingClientRect(); state.pointerNdc.x=((event.clientX-rect.left)/rect.width)*2-1; state.pointerNdc.y=-((event.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(state.pointerNdc,camera); const hit=raycaster.intersectObject((state.panel||playerSurface).mesh,false)[0];
  if(hit?.uv){
    state.pointerUv.copy(hit.uv); state.aimUv.copy(hit.uv);
    const reachable=clampToReach(state.aimUv);
    const world=uvToWorld(reachable,state.panel||playerSurface).project(camera);
    ui.crosshair.style.left=`${(world.x*.5+.5)*window.innerWidth}px`;
    ui.crosshair.style.top=`${(-world.y*.5+.5)*window.innerHeight}px`;
  }
}

function animate(){
  requestAnimationFrame(animate); const dt=Math.min(.05,clock.getDelta()); const now=performance.now();
  player.updateMixer(dt); opponent.updateMixer(dt);
  if(state.phase==='idle'){ if(!player.playClip('idle'))player.walk(now/1000,3.6); if(!opponent.playClip('idle'))opponent.walk(now/1000+.4,3.6); }
  else if(state.phase==='approach')updateApproach(now,dt);
  else if(state.phase==='countdown'){
    if(!player.tagMove.active)player.playClip('idle');
    if(!opponent.tagMove.active)opponent.playClip('idle');
    player.paint(new THREE.Vector2(.5,.5),state.panel||playerSurface,false,dt,false);
    opponent.paint(new THREE.Vector2(.5,.5),aiSurface,false,dt);
    // пролёт от общего плана к рабочей позиции за плечом
    const t=smoothstep(Math.min(1,(now-state.phaseStarted)/2600));
    const shoulder=new THREE.Vector3(state.walkX+1.15,2.05,WALL_Z+.34+state.standZ+2.1);
    camera.position.lerpVectors(WIDE_POS,shoulder,t);
    state.cameraLook=WIDE_LOOK.clone().lerp(new THREE.Vector3(state.walkX,PANEL_Y,WALL_Z+.3),t);
  }
  else if(state.phase==='paint')updatePaint(now,dt);
  else if(state.phase==='result'){
    player.playClip('idle');opponent.playClip('idle');
    camera.position.lerp(WIDE_POS,Math.min(1,dt*1.6));
    state.cameraLook=(state.cameraLook||WIDE_LOOK.clone()).lerp(WIDE_LOOK,Math.min(1,dt*1.8));
  }
  if(state.phase==='paint'&&state.beat){
    // акцентный ракурс: держим его, пока не истечёт, потом возвращаемся за плечо
    if(now>state.beat.until) state.beat=null;
    else {
      camera.position.lerp(state.beat.position,Math.min(1,dt*2.6));
      state.cameraLook=(state.cameraLook||state.beat.look.clone()).lerp(state.beat.look,Math.min(1,dt*3));
    }
  }
  if(state.phase==='paint'&&!state.beat){
    const handheldX=Math.sin(now*.0017)*.035,handheldY=Math.sin(now*.0023)*.025;
    // держим соперника в кадре: камера смещена в сторону его стены и отведена назад
    camera.position.x=THREE.MathUtils.damp(camera.position.x,state.walkX+1.55+handheldX,3.2,dt);
    camera.position.y=THREE.MathUtils.damp(camera.position.y,2.15-state.crouch*.4+handheldY,3,dt);
    camera.position.z=THREE.MathUtils.damp(camera.position.z,WALL_Z+.34+state.standZ+2.75,2.8,dt);
  }
  if(state.phase==='paint'&&!state.beat){
    // взгляд между точкой краски и серединой между двумя стенами — соперник остаётся сбоку
    const between=new THREE.Vector3(state.walkX+1.1,PANEL_Y,WALL_Z+.3);
    state.cameraLook=uvToWorld(state.reachUv,state.panel||playerSurface).lerp(between,.5);
  }

  // AnimationMixer rewrites the finger transforms every frame, so apply the
  // closed grip afterwards and immediately before rendering.
  player.applyCanGrip(); opponent.applyCanGrip();

  // Тряска на потёке — короткая, затухающая
  if(state.camShake>.001){
    state.camShake=Math.max(0,state.camShake-dt*.9);
    camera.position.x+=(Math.random()-.5)*state.camShake*.22;
    camera.position.y+=(Math.random()-.5)*state.camShake*.18;
  }
  const look=(state.phase==='approach'||state.phase==='paint'||state.phase==='countdown'||state.phase==='result')&&state.cameraLook
    ? state.cameraLook
    : new THREE.Vector3(state.phase==='paint'?-1.0:0,state.phase==='paint'?2.35:2.15,-8.05);
  if(now-(state.lastTrace||0)>2000&&state.phase==='paint'){
    state.lastTrace=now;
    console.info('SprayFight бот: маршрут=%d индекс=%d давление=%s пауза_через=%s aiUv=%s,%s покрытие=%s%% дрипы=%d',
      state.aiRoute.length, state.aiIndex, state.aiPressure.toFixed(1),
      (state.aiPauseUntil-now).toFixed(0), state.aiUv.x.toFixed(3), state.aiUv.y.toFixed(3),
      state.aiCoverage.toFixed(1), state.aiDrips);
  }
  camera.lookAt(look);
  for(const surface of surfaces)surface.animateDrips(now);
  renderer.render(scene,camera);
}

ui.scene.addEventListener('pointermove',updatePointer);
ui.scene.addEventListener('pointerdown',(e)=>{if(!state.running)return;updatePointer(e);state.pointerDown=true;state.shaking=false;state.lastUv.copy(state.pointerUv);ui.scene.setPointerCapture(e.pointerId);});
const stopPointer=()=>{state.pointerDown=false;state.stationary=Math.max(0,state.stationary-.18);};
ui.scene.addEventListener('pointerup',stopPointer);ui.scene.addEventListener('pointercancel',stopPointer);
$$('.cap').forEach(button=>button.addEventListener('click',()=>setCap(button.dataset.cap)));
ui.shake.addEventListener('pointerdown',(e)=>{e.preventDefault();if(!state.running)return;state.pointerDown=false;state.shaking=true;});
['pointerup','pointercancel','pointerleave'].forEach(name=>ui.shake.addEventListener(name,()=>state.shaking=false));
ui.shake.addEventListener('click',()=>{if(!state.running)return;state.pointerDown=false;state.shaking=true;setTimeout(()=>{state.shaking=false;},720);});
window.addEventListener('keydown',(e)=>{
  state.keys[e.code]=true;
  if(e.code==='Digit1')setCap('fat');
  if(e.code==='Digit2')setCap('skinny');
  if(e.code==='KeyE'){
    if(state.phase==='paint')exitTagging();
    else if(state.nearRival)talkToRival();
    else enterTagging();
  }
  if(e.code==='Escape')exitTagging();
  if(['KeyW','KeyA','KeyS','KeyD','KeyC'].includes(e.code))e.preventDefault();
  if(e.code==='Space'&&state.running){e.preventDefault();state.pointerDown=false;state.shaking=true;}
});
window.addEventListener('keyup',(e)=>{state.keys[e.code]=false;if(e.code==='Space')state.shaking=false;});
window.addEventListener('blur',()=>{state.keys={};});
ui.sound.addEventListener('click',()=>{state.sound=!state.sound;ui.sound.textContent=state.sound?'SOUND ON':'SOUND OFF';ui.sound.setAttribute('aria-pressed',String(state.sound));if(!state.sound)spraySound(false);});
ui.start.addEventListener('click',start);ui.restart.addEventListener('click',start);
window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight,false);renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));});

// ===== Touch controls: телефон/планшет без клавиатуры =====
// Джойстик и кнопки не заводят новую логику движения — они просто выставляют
// те же state.keys.KeyW/A/S/D/C/ShiftLeft, которые уже читают updateApproach()
// и updateTagMovement(). Так исключён риск разойтись с логикой Codex.
const touchCapable = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
if (touchCapable) ui.game.classList.add('touch-input');

(function setupJoystick(){
  const base = ui.joystick, stick = ui.joystickStick;
  const RADIUS = 40, DEAD = .28; // мёртвая зона от центра, доля радиуса
  let activeId = null, originX = 0, originY = 0;

  const setDirection = (dx, dy) => {
    state.keys.KeyD = dx > DEAD; state.keys.KeyA = dx < -DEAD;
    state.keys.KeyS = dy > DEAD; state.keys.KeyW = dy < -DEAD;
  };
  const clearDirection = () => { state.keys.KeyW = state.keys.KeyA = state.keys.KeyS = state.keys.KeyD = false; };

  base.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    activeId = e.pointerId; base.setPointerCapture(activeId);
    const rect = base.getBoundingClientRect();
    originX = rect.left + rect.width / 2; originY = rect.top + rect.height / 2;
    base.classList.add('is-active');
  });
  base.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId) return;
    let dx = (e.clientX - originX) / RADIUS, dy = (e.clientY - originY) / RADIUS;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    stick.style.transform = `translate(${dx * RADIUS}px, ${dy * RADIUS}px)`;
    setDirection(dx, dy);
  });
  const releaseStick = (e) => {
    if (e.pointerId !== activeId) return;
    activeId = null; base.classList.remove('is-active');
    stick.style.transform = 'translate(0,0)'; clearDirection();
  };
  base.addEventListener('pointerup', releaseStick);
  base.addEventListener('pointercancel', releaseStick);
})();

// Присед и вытягивание руки — как удержание клавиш C и Shift, только пальцем
function bindHoldButton(button, code){
  const press = (e) => { e.preventDefault(); state.keys[code] = true; button.classList.add('is-active'); };
  const release = () => { state.keys[code] = false; button.classList.remove('is-active'); };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}
bindHoldButton(ui.crouchBtn, 'KeyC');
bindHoldButton(ui.reachBtn, 'ShiftLeft');

ui.enterTagBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if(state.phase==='paint')exitTagging();
  else if(state.nearRival)talkToRival();
  else enterTagging();
});

window.SF = { state, reset, start, startBattle, surfaces, clampToReach, reachCenter, player, opponent, THREE,
  diag:()=>({
    баллонИгрока: !!player.canModel,
    баллонСоперника: !!opponent.canModel,
    маскиУдалены: !player.maskModel && !opponent.maskModel
  }),
  PANEL:{bottom:PANEL_Y-PANEL_H/2, top:PANEL_Y+PANEL_H/2} };

ui.start.disabled = true;
ui.start.textContent = 'LOADING';
Promise.all([loadArt(), loadCharacters()]).then(()=>{
  reset();
  console.info('SprayFight diag:', JSON.stringify(window.SF.diag()));
  animate();
  ui.start.disabled = false;
  ui.start.textContent = 'ENTER';
}).catch((error)=>{
  console.error(error);
  ui.start.disabled=true;
  ui.start.textContent='ASSET ERROR';
});
