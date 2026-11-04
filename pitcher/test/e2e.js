// End-to-end browser test. Needs the playwright package (pre-installed in Claude Code cloud sessions).
// It injects a fake microphone and fake voices, so no real mic, speaker or AI is used.
// Usage: node test/e2e.js [screenshot dir]
import { mkdirSync, mkdtempSync } from 'node:fs';
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

// A scripted stand-in for the browser's SpeechRecognition and speechSynthesis.
const FAKES = () => {
  window.__mic = { instances: [], started: 0, aborted: 0 };
  class FakeRecognition {
    constructor() { this.running = false; window.__mic.instances.push(this); }
    start() { if (this.running) throw new Error('already started'); this.running = true; window.__mic.started++; setTimeout(() => this.onstart?.(), 0); }
    stop() { this.running = false; setTimeout(() => this.onend?.(), 0); }
    abort() { this.running = false; window.__mic.aborted++; setTimeout(() => this.onend?.(), 0); }
    emit(text, isFinal) {
      if (!this.running) return false;
      const res = [{ transcript: text }]; res.isFinal = isFinal;
      this.onresult?.({ resultIndex: 0, results: [res] });
      return true;
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.__say = (text, isFinal = true) => window.__mic.instances.some((r) => r.emit(text, isFinal));
  window.__spoken = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'en-US', name: 'A' }, { lang: 'en-GB', name: 'B' }], speak(u) { window.__spoken.push({ text: u.text, micRunning: window.__mic.instances.some((r) => r.running) }); setTimeout(() => u.onend?.(), 120); }, cancel() {} } });
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

