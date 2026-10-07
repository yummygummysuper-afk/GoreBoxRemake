import * as THREE from 'three';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rand = (min, max) => min + Math.random() * (max - min);
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const centerNdc = new THREE.Vector2(0, 0);

export const WEAPON_DEFS = [
  { id: 'fists', key: 'weapon_fists', icon: '✊', kind: 'melee', range: 2.5, force: 4.1, permanent: true, desc: 'weapon_melee_desc' },
  { id: 'crusher', key: 'weapon_crusher', icon: '✦', kind: 'tool', range: 28, force: 0, permanent: true, desc: 'weapon_tool_desc' },
  { id: 'trainingKnife', key: 'weapon_knife', icon: '⌁', kind: 'melee', range: 2.9, force: 5.2, desc: 'weapon_melee_desc' },
  { id: 'foamBat', key: 'weapon_bat', icon: '╱', kind: 'melee', range: 3.2, force: 7.2, desc: 'weapon_melee_desc' },
  { id: 'zombieBat', key: 'weapon_zombie_bat', icon: '⌁', kind: 'melee', range: 3.2, force: 8.2, desc: 'weapon_melee_desc' },
  { id: 'pocketBlaster', key: 'weapon_pistol', icon: '⌑', kind: 'projectile', range: 70, force: 5.3, color: 0xf3ca62, desc: 'weapon_range_desc' },
  { id: 'carbine47', key: 'weapon_carbine', icon: '⌑', kind: 'projectile', range: 95, force: 6.4, color: 0xff8d66, desc: 'weapon_range_desc' },
  { id: 'scatterBlaster', key: 'weapon_scatter', icon: '✺', kind: 'scatter', range: 48, force: 7.0, color: 0xff9b63, desc: 'weapon_range_desc' },
  { id: 'foamLauncher', key: 'weapon_launcher', icon: '◉', kind: 'launcher', range: 80, force: 9.0, color: 0xff775d, desc: 'weapon_range_desc' },
  { id: 'waterBlaster', key: 'weapon_water', icon: '≈', kind: 'water', range: 36, force: 2.1, color: 0x70d8ed, desc: 'weapon_range_desc' }
];

const NPCS = {
  dummy: { color: 0x8d9992, skin: 0xd4c4ad, health: 8, speed: 0, aggro: false },
  citizen: { color: 0x68a99b, skin: 0xd4bda5, health: 8, speed: 1.35, aggro: false },
  deity: { color: 0xf1f2e8, skin: 0xf0e8d9, health: 999, speed: 1.15, aggro: false },
  bully: { color: 0xb9634d, skin: 0xcba48b, health: 7, speed: 2.0, aggro: true },
  maniac: { color: 0x4b625b, skin: 0xc9ac92, health: 7, speed: 1.75, aggro: false }
};

