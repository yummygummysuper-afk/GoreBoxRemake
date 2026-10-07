import './style.css';
import { SandboxGame, WEAPON_DEFS } from './game.js';
import { LANGUAGES, translate, applyTranslations } from './i18n.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const PRESETS = {
  potato: { resolution: .62, shadows: false, shadowQuality: 512, fog: false, foliage: .15, drawDistance: 72, fpsCap: 30, toneMapping: false, ambient: 1.4, sunlight: 2.1 },
  low: { resolution: .78, shadows: false, shadowQuality: 512, fog: true, foliage: .3, drawDistance: 95, fpsCap: 45, toneMapping: false, ambient: 1.6, sunlight: 2.4 },
  medium: { resolution: 1, shadows: true, shadowQuality: 512, fog: true, foliage: .55, drawDistance: 145, fpsCap: 60, toneMapping: true, ambient: 1.8, sunlight: 2.7 },
  high: { resolution: 1, shadows: true, shadowQuality: 1024, fog: true, foliage: .75, drawDistance: 190, fpsCap: 60, toneMapping: true, ambient: 2.0, sunlight: 3.0 },
  ultra: { resolution: 1.18, shadows: true, shadowQuality: 2048, fog: true, foliage: 1, drawDistance: 240, fpsCap: 90, toneMapping: true, ambient: 2.15, sunlight: 3.3 },
  cinematic: { resolution: 1.35, shadows: true, shadowQuality: 2048, fog: true, foliage: 1, drawDistance: 270, fpsCap: 60, toneMapping: true, ambient: 2.25, sunlight: 3.55 }
};
const PRESET_KEYS = ['potato', 'low', 'medium', 'high', 'ultra', 'cinematic'];
const DEFAULTS = {
  graphics: { preset: 'medium', ...PRESETS.medium, pixelRatioCap: 1.7 },
  effects: { impactFx: true, blurFx: false, shake: .35, ragdoll: true, intensity: 1, color: 'red' },
  audio: { music: .2, sfx: .58, master: .72 },
  language: 'ru',
  server: { gravity: 1, npcActivity: 'reactive' }
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('gbremake-settings') || 'null');
    if (!saved) return structuredClone(DEFAULTS);
    return {
      graphics: { ...DEFAULTS.graphics, ...(saved.graphics || {}) },
      effects: { ...DEFAULTS.effects, ...(saved.effects || {}) },
      audio: { ...DEFAULTS.audio, ...(saved.audio || {}) },
      language: LANGUAGES.some((item) => item.code === saved.language) ? saved.language : 'ru',
      server: { ...DEFAULTS.server, ...(saved.server || {}) }
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}
let settings = loadSettings();
const tr = (key) => translate(settings.language, key);
const saveSettings = () => {
  try { localStorage.setItem('gbremake-settings', JSON.stringify(settings)); } catch { /* Private browsing may disable storage. */ }
};
const setPath = (path, value) => {
  const keys = path.split('.');
  let target = settings;
  for (const key of keys.slice(0, -1)) target = target[key];
  target[keys.at(-1)] = value;
  if (path.startsWith('graphics.') && keys.at(-1) !== 'preset') settings.graphics.preset = 'custom';
  saveSettings();
  game?.applySettings(settings);
};

