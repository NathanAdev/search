// Pitcher app shell: the stage, speech engines, crowd engine, reactions and every panel.
import { CATEGORIES, expertId } from './categories.js';
import { CROWD_PEOPLE, createCrowdcast } from './crowdcast.js';
import { createDashboard } from './dashboard.js';
import { DEMO } from './demo.js';
import { createEngine } from './engine.js';
import { sessionData, sessionHtml, sessionMarkdown } from './export.js';
import { IDEAS, pitchScript } from './ideas.js';
import { createLocalMic, createLocalVoices, progressTracker, STT_MODELS } from './local-speech.js';
import { PERSONAS, YOU, colorOf, getPersona, nameOf } from './personas.js';
import { createPerformer } from './performer.js';
import { createMockProvider, hintFor, topicLabel } from './provider-mock.js';
import { createRemoteProvider } from './provider-remote.js';
import { CAMERAS, createScene } from './scene.js';
import { createSfx } from './sfx.js';
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
const DEFAULTS = { stt: 'auto', tts: 'auto', memory: 'normal', headphones: false, sfx: true, interruptions: true, chatter: true, crowdLines: true, provider: 'auto' };
function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('pitcher.settings') || '{}'); } catch { /* storage blocked */ }
  const s = { ...DEFAULTS, ...saved };
  for (const k of ['provider', 'stt', 'tts', 'memory']) if (params.get(k)) s[k] = params.get(k);
  if (params.has('mute')) s.tts = 'off';
  if (params.has('nosfx')) s.sfx = false;
  return s;
}
const settings = loadSettings();
const saveSettings = () => { try { localStorage.setItem('pitcher.settings', JSON.stringify(settings)); } catch { /* storage blocked */ } };

// ---------- stage, sound, crowd ----------
const scene = createScene($('stage'));
scene.start();
const sfx = createSfx(window);
const sound = (name, ...a) => { if (settings.sfx && sfx) sfx.play(name, ...a); };
const cast = createCrowdcast();
const crowdSeats = new Map(scene.nameCrowd(CROWD_PEOPLE.map((p) => p.name)).map((x) => [x.name, x.id]));
let energy = 0.2;
const bump = (d) => { energy = Math.min(1, energy + d); scene.setEnergy(energy); };
setInterval(() => { energy = Math.max(0.15, energy - 0.012); scene.setEnergy(energy); $('energyBar').style.width = `${Math.round(energy * 100)}%`; }, 250);

// ---------- server and providers ----------
let health = { ok: false, ai: null, speech: { local: false }, sessions: false };
const mock = createMockProvider({ seed: TEST ? 5 : Math.floor(Math.random() * 1e6) });
const remote = createRemoteProvider();
const chooseProvider = () => (settings.provider === 'mock' ? mock : settings.provider === 'cli' ? remote : health.ai ? remote : mock);
const sttWanted = () => (settings.stt === 'auto' ? (health.speech.local ? 'whisper' : 'browser') : settings.stt);
const ttsWanted = () => (settings.tts === 'auto' ? (health.speech.local ? 'kokoro' : 'browser') : settings.tts);

// ---------- engine and performer ----------
let engine;
let performer;
let mic = null;
let micKind = null;
let voices = null;
let voiceKind = null;
let voiceLoading = null;
let lastInterimAt = 0;
let youTimer = 0;
let scriptRunning = false;
let lastCrowdAt = 0;
let sessionId = newSessionId();
const prev = new Map();

function newSessionId() { return `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36).padStart(3, '0')}`; }
function buildEngine() {
  engine = createEngine({ provider: chooseProvider(), fallback: createMockProvider({ seed: 9 }), settings: { interruptions: settings.interruptions, chatter: settings.chatter }, onEvent });
}
buildEngine();
function makePerformer() {
  return createPerformer({ scene, settings, speed: SPEED, getVoices: () => voices, getMic: () => mic, addChat: (m) => engine.addChat(m), isUserTalking: () => Date.now() - lastInterimAt < 1500, onLine: reactToLine });
}
performer = makePerformer();