(async () => {
  const cli = cliConfig({ PITCHER_CLAUDE_BIN: process.execPath, PITCHER_CLAUDE_PREFIX: JSON.stringify([fake]), PITCHER_TIMEOUT_MS: '10000' });
  const server = createApp({ feedFile: join(mkdtempSync(join(tmpdir(), 'pitcher-feed-')), 'agents.json'), cli });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  // ---- 1. mock crowd, fake mic, voices off ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(FAKES);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/?test=1&provider=mock&speed=6&mute#pitch`);
  await page.waitForTimeout(400);
  check('loads without errors', errors.length === 0, errors.join(' | '));
  check('AI pill says scripted crowd', /scripted/.test(await page.textContent('#aiPill')));
  for (const cam of ['first', 'side', 'back']) {
    await page.click(`[data-cam="${cam}"]`);
    await page.waitForTimeout(850);
    const colours = await nonBlank(page);
    check(`camera ${cam} renders a scene`, colours > 25, `${colours} colours`);
    await page.locator('#stage').screenshot({ path: join(SHOTS, `cam-${cam}.png`) });
  }
  await page.click('[data-cam="first"]');

  await page.click('#micBtn');
  await page.waitForTimeout(100);
  check('Start pitch starts the microphone', await page.evaluate(() => window.__mic.started >= 1));
  await page.evaluate(() => window.__say("It's a tycoon where you run a haunted hotel for ghosts", false));
  check('interim speech shows and a heckle cuts in', await waitFor(page, () => [...document.querySelectorAll('#chat .msg.heckle')].length > 0, null, 5000));
  await page.evaluate(() => window.__say("My game is called Haunted Hotel Tycoon. It's a tycoon where you run a hotel for ghosts and build rooms and earn coins.", true));
  check('final speech starts pitch #1', await waitFor(page, () => document.querySelectorAll('#panel-board .pitch').length === 1 || document.getElementById('pitchCount').textContent === '1'));
  check('pitch title shows on the board', await waitFor(page, () => document.getElementById('panel-board').textContent.includes('Haunted Hotel Tycoon')));
  check('the critic asks a question after a pause', await waitFor(page, () => window.__pitcher.engine.state.pitches[0].questions.some((q) => q.by === 'critic'), null, 8000));
  await page.evaluate(() => window.__say('Unlike every other tycoon the guests are other real players, which is the twist.', true));
  check('a real answer resolves the critic question', await waitFor(page, () => window.__pitcher.engine.state.pitches[0].questions.some((q) => q.by === 'critic' && q.status === 'answered'), null, 8000));
  await page.evaluate(() => window.__say('Okay, my next idea is a racing game called Lava Kart where losers build the next track.', true));
  check('a second pitch is detected automatically', await waitFor(page, () => window.__pitcher.engine.state.pitches.length === 2, null, 8000));
  await waitFor(page, () => !window.__pitcher.performer.busy, null, 15000);
  const texts = await chatTexts(page);
  const speakers = new Set(await page.$$eval('#chat .msg .who', (els) => els.map((e) => e.textContent.split(' ·')[0])));
  const engineWho = await page.evaluate(() => window.__pitcher.engine.state.chat.map((m) => m.who).join(','));
  check('several claudes spoke', ['Vex', 'Sunny'].every((n) => speakers.has(n)), `dom: ${[...speakers].join(',')} engine: ${engineWho}`);
  check('claudes talk to each other in the chatroom', texts.some((t) => t.includes('→')), texts.slice(0, 8).join(' | '));
  await page.click('[data-panel="board"]');
  await page.locator('.side-col').screenshot({ path: join(SHOTS, 'board.png') });
  await page.click('#endBtn');
  check('ending writes an understanding for each pitch', await waitFor(page, () => document.querySelectorAll('#panel-doc .doc').length === 2 && !document.querySelector('#panel-doc .draft'), null, 10000));
  check('understanding has the crowd in their own words', /In their own words[\s\S]*Vex:[\s\S]*Mint:/.test(await page.textContent('#panel-doc')));
  await page.locator('.side-col').screenshot({ path: join(SHOTS, 'understanding.png') });
  await page.screenshot({ path: join(SHOTS, 'pitch-desktop.png') });

  // dashboard with sample feed + pitch-derived next items
  await page.click('#nav-dashboard');
  check('dashboard shows sample agents', await waitFor(page, () => document.querySelectorAll('#agents .agent').length >= 3, null, 5000));
  check('dashboard says it is sample data', /sample data/.test(await page.textContent('#feedSource')));
  check('recent pitches listed after ending', /Haunted Hotel Tycoon/.test(await page.textContent('#recentList')));
  await fetch(`${base}/api/agents`, { method: 'POST', body: JSON.stringify({ agents: [{ id: 'b1', name: 'Roblox builder', status: 'running', task: 'Lobby check-in', progress: 0.6 }] }) });
  check('posting to the feed updates the dashboard', await waitFor(page, () => document.getElementById('agents').textContent.includes('Roblox builder'), null, 9000));
  await page.screenshot({ path: join(SHOTS, 'dashboard.png') });
  check('no errors during the session', errors.length === 0, errors.join(' | '));

  // ---- 2. demo end to end ----
  await page.click('#nav-pitch');
  await page.click('#newBtn');
  await page.evaluate(() => window.__pitcher.runDemo());
  const st = await page.evaluate(() => window.__pitcher.engine.state.pitches.map((p) => ({ t: p.title, mood: p.criticMood, verdict: p.monetizer.verdict, u: !!p.understanding })));
  check('demo: two pitches, hotel critic convinced, both written up', st.length === 2 && st[0].mood === 'convinced' && st.every((p) => p.u), JSON.stringify(st));

  // ---- 3. voices on: the mic is muted while a claude speaks ----
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx2.addInitScript(FAKES);
  const p2 = await ctx2.newPage();
  await p2.goto(`${base}/?test=1&provider=mock&speed=4#pitch`);
  await p2.click('#micBtn');
  await p2.waitForTimeout(100);
  await p2.evaluate(() => window.__say("It's an obby where the floor is lava and you climb a tower to escape.", true));
  check('crowd lines are spoken out loud', await waitFor(p2, () => window.__spoken.length > 0, null, 8000), await p2.evaluate(() => JSON.stringify({ chat: window.__pitcher.engine.state.chat.map((m) => m.who), voices: window.__pitcher.settings.voices })));
  const spoken = await p2.evaluate(() => window.__spoken);
  check('mic is muted while a claude speaks', spoken.every((s) => !s.micRunning), JSON.stringify(spoken.slice(0, 3)));
  check('mic comes back after they finish', await waitFor(p2, () => window.__mic.instances.some((r) => r.running), null, 6000));
  check('crowd-to-crowd chat is not spoken', await p2.evaluate(() => { const chats = window.__pitcher.engine.state.chat.filter((m) => m.kind === 'chat').map((m) => m.text); return !window.__spoken.some((s) => chats.includes(s.text)); }));

  // ---- 4. real-AI path through the local server, with a fake Claude CLI ----
  const p3 = await ctx2.newPage();
  await p3.goto(`${base}/?test=1&provider=cli&speed=6&mute#pitch`);
  await p3.waitForTimeout(300);
  check('AI pill shows the Claude Code CLI', /Claude Code CLI/.test(await p3.textContent('#aiPill')));
  await p3.fill('#typeInput', "It's a tycoon where you run a haunted hotel for ghosts and earn coins.");
  await p3.press('#typeInput', 'Enter');
  check('CLI reply reaches the chatroom', await waitFor(p3, () => document.getElementById('chat').textContent.includes('Love it!'), null, 10000));
  check('invalid personas from the model are dropped', !(await p3.textContent('#chat')).includes('not a persona'));

  // ---- 5. phone layout ----
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await ctx3.addInitScript(FAKES);
  const p4 = await ctx3.newPage();
  await p4.goto(`${base}/?test=1&provider=mock&mute#pitch`);
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