class AudioMixer {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.music = null;
    this.sfx = null;
    this.started = false;
    this.chordIndex = 0;
    this.musicTimer = null;
    this.lastClickAt = 0;
  }
  async start() {
    if (this.started) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume().catch(() => {});
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.master.gain.value = 0.72;
      this.music.gain.value = 0.018;
      this.sfx.gain.value = 0.6;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 520; filter.Q.value = .5;
      filter.connect(this.music);
      this.padA = this.ctx.createOscillator(); this.padB = this.ctx.createOscillator(); this.padC = this.ctx.createOscillator();
      this.padA.type = 'sine'; this.padB.type = 'triangle'; this.padC.type = 'sine';
      this.padA.frequency.value = 110; this.padB.frequency.value = 164.81; this.padC.frequency.value = 220;
      const padGainA = this.ctx.createGain(); const padGainB = this.ctx.createGain(); const padGainC = this.ctx.createGain();
      padGainA.gain.value = .7; padGainB.gain.value = .18; padGainC.gain.value = .12;
      this.padA.connect(padGainA); this.padB.connect(padGainB); this.padC.connect(padGainC);
      padGainA.connect(filter); padGainB.connect(filter); padGainC.connect(filter);
      this.padA.start(); this.padB.start(); this.padC.start();
      this.started = true;
      const chords = [[110,164.81,220],[98,146.83,196],[130.81,196,261.63],[87.31,130.81,174.61]];
      this.musicTimer = window.setInterval(() => {
        if (!this.ctx) return;
        const next = chords[(++this.chordIndex) % chords.length];
        const t = this.ctx.currentTime;
        this.padA.frequency.setTargetAtTime(next[0], t, 1.8);
        this.padB.frequency.setTargetAtTime(next[1], t, 1.8);
        this.padC.frequency.setTargetAtTime(next[2], t, 1.8);
      }, 5200);
      this.apply(settings.audio);
    } catch { this.started = false; }
  }
  apply(audio) {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(clamp(audio.master, 0, 1), now, .05);
    this.music.gain.setTargetAtTime(clamp(audio.music, 0, 1) * .08, now, .08);
    this.sfx.gain.setTargetAtTime(clamp(audio.sfx, 0, 1), now, .05);
  }
  tone(frequency, duration = .08, type = 'sine', volume = .15, endFrequency = null) {
    if (!this.ctx || !this.sfx || settings.audio.sfx <= 0) return;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain); gain.connect(this.sfx);
    oscillator.start(now); oscillator.stop(now + duration + .01);
  }
  click() {
    const now = performance.now();
    if (now - this.lastClickAt < 45) return;
    this.lastClickAt = now;
    this.tone(480, .045, 'triangle', .055, 720);
  }
  hover() { this.tone(630, .027, 'sine', .024, 520); }
  action(kind = 'hit') {
    if (kind === 'water') { this.tone(540, .12, 'sine', .08, 240); return; }
    if (kind === 'launcher') { this.tone(118, .22, 'sawtooth', .16, 48); this.tone(420, .14, 'triangle', .06, 90); return; }
    if (kind === 'shot') { this.tone(210, .075, 'square', .065, 72); return; }
    if (kind === 'melee') { this.tone(170, .09, 'triangle', .075, 90); return; }
    if (kind === 'tool') { this.tone(320, .07, 'sine', .05, 680); return; }
    this.tone(140, .11, 'triangle', .08, 80);
  }
}
const audio = new AudioMixer();
document.addEventListener('pointerdown', () => audio.start(), { once: true });

const app = $('#app');
const mainScreen = $('#main-screen');
const mapScreen = $('#map-screen');
const settingsScreen = $('#settings-screen');
const exitScreen = $('#exit-screen');
const disconnectScreen = $('#disconnect-screen');
const gameHud = $('#game-hud');
const gameMenu = $('#game-menu');
const settingsContent = $('#settings-content');
const gameMenuContent = $('#game-menu-content');
const mobileControls = $('#mobile-controls');
const moveStick = $('#move-stick');
const stickKnob = $('#stick-knob');
const toastEl = $('#toast');
let game = null;
let currentScreen = 'main';
let selectedMap = 'plains';
let selectedSettingsTab = 'graphics';
let selectedGameTab = 'objects';
let gameMenuOpen = false;
let toastTimer = 0;
let impactBlurTimer = 0;
let hitPulseTimer = 0;
let stickPointerId = null;

const mapNameKey = (id) => id === 'test' ? 'map_test' : 'map_plains';
const spawnLabels = {
  table: 'spawn_table', chair: 'spawn_chair', wall: 'spawn_wall',
  dummy: 'npc_dummy', citizen: 'npc_citizen', deity: 'npc_deity', bully: 'npc_bully', maniac: 'npc_maniac'
};
const toastText = (key) => {
  const staticKeys = {
    stand: 'Встал', nothing: 'Рядом нет подходящего объекта', picked: 'Предмет подобран', permanent: 'Стартовый предмет нельзя выбросить',
    noTarget: 'В прицеле нет объекта', removed: tr('removed'), sit: 'Сел на стул', tool: 'Reality Crusher готов',
    grabbed: 'Объект захвачен', dropped: tr('dropped')
  };
  if (key === 'nothing') return tr('no_target');
  if (key === 'stand') return settings.language === 'ru' ? 'Ты встал' : 'Standing up';
  if (key === 'picked') return settings.language === 'ru' ? 'Снаряжение подобрано' : 'Gear picked up';
  if (key === 'permanent') return settings.language === 'ru' ? 'Стартовое снаряжение нельзя выбросить' : 'Starting gear is permanent';
  if (key === 'noTarget') return tr('no_target');
  if (key === 'removed') return tr('removed');
  if (key === 'sit') return settings.language === 'ru' ? 'Ты сел на стул' : 'You sat down';
  if (key.startsWith('spawned:')) {
    const id = key.slice(8);
    return `${tr('item_spawned')} ${spawnLabels[id] ? tr(spawnLabels[id]) : id}`;
  }
  if (key.startsWith('dropped:')) {
    const id = key.slice(8);
    const weapon = WEAPON_DEFS.find((item) => item.id === id);
    return `${tr('dropped')} ${weapon ? tr(weapon.key) : id}`;
  }
  if (key.startsWith('selected:')) {
    const id = key.slice(9);
    const item = spawnLabels[id] ? tr(spawnLabels[id]) : id;
    return `${tr('item_selected')} ${item} · ${tr('spawn_object_toast')}`;
  }
  return staticKeys[key] || key;
};
function showToast(key) {
  toastEl.textContent = toastText(String(key));
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 1900);
}