// ---------- speech engines (loaded on demand) ----------
const support = speechSupport(window);
const micHandlers = {
  onInterim(text) { lastInterimAt = Date.now(); $('interim').textContent = text; youTalk(); engine.hearInterim(text); },
  onFinal(text) { $('interim').textContent = ''; youTalk(); engine.hearFinal(text); },
  onPause(ms) { engine.pause(ms); },
  onState(s) { paintMic(s); },
  onError(msg) { engine.addChat({ who: 'system', kind: 'system', text: msg }); },
  onLevel(v) { $('micLevel').style.width = `${Math.round(v * 100)}%`; },
};
function showLoading(text) { $('loading').hidden = !text; if (text) $('loadingText').textContent = text; }
async function ensureMic() {
  const want = sttWanted();
  if (mic && micKind === want) return mic;
  mic?.destroy?.(); mic?.stop?.(); mic = null; micKind = null;
  if (want === 'whisper' && health.speech.local) {
    const model = STT_MODELS[settings.memory] || STT_MODELS.normal;
    showLoading(`Loading Whisper (${model.split('/')[1]}), first time only…`);
    paintPill('sttPill', 'Mic: loading Whisper…', 'busy');
    try {
      mic = await createLocalMic({ win: window, memory: settings.memory, ...micHandlers,
        onProgress: progressTracker((pct, mb) => { $('loadingText').textContent = `Downloading Whisper: ${pct}% of ${mb} MB (cached after this)`; paintPill('sttPill', `Mic: Whisper ${pct}%`, 'busy'); }),
        makeWorker: window.__pitcherFakeWorker });
      micKind = 'whisper';
    } catch (e) {
      engine.addChat({ who: 'system', kind: 'system', text: `Whisper could not load (${e.message}). Using the browser's speech recognition instead.` });
    } finally { showLoading(null); }
  }
  if (!mic) { mic = createMic({ win: window, ...micHandlers }); micKind = mic ? 'browser' : null; }
  paintPills();
  return mic;
}
function ensureVoices() {
  const want = ttsWanted();
  if (want === 'off') { voices?.cancel(); voices = null; voiceKind = 'off'; paintPills(); return; }
  if (voiceKind === want || (want === 'kokoro' && voiceLoading)) return;
  if (!voices || voiceKind === 'kokoro') { voices = createVoices({ win: window, personas: PERSONAS }); voiceKind = voices ? 'browser' : null; }
  if (want === 'kokoro' && health.speech.local) {
    paintPill('ttsPill', 'Voices: loading Kokoro…', 'busy');
    voiceLoading = createLocalVoices({ win: window, makeWorker: window.__pitcherFakeWorker,
      onProgress: progressTracker((pct, mb) => paintPill('ttsPill', `Voices: Kokoro ${pct}% of ${mb} MB`, 'busy')) })
      .then((v) => { if (ttsWanted() === 'kokoro') { voices = v; voiceKind = 'kokoro'; } else v.destroy(); })
      .catch((e) => engine.addChat({ who: 'system', kind: 'system', text: `Kokoro voices could not load (${e.message}). Using browser voices.` }))
      .finally(() => { voiceLoading = null; paintPills(); });
  }
  paintPills();
}

function youTalk() { scene.setYouTalking(true); clearTimeout(youTimer); youTimer = setTimeout(() => scene.setYouTalking(false), 900); }
setInterval(() => {
  engine.tick();
  if (mic?.listening && engine.state.status === 'live') { const s = mic.silentFor(); if (s >= 20000) engine.pause(s); }
  if (settings.crowdLines && engine.state.status === 'live' && !performer.busy && Date.now() - lastCrowdAt > 40000 && Date.now() - lastInterimAt > 8000) crowdLine('idle');
}, 1000);
setInterval(() => { fetch('/api/health', { cache: 'no-store' }).catch(() => {}); }, 30000); // keeps an auto-stopping server alive while this window is open

