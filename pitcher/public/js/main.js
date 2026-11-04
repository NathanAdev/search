// Pitcher app shell: wires the stage, the mic, the crowd engine and the panels together.
import { createDashboard } from './dashboard.js';
import { DEMO } from './demo.js';
import { createEngine } from './engine.js';
import { PERSONAS, YOU, nameOf } from './personas.js';
import { createPerformer } from './performer.js';
import { createMockProvider, topicLabel } from './provider-mock.js';
import { createRemoteProvider } from './provider-remote.js';
import { CAMERAS, createScene } from './scene.js';
import { createMic, createVoices, speechSupport } from './speech.js';
import { buildUnderstanding } from './understanding.js';

const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const SPEED = Math.max(0.1, +(params.get('speed') || 1));
const $ = (id) => document.getElementById(id);

// ---------- tiny DOM builder (text is always set as text, never as HTML) ----------
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

// ---------- settings ----------
const DEFAULTS = { voices: true, headphones: false, interruptions: true, chatter: true, provider: 'auto' };
function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('pitcher.settings') || '{}'); } catch { /* storage blocked */ }
  const s = { ...DEFAULTS, ...saved };
  if (params.get('provider')) s.provider = params.get('provider');
  if (params.has('mute')) s.voices = false;
  return s;
}
const settings = loadSettings();
const saveSettings = () => { try { localStorage.setItem('pitcher.settings', JSON.stringify(settings)); } catch { /* storage blocked */ } };

// ---------- stage ----------
const scene = createScene($('stage'));
scene.start();

// ---------- providers ----------
let serverUp = false;
let serverModel = '';
const mock = createMockProvider({ seed: TEST ? 5 : Math.floor(Math.random() * 1e6) });
const remote = createRemoteProvider();
const chooseProvider = () => (settings.provider === 'mock' ? mock : settings.provider === 'cli' ? remote : serverUp ? remote : mock);
function paintAiPill() {
  const p = chooseProvider();
  const pill = $('aiPill');
  pill.textContent = p === remote ? `AI: Claude Code CLI${serverModel ? ` (${serverModel})` : ''}` : 'AI: scripted crowd';
  pill.className = `pill ${p === remote ? (serverUp ? 'on' : 'warn') : ''}`;
  if (engine.state.providerError) { pill.textContent += ' · fell back'; pill.className = 'pill warn'; }
}

// ---------- engine, mic, voices, performer ----------
let engine;
let performer;
let mic = null;
let voices = null;
let lastInterimAt = 0;
let youTimer = 0;
let demoRunning = false;
const prevMood = new Map();

function buildEngine() {
  engine = createEngine({ provider: chooseProvider(), fallback: createMockProvider({ seed: 9 }), settings: { interruptions: settings.interruptions, chatter: settings.chatter }, onEvent });
  return engine;
}
buildEngine();

const support = speechSupport(window);
voices = createVoices({ win: window, personas: PERSONAS });
mic = createMic({
  win: window,
  onInterim(text) { lastInterimAt = Date.now(); $('interim').textContent = text; youTalk(); engine.hearInterim(text); },
  onFinal(text) { $('interim').textContent = ''; youTalk(); engine.hearFinal(text); },
  onPause(ms) { engine.pause(ms); },
  onState(s) { paintMic(s); },
  onError(msg) { engine.addChat({ who: 'system', kind: 'system', text: msg }); paintMic('off'); },
});
performer = makePerformer();
function makePerformer() {
  return createPerformer({ scene, voices, mic, settings, speed: SPEED, addChat: (m) => engine.addChat(m), isUserTalking: () => Date.now() - lastInterimAt < 1500 });
}

function youTalk() { scene.setYouTalking(true); clearTimeout(youTimer); youTimer = setTimeout(() => scene.setYouTalking(false), 900); }

setInterval(() => {
  engine.tick();
  if (mic?.listening && engine.state.status === 'live') { const s = mic.silentFor(); if (s >= 20000) engine.pause(s); }
}, 1000);

// ---------- engine events ----------
function onEvent(e) {
  if (e.type === 'lines') performer.push(e.lines);
  else if (e.type === 'chat') appendChat(e.msg);
  else if (e.type === 'pitch') { scene.setSign(e.pitch.title); if (e.reason === 'new') { scene.crowd('cheer', 0.5); scene.animate('hype', 'cheer', 1800); } else scene.crowd('think', 0.4, 1200); }
  else if (e.type === 'understanding') { scene.setWriting(true); setTimeout(() => scene.setWriting(false), 5000 / SPEED); showPanel('doc'); saveRecent(); }
  if (e.type === 'state' || e.type === 'pitch' || e.type === 'understanding') renderAll();
}

