// End-to-end browser test. Needs the playwright package (pre-installed in Claude Code cloud sessions).
// Fakes: browser speech recognition and voices, the Claude CLI, and the Whisper/Kokoro model workers
// (the real capture, voice detection and worker plumbing run; only the model inference is stubbed).
// Usage: node test/e2e.js [screenshot dir]
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createApp } from '../server.js';
import { cliConfig } from '../lib/cli.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SHOTS = process.argv[2] || mkdtempSync(join(tmpdir(), 'pitcher-shots-'));
mkdirSync(SHOTS, { recursive: true });
const fake = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

const FAKES = () => {
  window.__mic = { instances: [], started: 0, aborted: 0 };
  class FakeRecognition {
    constructor() { this.running = false; window.__mic.instances.push(this); }
    start() { if (this.running) throw new Error('already started'); this.running = true; window.__mic.started++; setTimeout(() => this.onstart?.(), 0); }
    stop() { this.running = false; setTimeout(() => this.onend?.(), 0); }
    abort() { this.running = false; window.__mic.aborted++; setTimeout(() => this.onend?.(), 0); }
    emit(text, isFinal) { if (!this.running) return false; const res = [{ transcript: text }]; res.isFinal = isFinal; this.onresult?.({ resultIndex: 0, results: [res] }); return true; }
  }
  window.SpeechRecognition = FakeRecognition;
  window.__say = (text, isFinal = true) => window.__mic.instances.some((r) => r.emit(text, isFinal));
  window.__spoken = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'en-US', name: 'A' }, { lang: 'en-GB', name: 'B' }], speak(u) { window.__spoken.push({ text: u.text, micRunning: window.__mic.instances.some((r) => r.running) }); setTimeout(() => u.onend?.(), 120); }, cancel() {} } });
  // Stand-ins for the Whisper and Kokoro workers: same message protocol, no model download.
  window.__workerLog = [];
  window.__pitcherFakeWorker = (kind) => {
    const src = kind === 'stt'
      ? `let n=0; self.onmessage=(e)=>{const m=e.data; if(m.type==='load'){self.postMessage({type:'progress',file:'model.onnx',loaded:50,total:100,status:'progress'});self.postMessage({type:'ready'})} if(m.type==='transcribe'){if(!m.partial)n++; self.postMessage({type:'text',id:m.id,partial:m.partial,text:m.partial?'it is a tycoon':(n<3?"It's a tycoon where you run a haunted hotel and earn coins from ghost guests.":'')})}}`
      : `self.onmessage=(e)=>{const m=e.data; if(m.type==='load')self.postMessage({type:'ready'}); if(m.type==='speak'){const sr=8000,len=sr/10,b=new ArrayBuffer(44+len*2),v=new DataView(b);const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};w(0,'RIFF');v.setUint32(4,36+len*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,len*2,true);self.postMessage({type:'audio',id:m.id,voice:m.voice,blob:new Blob([b],{type:'audio/wav'})})}}`;
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    const post = w.postMessage.bind(w);
    w.postMessage = (msg, t) => { window.__workerLog.push({ kind, type: msg.type, voice: msg.voice, len: msg.audio?.length }); post(msg, t); };
    return w;
  };
};

const nonBlank = (page) => page.evaluate(() => {
  const c = document.getElementById('stage');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 997) seen.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
  return seen.size;
});
const chatTexts = (page) => page.$$eval('#chat .msg', (els) => els.map((e) => e.textContent));
const waitFor = async (page, fn, arg, ms = 15000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };
const idle = (page) => waitFor(page, () => !window.__pitcher.performer.busy, null, 20000);