// ---------- reactions ----------
function activePitch() { return engine.state.pitches.find((p) => p.id === engine.state.activeId) || null; }
function crowdLine(moment) {
  if (!settings.crowdLines) return;
  const l = cast.line(moment, activePitch()?.category);
  if (!l) return;
  lastCrowdAt = Date.now();
  performer.crowd(crowdSeats.get(l.name) || 'crowd-0-0', l.name, l.text);
}
function reactToLine(line) {
  if (line.kind === 'heckle') { sound(Math.random() < 0.6 ? 'laugh' : 'gasp'); scene.crowd('gasp', 0.3, 900); bump(0.08); }
  if (line.emotion === 'annoyed') { sound('murmur'); scene.crowd('think', 0.3, 1200); }
  if (line.emotion === 'convinced') { sound('cheer'); scene.confetti(); scene.crowd('cheer', 0.9, 2600); bump(0.5); crowdLine('convinced'); }
}
function onEvent(e) {
  if (e.type === 'lines') performer.push(e.lines);
  else if (e.type === 'chat') appendChat(e.msg);
  else if (e.type === 'pitch') {
    scene.setSign(e.pitch.title);
    if (e.reason === 'new') { sound('sting'); setTimeout(() => sound('applause', 0.8, 1.8), 250); scene.crowd('cheer', 0.6); scene.animate('hype', 'cheer', 1800); bump(0.3); setTimeout(() => crowdLine('new'), 900); scene.setExpert(null); }
    else { scene.crowd('think', 0.4, 1200); if (e.pitch.adopted.length && e.pitch.versions.at(-1)?.note.startsWith('Adopted')) { sound('gasp'); setTimeout(() => sound('applause', 1, 2), 300); bump(0.3); crowdLine('twist'); } }
  } else if (e.type === 'expert') { scene.setExpert(expertId(e.category)); sound('murmur'); }
  else if (e.type === 'understanding') {
    scene.setWriting(true); sound('drumroll');
    setTimeout(() => { scene.setWriting(false); const green = e.pitches.some((p) => p.monetizer.verdict === 'GREENLIT'); sound(green ? 'cheer' : 'applause'); if (green) scene.confetti(); scene.crowd('clap', 0.9, 2400); }, 1700 / SPEED);
    showPanel('doc'); saveSession(true);
  }
  if (e.type === 'state' || e.type === 'pitch' || e.type === 'understanding' || e.type === 'expert') { detectMoments(); renderAll(); queueSave(); }
}
function detectMoments() {
  for (const p of engine.state.pitches) {
    const before = prev.get(p.id) || { answered: 0, critic: p.criticMood, verdict: p.monetizer.verdict };
    const answered = p.questions.filter((q) => q.status === 'answered').length;
    if (p.id === engine.state.activeId) {
      scene.setMood('critic', p.criticMood);
      scene.setMood('monetizer', p.monetizer.score >= 72 ? 'happy' : p.monetizer.score < 50 ? 'sad' : 'neutral');
      if (answered > before.answered) { sound('ding'); setTimeout(() => sound('applause', 0.5, 1.2), 200); scene.crowd('clap', 0.4, 1300); bump(0.18); if (Math.random() < 0.5) setTimeout(() => crowdLine('answered'), 1200); }
      if (before.critic !== 'convinced' && p.criticMood === 'convinced') { sound('cheer'); scene.confetti(); scene.crowd('cheer', 0.9, 2600); scene.animate('hype', 'cheer', 2200); bump(0.5); }
      if (before.verdict !== 'GREENLIT' && p.monetizer.verdict === 'GREENLIT') { setTimeout(() => sound('cheer'), 400); scene.confetti(90); scene.animate('monetizer', 'cheer', 1800); bump(0.35); crowdLine('greenlit'); }
    }
    prev.set(p.id, { answered, critic: p.criticMood, verdict: p.monetizer.verdict });
  }
}