function setVisible(element, visible) {
  element.classList.toggle('is-visible', visible);
  element.setAttribute('aria-hidden', String(!visible));
}
function showMainScreen() {
  currentScreen = 'main';
  app.classList.remove('in-game');
  mainScreen.classList.remove('is-hidden');
  setVisible(mapScreen, false); setVisible(settingsScreen, false); setVisible(exitScreen, false);
  setVisible(gameHud, false); setVisible(gameMenu, false); setVisible(mobileControls, false);
  game?.setMobileMove(0, 0);
  $('.game-prototype').classList.remove('is-visible');
}
function openMapScreen() {
  currentScreen = 'maps';
  setVisible(mapScreen, true);
  setVisible(settingsScreen, false);
  setVisible(exitScreen, false);
}
function openSettingsScreen() {
  currentScreen = 'settings';
  selectedSettingsTab = 'graphics';
  $$('.settings-nav-button').forEach((button) => button.classList.toggle('active', button.dataset.settingsTab === selectedSettingsTab));
  renderSettingsContent(selectedSettingsTab);
  setVisible(settingsScreen, true);
  setVisible(mapScreen, false);
  setVisible(exitScreen, false);
}
function closeSettingsScreen() {
  setVisible(settingsScreen, false);
  currentScreen = 'main';
}
function startGame(mapId) {
  audio.start();
  selectedMap = mapId;
  currentScreen = 'game';
  gameMenuOpen = false;
  mainScreen.classList.add('is-hidden');
  setVisible(mapScreen, false); setVisible(settingsScreen, false); setVisible(exitScreen, false);
  app.classList.add('in-game');
  setVisible(gameHud, true);
  setVisible(mobileControls, true);
  $('.game-prototype').classList.add('is-visible');
  game.start(mapId);
  $('#hud-map-name').textContent = tr(mapNameKey(mapId)).toLocaleUpperCase(settings.language);
  $('#top-map-label').textContent = tr('menu_space');
}
function showExit() {
  currentScreen = 'exit';
  setVisible(exitScreen, true);
}