function reactToMoods() {
  for (const p of engine.state.pitches) {
    const key = p.id;
    const before = prevMood.get(key) || {};
    const now = { critic: p.criticMood, verdict: p.monetizer?.verdict };
    if (p.id === engine.state.activeId) {
      scene.setMood('critic', p.criticMood);
      scene.setMood('monetizer', p.monetizer?.score >= 72 ? 'happy' : p.monetizer?.score < 50 ? 'sad' : 'neutral');
      if (before.critic && before.critic !== 'convinced' && now.critic === 'convinced') { scene.crowd('cheer', 0.8); scene.animate('hype', 'cheer', 2200); }
      if (before.verdict && before.verdict !== 'GREENLIT' && now.verdict === 'GREENLIT') { scene.crowd('clap', 0.7); scene.animate('monetizer', 'cheer', 1800); }
    }
    prevMood.set(key, now);
  }
}

// ---------- chat ----------
function appendChat(m) {
  const list = $('chat');
  const color = m.who === 'you' ? YOU.color : PERSONAS[m.who]?.color || 'var(--muted)';
  const to = m.to && m.to !== 'you' ? ` → ${nameOf(m.to)}` : '';
  const role = PERSONAS[m.who] ? ` · ${PERSONAS[m.who].role}` : '';
  list.append(el('li', { class: `msg ${m.who === 'you' ? 'you' : ''} ${m.kind || ''} ${m.question ? 'question' : ''}`, style: `--c:${color}` },
    m.who === 'system' ? null : el('span', { class: 'who', text: `${nameOf(m.who)}${role}` }, to ? el('span', { class: 'to', text: to }) : null),
    el('p', { class: 'text', text: m.text })));
  const body = $('panel-chat');
  body.scrollTop = body.scrollHeight;
  if (m.kind === 'heckle') scene.crowd('gasp', 0.25, 900);
}

// ---------- panels ----------
const moodWord = { hostile: 'hostile', skeptical: 'skeptical', convinced: 'convinced' };
function renderChips() {
  const p = engine.state.pitches.find((x) => x.id === engine.state.activeId);
  const crit = p ? p.questions.filter((q) => q.by === 'critic') : [];
  const open = crit.filter((q) => q.status === 'open').length;
  const status = {
    critic: p ? `${moodWord[p.criticMood]}${open ? ` · ${open} open` : ''}` : 'waiting',
    monetizer: p ? `${p.monetizer.verdict} · ${p.monetizer.score}` : 'waiting',
    hype: p ? (p.spec.hook.length ? 'loves the hook' : 'cheering') : 'waiting',
    wrestler: p ? (p.proposal ? 'twist pending' : p.adopted.length ? `${p.adopted.length} twist taken` : 'circling') : 'waiting',
  };
  $('chips').replaceChildren(...Object.values(PERSONAS).map((x) => el('div', { class: 'chip', style: `--c:${x.color}`, title: x.blurb }, el('b', { text: x.name }), el('span', { text: x.role }), el('span', { class: 'st', text: status[x.id] }))));
}

function renderBoard() {
  const { pitches, activeId } = engine.state;
  $('pitchCount').textContent = String(pitches.length);
  if (!pitches.length) { $('panel-board').replaceChildren(el('p', { class: 'empty', text: 'No pitch yet. Start talking (or type) and every pitch you make shows up here, detected automatically.' })); return; }
  $('panel-board').replaceChildren(...[...pitches].reverse().map((p) => {
    const m = p.monetizer;
    const mc = m.score >= 72 ? 'var(--ok)' : m.score >= 50 ? 'var(--warn)' : 'var(--bad)';
    return el('article', { class: `pitch ${p.id === activeId ? 'active' : ''}`, 'data-pitch': p.n },
      el('h3', {}, p.title, el('small', { text: `#${p.n} · v${p.versions.length}${p.id === activeId ? ' · live' : ''}` })),
      el('div', { class: 'tags' }, (p.spec.genres.length ? p.spec.genres : ['genre?']).map((g) => el('span', { class: 'tag', text: g })),
        p.spec.monetization.mechanisms.map((x) => el('span', { class: 'tag', text: x })), p.spec.retention.slice(0, 3).map((x) => el('span', { class: 'tag', text: x }))),
      el('div', { class: 'row2' }, el('span', { text: `Mint: ${m.verdict}` }), el('span', { text: `${m.score}/100` })),
      el('div', { class: 'meter', style: `--c:${mc}` }, el('i', { style: `width:${m.score}%` })),
      el('div', { class: 'row2' }, el('span', { text: `Vex: ${moodWord[p.criticMood]}` }), el('span', { text: `${p.questions.filter((q) => q.status === 'answered').length}/${p.questions.length} answered` })),
      el('ul', { class: 'qs' }, p.questions.map((q) => el('li', { class: q.status, style: `--c:${PERSONAS[q.by].color}` },
        el('span', { class: 'mark', text: q.status === 'answered' ? '✓' : '○' }),
        el('span', { class: 'q' }, el('span', { class: 'by', text: `${PERSONAS[q.by].name}: ` }), `${topicLabel(q.topic)}`, q.attempts ? ` (${q.attempts} weak answer${q.attempts > 1 ? 's' : ''})` : '')))),
      p.proposal ? el('p', { class: 'hint', text: `Brawl's twist on the table: what if ${p.proposal.text}? Say "yes" to take it.` }) : null,
      p.versions.length > 1 ? el('ol', { class: 'versions', start: 2 }, p.versions.slice(1).map((v) => el('li', { text: v.note.slice(0, 120) }))) : null);
  }));
}