export class SandboxGame {
  constructor(canvas, settings, callbacks = {}) {
    this.canvas = canvas;
    this.settings = settings;
    this.callbacks = callbacks;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x889590);
    this.scene.fog = new THREE.Fog(0x889590, 35, 180);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 420);
    this.scene.add(this.camera);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.clock = new THREE.Clock();
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    this.entities = [];
    this.effects = [];
    this.particles = [];
    this.foliage = [];
    this.mode = 'menu';
    this.paused = false;
    this.mapId = 'menu';
    this.mapBounds = 58;
    this.menuTime = 0;
    this.menuHover = false;
    this.menuDisconnect = false;
    this.menuDoll = null;
    this.player = null;
    this.spawnChoice = 'prop:table';
    this.currentWeaponId = 'fists';
    this.server = { gravity: 1, npcActivity: 'reactive' };
    this.keys = new Set();
    this.pointerState = null;
    this.cameraYaw = 0;
    this.cameraPitch = 0;
    this.cameraDistance = 0;
    this.mobileMove = { x: 0, y: 0 };
    this.mobileTractor = false;
    this.viewKick = 0;
    this.viewClock = 0;
    this.raycaster = new THREE.Raycaster();
    this.shake = 0;
    this.lastHudAt = 0;
    this.fpsWindowStart = performance.now();
    this.fpsFrames = 0;
    this.currentFps = 60;
    this.lastDrawAt = 0;
    this.lastTime = performance.now();
    this.tmpVec = new THREE.Vector3();
    this.initLights();
    this.createFirstPersonViewModel();
    this.bindEvents();
    this.resize();
    this.applySettings(settings);
    this.buildMenuWorld();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initLights() {
    this.hemi = new THREE.HemisphereLight(0xd9eee2, 0x2a3931, 1.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 3.0);
    this.sun.position.set(-15, 24, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -55;
    this.sun.shadow.camera.right = 55;
    this.sun.shadow.camera.top = 55;
    this.sun.shadow.camera.bottom = -55;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 95;
    this.sun.shadow.bias = -0.00032;
    this.scene.add(this.sun);
    this.fillLight = new THREE.DirectionalLight(0x9ad1c8, 0.72);
    this.fillLight.position.set(12, 10, -14);
    this.scene.add(this.fillLight);
  }

  createFirstPersonViewModel() {
    this.viewModel = new THREE.Group();
    this.viewModel.visible = false;
    this.camera.add(this.viewModel);
    const sleeve = new THREE.MeshBasicMaterial({ color: 0x4e887b, toneMapped: false, depthTest: false, depthWrite: false });
    const cuff = new THREE.MeshBasicMaterial({ color: 0x263c37, toneMapped: false, depthTest: false, depthWrite: false });
    const skin = new THREE.MeshBasicMaterial({ color: 0xc7a88d, toneMapped: false, depthTest: false, depthWrite: false });
    const addView = (geometry, material, position, rotation = [0, 0, 0]) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position[0], position[1], position[2]);
      mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
      mesh.renderOrder = 900;
      this.viewModel.add(mesh);
      return mesh;
    };
    addView(new THREE.CylinderGeometry(.085, .12, .48, 7), sleeve, [-.37, -.42, -.68], [0, 0, -.35]);
    addView(new THREE.BoxGeometry(.14, .07, .15), cuff, [-.29, -.65, -.78], [0, 0, -.35]);
    addView(new THREE.SphereGeometry(.115, 8, 7), skin, [-.25, -.68, -.83]);
    addView(new THREE.CylinderGeometry(.085, .12, .49, 7), sleeve, [.39, -.40, -.62], [0, 0, .32]);
    addView(new THREE.BoxGeometry(.14, .07, .15), cuff, [.32, -.64, -.75], [0, 0, .32]);
    addView(new THREE.SphereGeometry(.115, 8, 7), skin, [.28, -.67, -.81]);
    this.viewWeapon = new THREE.Group();
    this.viewWeapon.position.set(.38, -.35, -.79);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x35453e, toneMapped: false, depthTest: false, depthWrite: false });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0xff6f67, toneMapped: false, depthTest: false, depthWrite: false });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xd8f26a, toneMapped: false, depthTest: false, depthWrite: false });
    const body = new THREE.Mesh(new THREE.BoxGeometry(.27, .15, .42), bodyMat);
    body.renderOrder = 901;
    this.viewWeapon.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, .34, 8), bodyMat);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .015, -.31); barrel.renderOrder = 901;
    this.viewWeapon.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(.11, .22, .12), bodyMat);
    grip.position.set(0, -.15, .05); grip.rotation.x = -.22; grip.renderOrder = 901;
    this.viewWeapon.add(grip);
    const accent = new THREE.Mesh(new THREE.BoxGeometry(.28, .035, .18), accentMat);
    accent.position.set(0, .095, -.05); accent.renderOrder = 902;
    this.viewWeapon.add(accent);
    const status = new THREE.Mesh(new THREE.BoxGeometry(.07, .025, .09), glowMat);
    status.position.set(.07, .12, .06); status.renderOrder = 902;
    this.viewWeapon.add(status);
    this.viewModel.add(this.viewWeapon);
    this.viewWeapon.visible = false;
    this.viewWeapon.userData = { bodyMat, accentMat, glowMat };
  }

  updateViewWeapon() {
    if (!this.viewWeapon) return;
    const item = this.weapon(this.currentWeaponId);
    this.viewWeapon.visible = item.id !== 'fists';
    const colors = item.id === 'crusher' ? [0x344238, 0xd6f36b, 0xe7ff89]
      : item.id === 'waterBlaster' ? [0x274c58, 0x68dced, 0xaaf5ff]
      : item.kind === 'melee' ? [0x4d4739, 0xf0c86b, 0xffdfa0]
      : item.id === 'foamLauncher' ? [0x443530, 0xff775f, 0xffaf69]
      : [0x36443c, 0xff6f67, 0xd8f26a];
    const data = this.viewWeapon.userData;
    data.bodyMat.color.setHex(colors[0]);
    data.accentMat.color.setHex(colors[1]);
    data.glowMat.color.setHex(colors[2]);
  }

  setMobileMove(x, y) {
    this.mobileMove.x = clamp(Number(x) || 0, -1, 1);
    this.mobileMove.y = clamp(Number(y) || 0, -1, 1);
  }

  jump() {
    if (!this.player || this.player.seated || !this.player.grounded || this.paused || this.mode !== 'game') return;
    this.player.velocity.y = 7.3;
    this.player.grounded = false;
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    window.addEventListener('pointerup', (event) => this.onPointerUp(event));
    this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.canvas.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.onKeyUp(event));
    window.addEventListener('blur', () => { this.keys.clear(); this.pointerState = null; });
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.applyRendererScale();
  }

  applyRendererScale() {
    const scale = clamp(Number(this.settings?.graphics?.resolution ?? 1), 0.55, 1.45);
    const maxDpr = this.settings?.graphics?.pixelRatioCap ?? 1.6;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr) * scale);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  applySettings(settings) {
    this.settings = settings;
    if (this.renderer) {
      this.applyRendererScale();
      const g = settings.graphics || {};
      this.renderer.shadowMap.enabled = Boolean(g.shadows);
      this.sun.castShadow = Boolean(g.shadows);
      const shadowSize = Number(g.shadowQuality || 1024);
      if (this.sun.shadow.mapSize.x !== shadowSize) {
        this.sun.shadow.mapSize.set(shadowSize, shadowSize);
        if (this.sun.shadow.map) {
          this.sun.shadow.map.dispose();
          this.sun.shadow.map = null;
        }
      }
      this.renderer.toneMapping = g.toneMapping === false ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = g.toneMapping === false ? 1 : 1.08;
      this.hemi.intensity = Number(g.ambient ?? 1.9);
      this.sun.intensity = Number(g.sunlight ?? 3.0);
      this.camera.far = Number(g.drawDistance || 180) * 1.6;
      this.camera.updateProjectionMatrix();
      this.updateFog();
      this.updateFoliage();
    }
  }

  updateFog() {
    const g = this.settings?.graphics || {};
    if (g.fog === false) {
      this.scene.fog = null;
      return;
    }
    const color = this.mapId === 'plains' ? 0x9cae9b : this.mapId === 'test' ? 0x9ba8a6 : 0x899994;
    const far = Number(g.drawDistance || 180);
    this.scene.fog = new THREE.Fog(color, Math.max(12, far * 0.28), Math.max(30, far));
  }

  updateFoliage() {
    const density = clamp(Number(this.settings?.graphics?.foliage ?? 0.72), 0, 1);
    for (const item of this.foliage) item.visible = item.userData.density <= density;
  }

  disposeGroup(group) {
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        mats.forEach((material) => material.dispose());
      }
    });
    group.clear();
  }

  resetWorldGroup() {
    if (this.worldGroup) {
      this.scene.remove(this.worldGroup);
      this.disposeGroup(this.worldGroup);
    }
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    this.player = null;
    this.tractor = null;
    this.mobileTractor = false;
    this.entities = [];
    this.effects = [];
    this.particles = [];
    this.foliage = [];
    this.menuDoll = null;
  }

  mat(color, roughness = 0.82, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  addMesh(parent, geometry, material, position = [0, 0, 0], options = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    if (options.rotation) mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
    if (options.scale) mesh.scale.set(options.scale[0], options.scale[1], options.scale[2]);
    parent.add(mesh);
    return mesh;
  }

  makeBase(width, depth, color, roughness = 0.95) {
    const floor = this.addMesh(this.worldGroup, new THREE.BoxGeometry(width, 0.65, depth), this.mat(color, roughness), [0, -0.325, 0]);
    floor.receiveShadow = true;
    const under = this.addMesh(this.worldGroup, new THREE.PlaneGeometry(800, 800), this.mat(0x657370, 1), [0, -0.67, 0]);
    under.rotation.x = -Math.PI / 2;
    under.receiveShadow = true;
    return floor;
  }

  addGroundMark(x, z, w, d, color, opacity = 0.6, rotation = 0) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const mesh = this.addMesh(this.worldGroup, new THREE.PlaneGeometry(w, d), material, [x, 0.04, z], { castShadow: false });
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotation;
    return mesh;
  }

  buildMenuWorld() {
    this.resetWorldGroup();
    this.mode = 'menu';
    this.paused = false;
    this.menuHover = false;
    this.menuDisconnect = false;
    this.canvas.style.cursor = 'default';
    this.mapId = 'menu';
    this.scene.background = new THREE.Color(0x82938f);
    this.scene.fog = new THREE.Fog(0x82938f, 28, 150);
    this.camera.fov = 52;
    this.camera.updateProjectionMatrix();
    if (this.viewModel) this.viewModel.visible = false;
    this.makeBase(54, 54, 0x49624b, 1);
    // A broad, quiet baseplate with sparse test markings.
    const concrete = this.addMesh(this.worldGroup, new THREE.BoxGeometry(52.4, 0.035, 52.4), this.mat(0x667761, 0.98), [0, 0.012, 0], { castShadow: false });
    concrete.receiveShadow = true;
    const borderMat = this.mat(0x293834, 0.78);
    for (const [x, z, sx, sz] of [[0, -26.1, 52, .18], [0, 26.1, 52, .18], [-26.1, 0, .18, 52], [26.1, 0, .18, 52]]) {
      this.addMesh(this.worldGroup, new THREE.BoxGeometry(sx, .1, sz), borderMat, [x, .06, z]);
    }
    for (let i = -20; i <= 20; i += 4) {
      this.addGroundMark(i, 0, .035, 50, 0xc4d49a, .11);
      this.addGroundMark(0, i, 50, .035, 0xc4d49a, .11);
    }
    this.addGroundMark(0, 0, 8, .075, 0xd8e1b6, .24);
    this.addGroundMark(0, 0, .075, 8, 0xd8e1b6, .24);
    const ring = this.addMesh(this.worldGroup, new THREE.TorusGeometry(2.6, .025, 5, 64), new THREE.MeshBasicMaterial({ color: 0xd0e7ad, transparent: true, opacity: .25 }), [0, .065, 0], { castShadow: false });
    ring.rotation.x = Math.PI / 2;
    const actor = this.createActor('dummy', true);
    actor.root.position.set(0, 0, 0);
    actor.root.rotation.y = Math.PI * .88;
    this.worldGroup.add(actor.root);
    const blasterMat = this.mat(0x243831, .48, .16);
    const blaster = this.addMesh(actor.parts.rightArm, new THREE.BoxGeometry(.18, .12, .42), blasterMat, [0, -.62, .14]);
    const blasterAccent = this.addMesh(actor.parts.rightArm, new THREE.BoxGeometry(.19, .035, .17), this.mat(0xccf36a, .45, .05), [0, -.59, -.04]);
    blaster.visible = false;
    blasterAccent.visible = false;
    actor.blaster = [blaster, blasterAccent];
    actor.root.traverse((object) => { if (object.isMesh) object.userData.menuFigure = true; });
    this.menuDoll = actor;
    this.camera.position.set(5.8, 4.0, 8.5);
    this.camera.lookAt(0, 1.08, 0);
    this.callbacks.onWorldChanged?.('menu');
  }

  createActor(type = 'dummy', withFace = true) {
    const config = NPCS[type] || NPCS.dummy;
    const root = new THREE.Group();
    const shirtMat = this.mat(config.color, .86, type === 'deity' ? .02 : 0);
    const skinMat = this.mat(config.skin, .91);
    const pantsMat = this.mat(type === 'deity' ? 0xe4e7df : (type === 'bully' ? 0x343b39 : 0x394744), .92);
    const shoeMat = this.mat(0x26312f, .9);
    const eyeMat = this.mat(0x202625, .7);
    const torso = this.addMesh(root, new THREE.CylinderGeometry(.30, .38, .82, 9), shirtMat, [0, 1.36, 0]);
    this.addMesh(root, new THREE.CylinderGeometry(.27, .31, .25, 8), pantsMat, [0, .82, 0]);
    this.addMesh(root, new THREE.CylinderGeometry(.09, .10, .17, 8), skinMat, [0, 1.83, 0]);
    const head = this.addMesh(root, new THREE.SphereGeometry(.265, 14, 11), skinMat, [0, 2.08, .015]);
    if (withFace) {
      const eyeLeft = this.addMesh(root, new THREE.SphereGeometry(.035, 8, 6), eyeMat, [-.09, 2.11, .244]);
      const eyeRight = this.addMesh(root, new THREE.SphereGeometry(.035, 8, 6), eyeMat, [.09, 2.11, .244]);
      if (type === 'deity') {
        eyeLeft.material = this.mat(0x101413, .65);
        eyeRight.material = this.mat(0x101413, .65);
        eyeLeft.scale.set(.76, 1.55, .32);
        eyeRight.scale.set(.76, 1.55, .32);
      }
    }
    const limbPivots = {};
    const makeLimb = (name, x, y, pants = false) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      root.add(pivot);
      const material = pants ? pantsMat : shirtMat;
      const radius = pants ? .15 : .125;
      this.addMesh(pivot, new THREE.CylinderGeometry(radius * .82, radius, pants ? .73 : .68, 8), material, [0, pants ? -.33 : -.31, 0]);
      const endpoint = pants ? -.72 : -.64;
      this.addMesh(pivot, new THREE.SphereGeometry(radius * .98, 8, 7), material, [0, endpoint + .025, 0]);
      if (pants) this.addMesh(pivot, new THREE.BoxGeometry(.20, .11, .31), shoeMat, [0, -.75, .075]);
      else this.addMesh(pivot, new THREE.SphereGeometry(.105, 8, 7), skinMat, [0, -.66, .015]);
      limbPivots[name] = pivot;
      return pivot;
    };
    const leftArm = makeLimb('leftArm', -.43, 1.61, false);
    const rightArm = makeLimb('rightArm', .43, 1.61, false);
    const leftLeg = makeLimb('leftLeg', -.19, .78, true);
    const rightLeg = makeLimb('rightLeg', .19, .78, true);
    // A small blank collar gives the characters a clean low-poly silhouette.
    this.addMesh(root, new THREE.TorusGeometry(.12, .035, 5, 10), this.mat(type === 'deity' ? 0xf9f6e9 : 0x253430, .76), [0, 1.78, 0]);
    return { root, parts: { torso, head, leftArm, rightArm, leftLeg, rightLeg }, limbs: limbPivots, meshes: [], type };
  }

  tagEntity(entity) {
    entity.root.traverse((object) => {
      if (object.isMesh) object.userData.entityRef = entity;
    });
  }

  start(mapId = 'plains') {
    this.resetWorldGroup();
    this.mapId = mapId === 'test' ? 'test' : 'plains';
    this.mode = 'game';
    this.paused = false;
    this.menuDisconnect = false;
    this.canvas.style.cursor = 'default';
    this.scene.background = new THREE.Color(this.mapId === 'test' ? 0x92a5a5 : 0x9aab9a);
    this.updateFog();
    if (this.mapId === 'test') this.buildTestMap(); else this.buildPlainsMap();
    const playerStart = this.mapId === 'test' ? v3(-7, 0, 11) : v3(-4, 0, 1);
    const actor = this.createActor('citizen', true);
    actor.root.visible = false;
    this.worldGroup.add(actor.root);
    this.player = {
      id: 'player', kind: 'player', type: 'player', root: actor.root, actor,
      position: actor.root.position, velocity: v3(), radius: .42, floorY: 0,
      grounded: true, isStunned: 0, stanceTimer: 0, seated: false,
      walkPhase: 0, health: 1, alive: true, mass: 1
    };
    actor.root.position.copy(playerStart);
    actor.root.rotation.y = Math.PI;
    this.tagEntity(this.player);
    this.entities.push(this.player);
    this.currentWeaponId = 'fists';
    this.camera.fov = 78;
    this.camera.updateProjectionMatrix();
    this.cameraYaw = 0;
    this.cameraPitch = 0;
    this.cameraDistance = 0;
    this.mobileMove.x = 0;
    this.mobileMove.y = 0;
    this.viewModel.visible = true;
    this.updateViewWeapon();
    this.camera.position.copy(playerStart).add(v3(0, 1.66, 0));
    this.camera.lookAt(playerStart.clone().add(v3(0, 1.66, -1)));
    this.callbacks.onWorldChanged?.(this.mapId);
    this.callbacks.onWeaponChange?.(this.weapon(this.currentWeaponId));
    this.callbacks.onHUD?.({ entities: this.entities.length - 1, weapon: this.weapon(this.currentWeaponId), mapId: this.mapId, fps: this.currentFps, stance: false });
    this.applySettings(this.settings);
  }

  buildPlainsMap() {
    const width = 124;
    this.mapBounds = 58;
    this.makeBase(width, width, 0x4c684b, .98);
    const fieldColors = [0x5f784f, 0x556f49, 0x677b53, 0x4f6a49];
    for (let i = 0; i < 30; i++) {
      const x = rand(-54, 54), z = rand(-54, 54);
      const patch = this.addMesh(this.worldGroup, new THREE.CircleGeometry(rand(1.2, 4.4), 18), this.mat(fieldColors[i % fieldColors.length], 1), [x, .012, z], { castShadow: false });
      patch.rotation.x = -Math.PI / 2;
      patch.scale.set(rand(.8, 1.9), 1, rand(.7, 1.5));
      patch.material.transparent = true;
      patch.material.opacity = .54;
    }
    // Dirt tracks, laid out like a small map rather than a real road.
    this.addGroundMark(0, 2, 5.2, 116, 0xb2a37a, .72);
    this.addGroundMark(-18, -19, 47, 3.3, 0xb2a37a, .69, -.42);
    this.addGroundMark(21, 25, 38, 3, 0xb2a37a, .68, -.58);
    this.addGroundMark(-27, 23, 26, 2.4, 0xb2a37a, .62, .4);
    const treeRoot = new THREE.Group();
    this.worldGroup.add(treeRoot);
    const trunkMat = this.mat(0x6b5943, .98);
    const leafMats = [this.mat(0x617c4e, 1), this.mat(0x748c59, 1), this.mat(0x496746, 1)];
    for (let i = 0; i < 55; i++) {
      let x = rand(-52, 52), z = rand(-52, 52);
      if (Math.abs(x) < 7 || (Math.abs(z) < 5 && Math.abs(x) < 29)) x += Math.sign(x || 1) * 13;
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      const h = rand(1.5, 2.6), widthT = rand(.17, .26);
      this.addMesh(tree, new THREE.CylinderGeometry(widthT * .72, widthT, h, 6), trunkMat, [0, h / 2, 0]);
      const canopy = this.addMesh(tree, new THREE.IcosahedronGeometry(rand(.72, 1.25), 0), leafMats[i % leafMats.length], [0, h + .45, 0]);
      canopy.scale.y = rand(1, 1.35);
      tree.rotation.y = rand(0, Math.PI * 2);
      tree.userData.density = Math.random();
      treeRoot.add(tree);
      this.foliage.push(tree);
    }
    // Scattered low-poly rocks as landmarks.
    for (let i = 0; i < 18; i++) {
      const rock = this.addMesh(this.worldGroup, new THREE.DodecahedronGeometry(rand(.32, .74), 0), this.mat(i % 2 ? 0x788077 : 0x69756e, .98), [rand(-45, 45), .25, rand(-45, 45)]);
      rock.scale.set(rand(.8, 1.6), rand(.65, 1.2), rand(.8, 1.5));
      rock.rotation.set(rand(0, .3), rand(0, Math.PI), rand(0, .3));
    }
    this.updateFoliage();
  }

  buildTestMap() {
    this.mapBounds = 34;
    this.makeBase(74, 74, 0x616b62, .94);
    const slabMat = this.mat(0x70776d, .91);
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(72, .035, 72), slabMat, [0, .01, 0], { castShadow: false });
    for (let i = -30; i <= 30; i += 3) {
      this.addGroundMark(i, 0, .022, 68, 0xe0e1bf, .11);
      this.addGroundMark(0, i, 68, .022, 0xe0e1bf, .11);
    }
    const yellow = this.mat(0xc4ca6c, .65);
    for (const [x, z, sx, sz] of [[0, -35.6, 73, .36], [0, 35.6, 73, .36], [-35.6, 0, .36, 73], [35.6, 0, .36, 73]]) {
      this.addMesh(this.worldGroup, new THREE.BoxGeometry(sx, .12, sz), yellow, [x, .07, z]);
    }
    // Small test house on the left.
    const wall = this.mat(0x9b8d78, .98);
    const trim = this.mat(0x4e4a40, .9);
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(10, .35, 8), trim, [-17, .18, -10]);
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(10, 3.3, .36), wall, [-17, 1.65, -14]);
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(.36, 3.3, 8), wall, [-21.8, 1.65, -10]);
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(.36, 3.3, 8), wall, [-12.2, 1.65, -10]);
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(4.6, 3.3, .36), wall, [-19.7, 1.65, -6]);
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(3.7, .36, 8.4), this.mat(0x765f4b, .92), [-17, 3.34, -10], { rotation: [0, 0, -.12] });
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(1.1, 2.25, .08), this.mat(0x5c594e, .87), [-17, 1.13, -13.75]);
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(.12, .12, .12), yellow, [-16.62, 1.1, -13.65]);
    // A calm pond with a low rim.
    const pond = this.addMesh(this.worldGroup, new THREE.CylinderGeometry(6.4, 6.4, .07, 32), this.mat(0x3b8c89, .22, .16), [10, .02, 13]);
    pond.receiveShadow = false;
    const rim = this.addMesh(this.worldGroup, new THREE.TorusGeometry(6.4, .18, 8, 48), this.mat(0x777b67, .88), [10, .08, 13]);
    rim.rotation.x = Math.PI / 2;
    // Tower and long low ramp.
    const towerX = 18, towerZ = -8;
    const steel = this.mat(0x737d78, .7, .08);
    for (const x of [towerX - 1.5, towerX + 1.5]) for (const z of [towerZ - 1.5, towerZ + 1.5]) {
      this.addMesh(this.worldGroup, new THREE.BoxGeometry(.25, 7.5, .25), steel, [x, 3.75, z]);
    }
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(4.2, .35, 4.2), this.mat(0x59675f, .76), [towerX, 7.45, towerZ]);
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(4.4, .16, .18), yellow, [towerX, 7.68, towerZ + 2.0]);
    // High-contrast cyan slide ramp: the yellow crossbars make the slope obvious at a glance.
    const slideMat = this.mat(0x54cbd0, .42, .08);
    const railMat = this.mat(0xe7cd68, .56, .02);
    const ramp = this.addMesh(this.worldGroup, new THREE.BoxGeometry(20, .34, 5.2), slideMat, [6.5, 3.3, -7.8], { rotation: [0, 0, .31] });
    ramp.receiveShadow = true;
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(20, .44, .16), railMat, [6.5, 3.58, -10.42], { rotation: [0, 0, .31] });
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(20, .44, .16), railMat, [6.5, 3.58, -5.18], { rotation: [0, 0, .31] });
    for (let i = 0; i < 9; i++) {
      const x = -2.1 + i * 2.15;
      const y = 3.48 + (x - 6.5) * Math.tan(.31);
      this.addMesh(this.worldGroup, new THREE.BoxGeometry(.12, .055, 5.05), railMat, [x, y, -7.8], { rotation: [0, 0, .31], castShadow: false });
    }
    for (let i = 0; i < 4; i++) {
      const x = 15.3 + i * .52;
      const y = 6.43 + i * .25;
      this.addMesh(this.worldGroup, new THREE.BoxGeometry(.65, .16, 5.0), railMat, [x, y, -7.8]);
    }
    // Three loose, oversized test spheres start on the top platform.
    this.addProp('ball', v3(towerX - 1.0, 9.4, towerZ - .7), 0xd6d96d);
    this.addProp('ball', v3(towerX + .15, 9.9, towerZ), 0xe79a66);
    this.addProp('ball', v3(towerX + 1.1, 10.45, towerZ + .65), 0x84cfc0);
    // A couple of guide blocks on the floor establish scale.
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(4.5, .55, .25), yellow, [0, .28, -25]);
    this.addMesh(this.worldGroup, new THREE.BoxGeometry(.25, .55, 4.5), yellow, [2.2, .28, -27]);
  }

  createProp(type, color) {
    const root = new THREE.Group();
    let floorY = 0;
    let sitPoint = null;
    if (type === 'table') {
      const wood = this.mat(color || 0xa1825d, .86);
      const dark = this.mat(0x594b3c, .9);
      this.addMesh(root, new THREE.BoxGeometry(1.72, .15, 1.02), wood, [0, .76, 0]);
      for (const x of [-.72, .72]) for (const z of [-.39, .39]) this.addMesh(root, new THREE.BoxGeometry(.12, .72, .12), dark, [x, .36, z]);
      this.addMesh(root, new THREE.BoxGeometry(1.4, .08, .1), dark, [0, .47, 0]);
      floorY = 0;
    } else if (type === 'chair') {
      const wood = this.mat(color || 0x8c765d, .9);
      const dark = this.mat(0x594e40, .93);
      this.addMesh(root, new THREE.BoxGeometry(.95, .13, .87), wood, [0, .57, 0]);
      this.addMesh(root, new THREE.BoxGeometry(.95, .82, .13), wood, [0, 1.0, -.37]);
      for (const x of [-.37, .37]) for (const z of [-.32, .32]) this.addMesh(root, new THREE.BoxGeometry(.1, .55, .1), dark, [x, .28, z]);
      sitPoint = v3(0, 0, 0);
      floorY = 0;
    } else if (type === 'wall') {
      this.addMesh(root, new THREE.BoxGeometry(4.2, 2.7, .32), this.mat(color || 0x8c9990, .94), [0, 1.35, 0]);
      this.addMesh(root, new THREE.BoxGeometry(4.35, .08, .38), this.mat(0xc4d0c0, .86), [0, 2.7, 0]);
      floorY = 0;
    } else if (type === 'ball') {
      const ball = this.addMesh(root, new THREE.SphereGeometry(.62, 16, 12), this.mat(color || 0xd6d96d, .44, .02), [0, 0, 0]);
      ball.castShadow = true;
      floorY = .62;
    } else if (type === 'weaponDrop') {
      const weapon = WEAPON_DEFS.find((item) => item.id === color) || WEAPON_DEFS[2];
      const materialColor = weapon.color || (weapon.kind === 'melee' ? 0xb4c5b6 : 0x839b83);
      const body = this.addMesh(root, new THREE.BoxGeometry(.5, .16, .16), this.mat(materialColor, .54, .08), [0, .15, 0]);
      body.rotation.y = .1;
      this.addMesh(root, new THREE.BoxGeometry(.16, .24, .14), this.mat(0x394841, .6), [.07, .03, .02], { rotation: [0, 0, -.23] });
      if (weapon.kind === 'melee') this.addMesh(root, new THREE.BoxGeometry(.9, .1, .13), this.mat(materialColor, .54), [0, .23, 0]);
      floorY = .12;
    }
    return { root, floorY, sitPoint, type };
  }

  addProp(type, position = v3(0, 2.3, 0), color = null) {
    const data = this.createProp(type, color);
    this.worldGroup.add(data.root);
    const entity = {
      id: `entity-${Math.random().toString(36).slice(2, 8)}`,
      kind: type === 'weaponDrop' ? 'weaponDrop' : 'prop', type, root: data.root,
      position: data.root.position, velocity: v3(), angularVelocity: v3(), floorY: data.floorY,
      radius: type === 'wall' ? 1.8 : type === 'table' ? .9 : type === 'ball' ? .62 : .65,
      mass: type === 'wall' ? 40 : type === 'table' ? 12 : type === 'ball' ? 3 : 6,
      sitPoint: data.sitPoint, weaponId: type === 'weaponDrop' ? color : null,
      health: 1, alive: true, isStunned: 0
    };
    data.root.position.copy(position);
    this.tagEntity(entity);
    this.entities.push(entity);
    return entity;
  }

  addNPC(type, position = v3(0, 0, 0)) {
    const config = NPCS[type] || NPCS.dummy;
    const actor = this.createActor(type, true);
    actor.root.position.copy(position);
    this.worldGroup.add(actor.root);
    const entity = {
      id: `npc-${Math.random().toString(36).slice(2, 8)}`,
      kind: 'npc', type, root: actor.root, actor, position: actor.root.position,
      velocity: v3(), angularVelocity: v3(), floorY: 0, radius: .43, mass: type === 'deity' ? 16 : 1,
      speed: config.speed, health: config.health, maxHealth: config.health, alive: true,
      isStunned: 0, aggroUntil: 0, wanderTimer: rand(.2, 2.4), wanderDir: v3(rand(-1, 1), 0, rand(-1, 1)).normalize(),
      bumpCooldown: 0, walkPhase: rand(0, 6), modeTimer: rand(6, 15), tagCooldown: 0,
      initialPosition: position.clone()
    };
    this.tagEntity(entity);
    this.entities.push(entity);
    return entity;
  }

  setSpawnChoice(choice) {
    this.spawnChoice = choice;
    this.callbacks.onSpawnChoice?.(choice);
  }

  spawnSelected() {
    if (this.mode !== 'game' || !this.player) return;
    const forward = this.getPlayerForward();
    const spawnAt = this.player.position.clone().addScaledVector(forward, 4.2);
    spawnAt.y = 2.0;
    let label = '';
    if (this.spawnChoice.startsWith('npc:')) {
      const type = this.spawnChoice.slice(4);
      this.addNPC(type, v3(spawnAt.x, 0, spawnAt.z));
      label = type;
    } else {
      const type = this.spawnChoice.slice(5);
      this.addProp(type, spawnAt);
      label = type;
    }
    this.callbacks.onSpawned?.(label);
    this.publishHud();
  }

  emitToast(key) {
    this.callbacks.onToast?.(key);
  }

  setWeapon(id) {
    const definition = this.weapon(id);
    if (!definition) return;
    this.currentWeaponId = id;
    if (id !== 'crusher' && this.tractor) this.releaseTractor();
    this.updateViewWeapon();
    if (this.player?.actor) {
      this.player.stanceTimer = 0;
      this.player.actor.parts.leftArm.rotation.set(0, 0, 0);
      this.player.actor.parts.rightArm.rotation.set(0, 0, 0);
    }
    this.callbacks.onWeaponChange?.(definition);
  }

  weapon(id = this.currentWeaponId) {
    return WEAPON_DEFS.find((item) => item.id === id) || WEAPON_DEFS[0];
  }

  pause(value = true) {
    this.paused = value;
    this.keys.clear();
    if (!value && this.mode === 'game') this.lastTime = performance.now();
  }

  backToMenu() {
    this.player = null;
    this.keys.clear();
    this.pointerState = null;
    this.buildMenuWorld();
  }

  reloadMap() {
    const map = this.mapId === 'test' ? 'test' : 'plains';
    this.start(map);
  }

  getPlayerForward() {
    return v3(Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw)).normalize();
  }

  getAimOrigin() {
    return this.camera.getWorldPosition(v3());
  }

  getAimDirection() {
    const direction = v3();
    this.camera.getWorldDirection(direction);
    return direction.normalize();
  }

  pickEntity(maxDistance = 80, direction = null, origin = null) {
    if (!this.player) return null;
    this.raycaster.set(origin || this.camera.position, direction || this.getAimDirection());
    this.raycaster.far = maxDistance;
    const roots = this.entities.filter((entity) => entity !== this.player && entity.alive && entity.root).map((entity) => entity.root);
    if (!roots.length) return null;
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node && !node.userData.entityRef) node = node.parent;
      const entity = node?.userData?.entityRef;
      if (entity && entity.alive) return { entity, point: hit.point.clone(), distance: hit.distance, object: hit.object };
    }
    return null;
  }

  findNearChair() {
    if (!this.player) return null;
    let best = null, bestDist = Infinity;
    for (const entity of this.entities) {
      if (entity.type !== 'chair' || !entity.alive) continue;
      const d = entity.position.distanceTo(this.player.position);
      if (d < bestDist) { bestDist = d; best = entity; }
    }
    return best && bestDist < 2.5 ? best : null;
  }

  findNearWeaponDrop() {
    if (!this.player) return null;
    let best = null, bestDist = Infinity;
    for (const entity of this.entities) {
      if (entity.kind !== 'weaponDrop' || !entity.alive) continue;
      const d = entity.position.distanceTo(this.player.position);
      if (d < bestDist) { bestDist = d; best = entity; }
    }
    return best && bestDist < 2.0 ? best : null;
  }

  interact() {
    if (!this.player) return;
    if (this.player.seated) {
      this.player.seated = false;
      this.player.root.position.y = 0;
      this.callbacks.onToast?.('stand');
      return;
    }
    const drop = this.findNearWeaponDrop();
    if (drop) {
      const weaponId = drop.weaponId;
      this.removeEntity(drop);
      this.setWeapon(weaponId);
      this.callbacks.onToast?.('picked');
      return;
    }
    const chair = this.findNearChair();
    if (chair) {
      this.player.seated = true;
      this.player.velocity.set(0, 0, 0);
      this.player.position.set(chair.position.x, -.1, chair.position.z + .12);
      this.player.root.rotation.y = chair.root.rotation.y;
      this.player.actor.parts.leftLeg.rotation.x = -1.05;
      this.player.actor.parts.rightLeg.rotation.x = -1.05;
      this.player.actor.parts.leftArm.rotation.x = -.24;
      this.player.actor.parts.rightArm.rotation.x = -.24;
      this.callbacks.onToast?.('sit');
      return;
    }
    this.callbacks.onToast?.('nothing');
  }

  dropWeapon() {
    const item = this.weapon();
    if (item.permanent || item.id === 'fists' || item.id === 'crusher') {
      this.callbacks.onToast?.('permanent');
      return;
    }
    const at = this.player.position.clone().addScaledVector(this.getPlayerForward(), 1.1);
    at.y = .55;
    this.addProp('weaponDrop', at, item.id);
    this.setWeapon('fists');
    this.callbacks.onWeaponDrop?.(item);
  }

  removeEntity(entity) {
    entity.alive = false;
    this.worldGroup.remove(entity.root);
    this.disposeGroup(entity.root);
    this.entities = this.entities.filter((item) => item !== entity);
    this.publishHud();
  }

  deleteFocused() {
    const found = this.pickEntity(60);
    if (!found) {
      this.callbacks.onToast?.('noTarget');
      return;
    }
    this.removeEntity(found.entity);
    this.callbacks.onToast?.('removed');
  }

  updatePlayer(dt, elapsed) {
    const player = this.player;
    if (!player) return;
    player.stanceTimer = Math.max(0, player.stanceTimer - dt);
    if (player.seated) {
      player.velocity.set(0, 0, 0);
      this.updateActorPose(player, elapsed, 0);
      return;
    }
    const forward = this.getPlayerForward();
    const right = v3(-forward.z, 0, forward.x).normalize();
    const move = v3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);
    move.addScaledVector(right, this.mobileMove.x);
    move.addScaledVector(forward, -this.mobileMove.y);
    if (move.lengthSq() > 0) move.normalize();
    const speed = this.keys.has('ShiftLeft') ? 9.3 : 6.1;
    const accel = player.grounded ? 21 : 8;
    player.velocity.x += move.x * accel * dt;
    player.velocity.z += move.z * accel * dt;
    const friction = player.grounded ? (move.lengthSq() > 0 ? .82 : .79) : .95;
    player.velocity.x *= Math.pow(friction, dt * 60);
    player.velocity.z *= Math.pow(friction, dt * 60);
    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    if (horizontalSpeed > speed) { player.velocity.x *= speed / horizontalSpeed; player.velocity.z *= speed / horizontalSpeed; }
    const gravity = 18 * Number(this.server.gravity || 1);
    player.velocity.y -= gravity * dt;
    player.position.addScaledVector(player.velocity, dt);
    if (player.position.y <= 0) {
      player.position.y = 0;
      player.velocity.y = 0;
      player.grounded = true;
    } else player.grounded = false;
    const bounds = this.mapBounds - 2;
    player.position.x = clamp(player.position.x, -bounds, bounds);
    player.position.z = clamp(player.position.z, -bounds, bounds);
    if (move.lengthSq() > .01) {
      player.root.rotation.y = Math.atan2(move.x, move.z);
      player.walkPhase += dt * (horizontalSpeed > .2 ? 8.5 : 0);
    }
    if (this.tractor && this.currentWeaponId === 'crusher' && (this.mobileTractor || (this.pointerState?.active && this.pointerState.button === 0))) this.updateTractor();
    this.updateActorPose(player, elapsed, horizontalSpeed);
  }

  updateActorPose(entity, elapsed, speed = 0) {
    const actor = entity.actor;
    if (!actor) return;
    const { leftArm, rightArm, leftLeg, rightLeg, torso } = actor.parts;
    if (entity.seated) {
      leftLeg.rotation.x = -1.05;
      rightLeg.rotation.x = -1.05;
      leftArm.rotation.x = -.24;
      rightArm.rotation.x = -.24;
      leftArm.rotation.z = 0;
      rightArm.rotation.z = 0;
      torso.rotation.z = 0;
      return;
    }
    const moving = speed > .25 && !entity.seated;
    const phase = moving ? elapsed * 8.5 + (entity.walkPhase || 0) : elapsed * .7;
    const gait = moving ? Math.sin(phase) * .48 : Math.sin(phase) * .025;
    leftLeg.rotation.x = gait;
    rightLeg.rotation.x = -gait;
    leftArm.rotation.x = -gait * .82;
    rightArm.rotation.x = gait * .82;
    torso.rotation.z = 0;
    if (entity === this.player && entity.stanceTimer > 0) {
      leftArm.rotation.x = -.38;
      rightArm.rotation.x = -.62;
      leftArm.rotation.z = -.3;
      rightArm.rotation.z = .26;
    } else if (entity.kind === 'npc' && entity.isStunned > 0) {
      const kick = Math.sin(elapsed * 18 + entity.walkPhase) * .18;
      leftArm.rotation.x = kick - .2;
      rightArm.rotation.x = -kick - .2;
      leftLeg.rotation.x = -kick;
      rightLeg.rotation.x = kick;
      torso.rotation.z = Math.sin(elapsed * 11) * .06;
    } else {
      leftArm.rotation.z = 0;
      rightArm.rotation.z = 0;
    }
    if (entity.kind === 'npc' && entity.type === 'deity') {
      // The white guardian's simple blank stare is part of the stylized prototype look.
      actor.root.position.y = entity.floorY + Math.sin(elapsed * 1.25 + entity.walkPhase) * .012;
    }
  }

  updateNPCs(dt, elapsed) {
    if (!this.player) return;
    const activity = this.server.npcActivity === 'peaceful' ? 0 : this.server.npcActivity === 'busy' ? 1.55 : 1;
    for (const entity of this.entities) {
      if (entity.kind !== 'npc' || !entity.alive) continue;
      entity.isStunned = Math.max(0, entity.isStunned - dt);
      entity.bumpCooldown = Math.max(0, entity.bumpCooldown - dt);
      entity.tagCooldown = Math.max(0, entity.tagCooldown - dt);
      entity.wanderTimer -= dt;
      entity.modeTimer -= dt;
      const toPlayer = this.player.position.clone().sub(entity.position); toPlayer.y = 0;
      const distance = toPlayer.length();
      let desired = v3();
      let chasing = false;
      const forcedAggro = elapsed < entity.aggroUntil;
      if (entity.type === 'bully' && activity > 0) chasing = distance < 30;
      if (entity.type === 'citizen' && forcedAggro && activity > 0) chasing = true;
      if (entity.type === 'deity' && forcedAggro && activity > 0) chasing = true;
      if (entity.type === 'maniac' && activity > 0) {
        if (forcedAggro) chasing = true;
        else if (entity.modeTimer <= 0) {
          entity.modeTimer = rand(10, 19);
          entity.observePlayer = Math.random() > .43;
          if (entity.observePlayer) entity.watchUntil = elapsed + rand(3, 6);
        }
        if (entity.watchUntil && elapsed < entity.watchUntil && distance < 20) {
          // An occasional stare, then a short playful tag chase.
          if (distance < 7 && entity.tagCooldown <= 0 && Math.random() < .003) chasing = true;
        }
      }
      if (chasing && distance > 1.35 && distance < 34 && entity.isStunned <= 0) {
        desired.copy(toPlayer).normalize();
      } else if (entity.type !== 'dummy' && entity.speed > 0 && !chasing && entity.wanderTimer <= 0) {
        entity.wanderTimer = rand(1.5, 4.5);
        entity.wanderDir.set(rand(-1, 1), 0, rand(-1, 1)).normalize();
      }
      if (!chasing && entity.type !== 'dummy' && entity.speed > 0 && entity.wanderTimer > 0 && activity > 0 && entity.isStunned <= 0) {
        const shouldWander = entity.type === 'citizen' || entity.type === 'maniac' || (entity.type === 'deity' && forcedAggro);
        if (shouldWander && entity.wanderTimer > 0) desired.copy(entity.wanderDir);
        if (entity.type === 'bully' && activity > 0 && distance > 14) desired.set(0, 0, 0);
      }
      const npcSpeed = entity.speed * activity * (entity.type === 'deity' ? .78 : 1);
      if (desired.lengthSq() > .001 && entity.isStunned <= 0) {
        desired.normalize();
        entity.velocity.x += desired.x * 5 * dt;
        entity.velocity.z += desired.z * 5 * dt;
        entity.root.rotation.y = Math.atan2(desired.x, desired.z);
      }
      const cap = chasing ? npcSpeed * 1.16 : npcSpeed * .55;
      const horizontal = Math.hypot(entity.velocity.x, entity.velocity.z);
      if (horizontal > cap && cap > 0) { entity.velocity.x *= cap / horizontal; entity.velocity.z *= cap / horizontal; }
      entity.velocity.x *= Math.pow(.9, dt * 60);
      entity.velocity.z *= Math.pow(.9, dt * 60);
      if (entity.isStunned <= 0) entity.velocity.y -= 18 * Number(this.server.gravity || 1) * dt;
      entity.position.addScaledVector(entity.velocity, dt);
      if (entity.position.y <= entity.floorY) {
        entity.position.y = entity.floorY;
        if (entity.velocity.y < -2.7) entity.velocity.y *= -.18;
        else entity.velocity.y = 0;
      }
      const bounds = this.mapBounds - 1;
      entity.position.x = clamp(entity.position.x, -bounds, bounds);
      entity.position.z = clamp(entity.position.z, -bounds, bounds);
      if (chasing && distance < 1.45 && entity.bumpCooldown <= 0 && this.player && !this.player.seated) {
        this.tagPlayer(entity, toPlayer);
      }
      this.updateActorPose(entity, elapsed, horizontal);
    }
  }

  tagPlayer(npc, toPlayer) {
    if (!this.player) return;
    const away = toPlayer.lengthSq() > .001 ? toPlayer.clone().normalize() : this.getPlayerForward().multiplyScalar(-1);
    const strength = npc.type === 'deity' ? 11 : npc.type === 'bully' ? 6.5 : 5.5;
    this.player.velocity.x += away.x * strength;
    this.player.velocity.z += away.z * strength;
    this.player.velocity.y = Math.max(this.player.velocity.y, strength * .34);
    npc.velocity.addScaledVector(away, -2.1);
    npc.bumpCooldown = 1.3;
    npc.tagCooldown = 1.5;
    this.shake = Math.max(this.shake, .18 * Number(this.settings?.effects?.shake ?? .35));
    this.spawnImpact(this.player.position.clone().add(v3(0, 1.25, 0)), 0x9ce3d3, 5);
    this.callbacks.onHit?.();
  }

  updateEntities(dt) {
    const gravity = 18 * Number(this.server.gravity || 1);
    for (const entity of this.entities) {
      if (!entity.alive || entity === this.player || entity.kind === 'npc') continue;
      if (this.tractor === entity && (this.mobileTractor || this.pointerState?.active)) continue;
      entity.velocity.y -= gravity * dt;
      entity.position.addScaledVector(entity.velocity, dt);
      let floor = entity.floorY ?? 0;
      if (this.mapId === 'test' && entity.type === 'ball' && Math.abs(entity.position.x - 18) < 2.2 && Math.abs(entity.position.z + 8) < 2.2) floor = 8.25;
      if (entity.position.y < floor) {
        const impactVelocity = entity.velocity.y;
        entity.position.y = floor;
        entity.velocity.y = impactVelocity < -2.8 ? -impactVelocity * .25 : 0;
        entity.velocity.x *= .89;
        entity.velocity.z *= .89;
      }
      entity.velocity.x *= Math.pow(.992, dt * 60);
      entity.velocity.z *= Math.pow(.992, dt * 60);
      entity.angularVelocity.multiplyScalar(Math.pow(.965, dt * 60));
      entity.root.rotation.x += entity.angularVelocity.x * dt;
      entity.root.rotation.y += entity.angularVelocity.y * dt;
      entity.root.rotation.z += entity.angularVelocity.z * dt;
      const b = this.mapBounds - .8;
      if (entity.position.x < -b || entity.position.x > b) { entity.position.x = clamp(entity.position.x, -b, b); entity.velocity.x *= -.35; }
      if (entity.position.z < -b || entity.position.z > b) { entity.position.z = clamp(entity.position.z, -b, b); entity.velocity.z *= -.35; }
    }
  }

  applyImpact(entity, origin, force, color = 0xf3ca62) {
    if (!entity || entity === this.player || !entity.alive) return;
    const direction = entity.position.clone().sub(origin);
    if (direction.lengthSq() < .0001) direction.copy(this.getAimDirection());
    direction.y = Math.max(-.15, direction.y);
    direction.normalize();
    const powerScale = entity.type === 'deity' ? .27 : entity.kind === 'npc' ? 1 : 1.18;
    const impulse = force * powerScale;
    entity.velocity.x += direction.x * impulse;
    entity.velocity.z += direction.z * impulse;
    entity.velocity.y += Math.max(.9, impulse * (entity.kind === 'npc' ? .16 : .21));
    entity.angularVelocity.x += rand(-2, 2) * impulse * .12;
    entity.angularVelocity.z += rand(-2, 2) * impulse * .12;
    if (entity.kind === 'npc') {
      const ragdollEnabled = this.settings?.effects?.ragdoll !== false && this.server.ragdoll !== false;
      entity.isStunned = Math.max(entity.isStunned, ragdollEnabled ? .78 + Math.min(.7, force * .035) : .12);
      entity.aggroUntil = performance.now() / 1000 + (entity.type === 'citizen' || entity.type === 'deity' || entity.type === 'maniac' ? 6.5 : 0);
      if (entity.type === 'deity') entity.aggroUntil = performance.now() / 1000 + 4;
    }
    const point = entity.position.clone().add(v3(0, entity.kind === 'npc' ? 1.35 : .6, 0));
    this.spawnImpact(point, color, 7);
    const shakeScale = Number(this.settings?.effects?.shake ?? .35);
    this.shake = Math.max(this.shake, clamp(force * .018 * shakeScale, 0, .22));
    this.callbacks.onHit?.();
  }

  spawnImpact(point, color = 0xf3ca62, count = 7) {
    if (this.settings?.effects?.impactFx === false) return;
    const intensity = Number(this.settings?.effects?.intensity ?? 1);
    const total = Math.max(8, Math.round(count * 1.65 * clamp(intensity, 0.25, 1.6)));
    const chosen = color === 0x73dbee ? color : this.impactColor(color);
    const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(.16, 0), new THREE.MeshBasicMaterial({ color: chosen, transparent: true, opacity: .9, depthWrite: false, toneMapped: false }));
    flash.position.copy(point);
    this.worldGroup.add(flash);
    this.effects.push({ mesh: flash, age: 0, life: .24, kind: 'burst' });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.14, .024, 5, 14), new THREE.MeshBasicMaterial({ color: chosen, transparent: true, opacity: .95, depthWrite: false, toneMapped: false }));
    ring.position.copy(point);
    ring.quaternion.setFromUnitVectors(v3(0, 0, 1), this.getAimDirection());
    this.worldGroup.add(ring);
    this.effects.push({ mesh: ring, age: 0, life: .32, kind: 'hitRing' });
    for (let i = 0; i < total; i++) {
      const size = rand(.055, .12) * (intensity > 1 ? 1.18 : 1);
      const material = new THREE.MeshBasicMaterial({ color: chosen, transparent: true, opacity: .98, depthWrite: false, toneMapped: false });
      const particle = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), material);
      particle.position.copy(point).add(v3(rand(-.09, .09), rand(-.04, .1), rand(-.09, .09)));
      this.worldGroup.add(particle);
      this.particles.push({ mesh: particle, velocity: v3(rand(-4.4, 4.4), rand(1.8, 5.4), rand(-4.4, 4.4)), age: 0, life: rand(.34, .72) });
    }
  }

  impactColor(fallback) {
    const color = this.settings?.effects?.color || 'amber';
    if (color === 'red') return 0xff8c78;
    if (color === 'cyan') return 0x76e1d1;
    return fallback || 0xf3ca62;
  }

  addBeam(start, end, color, width = .025) {
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (!length) return;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(width * .45, width, length, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .78 }));
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(v3(0, 1, 0), direction.normalize());
    this.worldGroup.add(mesh);
    this.effects.push({ mesh, age: 0, life: .09, kind: 'fade' });
  }

  explode(point, color = 0xff8d66) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.65, .055, 6, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .83, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(point);
    this.worldGroup.add(ring);
    this.effects.push({ mesh: ring, age: 0, life: .52, kind: 'ring' });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(.45, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .28, depthWrite: false }));
    sphere.position.copy(point);
    this.worldGroup.add(sphere);
    this.effects.push({ mesh: sphere, age: 0, life: .28, kind: 'burst' });
    for (const entity of this.entities) {
      if (!entity.alive || entity === this.player) continue;
      const delta = entity.position.clone().add(v3(0, entity.kind === 'npc' ? 1 : .2, 0)).sub(point);
      const distance = delta.length();
      if (distance < 7.5) {
        const force = (1 - distance / 7.5) * 12;
        this.applyImpact(entity, point, force, color);
      }
    }
    this.shake = Math.max(this.shake, .26 * Number(this.settings?.effects?.shake ?? .35));
    this.callbacks.onHit?.();
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.age += dt;
      particle.velocity.y -= 5 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.material.opacity = Math.max(0, 1 - particle.age / particle.life);
      if (particle.age >= particle.life) {
        this.worldGroup.remove(particle.mesh);
        particle.mesh.geometry.dispose(); particle.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.age += dt;
      const progress = clamp(effect.age / effect.life, 0, 1);
      const material = effect.mesh.material;
      material.opacity = 1 - progress;
      if (effect.kind === 'ring') effect.mesh.scale.setScalar(1 + progress * 6.5);
      else if (effect.kind === 'hitRing') effect.mesh.scale.setScalar(1 + progress * 4.4);
      else if (effect.kind === 'burst') effect.mesh.scale.setScalar(1 + progress * 3.2);
      if (effect.age >= effect.life) {
        this.worldGroup.remove(effect.mesh);
        effect.mesh.geometry.dispose(); material.dispose();
        this.effects.splice(i, 1);
      }
    }
    this.shake = Math.max(0, this.shake - dt * 1.5);
  }

  useCurrentTool() {
    if (!this.player || this.paused) return;
    const weapon = this.weapon();
    if (weapon.kind === 'tool') return;
    if (weapon.kind === 'melee') {
      this.player.stanceTimer = 3;
      const actor = this.player.actor;
      actor.parts.leftArm.rotation.x = -.48;
      actor.parts.rightArm.rotation.x = -.7;
      actor.parts.leftArm.rotation.z = -.25;
      actor.parts.rightArm.rotation.z = .2;
      const found = this.pickEntity(weapon.range);
      if (found) this.applyImpact(found.entity, this.player.position.clone().add(v3(0, 1.15, 0)), weapon.force, this.impactColor(0xf3ca62));
      this.callbacks.onAction?.('melee');
      return;
    }
    const origin = this.getAimOrigin();
    const aim = this.getAimDirection();
    this.viewKick = Math.max(this.viewKick, weapon.kind === 'water' ? .06 : .11);
    if (weapon.kind === 'launcher') {
      const found = this.pickEntity(weapon.range, aim, origin);
      const point = found ? found.point : origin.clone().addScaledVector(aim, 22);
      this.addBeam(origin.clone().addScaledVector(aim, .7), point, weapon.color, .075);
      this.explode(point, weapon.color);
      this.callbacks.onAction?.('launcher');
      return;
    }
    if (weapon.kind === 'scatter') {
      const cameraRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
      const cameraUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
      const centralHit = this.pickEntity(weapon.range, aim, origin);
      const impactTargets = new Set();
      for (let i = 0; i < 7; i++) {
        const spread = aim.clone().addScaledVector(cameraRight, rand(-.08, .08)).addScaledVector(cameraUp, rand(-.07, .07)).normalize();
        const found = this.pickEntity(weapon.range, spread, origin);
        const end = found ? found.point : origin.clone().addScaledVector(spread, weapon.range * .72);
        this.addBeam(origin, end, weapon.color, .023);
        if (found) impactTargets.add(found.entity);
      }
      if (!impactTargets.size && centralHit) impactTargets.add(centralHit.entity);
      for (const target of impactTargets) this.applyImpact(target, origin, weapon.force, weapon.color);
      this.callbacks.onAction?.('shot');
      return;
    }
    const found = this.pickEntity(weapon.range, aim, origin);
    const endpoint = found ? found.point : origin.clone().addScaledVector(aim, weapon.range * .74);
    this.addBeam(origin.clone().addScaledVector(aim, .65), endpoint, weapon.color, weapon.kind === 'water' ? .05 : .028);
    if (found) this.applyImpact(found.entity, origin, weapon.force, weapon.color);
    if (weapon.kind === 'water') {
      const splashPoint = endpoint;
      this.spawnImpact(splashPoint, 0x73dbee, 8);
    }
    this.callbacks.onAction?.(weapon.kind === 'water' ? 'water' : 'shot');
  }

  beginTractor() {
    const found = this.pickEntity(24);
    if (!found) return;
    this.tractor = found.entity;
    this.mobileTractor = false;
    this.tractorDistance = clamp(found.distance, 2.4, 15);
    this.tractor.velocity.set(0, 0, 0);
    this.callbacks.onGrab?.(true);
  }

  toggleMobileTractor() {
    if (this.currentWeaponId !== 'crusher' || this.mode !== 'game' || this.paused) return;
    if (this.mobileTractor && this.tractor) {
      this.releaseTractor();
      return;
    }
    this.beginTractor();
    if (this.tractor) this.mobileTractor = true;
    else this.callbacks.onToast?.('noTarget');
  }

  updateTractor() {
    if (!this.tractor || !this.tractor.alive) return;
    const origin = this.getAimOrigin();
    const direction = this.getAimDirection();
    const target = origin.addScaledVector(direction, this.tractorDistance);
    const lift = this.tractor.kind === 'npc' ? 1.15 : Math.max(.1, this.tractor.floorY || 0);
    target.y = Math.max(lift, target.y);
    const delta = target.sub(this.tractor.position);
    this.tractor.velocity.copy(delta.multiplyScalar(12));
    const max = 18;
    if (this.tractor.velocity.length() > max) this.tractor.velocity.setLength(max);
    this.tractor.position.addScaledVector(this.tractor.velocity, .016);
  }

  releaseTractor() {
    if (!this.tractor) { this.mobileTractor = false; return; }
    this.tractor = null;
    this.mobileTractor = false;
    this.callbacks.onGrab?.(false);
  }

  spawnFromRightClick() {
    if (this.mode !== 'game' || this.paused) return;
    this.spawnSelected();
  }

  onPointerDown(event) {
    if (this.mode === 'disconnect') return;
    if (this.mode === 'menu') {
      if (event.button === 0 && this.menuHover && !this.menuDisconnect) {
        this.menuDisconnect = true;
        setTimeout(() => {
          this.mode = 'disconnect';
          this.callbacks.onDisconnect?.();
        }, 150);
      }
      return;
    }
    if (this.mode !== 'game' || this.paused) return;
    event.preventDefault();
    this.pointerState = { active: true, button: event.button, x: event.clientX, y: event.clientY, dragged: false };
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* Safari/embedded preview may decline capture */ }
    if (event.button === 0 && this.currentWeaponId === 'crusher') this.beginTractor();
  }

  onPointerMove(event) {
    if (this.mode === 'menu') {
      const rect = this.canvas.getBoundingClientRect();
      const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(pointer, this.camera);
      const hits = this.menuDoll ? this.raycaster.intersectObject(this.menuDoll.root, true) : [];
      const hover = hits.length > 0;
      if (hover !== this.menuHover) {
        this.menuHover = hover;
        this.canvas.style.cursor = hover ? 'pointer' : 'default';
        if (this.menuDoll?.blaster) this.menuDoll.blaster.forEach((mesh) => { mesh.visible = hover; });
        this.callbacks.onMenuHover?.(hover);
      }
      return;
    }
    if (this.mode !== 'game' || this.paused || !this.pointerState?.active) return;
    const dx = event.clientX - this.pointerState.x;
    const dy = event.clientY - this.pointerState.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.pointerState.dragged = true;
    if (this.pointerState.dragged) {
      this.cameraYaw -= dx * .0046;
      this.cameraPitch = clamp(this.cameraPitch + dy * .0032, -1.1, 1.1);
      this.pointerState.x = event.clientX;
      this.pointerState.y = event.clientY;
    }
  }

  onPointerUp(event) {
    if (!this.pointerState) return;
    const state = this.pointerState;
    this.pointerState = null;
    if (this.mode !== 'game' || this.paused) return;
    if (state.button === 0) {
      if (this.currentWeaponId === 'crusher') {
        const hadTarget = Boolean(this.tractor);
        if (!this.mobileTractor) this.releaseTractor();
        if (!state.dragged && !hadTarget) this.callbacks.onAction?.('tool');
      } else if (!state.dragged) this.useCurrentTool();
    } else if (state.button === 2 && !state.dragged) {
      this.spawnFromRightClick();
    }
  }

  onWheel(event) {
    if (this.mode !== 'game' || this.paused) return;
    if (this.currentWeaponId === 'crusher') {
      event.preventDefault();
      this.deleteFocused();
    }
  }

  onKeyDown(event) {
    if (event.code === 'Escape') {
      if (this.mode === 'game') {
        event.preventDefault();
        this.callbacks.onToggleMenu?.();
      }
      return;
    }
    if (this.mode !== 'game' || this.paused) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Space') this.jump();
    if (event.code === 'KeyE') this.interact();
    if (event.code === 'KeyG') this.dropWeapon();
    if (event.code === 'Digit1') this.setWeapon('fists');
    if (event.code === 'Digit2') this.setWeapon('crusher');
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  updateCamera(dt) {
    if (!this.player) return;
    const eye = this.player.position.clone().add(v3(0, this.player.seated ? 1.12 : 1.66, 0));
    if (this.shake > .002) {
      eye.x += rand(-1, 1) * this.shake * .42;
      eye.y += rand(-1, 1) * this.shake * .3;
      eye.z += rand(-1, 1) * this.shake * .42;
    }
    const cosPitch = Math.cos(this.cameraPitch);
    const direction = v3(
      Math.sin(this.cameraYaw) * cosPitch,
      -Math.sin(this.cameraPitch),
      -Math.cos(this.cameraYaw) * cosPitch
    ).normalize();
    this.camera.position.copy(eye);
    this.camera.lookAt(eye.clone().add(direction));
    this.camera.updateMatrixWorld(true);
    if (this.viewModel) {
      this.viewClock += dt;
      const speed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
      const bob = this.player.grounded && speed > .35 ? Math.sin(this.viewClock * 10) * .018 : 0;
      this.viewKick = Math.max(0, this.viewKick - dt * 1.9);
      this.viewModel.position.set(0, bob, this.viewKick);
    }
  }

  updateMenu(dt, elapsed) {
    this.menuTime += dt;
    if (!this.menuDoll) return;
    const figure = this.menuDoll;
    figure.root.position.y = Math.sin(elapsed * 1.3) * .012;
    const towardCamera = Math.atan2(this.camera.position.x - figure.root.position.x, this.camera.position.z - figure.root.position.z);
    const idleFacing = Math.PI * .88 + Math.sin(elapsed * .35) * .055;
    const goal = this.menuHover ? towardCamera : idleFacing;
    let difference = goal - figure.root.rotation.y;
    difference = Math.atan2(Math.sin(difference), Math.cos(difference));
    figure.root.rotation.y += difference * Math.min(1, dt * 3.5);
    figure.parts.leftArm.rotation.x = this.menuHover ? -.12 : Math.sin(elapsed * .7) * .025;
    figure.parts.rightArm.rotation.x = this.menuHover ? -.78 : Math.sin(elapsed * .7 + 1) * .025;
    figure.parts.rightArm.rotation.z = this.menuHover ? -.3 : 0;
    this.camera.position.x = 5.8 + Math.sin(elapsed * .17) * .48;
    this.camera.position.y = 4 + Math.sin(elapsed * .22) * .12;
    this.camera.lookAt(0, 1.02, 0);
  }

  publishHud() {
    this.callbacks.onHUD?.({
      entities: Math.max(0, this.entities.length - (this.player ? 1 : 0)),
      weapon: this.weapon(this.currentWeaponId), mapId: this.mapId, fps: this.currentFps,
      stance: Boolean(this.player?.stanceTimer > 0)
    });
  }

  animate(now) {
    requestAnimationFrame(this.animate);
    const limit = Number(this.settings?.graphics?.fpsCap || 60);
    if (now - this.lastDrawAt < 1000 / limit - 1) return;
    const dt = clamp((now - this.lastTime) / 1000, 0, .045);
    this.lastTime = now;
    this.lastDrawAt = now;
    const elapsed = now / 1000;
    if (this.mode === 'menu') this.updateMenu(dt, elapsed);
    else if (this.mode === 'game') {
      if (!this.paused) {
        this.updatePlayer(dt, elapsed);
        this.updateNPCs(dt, elapsed);
        this.updateEntities(dt, elapsed);
      }
      this.updateCamera(dt);
      this.updateEffects(dt);
    }
    this.renderer.render(this.scene, this.camera);
    this.fpsFrames++;
    if (now - this.fpsWindowStart >= 500) {
      this.currentFps = Math.round(this.fpsFrames * 1000 / (now - this.fpsWindowStart));
      this.fpsFrames = 0;
      this.fpsWindowStart = now;
    }
    if (now - this.lastHudAt > 250 && this.mode === 'game') {
      this.lastHudAt = now;
      this.publishHud();
    }
  }
}