function settingRow(labelKey, path, control, descKey = '') {
  return `<div class="setting-row"><div class="setting-label"><strong>${esc(tr(labelKey))}</strong>${descKey ? `<small>${esc(tr(descKey))}</small>` : ''}</div><div class="setting-control">${control}</div></div>`;
}
function toggleControl(path, checked) {
  return `<label class="toggle"><input type="checkbox" data-control="${esc(path)}" ${checked ? 'checked' : ''}><span class="toggle-track"></span></label>`;
}
function rangeControl(path, value, min, max, step, output, unit = '') {
  return `<div class="range-control"><input type="range" data-control="${esc(path)}" min="${min}" max="${max}" step="${step}" value="${value}"><span class="range-value" data-output="${esc(path)}">${esc(output)}${esc(unit)}</span></div>`;
}
function selectControl(path, value, options) {
  return `<select data-control="${esc(path)}">${options.map(([key, label]) => `<option value="${esc(key)}" ${String(value) === String(key) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
}
function renderSettingsContent(tab) {
  if (!settingsContent) return;
  const g = settings.graphics, fx = settings.effects, sound = settings.audio;
  if (tab === 'graphics') {
    const presetButtons = PRESET_KEYS.map((key) => `<button class="preset-button ${g.preset === key ? 'active' : ''}" data-preset="${key}"><span>${esc(tr(key))}</span><small>${key === 'potato' ? '30 FPS / MIN' : key === 'cinematic' ? 'MAX / 60 FPS' : key.toUpperCase()}</small></button>`).join('');
    settingsContent.innerHTML = `
      <div class="settings-section-title"><h3>${esc(tr('quality_title'))}</h3><small>${esc(tr('quality_hint'))}</small></div>
      <div class="preset-grid">${presetButtons}</div>
      <div class="setting-list">
        ${settingRow('resolution', 'graphics.resolution', rangeControl('graphics.resolution', g.resolution, .55, 1.4, .05, `${Math.round(g.resolution * 100)}%`))}
        ${settingRow('shadows', 'graphics.shadows', toggleControl('graphics.shadows', g.shadows))}
        ${settingRow('shadow_quality', 'graphics.shadowQuality', selectControl('graphics.shadowQuality', g.shadowQuality, [['512', tr('low_opt')], ['1024', tr('normal_opt')], ['2048', tr('high_opt')]]))}
        ${settingRow('fog', 'graphics.fog', toggleControl('graphics.fog', g.fog))}
        ${settingRow('foliage', 'graphics.foliage', rangeControl('graphics.foliage', g.foliage, 0, 1, .05, `${Math.round(g.foliage * 100)}%`))}
        ${settingRow('draw_distance', 'graphics.drawDistance', rangeControl('graphics.drawDistance', g.drawDistance, 60, 270, 10, `${g.drawDistance} m`))}
        ${settingRow('fps_cap', 'graphics.fpsCap', selectControl('graphics.fpsCap', g.fpsCap, [['30','30 FPS'],['45','45 FPS'],['60','60 FPS'],['90','90 FPS'],['120','120 FPS']]))}
        ${settingRow('tone_mapping', 'graphics.toneMapping', toggleControl('graphics.toneMapping', g.toneMapping))}
        ${settingRow('ambient_light', 'graphics.ambient', rangeControl('graphics.ambient', g.ambient, .5, 2.8, .1, g.ambient.toFixed(1)))}
        ${settingRow('sunlight', 'graphics.sunlight', rangeControl('graphics.sunlight', g.sunlight, .5, 4, .1, g.sunlight.toFixed(1)))}
      </div>`;
  } else if (tab === 'effects') {
    settingsContent.innerHTML = `
      <div class="settings-section-title"><h3>${esc(tr('effects'))}</h3><small>SAFE / STYLIZED</small></div>
      <div class="hint-box">${esc(tr('no_gore_note'))}</div>
      <div class="setting-list" style="margin-top:12px">
        ${settingRow('impact_fx', 'effects.impactFx', toggleControl('effects.impactFx', fx.impactFx), 'impact_fx_desc')}
        ${settingRow('blur_fx', 'effects.blurFx', toggleControl('effects.blurFx', fx.blurFx))}
        ${settingRow('shake', 'effects.shake', rangeControl('effects.shake', fx.shake, 0, 1, .05, `${Math.round(fx.shake * 100)}%`))}
        ${settingRow('ragdoll', 'effects.ragdoll', toggleControl('effects.ragdoll', fx.ragdoll))}
        ${settingRow('fx_level', 'effects.intensity', rangeControl('effects.intensity', fx.intensity, .25, 1.5, .05, `${Math.round(fx.intensity * 100)}%`))}
        ${settingRow('fx_color', 'effects.color', selectControl('effects.color', fx.color, [['amber', tr('amber')], ['red', tr('red')], ['cyan', tr('cyan')]]))}
      </div>`;
  } else if (tab === 'audio') {
    settingsContent.innerHTML = `
      <div class="settings-section-title"><h3>${esc(tr('audio'))}</h3><small>WEB AUDIO / SYNTH</small></div>
      <div class="hint-box">${esc(tr('click_to_start'))} — the browser enables audio after your first interaction.</div>
      <div class="setting-list" style="margin-top:12px">
        ${settingRow('master_volume', 'audio.master', rangeControl('audio.master', sound.master, 0, 1, .01, `${Math.round(sound.master * 100)}%`))}
        ${settingRow('music_volume', 'audio.music', rangeControl('audio.music', sound.music, 0, 1, .01, `${Math.round(sound.music * 100)}%`))}
        ${settingRow('sfx_volume', 'audio.sfx', rangeControl('audio.sfx', sound.sfx, 0, 1, .01, `${Math.round(sound.sfx * 100)}%`))}
      </div>`;
  } else {
    settingsContent.innerHTML = `
      <div class="settings-section-title"><h3>${esc(tr('language_title'))}</h3><small>${esc(tr('language_hint'))}</small></div>
      <div class="language-grid">${LANGUAGES.map((language) => `<button class="language-choice ${settings.language === language.code ? 'active' : ''}" data-language="${esc(language.code)}"><span>${esc(language.code.toUpperCase())}</span><span>${esc(language.native)}</span></button>`).join('')}</div>
      <div class="hint-box" style="margin-top:15px">GBRemake Prototype 0.1 — interface strings are translated as the prototype grows.</div>`;
  }
  bindSettingsControls();
}

function updateRangeOutput(input) {
  const output = $(`[data-output="${CSS.escape(input.dataset.control)}"]`, settingsContent);
  if (!output) return;
  const value = Number(input.value);
  const path = input.dataset.control;
  if (path.endsWith('resolution') || path.endsWith('foliage') || path.endsWith('shake') || path.endsWith('intensity') || path.startsWith('audio.')) output.textContent = `${Math.round(value * (path.startsWith('audio.') ? 100 : path.endsWith('resolution') || path.endsWith('foliage') || path.endsWith('shake') || path.endsWith('intensity') ? (path.endsWith('intensity') ? 100 : 100) : 1))}%`;
  else if (path.endsWith('drawDistance')) output.textContent = `${value} m`;
  else if (path.endsWith('ambient') || path.endsWith('sunlight')) output.textContent = value.toFixed(1);
  else output.textContent = String(value);
}
function bindSettingsControls() {
  $$('[data-control]', settingsContent).forEach((control) => {
    const eventName = control.type === 'range' ? 'input' : 'change';
    control.addEventListener(eventName, () => {
      const value = control.type === 'checkbox' ? control.checked : control.type === 'range' ? Number(control.value) : control.value;
      setPath(control.dataset.control, value);
      if (control.type === 'range') updateRangeOutput(control);
      if (control.dataset.control.startsWith('audio.')) audio.apply(settings.audio);
    });
  });
  $$('[data-preset]', settingsContent).forEach((button) => button.addEventListener('click', () => applyPreset(button.dataset.preset)));
  $$('[data-language]', settingsContent).forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.language)));
}
function applyPreset(key) {
  settings.graphics = { ...settings.graphics, ...PRESETS[key], preset: key };
  saveSettings();
  game?.applySettings(settings);
  renderSettingsContent('graphics');
  audio.click();
}
function setLanguage(code) {
  if (!LANGUAGES.some((item) => item.code === code)) return;
  settings.language = code;
  saveSettings();
  applyTranslations(code);
  audio.click();
  if (currentScreen === 'settings') renderSettingsContent(selectedSettingsTab);
  if (gameMenuOpen) renderGameMenuTab(selectedGameTab);
  if (game?.mode === 'game') {
    $('#hud-map-name').textContent = tr(mapNameKey(game.mapId)).toLocaleUpperCase(code);
    updateHud({ entities: game.entities.length - 1, weapon: game.weapon(), mapId: game.mapId, fps: game.currentFps, stance: Boolean(game.player?.stanceTimer > 0) });
  }
}