// ---------- chat and transcript ----------
function appendChat(m) {
  const isCrowd = m.who === 'crowd';
  const color = m.who === 'you' ? YOU.color : isCrowd ? '#6c627d' : colorOf(m.who);
  const name = isCrowd ? m.name : nameOf(m.who);
  const p = getPersona(m.who);
  const to = m.to && m.to !== 'you' ? ` → ${nameOf(m.to)}` : '';
  $('chat').append(el('li', { class: `msg ${m.who === 'you' ? 'you' : ''} ${m.kind || ''} ${m.question ? 'question' : ''}`, style: `--c:${color}` },
    m.who === 'system' ? null : el('span', { class: 'who', text: name }, p && m.who !== 'you' ? el('span', { class: 'role', text: ` · ${p.role}${to}` }) : isCrowd ? el('span', { class: 'role', text: ' · crowd' }) : null),
    el('p', { class: 'text', text: m.text })));
  const body = $('panel-chat');
  if (body.scrollHeight - body.scrollTop - body.clientHeight < 160) body.scrollTop = body.scrollHeight;
  if (m.who === 'you') renderTranscript();
}
function renderTranscript() {
  const t = engine.state.transcript;
  const start = engine.state.startedAt || t[0]?.t || Date.now();
  const items = [];
  let last = null;
  for (const x of t) {
    if (x.pitchId !== last) { const p = engine.state.pitches.find((y) => y.id === x.pitchId); if (p) items.push(el('li', { class: 'pitchmark', text: `Pitch ${p.n}: ${p.title}` })); last = x.pitchId; }
    const s = Math.round((x.t - start) / 1000);
    items.push(el('li', {}, el('time', { text: `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }), x.text, x.source === 'typed' ? el('span', { class: 'hint', text: ' (typed)' }) : null));
  }
  $('tlist').replaceChildren(...(items.length ? items : [el('li', { class: 'empty', text: 'Everything you say is written down here, and saved with the session.' })]));
}

// ---------- questions you can choose to answer ----------
const STARTERS = {
  saturation: ['Unlike every other one,', 'The one thing only mine does is'], loop: ['You spawn, then you', 'Every minute you'], retention: ['They come back for a daily', 'Every week there is'],
  onboarding: ['In the first 30 seconds you', 'You spawn right next to'], scope: ['I am building it solo in', 'Version one is just'], exploits: ['Every reward is checked on the server,'],
  social: ['If the server is empty,', 'There is a solo mode where'], safety: ["I'll use Roblox's text filter and"], monetize: ['It makes Robux from a game pass for', 'There is a developer product that'],
  price: ['The game pass is 199 robux and', 'VIP is 99 robux'], payers: ['About 2 percent of players will pay, mostly for'], fairness: ['Everything you can buy is cosmetic or capped, and'],
  fun: ['The clip people share is when'], heart: ['The game is really about', "I'm cutting"],
};
function openQuestions(p) { return p ? p.questions.filter((q) => q.status === 'open').sort((a, b) => (a.deferred ? 1 : 0) - (b.deferred ? 1 : 0) || b.seq - a.seq) : []; }
function renderTray() {
  const p = activePitch();
  const qs = openQuestions(p);
  const focus = engine.state.focusId;
  $('trayHint').textContent = qs.length ? 'Pick one to answer (or say "Vex, ..."). Otherwise your next words answer the newest one.' : 'No open questions right now.';
  $('qcards').replaceChildren(...(qs.length ? qs.map((q) => {
    const per = getPersona(q.by);
    return el('article', { class: `qcard ${q.id === focus ? 'focused' : ''}`, style: `--c:${per?.color}`, 'data-q': q.id },
      el('div', { class: 'who' }, el('b', { text: per?.name }), ` · ${per?.role} · ${topicLabel(q.topic)}`),
      el('p', { text: q.text }),
      q.attempts ? el('div', { class: 'tries', text: `${q.attempts} weak answer${q.attempts > 1 ? 's' : ''} so far` }) : null,
      el('div', { class: 'acts' },
        el('button', { class: 'go', text: q.id === focus ? 'Answering…' : 'Answer this', onclick: () => { engine.focus(q.id === focus ? null : q.id); $('typeInput').focus(); } }),
        el('button', { text: 'Hint', title: 'Sunny suggests how to answer', onclick: () => engine.hint(q.id) }),
        q.deferred ? null : el('button', { text: 'Later', onclick: () => engine.defer(q.id) })));
  }) : [el('p', { class: 'qempty', text: 'When the crowd asks you something, it shows up here.' })]));
  const fq = p?.questions.find((q) => q.id === focus && q.status === 'open');
  const pill = $('focusPill');
  pill.hidden = !fq;
  if (fq) {
    const per = getPersona(fq.by);
    pill.style.setProperty('--c', per.color);
    pill.replaceChildren(el('span', { text: 'Answering ' }), el('b', { text: per.name }), el('span', { text: ` · ${topicLabel(fq.topic)}` }), el('button', { text: '✕', title: 'Stop choosing', onclick: () => engine.focus(null) }));
  }
  const starters = fq ? (STARTERS[fq.topic] || [hintFor(fq.topic)?.replace(/^Psst! /, '').split('.')[0]].filter(Boolean)) : [];
  $('starters').replaceChildren(...starters.map((s) => el('button', { type: 'button', text: s, onclick: () => { $('typeInput').value = `${s} `; $('typeInput').focus(); } })));
}

// ---------- panels ----------
const moodWord = { hostile: 'hostile', skeptical: 'skeptical', convinced: 'convinced' };
function renderChips() {
  const p = activePitch();
  const crit = p ? p.questions.filter((q) => q.by === 'critic') : [];
  const open = crit.filter((q) => q.status === 'open').length;
  const status = {
    critic: p ? `${moodWord[p.criticMood]}${open ? ` · ${open} open` : ''}` : 'waiting',
    monetizer: p ? `${p.monetizer.verdict} · ${p.monetizer.score}` : 'waiting',
    hype: p ? (p.spec.hook.length ? 'loves the hook' : 'cheering') : 'waiting',
    wrestler: p ? (p.proposal ? 'twist pending' : p.adopted.length ? `${p.adopted.length} twist taken` : 'circling') : 'waiting',
  };
  const chips = Object.values(PERSONAS).map((x) => el('div', { class: 'chip', style: `--c:${x.color}`, title: x.blurb }, el('b', { text: x.name }), el('span', { text: x.role }), el('span', { class: 'st', text: status[x.id] })));
  if (p?.category) { const ex = getPersona(expertId(p.category)); const exOpen = p.questions.filter((q) => q.by === ex.id && q.status === 'open').length; chips.push(el('div', { class: 'chip expert', style: `--c:${ex.color}`, title: ex.blurb }, el('b', { text: ex.name }), el('span', { text: ex.role }), el('span', { class: 'st', text: exOpen ? `${exOpen} open` : 'watching' }))); }
  $('chips').replaceChildren(...chips);
}
function renderBoard() {
  const { pitches, activeId } = engine.state;
  $('pitchCount').textContent = String(pitches.length);
  if (!pitches.length) { $('panel-board').replaceChildren(el('p', { class: 'empty', text: 'No pitch yet. Start talking (or type) and every pitch you make shows up here, detected automatically.' })); return; }
  $('panel-board').replaceChildren(...[...pitches].reverse().map((p) => {
    const m = p.monetizer;
    const mc = m.score >= 72 ? 'var(--ok)' : m.score >= 50 ? 'var(--warn)' : 'var(--bad)';
    const cat = p.category && CATEGORIES[p.category];
    return el('article', { class: `pitch ${p.id === activeId ? 'active' : ''}`, 'data-pitch': p.n },
      el('h3', {}, p.title, el('small', { text: `#${p.n} · v${p.versions.length}${p.id === activeId ? ' · live' : ''}` })),
      el('div', { class: 'tags' }, cat ? el('span', { class: 'tag cat', style: `--c:${cat.expert.color}`, text: `${cat.label} · ${cat.expert.name}` }) : null,
        (p.spec.genres.length ? p.spec.genres : ['genre?']).map((g) => el('span', { class: 'tag', text: g })),
        p.spec.monetization.mechanisms.map((x) => el('span', { class: 'tag', text: x })), p.spec.retention.slice(0, 3).map((x) => el('span', { class: 'tag', text: x }))),
      el('div', { class: 'row2' }, el('span', { text: `Mint: ${m.verdict}` }), el('span', { text: `${m.score}/100` })),
      el('div', { class: 'meter', style: `--c:${mc}` }, el('i', { style: `width:${m.score}%` })),
      el('div', { class: 'row2' }, el('span', { text: `Vex: ${moodWord[p.criticMood]}` }), el('span', { text: `${p.questions.filter((q) => q.status === 'answered').length}/${p.questions.length} answered` })),
      el('ul', { class: 'qs' }, p.questions.map((q) => el('li', { class: q.status, style: `--c:${colorOf(q.by)}` },
        el('span', { class: 'mark', text: q.status === 'answered' ? '✓' : '○' }),
        el('span', { class: 'q' }, el('span', { class: 'by', text: `${nameOf(q.by)}: ` }), topicLabel(q.topic), q.attempts ? ` (${q.attempts} weak)` : '')))),
      p.proposal ? el('p', { class: 'hint', text: `Brawl's twist on the table: what if ${p.proposal.text}? Say "yes" to take it.` }) : null,
      p.versions.length > 1 ? el('ol', { class: 'versions', start: 2 }, p.versions.slice(1).map((v) => el('li', { text: v.note.slice(0, 120) }))) : null);
  }));
}
function docView(u, final, actions) {
  return el('section', { class: 'doc' }, el('h3', { text: u.title }),
    final ? null : el('div', { class: 'draft', text: 'LIVE DRAFT · the final write-up comes when you end the pitch' }),
    el('p', { text: u.shared }),
    u.sections.map((s) => [el('h4', { text: s.title }), el('ul', {}, s.items.map((i) => el('li', { text: i })))]),
    el('h4', { text: 'In their own words' }),
    Object.entries(u.perPersona).map(([id, text]) => el('p', { class: 'own', style: `--c:${colorOf(id)}` }, el('b', { text: `${nameOf(id)}: ` }), text)),
    actions);
}
function renderDoc() {
  const { pitches, activeId } = engine.state;
  if (!pitches.length) { $('panel-doc').replaceChildren(el('p', { class: 'empty', text: 'When you end the pitch, every claude writes down what they understood. A live draft appears here as soon as you start.' })); return; }
  const order = [...pitches].sort((a, b) => (a.id === activeId ? -1 : b.id === activeId ? 1 : b.n - a.n));
  $('panel-doc').replaceChildren(...order.map((p) => {
    const u = p.understanding || buildUnderstanding(p);
    return docView(u, !!p.understanding, el('div', { class: 'doc-actions' },
      el('button', { onclick: () => copy(u.markdown), text: 'Copy Markdown' }),
      el('button', { onclick: () => download(`${slug(u.title)}.md`, u.markdown, 'text/markdown'), text: 'Download .md' })));
  }));
}
const slug = (s) => String(s).replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'pitch';
function download(name, text, type) { const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); document.body.append(a); a.click(); a.remove(); }
function copy(text) { navigator.clipboard?.writeText(text).then(() => engine.addChat({ who: 'system', kind: 'system', text: 'Copied to the clipboard.' })).catch(() => {}); }