(async () => {
  const cli = cliConfig({ PITCHER_CLAUDE_BIN: process.execPath, PITCHER_CLAUDE_PREFIX: JSON.stringify([fake]), PITCHER_TIMEOUT_MS: '10000' });
  const tmp = mkdtempSync(join(tmpdir(), 'pitcher-e2e-'));
  const server = createApp({ feedFile: join(tmp, 'agents.json'), sessionsDir: join(tmp, 'sessions'), cli });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });

  // ---- 1. scripted crowd, fake browser mic, voices off ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(FAKES);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/?test=1&provider=mock&stt=browser&speed=6&mute#pitch`);
  await page.waitForTimeout(500);
  check('loads without errors', errors.length === 0, errors.join(' | '));
  check('AI pill says scripted crowd', /scripted/.test(await page.textContent('#aiPill')));
  check('health reports the local speech runtimes', await page.evaluate(() => window.__pitcher.health.speech.local === true));
  for (const cam of ['first', 'side', 'back']) {
    await page.click(`[data-cam="${cam}"]`);
    await page.waitForTimeout(850);
    const colours = await nonBlank(page);
    check(`camera ${cam} renders a scene`, colours > 25, `${colours} colours`);
    await page.locator('#stage').screenshot({ path: join(SHOTS, `cam-${cam}.png`) });
  }
  await page.click('[data-cam="first"]');

  await page.click('#micBtn');
  await page.waitForTimeout(150);
  check('Start pitch starts the microphone', await page.evaluate(() => window.__mic.started >= 1));
  await page.evaluate(() => window.__say("It's a tycoon where you run a haunted hotel for ghosts", false));
  check('interim speech shows and a heckle cuts in', await waitFor(page, () => document.querySelectorAll('#chat .msg.heckle').length > 0, null, 5000));
  await page.evaluate(() => window.__say("My game is called Haunted Hotel Tycoon. It's a tycoon where you run a hotel for ghosts and build rooms and earn coins.", true));
  check('final speech starts pitch #1', await waitFor(page, () => document.getElementById('pitchCount').textContent === '1'));
  check('the Tycoon expert takes the expert seat', await waitFor(page, () => document.getElementById('chips').textContent.includes('Ledger'), null, 5000));
  check('the critic asks a question after a pause', await waitFor(page, () => window.__pitcher.engine.state.pitches[0].questions.some((q) => q.by === 'critic'), null, 8000));
  check('the question shows up as a card in the tray', await waitFor(page, () => document.querySelectorAll('#qcards .qcard').length >= 1, null, 5000));
  await page.click('#qcards .qcard .go');
  check('choosing a question shows who you are answering', await waitFor(page, () => !document.getElementById('focusPill').hidden && document.getElementById('focusPill').textContent.includes('Answering'), null, 3000));
  check('answer starters appear for the chosen question', (await page.$$('#starters button')).length > 0);
  await page.evaluate(() => window.__say('Unlike every other tycoon the guests are other real players, which is the twist.', true));
  check('a real answer resolves the critic question', await waitFor(page, () => window.__pitcher.engine.state.pitches[0].questions.some((q) => q.by === 'critic' && q.status === 'answered'), null, 8000));
  await page.evaluate(() => window.__say('Okay, my next idea is a racing game called Lava Kart where losers build the next track.', true));
  check('a second pitch is detected automatically', await waitFor(page, () => window.__pitcher.engine.state.pitches.length === 2, null, 8000));
  await idle(page);
  const texts = await chatTexts(page);
  const speakers = new Set(await page.$$eval('#chat .msg .who', (els) => els.map((e) => e.textContent.split(' ·')[0])));
  check('several claudes spoke', ['Vex', 'Sunny'].every((n) => speakers.has(n)), [...speakers].join(','));
  check('claudes talk to each other in the chatroom', texts.some((t) => t.includes('→')));
  check('background crowd members chime in', await waitFor(page, () => document.querySelectorAll('#chat .msg.crowd').length > 0, null, 5000));
  check('the crowd energy meter moved', await page.evaluate(() => parseInt(document.getElementById('energyBar').style.width, 10) > 20));
  await page.click('[data-panel="transcript"]');
  check('the transcript tab lists everything you said', (await page.$$('#tlist li time')).length >= 3);
  await page.click('[data-panel="board"]');
  await page.locator('.side-col').screenshot({ path: join(SHOTS, 'board.png') });
  await page.click('#endBtn');
  check('ending writes an understanding for each pitch', await waitFor(page, () => document.querySelectorAll('#panel-doc .doc').length === 2 && !document.querySelector('#panel-doc .draft'), null, 10000));
  check('understanding has the crowd and the expert in their own words', /In their own words[\s\S]*Vex:[\s\S]*Ledger:/.test(await page.textContent('#panel-doc')));
  await page.locator('.side-col').screenshot({ path: join(SHOTS, 'understanding.png') });
  await idle(page);
  await page.screenshot({ path: join(SHOTS, 'pitch-desktop.png') });

  await page.click('#exportBtn');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-export="md"]')]);
  const md = readFileSync(await dl.path(), 'utf8');
  check('Markdown export has the transcript, Q&A and write-up', /## Your transcript/.test(md) && /Haunted Hotel Tycoon/.test(md) && /What the crowd understood/.test(md) && /Lava Kart/.test(md));

  await page.click('#nav-dashboard');
  check('dashboard shows sample agents', await waitFor(page, () => document.querySelectorAll('#agents .agent').length >= 3, null, 5000));
  check('the session was saved with its transcript', await waitFor(page, () => /Haunted Hotel Tycoon/.test(document.getElementById('recentList').textContent), null, 8000));
  await page.click('#recentList li button');
  check('a saved session opens in the viewer', await waitFor(page, () => document.getElementById('viewer').open && document.getElementById('viewerBody').textContent.includes('Your transcript'), null, 5000));
  await page.click('#viewerClose');
  await fetch(`${base}/api/agents`, { method: 'POST', body: JSON.stringify({ agents: [{ id: 'b1', name: 'Roblox builder', status: 'running', task: 'Lobby check-in', progress: 0.6 }] }) });
  check('posting to the feed updates the dashboard', await waitFor(page, () => document.getElementById('agents').textContent.includes('Roblox builder'), null, 9000));
  await page.screenshot({ path: join(SHOTS, 'dashboard.png') });

  // ---- 2. ideas view and "pitch it for me" ----
  await page.click('#nav-ideas');
  check('ideas view lists 100 ideas', (await page.$$('#ideaGrid .idea')).length === 100);
  await page.click('#catChips [data-cat="steal"]');
  check('the Steal-a filter shows 22 ideas', (await page.$$('#ideaGrid .idea')).length === 22);
  await page.screenshot({ path: join(SHOTS, 'ideas.png') });
  await page.evaluate(() => window.__pitcher.runIdea(window.__pitcher.IDEAS.find((i) => i.title === 'Throw an Egg')));
  const egg = await page.evaluate(() => { const p = window.__pitcher.engine.state.pitches.at(-1); return { title: p.title, cat: p.category }; });
  check('pitching "Throw an Egg" brings in Pip, the Steal-a expert', egg.title === 'Throw an Egg' && egg.cat === 'steal' && (await page.textContent('#chips')).includes('Pip'), JSON.stringify(egg));
  await page.locator('#stage').screenshot({ path: join(SHOTS, 'expert-seat.png') });
  check('no errors during the session', errors.length === 0, errors.join(' | '));

  // ---- 3. voices: the mic is muted while a claude speaks (browser voices) ----
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx2.addInitScript(FAKES);
  const p2 = await ctx2.newPage();
  await p2.goto(`${base}/?test=1&provider=mock&stt=browser&tts=browser&nosfx&speed=4#pitch`);
  await p2.click('#micBtn');
  await p2.waitForTimeout(150);
  await p2.evaluate(() => window.__say("It's an obby where the floor is lava and you climb a tower to escape.", true));
  check('crowd lines are spoken out loud', await waitFor(p2, () => window.__spoken.length > 0, null, 8000));
  const spoken = await p2.evaluate(() => window.__spoken);
  check('mic is muted while a claude speaks', spoken.every((s) => !s.micRunning), JSON.stringify(spoken.slice(0, 3)));
  check('mic comes back after they finish', await waitFor(p2, () => window.__mic.instances.some((r) => r.running), null, 6000));

  // ---- 4. local open-source speech: Whisper mic + Kokoro voices (workers stubbed, real audio capture) ----
  const p5 = await ctx2.newPage();
  const errs5 = [];
  p5.on('pageerror', (e) => errs5.push(e.message));
  await p5.goto(`${base}/?test=1&provider=mock&stt=whisper&tts=kokoro&nosfx&speed=4#pitch`);
  await p5.click('#micBtn');
  check('Whisper mic loads and starts listening', await waitFor(p5, () => /Whisper/.test(document.getElementById('sttPill').textContent) && document.getElementById('micStatus').textContent === 'Listening', null, 10000), await p5.textContent('#sttPill'));
  check('real microphone audio reaches the Whisper worker', await waitFor(p5, () => window.__workerLog.some((x) => x.kind === 'stt' && x.type === 'transcribe' && x.len > 1000), null, 15000));
  check('a transcribed phrase becomes a pitch', await waitFor(p5, () => window.__pitcher.engine.state.pitches.length >= 1, null, 30000), await p5.evaluate(() => JSON.stringify(window.__workerLog.slice(-4))));
  check('Kokoro voices load and speak', await waitFor(p5, () => /Kokoro/.test(document.getElementById('ttsPill').textContent) && window.__workerLog.some((x) => x.kind === 'tts' && x.type === 'speak'), null, 15000), await p5.textContent('#ttsPill'));
  const voicesUsed = await p5.evaluate(() => [...new Set(window.__workerLog.filter((x) => x.type === 'speak').map((x) => x.voice))]);
  check('each claude speaks with a named Kokoro voice', voicesUsed.length >= 1 && voicesUsed.every((v) => /^[ab][fm]_/.test(v)), voicesUsed.join(','));
  check('no errors on the local speech path', errs5.length === 0, errs5.join(' | '));

  // ---- 5. real-AI path through the local server, with a fake Claude CLI ----
  const p3 = await ctx2.newPage();
  await p3.goto(`${base}/?test=1&provider=cli&stt=browser&speed=6&mute#pitch`);
  await p3.waitForTimeout(400);
  check('AI pill shows Claude Code with Sonnet', /Claude Code \(sonnet\)/.test(await p3.textContent('#aiPill')), await p3.textContent('#aiPill'));
  await p3.fill('#typeInput', "It's a tycoon where you run a haunted hotel for ghosts and earn coins.");
  await p3.press('#typeInput', 'Enter');
  check('CLI reply reaches the chatroom', await waitFor(p3, () => document.getElementById('chat').textContent.includes('Love it!'), null, 10000));
  check('invalid speakers from the model are dropped', !(await p3.textContent('#chat')).includes('not a persona'));

  // ---- 6. phone layout ----
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await ctx3.addInitScript(FAKES);
  const p4 = await ctx3.newPage();
  await p4.goto(`${base}/?test=1&provider=mock&stt=browser&mute#pitch`);
  await p4.waitForTimeout(300);
  const sw = await p4.evaluate(() => document.scrollingElement.scrollWidth);
  check('phone width has no horizontal scroll', sw <= 391, String(sw));
  await p4.screenshot({ path: join(SHOTS, 'phone.png'), fullPage: false });

  await browser.close();
  server.close();
  const bad = results.filter((r) => !r.ok);
  console.log(results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  -> ${r.detail}`}`).join('\n'));
  console.log(`\n${results.length - bad.length}/${results.length} checks passed. Screenshots: ${SHOTS}`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error('e2e crashed:', e); process.exit(2); });