function renderDoc() {
  const { pitches, activeId } = engine.state;
  const body = $('panel-doc');
  if (!pitches.length) { body.replaceChildren(el('p', { class: 'empty', text: 'When you end the pitch, the four claudes write down what they understood. A live draft appears here as soon as you start.' })); return; }
  const order = [...pitches].sort((a, b) => (a.id === activeId ? -1 : b.id === activeId ? 1 : b.n - a.n));
  body.replaceChildren(...order.map((p) => {
    const u = p.understanding || buildUnderstanding(p);
    return el('section', { class: 'doc', 'data-doc': p.n },
      el('h3', { text: u.title }),
      p.understanding ? null : el('div', { class: 'draft', text: 'LIVE DRAFT · final write-up when you end the pitch' }),
      el('p', { text: u.shared }),
      u.sections.map((s) => [el('h4', { text: s.title }), el('ul', {}, s.items.map((i) => el('li', { text: i })))]),
      el('h4', { text: 'In their own words' }),
      Object.entries(u.perPersona).map(([id, text]) => el('p', { class: 'own', style: `--c:${PERSONAS[id].color}` }, el('b', { text: `${PERSONAS[id].name}: ` }), text)),
      el('div', { class: 'doc-actions' },
        el('button', { onclick: () => navigator.clipboard?.writeText(u.markdown), text: 'Copy Markdown' }),
        el('button', { onclick: () => download(`${u.title.replace(/[^\w-]+/g, '-')}.md`, u.markdown), text: 'Download .md' })));
  }));
}

function download(name, text) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/markdown' })), download: name });
  document.body.append(a); a.click(); a.remove();
}

let renderQueued = false;
function renderAll() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderChips(); renderBoard(); renderDoc(); reactToMoods(); paintAiPill(); paintControls(); });
}

function showPanel(name) {
  for (const b of document.querySelectorAll('.side-tabs button')) b.setAttribute('aria-selected', String(b.dataset.panel === name));
  for (const n of ['chat', 'board', 'doc']) $(`panel-${n}`).hidden = n !== name;
}
for (const b of document.querySelectorAll('.side-tabs button')) b.addEventListener('click', () => showPanel(b.dataset.panel));

// ---------- controls ----------
function paintMic(state) {
  const s = $('micStatus');
  const map = { listening: 'Listening', muted: 'Mic paused while a claude talks', off: engine.state.status === 'live' ? 'Mic off (you can still type)' : 'Mic off' };
  s.textContent = map[state] || state;
  s.className = `status ${state === 'listening' ? 'live' : ''}`;
  paintControls();
}
function paintControls() {
  const live = engine.state.status === 'live';
  const btn = $('micBtn');
  btn.textContent = !live ? 'Start pitch' : mic?.listening ? 'Mute mic' : 'Unmute mic';
  btn.classList.toggle('live', live && !!mic?.listening);
  $('endBtn').disabled = !live || !engine.state.pitches.length;
  $('demoBtn').disabled = demoRunning;
}
function startSession() {
  if (engine.state.status === 'live') return;
  if (engine.state.status === 'ended') resetSession();
  engine.start();
  engine.addChat({ who: 'system', kind: 'system', text: 'You are on stage. Pitch a Roblox game. Say "next idea" to start another pitch, "actually..." to change it, "that\'s my pitch" when done.' });
  paintControls();
}
$('micBtn').addEventListener('click', () => {
  if (engine.state.status !== 'live') {
    startSession();
    if (mic) mic.start();
    else engine.addChat({ who: 'system', kind: 'system', text: support.recognition ? 'Could not start the microphone.' : 'This browser has no speech recognition. Chrome or Edge do; until then, type what you would say below.' });
  } else if (mic) { if (mic.listening) mic.stop(); else mic.start(); }
  paintControls();
});
$('typeForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const text = $('typeInput').value.trim();
  if (!text) return;
  $('typeInput').value = '';
  startSession();
  scene.say('you', text, 2600);
  youTalk();
  engine.hearFinal(text, { typed: true });
});
$('endBtn').addEventListener('click', () => endPitch());
async function endPitch() {
  mic?.stop();
  await engine.end();
  paintControls();
}
$('newBtn').addEventListener('click', () => resetSession());
function resetSession() {
  mic?.stop();
  performer.clear();
  buildEngine();
  performer = makePerformer();
  prevMood.clear();
  $('chat').replaceChildren();
  $('interim').textContent = '';
  scene.setSign('PITCH MODE');
  renderAll();
}