let renderQueued = false;
function renderAll() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderChips(); renderBoard(); renderDoc(); renderTray(); renderTranscript(); paintPills(); paintControls(); });
}
function showPanel(name) {
  for (const b of document.querySelectorAll('.side-tabs button')) b.setAttribute('aria-selected', String(b.dataset.panel === name));
  for (const n of ['chat', 'board', 'doc', 'transcript']) $(`panel-${n}`).hidden = n !== name;
}
for (const b of document.querySelectorAll('.side-tabs button')) b.addEventListener('click', () => showPanel(b.dataset.panel));

// ---------- pills and controls ----------
function paintPill(id, text, cls = '') { const p = $(id); p.textContent = text; p.className = `pill ${cls}`; }
function paintPills() {
  const prov = chooseProvider();
  paintPill('aiPill', prov === remote ? `AI: Claude Code (${health.ai?.model || 'cli'})${engine.state.providerError ? ' · fell back' : ''}` : 'AI: scripted crowd', prov === remote ? (engine.state.providerError ? 'warn' : 'on') : '');
  if (!$('sttPill').classList.contains('busy') || micKind) paintPill('sttPill', micKind === 'whisper' ? `Mic: Whisper ${settings.memory === 'low' ? 'tiny' : 'base'} (local)` : micKind === 'browser' ? 'Mic: browser' : `Mic: ${sttWanted() === 'whisper' ? 'Whisper (loads on start)' : support.recognition ? 'browser' : 'type only'}`, micKind === 'whisper' ? 'on' : '');
  if (!voiceLoading) paintPill('ttsPill', voiceKind === 'kokoro' ? 'Voices: Kokoro (local)' : voiceKind === 'off' || ttsWanted() === 'off' ? 'Voices: off' : `Voices: ${ttsWanted() === 'kokoro' ? 'Kokoro (loads on start)' : 'browser'}`, voiceKind === 'kokoro' ? 'on' : '');
}
function paintMic(state) {
  const map = { listening: 'Listening', muted: 'Mic paused while the crowd talks', off: engine.state.status === 'live' ? 'Mic off (you can still type)' : 'Mic off' };
  $('micStatus').textContent = map[state] || state;
  if (state !== 'listening') $('micLevel').style.width = '0%';
  paintControls();
}
function paintControls() {
  const live = engine.state.status === 'live';
  $('micLabel').textContent = !live ? 'Start pitch' : mic?.listening ? 'Mute mic' : 'Unmute mic';
  $('micBtn').classList.toggle('live', live && !!mic?.listening);
  $('endBtn').disabled = !live || !engine.state.pitches.length;
  $('demoBtn').disabled = scriptRunning;
}
function startSession() {
  if (engine.state.status === 'live') return;
  if (engine.state.status === 'ended') resetSession();
  sfx?.unlock();
  engine.start();
  engine.addChat({ who: 'system', kind: 'system', text: 'You are on stage. Pitch a Roblox game. Say "next idea" to start another pitch, "actually..." to change it, "that\'s my pitch" when you are done.' });
  ensureVoices();
  bump(0.25);
  sound('applause', 0.7, 1.6);
  paintControls();
}
$('micBtn').addEventListener('click', async () => {
  if (engine.state.status !== 'live') {
    startSession();
    const m = await ensureMic();
    if (m) m.start();
    else engine.addChat({ who: 'system', kind: 'system', text: support.recognition ? 'Could not start the microphone.' : 'No speech recognition is available here. Type what you would say below.' });
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
async function endPitch() { mic?.stop(); await engine.end(); paintControls(); }
$('newBtn').addEventListener('click', () => resetSession());
function resetSession() {
  saveSession(true);
  mic?.stop();
  performer.clear();
  buildEngine();
  performer = makePerformer();
  prev.clear();
  sessionId = newSessionId();
  $('chat').replaceChildren();
  $('interim').textContent = '';
  scene.setSign('PITCH MODE');
  scene.setExpert(null);
  renderAll();
}

async function settle() { await engine.idle(); while (performer.busy) await new Promise((r) => setTimeout(r, 60)); }
async function runScript(steps) {
  if (scriptRunning) return;
  scriptRunning = true;
  startSession();
  paintControls();
  try {
    for (const step of steps) {
      if (step.pause) { await new Promise((r) => setTimeout(r, 900 / SPEED)); await engine.pause(2500); await settle(); continue; }
      scene.say('you', step.say, 2400 / SPEED);
      youTalk();
      engine.hearInterim(step.say);
      await engine.hearFinal(step.say);
      await settle();
    }
  } finally { scriptRunning = false; paintControls(); }
}
$('demoBtn').addEventListener('click', () => runDemo());
async function runDemo() { await runScript(DEMO); await endPitch(); await settle(); }
async function runIdea(idea) {
  showView('pitch');
  const steps = pitchScript(idea).flatMap((say) => [{ say }, { pause: true }]);
  await runScript(steps);
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
  if (e.key.toLowerCase() === 'q') { const qs = openQuestions(activePitch()); if (qs.length) { const i = qs.findIndex((q) => q.id === engine.state.focusId); engine.focus(qs[(i + 1) % qs.length].id); } }
  if (e.key === 'Escape') engine.focus(null);
});

// ---------- export and saving ----------
$('exportBtn').addEventListener('click', () => { const m = $('exportMenu'); m.hidden = !m.hidden; $('exportBtn').setAttribute('aria-expanded', String(!m.hidden)); });
document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) { $('exportMenu').hidden = true; $('exportBtn').setAttribute('aria-expanded', 'false'); } });
for (const b of document.querySelectorAll('[data-export]')) b.addEventListener('click', () => {
  const kind = b.dataset.export;
  const name = `pitcher-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`;
  if (kind === 'md') download(`${name}.md`, sessionMarkdown(engine.state, { id: sessionId }), 'text/markdown');
  if (kind === 'html') download(`${name}.html`, sessionHtml(engine.state, { id: sessionId }), 'text/html');
  if (kind === 'json') download(`${name}.json`, JSON.stringify(sessionData(engine.state, { id: sessionId }), null, 2), 'application/json');
  if (kind === 'copy') copy(sessionMarkdown(engine.state, { id: sessionId }));
  $('exportMenu').hidden = true;
});
let saveTimer = 0;
function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveSession(false), 1500); }
function saveSession(now) {
  clearTimeout(saveTimer);
  const st = engine.state;
  if (!st.transcript.length && !st.pitches.length) return;
  const payload = { ...sessionData(st, { id: sessionId }), markdown: sessionMarkdown(st, { id: sessionId }), html: sessionHtml(st, { id: sessionId }) };
  try {
    const all = JSON.parse(localStorage.getItem('pitcher.sessions') || '{}');
    all[sessionId] = { ...payload, savedAt: new Date().toISOString() };
    const keep = Object.values(all).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))).slice(0, 8);
    localStorage.setItem('pitcher.sessions', JSON.stringify(Object.fromEntries(keep.map((x) => [x.id, x]))));
  } catch { /* storage full or blocked */ }
  if (health.sessions) fetch('/api/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: sessionId, session: payload }), keepalive: now && JSON.stringify(payload).length < 60000 }).catch(() => {});
}
window.addEventListener('pagehide', () => saveSession(true));
async function loadSessions() {
  let list = [];
  if (health.sessions) { try { list = (await (await fetch('/api/sessions', { cache: 'no-store' })).json()).sessions; } catch { /* offline */ } }
  if (!list.length) { try { list = Object.values(JSON.parse(localStorage.getItem('pitcher.sessions') || '{}')).map((d) => ({ id: d.id, startedAt: d.startedAt, savedAt: d.savedAt, pitches: d.pitches.map((p) => ({ title: p.title, verdict: p.monetizer?.verdict, score: p.monetizer?.score, critic: p.critic, category: p.category })) })); } catch { /* none */ } }
  return list;
}
async function getSession(id) {
  if (health.sessions) { try { const r = await fetch(`/api/sessions/${id}`); if (r.ok) return r.json(); } catch { /* fall back */ } }
  try { return JSON.parse(localStorage.getItem('pitcher.sessions') || '{}')[id] || null; } catch { return null; }
}
async function openSession(id, as) {
  const d = await getSession(id);
  if (!d) return;
  const name = `pitcher-${id}`;
  if (as === 'md') return download(`${name}.md`, d.markdown || '', 'text/markdown');
  if (as === 'html') return download(`${name}.html`, d.html || '', 'text/html');
  if (as === 'json') { const { markdown, html, ...data } = d; return download(`${name}.json`, JSON.stringify(data, null, 2), 'application/json'); }
  const idByName = (n) => [...Object.keys(PERSONAS), ...Object.keys(CATEGORIES).map(expertId)].find((k) => nameOf(k) === n) || n;
  $('viewerTitle').textContent = `Session ${d.startedAt?.slice(0, 16).replace('T', ' ') || id}`;
  $('viewerBody').replaceChildren(
    ...d.pitches.map((p) => docView({ title: `${p.n}. ${p.title}`, shared: p.understanding.shared, sections: p.understanding.sections, perPersona: Object.fromEntries(Object.entries(p.understanding.perPersona).map(([n, t]) => [idByName(n), t])) }, true)),
    el('h3', { text: 'Your transcript' }), el('ol', { class: 'tlist' }, d.transcript.map((x) => el('li', {}, el('time', { text: x.clock }), x.text))));
  $('viewer').showModal();
}
$('viewerClose').addEventListener('click', () => $('viewer').close());