function openGameMenu() {
  if (!game || game.mode !== 'game' || gameMenuOpen) return;
  currentScreen = 'game';
  gameMenuOpen = true;
  game.pause(true);
  setVisible(mobileControls, false);
  selectedGameTab = 'objects';
  $$('.game-tab').forEach((button) => button.classList.toggle('active', button.dataset.gameTab === selectedGameTab));
  renderGameMenuTab(selectedGameTab);
  setVisible(gameMenu, true);
}
function closeGameMenu() {
  if (!gameMenuOpen) return;
  gameMenuOpen = false;
  setVisible(gameMenu, false);
  setVisible(mobileControls, true);
  game.pause(false);
}
function makeSpawnCard(id, titleKey, descKey, icon, choicePrefix = 'prop:') {
  const choice = `${choicePrefix}${id}`;
  const selected = game?.spawnChoice === choice;
  const desc = descKey ? tr(descKey) : tr('spawn');
  return `<button class="spawn-card ${selected ? 'selected' : ''}" data-spawn-choice="${esc(choice)}"><span class="spawn-icon">${icon}</span><strong>${esc(tr(titleKey))}</strong><small>${esc(desc)}</small></button>`;
}
function renderGameMenuTab(tab) {
  if (!gameMenuContent) return;
  if (tab === 'objects') {
    gameMenuContent.innerHTML = `<div class="menu-content-head"><div><h3>${esc(tr('choose_object'))}</h3><p>${esc(tr('spawn_tip'))}</p></div><span>PROPS / 03</span></div><div class="spawn-grid">${makeSpawnCard('table','spawn_table','prop_table_desc','▤')}${makeSpawnCard('chair','spawn_chair','prop_chair_desc','▣')}${makeSpawnCard('wall','spawn_wall','prop_wall_desc','▥')}</div><div class="hint-box">${esc(tr('interact_hint'))}</div>`;
  } else if (tab === 'npcs') {
    gameMenuContent.innerHTML = `<div class="menu-content-head"><div><h3>${esc(tr('choose_npc'))}</h3><p>${esc(tr('spawn_tip'))}</p></div><span>CHARACTERS / 05</span></div><div class="spawn-grid">${makeSpawnCard('dummy','npc_dummy','npc_dummy_desc','◌','npc:')}${makeSpawnCard('citizen','npc_citizen','npc_citizen_desc','◍','npc:')}${makeSpawnCard('deity','npc_deity','npc_deity_desc','✧','npc:')}${makeSpawnCard('bully','npc_bully','npc_bully_desc','⬟','npc:')}${makeSpawnCard('maniac','npc_maniac','npc_maniac_desc','◒','npc:')}</div><div class="hint-box">${esc(tr('no_gore_note'))}</div>`;
  } else if (tab === 'weapons') {
    const cards = WEAPON_DEFS.map((item) => `<button class="weapon-card ${game.currentWeaponId === item.id ? 'active' : ''}" data-equip="${esc(item.id)}"><span class="weapon-icon">${item.icon}</span><span><strong>${esc(tr(item.key))}</strong><small>${esc(tr(item.desc))}</small></span><span class="weapon-state">${item.permanent ? esc(tr('permanent')) : game.currentWeaponId === item.id ? esc(tr('selected')) : esc(tr('equip'))}</span></button>`).join('');
    gameMenuContent.innerHTML = `<div class="menu-content-head"><div><h3>${esc(tr('choose_weapon'))}</h3><p>${esc(tr('weapon_tool_desc'))}</p></div><span>LOADOUT / 10</span></div><div class="weapon-grid">${cards}</div><div class="hint-box">${esc(tr('weapon_fists'))} and Reality Crusher are permanent. Press G to drop other gear; walk up to a dropped item and press E to pick it up.</div>`;
  } else if (tab === 'server') {
    gameMenuContent.innerHTML = `<div class="menu-content-head"><div><h3>${esc(tr('server_options'))}</h3><p>LOCAL / SINGLE PLAYER</p></div><span>WORLD RULES</span></div><div class="server-settings">
      <div class="server-row"><div><strong>${esc(tr('gravity'))}</strong><small>Physics acceleration</small></div><select data-server-setting="gravity"><option value="0.55" ${game.server.gravity === .55 ? 'selected' : ''}>${esc(tr('low_gravity'))}</option><option value="1" ${game.server.gravity === 1 ? 'selected' : ''}>${esc(tr('normal'))}</option><option value="1.45" ${game.server.gravity === 1.45 ? 'selected' : ''}>${esc(tr('high_gravity'))}</option></select></div>
      <div class="server-row"><div><strong>${esc(tr('npc_activity'))}</strong><small>Simple, non-graphic chase and tag AI</small></div><select data-server-setting="npcActivity"><option value="peaceful" ${game.server.npcActivity === 'peaceful' ? 'selected' : ''}>${esc(tr('peaceful'))}</option><option value="reactive" ${game.server.npcActivity === 'reactive' ? 'selected' : ''}>${esc(tr('reactive'))}</option><option value="busy" ${game.server.npcActivity === 'busy' ? 'selected' : ''}>${esc(tr('busy'))}</option></select></div>
      <div class="server-row"><div><strong>${esc(tr('ragdoll'))}</strong><small>NPCs use playful push reactions</small></div>${toggleControl('server.ragdoll', settings.server.ragdoll !== false)}</div>
      </div><div class="hint-box">${esc(tr('no_gore_note'))}</div>`;
  } else {
    const qualityOptions = PRESET_KEYS.map((key) => [key, tr(key)]);
    gameMenuContent.innerHTML = `<div class="menu-content-head"><div><h3>${esc(tr('settings'))}</h3><p>QUICK OPTIONS / APPLY LIVE</p></div><span>SETUP</span></div><div class="server-settings">
      <div class="server-row"><div><strong>${esc(tr('quality_title'))}</strong><small>${esc(tr('quality_hint'))}</small></div><select data-game-preset>${qualityOptions.map(([key,label]) => `<option value="${esc(key)}" ${settings.graphics.preset === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div>
      <div class="server-row"><div><strong>${esc(tr('shadows'))}</strong><small>Three.js shadow map</small></div>${toggleControl('graphics.shadows', settings.graphics.shadows)}</div>
      <div class="server-row"><div><strong>${esc(tr('fog'))}</strong><small>Atmospheric depth</small></div>${toggleControl('graphics.fog', settings.graphics.fog)}</div>
      <div class="server-row"><div><strong>${esc(tr('impact_fx'))}</strong><small>${esc(tr('impact_fx_desc'))}</small></div>${toggleControl('effects.impactFx', settings.effects.impactFx)}</div>
      <div class="server-row"><div><strong>${esc(tr('music_volume'))}</strong><small>Web Audio</small></div><input type="range" min="0" max="1" step=".01" value="${settings.audio.music}" data-server-setting="music"></div>
      </div><div class="hint-box">${esc(tr('settings_note'))} You can fine tune graphics, effects, audio and the 20 language choices from the main menu.</div>`;
  }
  $$('[data-spawn-choice]', gameMenuContent).forEach((button) => button.addEventListener('click', () => {
    game.setSpawnChoice(button.dataset.spawnChoice);
    showToast(`selected:${button.dataset.spawnChoice.split(':')[1]}`);
    audio.click();
    renderGameMenuTab(tab);
  }));
  $$('[data-equip]', gameMenuContent).forEach((button) => button.addEventListener('click', () => {
    game.setWeapon(button.dataset.equip);
    audio.click();
    renderGameMenuTab('weapons');
  }));
  $$('[data-server-setting]', gameMenuContent).forEach((control) => {
    control.addEventListener('change', () => {
      if (control.dataset.serverSetting === 'gravity') game.server.gravity = Number(control.value);
      else if (control.dataset.serverSetting === 'npcActivity') game.server.npcActivity = control.value;
      else if (control.dataset.serverSetting === 'music') {
        settings.audio.music = Number(control.value); saveSettings(); audio.apply(settings.audio);
      }
      audio.click();
    });
    if (control.type === 'range') control.addEventListener('input', () => {
      if (control.dataset.serverSetting === 'music') { settings.audio.music = Number(control.value); saveSettings(); audio.apply(settings.audio); }
    });
  });
  $$('[data-control]', gameMenuContent).forEach((control) => {
    control.addEventListener('change', () => {
      const value = control.type === 'checkbox' ? control.checked : control.value;
      setPath(control.dataset.control, value);
      if (control.dataset.control.startsWith('server.')) game.server.ragdoll = value;
    });
  });
  const preset = $('[data-game-preset]', gameMenuContent);
  if (preset) preset.addEventListener('change', () => {
    settings.graphics = { ...settings.graphics, ...PRESETS[preset.value], preset: preset.value };
    saveSettings(); game.applySettings(settings); audio.click();
  });
}

function updateSpawnStatus(choice = game?.spawnChoice) {
  if (!choice) return;
  const id = choice.split(':')[1];
  const name = spawnLabels[id] ? tr(spawnLabels[id]) : id;
  $('#spawn-status-text').textContent = `${name.toLocaleUpperCase(settings.language)} · ${tr('spawn_tip')}`;
}
function updateHud(data = {}) {
  if (!data) return;
  $('#fps-readout').textContent = `${Math.max(0, data.fps || 0)} FPS`;
  $('#object-readout').textContent = `${data.entities ?? 0} ${settings.language === 'ru' ? 'ОБЪЕКТОВ' : 'ENTITIES'}`;
  if (data.mapId) $('#hud-map-name').textContent = tr(mapNameKey(data.mapId)).toLocaleUpperCase(settings.language);
  if (data.weapon) {
    $('#weapon-name').textContent = tr(data.weapon.key);
    $('#tool-icon').textContent = data.weapon.icon;
    const mobileUseLabel = $('#mobile-use [data-i18n]');
    if (mobileUseLabel) mobileUseLabel.textContent = tr(data.weapon.id === 'crusher' ? 'grab' : 'use_tool');
    $('#mobile-use').setAttribute('aria-label', tr(data.weapon.id === 'crusher' ? 'grab' : 'use_tool'));
  }
  $('#stance-chip').classList.toggle('is-active', Boolean(data.stance));
}

function handleHit() {
  audio.action('hit');
  const crosshair = $('#crosshair');
  crosshair.classList.add('is-hit');
  window.clearTimeout(hitPulseTimer);
  hitPulseTimer = window.setTimeout(() => crosshair.classList.remove('is-hit'), 150);
  if (settings.effects.blurFx) {
    app.classList.add('impact-blur');
    window.clearTimeout(impactBlurTimer);
    impactBlurTimer = window.setTimeout(() => app.classList.remove('impact-blur'), 120);
  }
}

const canvas = $('#world');
game = new SandboxGame(canvas, settings, {
  onToggleMenu: () => gameMenuOpen ? closeGameMenu() : openGameMenu(),
  onDisconnect: () => setVisible(disconnectScreen, true),
  onHUD: updateHud,
  onWorldChanged: (map) => {
    if (map === 'menu') $('#top-map-label').textContent = tr('menu_space');
    else $('#top-map-label').textContent = tr(mapNameKey(map)).toLocaleUpperCase(settings.language);
  },
  onWeaponChange: (weapon) => {
    if (weapon) updateHud({ entities: game.entities.length - 1, weapon, mapId: game.mapId, fps: game.currentFps, stance: false });
    if (gameMenuOpen && selectedGameTab === 'weapons') renderGameMenuTab('weapons');
  },
  onSpawnChoice: updateSpawnStatus,
  onSpawned: (id) => showToast(`spawned:${id}`),
  onToast: showToast,
  onAction: (type) => audio.action(type),
  onHit: handleHit,
  onMenuHover: (hover) => { if (hover) audio.hover(); },
  onGrab: (isGrabbed) => { if (isGrabbed) audio.action('tool'); },
  onWeaponDrop: (weapon) => showToast(`dropped:${weapon.id}`)
});

// Main menu and modal routing.
$('#play-button').addEventListener('click', () => { audio.click(); openMapScreen(); });
$('#settings-button').addEventListener('click', () => { audio.click(); openSettingsScreen(); });
$('#exit-button').addEventListener('click', () => { audio.click(); showExit(); });
$('#return-from-exit').addEventListener('click', () => { audio.click(); setVisible(exitScreen, false); currentScreen = 'main'; });
$('.close-map').addEventListener('click', () => { audio.click(); setVisible(mapScreen, false); currentScreen = 'main'; });
$('#launch-map').addEventListener('click', () => { audio.click(); startGame(selectedMap); });
$$('.map-card').forEach((card) => card.addEventListener('click', () => {
  selectedMap = card.dataset.map;
  $$('.map-card').forEach((item) => item.classList.toggle('selected', item === card));
  audio.click();
}));
$('.close-settings').addEventListener('click', () => { audio.click(); closeSettingsScreen(); });
$$('.settings-nav-button').forEach((button) => button.addEventListener('click', () => {
  selectedSettingsTab = button.dataset.settingsTab;
  $$('.settings-nav-button').forEach((item) => item.classList.toggle('active', item === button));
  renderSettingsContent(selectedSettingsTab);
  audio.click();
}));
$('#hud-menu-button').addEventListener('click', openGameMenu);
$('#resume-game').addEventListener('click', () => { audio.click(); closeGameMenu(); });
$$('.game-tab').forEach((button) => button.addEventListener('click', () => {
  selectedGameTab = button.dataset.gameTab;
  $$('.game-tab').forEach((item) => item.classList.toggle('active', item === button));
  renderGameMenuTab(selectedGameTab);
  audio.click();
}));
$('#reload-map').addEventListener('click', () => {
  audio.click(); gameMenuOpen = false; setVisible(gameMenu, false); game.reloadMap();
  setVisible(gameHud, true); setVisible(mobileControls, true); $('.game-prototype').classList.add('is-visible');
});
$('#back-to-menu').addEventListener('click', () => {
  audio.click(); gameMenuOpen = false; game.backToMenu(); showMainScreen();
});

function updateStickFromEvent(event) {
  if (!moveStick || !stickKnob) return;
  const ring = $('.stick-ring', moveStick);
  const rect = ring.getBoundingClientRect();
  const max = rect.width * .34;
  let dx = event.clientX - (rect.left + rect.width / 2);
  let dy = event.clientY - (rect.top + rect.height / 2);
  const length = Math.hypot(dx, dy);
  if (length > max) { dx *= max / length; dy *= max / length; }
  stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  game?.setMobileMove(dx / max, dy / max);
}
moveStick.addEventListener('pointerdown', (event) => {
  if (game?.mode !== 'game' || game.paused) return;
  event.preventDefault();
  stickPointerId = event.pointerId;
  moveStick.classList.add('active');
  try { moveStick.setPointerCapture(event.pointerId); } catch { /* Fine in browsers without capture. */ }
  updateStickFromEvent(event);
});
window.addEventListener('pointermove', (event) => {
  if (stickPointerId === event.pointerId) updateStickFromEvent(event);
});
function releaseStick(event) {
  if (stickPointerId !== event.pointerId) return;
  stickPointerId = null;
  moveStick.classList.remove('active');
  stickKnob.style.transform = 'translate(-50%, -50%)';
  game?.setMobileMove(0, 0);
}
window.addEventListener('pointerup', releaseStick);
window.addEventListener('pointercancel', releaseStick);

function bindMobileAction(id, action) {
  const button = $(`#${id}`);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!game || game.mode !== 'game' || game.paused) return;
    audio.click();
    action();
  });
}
bindMobileAction('mobile-use', () => game.currentWeaponId === 'crusher' ? game.toggleMobileTractor() : game.useCurrentTool());
bindMobileAction('mobile-jump', () => game.jump());
bindMobileAction('mobile-interact', () => game.interact());
bindMobileAction('mobile-drop', () => game.dropWeapon());
bindMobileAction('mobile-spawn', () => game.spawnSelected());
bindMobileAction('mobile-delete', () => game.deleteFocused());
bindMobileAction('mobile-menu', () => openGameMenu());

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Escape') return;
  if (currentScreen === 'settings') { closeSettingsScreen(); audio.click(); }
  else if (currentScreen === 'maps') { setVisible(mapScreen, false); currentScreen = 'main'; audio.click(); }
  else if (currentScreen === 'exit') { setVisible(exitScreen, false); currentScreen = 'main'; }
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (button && !button.disabled) audio.click();
});
document.addEventListener('pointerover', (event) => {
  const button = event.target.closest('button');
  if (button && !button.dataset.hoveredSound) { button.dataset.hoveredSound = '1'; audio.hover(); }
});
document.addEventListener('pointerout', (event) => {
  const button = event.target.closest('button');
  if (button) button.dataset.hoveredSound = '';
});

applyTranslations(settings.language);
renderSettingsContent('graphics');
updateSpawnStatus();
setInterval(() => {
  const now = new Date();
  $('#menu-clock').textContent = now.toLocaleTimeString(settings.language, { hour: '2-digit', minute: '2-digit', hour12: false });
}, 1000);

// Tiny CSS pulse for the optional soft-impact accessibility effect.
const style = document.createElement('style');
style.textContent = `#world { transition: filter .08s linear; } #app.impact-blur #world { filter: blur(1.6px) saturate(.92); }`;
document.head.appendChild(style);