async function settle() {
  await engine.idle();
  while (performer.busy) await new Promise((r) => setTimeout(r, 60));
}
$('demoBtn').addEventListener('click', () => runDemo());
async function runDemo() {
  if (demoRunning) return;
  demoRunning = true;
  startSession();
  paintControls();
  try {
    for (const step of DEMO) {
      if (step.pause) { await new Promise((r) => setTimeout(r, 900 / SPEED)); await engine.pause(2500); await settle(); continue; }
      scene.say('you', step.say, 2400 / SPEED);
      youTalk();
      engine.hearInterim(step.say);
      await engine.hearFinal(step.say);
      await settle();
    }
    await endPitch();
    await settle();
  } finally { demoRunning = false; paintControls(); }
}

for (const b of document.querySelectorAll('[data-cam]')) b.addEventListener('click', () => setCam(b.dataset.cam));
function setCam(key) {
  if (!CAMERAS[key]) return;
  scene.setCamera(key);
  for (const b of document.querySelectorAll('[data-cam]')) b.setAttribute('aria-pressed', String(b.dataset.cam === key));
}
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, dialog')) return;
  if (e.key === '1') setCam('first');
  if (e.key === '2') setCam('side');
  if (e.key === '3') setCam('back');
  if (e.key.toLowerCase() === 'm') $('micBtn').click();
});

// ---------- settings dialog ----------
const boxes = { setVoices: 'voices', setHeadphones: 'headphones', setInterrupt: 'interruptions', setChatter: 'chatter' };
for (const [id, key] of Object.entries(boxes)) {
  $(id).checked = !!settings[key];
  $(id).addEventListener('change', () => { settings[key] = $(id).checked; saveSettings(); engine.configure({ interruptions: settings.interruptions, chatter: settings.chatter }); if (!settings.voices) voices?.cancel(); });
}
$('setProvider').value = settings.provider;
$('setProvider').addEventListener('change', () => { settings.provider = $('setProvider').value; saveSettings(); engine.setProvider(chooseProvider()); paintAiPill(); });
$('openSettings').addEventListener('click', () => $('settings').showModal());

// ---------- views ----------
const dashboard = createDashboard({ el, root: { agents: $('agents'), next: $('nextList'), recent: $('recentList'), source: $('feedSource') }, getLive: () => engine.state, loadRecent });
function showView(name) {
  $('view-dashboard').hidden = name !== 'dashboard';
  $('view-pitch').hidden = name !== 'pitch';
  $('nav-dashboard').setAttribute('aria-selected', String(name === 'dashboard'));
  $('nav-pitch').setAttribute('aria-selected', String(name === 'pitch'));
  if (name === 'dashboard') dashboard.show(); else dashboard.hide();
  if (location.hash !== `#${name}`) history.replaceState(null, '', `${location.pathname}${location.search}#${name}`);
}
$('nav-dashboard').addEventListener('click', () => showView('dashboard'));
$('nav-pitch').addEventListener('click', () => showView('pitch'));

function loadRecent() { try { return JSON.parse(localStorage.getItem('pitcher.recent') || '[]'); } catch { return []; } }
function saveRecent() {
  const list = loadRecent();
  for (const p of engine.state.pitches) {
    list.unshift({ title: p.title, verdict: p.monetizer.verdict, score: p.monetizer.score, critic: p.criticMood, open: p.questions.filter((q) => q.status === 'open').map((q) => `${PERSONAS[q.by].name}: ${topicLabel(q.topic)}`), at: Date.now() });
  }
  try { localStorage.setItem('pitcher.recent', JSON.stringify(list.slice(0, 20))); } catch { /* storage blocked */ }
}

// ---------- boot ----------
(async () => {
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    if (r.ok) { const h = await r.json(); serverUp = !!h.ok; serverModel = h.ai?.model || ''; }
  } catch { serverUp = false; }
  engine.setProvider(chooseProvider());
  showView(location.hash === '#dashboard' ? 'dashboard' : 'pitch');
  renderAll();
  paintMic('off');
})();

if (TEST) window.__pitcher = { get engine() { return engine; }, scene, get performer() { return performer; }, settings, runDemo, setCam, endPitch };