// ---------- settings dialog ----------
const boxes = { setHeadphones: 'headphones', setInterrupt: 'interruptions', setChatter: 'chatter', setSfx: 'sfx', setCrowdLines: 'crowdLines' };
for (const [id, key] of Object.entries(boxes)) {
  $(id).checked = !!settings[key];
  $(id).addEventListener('change', () => { settings[key] = $(id).checked; saveSettings(); engine.configure({ interruptions: settings.interruptions, chatter: settings.chatter }); });
}
function syncSelects() {
  $('setStt').value = sttWanted();
  $('setTts').value = ttsWanted();
  $('setMemory').value = settings.memory;
  $('setProvider').value = settings.provider;
  $('setStt').querySelector('[value="whisper"]').disabled = !health.speech.local;
  $('setTts').querySelector('[value="kokoro"]').disabled = !health.speech.local;
}
$('setStt').addEventListener('change', () => { settings.stt = $('setStt').value; saveSettings(); const was = mic?.listening; mic?.stop(); mic?.destroy?.(); mic = null; micKind = null; if (was) ensureMic().then((m) => m?.start()); paintPills(); });
$('setTts').addEventListener('change', () => { settings.tts = $('setTts').value; saveSettings(); voiceKind = null; ensureVoices(); });
$('setMemory').addEventListener('change', () => { settings.memory = $('setMemory').value; saveSettings(); if (micKind === 'whisper') { mic?.stop(); mic?.destroy?.(); mic = null; micKind = null; } paintPills(); });
$('setProvider').addEventListener('change', () => { settings.provider = $('setProvider').value; saveSettings(); engine.setProvider(chooseProvider()); paintPills(); });
$('openSettings').addEventListener('click', () => { syncSelects(); $('settings').showModal(); });

// ---------- ideas view ----------
let ideaCat = 'all';
function renderIdeas() {
  const q = $('ideaSearch').value.trim().toLowerCase();
  const counts = {};
  IDEAS.forEach((i) => { counts[i.category] = (counts[i.category] || 0) + 1; });
  $('catChips').replaceChildren(el('button', { 'aria-pressed': String(ideaCat === 'all'), text: `All ${IDEAS.length}`, onclick: () => { ideaCat = 'all'; renderIdeas(); } }),
    ...Object.entries(CATEGORIES).filter(([id]) => counts[id]).map(([id, c]) => el('button', { 'aria-pressed': String(ideaCat === id), style: `--c:${c.expert.color}`, 'data-cat': id, text: `${c.label} ${counts[id]}`, onclick: () => { ideaCat = id; renderIdeas(); } })));
  const list = IDEAS.filter((i) => (ideaCat === 'all' || i.category === ideaCat) && (!q || `${i.title} ${i.line} ${i.hook}`.toLowerCase().includes(q)));
  $('ideaGrid').replaceChildren(...list.map((i) => {
    const c = CATEGORIES[i.category];
    return el('article', { class: 'idea', style: `--c:${c.expert.color}`, 'data-idea': i.n },
      el('div', { class: 'n', text: `#${i.n} · ${c.label} · expert ${c.expert.name}` }),
      el('h3', { text: i.title }), el('p', { text: i.line }),
      el('p', { class: 'twist' }, el('b', { text: 'Twist: ' }), i.hook), el('p', { class: 'money' }, el('b', { text: 'Money: ' }), i.money),
      el('div', { class: 'acts' }, el('button', { class: 'primary', text: 'Pitch it for me', onclick: () => runIdea(i) }), el('button', { text: 'Copy pitch', onclick: () => copy(pitchScript(i).join(' ')) })));
  }));
}
$('ideaSearch').addEventListener('input', renderIdeas);

// ---------- views ----------
const dashboard = createDashboard({ el, root: { agents: $('agents'), next: $('nextList'), recent: $('recentList'), source: $('feedSource') }, getLive: () => engine.state, loadSessions, openSession });
function showView(name) {
  for (const v of ['dashboard', 'pitch', 'ideas']) { $(`view-${v}`).hidden = v !== name; $(`nav-${v}`).setAttribute('aria-selected', String(v === name)); }
  if (name === 'dashboard') dashboard.show(); else dashboard.hide();
  if (name === 'ideas') renderIdeas();
  if (location.hash !== `#${name}`) history.replaceState(null, '', `${location.pathname}${location.search}#${name}`);
}
for (const v of ['dashboard', 'pitch', 'ideas']) $(`nav-${v}`).addEventListener('click', () => showView(v));

// ---------- boot ----------
(async () => {
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    if (r.ok) health = { ...health, ...(await r.json()) };
  } catch { /* opened without the server */ }
  engine.setProvider(chooseProvider());
  showView(['dashboard', 'ideas'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'pitch');
  renderAll();
  paintMic('off');
  if ('serviceWorker' in navigator && !TEST && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();

if (TEST) window.__pitcher = { get engine() { return engine; }, scene, get performer() { return performer; }, settings, runDemo, runIdea, setCam, endPitch, get health() { return health; }, IDEAS };
