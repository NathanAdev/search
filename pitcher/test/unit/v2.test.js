import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync, inflateRawSync } from 'node:zlib';
import { createApp } from '../../server.js';
import { buildBeatPrompt, validateBeat } from '../../public/js/aiContract.js';
import { CATEGORIES, detectCategories, expertId } from '../../public/js/categories.js';
import { createCrowdcast } from '../../public/js/crowdcast.js';
import { createEngine } from '../../public/js/engine.js';
import { sessionData, sessionHtml, sessionMarkdown } from '../../public/js/export.js';
import { IDEAS, ideasMarkdown, pitchScript } from '../../public/js/ideas.js';
import { getPersona } from '../../public/js/personas.js';
import { BRIEFS, expertBrief } from '../../public/js/prompts.js';
import { createMockProvider } from '../../public/js/provider-mock.js';
import { untar } from '../../scripts/fetch-vendor.mjs';
import { zip } from '../../scripts/package.mjs';

function harness() {
  let now = 5_000_000;
  const events = [];
  const engine = createEngine({ provider: createMockProvider({ seed: 2 }), clock: () => (now += 1000), settings: { interruptions: false, chatter: false }, onEvent: (e) => events.push(e) });
  engine.start();
  return { engine, events, lines: () => events.filter((e) => e.type === 'lines').flatMap((e) => e.lines) };
}

test('100 ideas, every one detected as its own category', () => {
  assert.equal(IDEAS.length, 100);
  assert.equal(new Set(IDEAS.map((i) => i.title)).size, 100, 'titles are unique');
  assert.equal(IDEAS.filter((i) => i.category === 'steal').length, 22);
  assert.equal(IDEAS.filter((i) => i.category === 'plusone').length, 22);
  for (const t of ['Throw an Egg', 'Kick an Egg', '+1 Long Arm Escape', '+1 Float Prison Escape']) assert.ok(IDEAS.some((i) => i.title === t), t);
  for (const i of IDEAS) assert.equal(detectCategories(pitchScript(i).join(' '))[0], i.category, i.title);
  assert.match(ideasMarkdown(), /## Steal-a \(22\)/);
});

test('category detection prefers named formats', () => {
  assert.equal(detectCategories('a tycoon where you earn cash every second')[0], 'tycoon');
  assert.equal(detectCategories('+1 float prison escape where you float higher')[0], 'plusone');
  assert.equal(detectCategories('steal an egg but you kick it home')[0], 'steal');
  assert.deepEqual(detectCategories('a cooking show'), []);
});

test('every main claude and every expert has a real system brief', () => {
  for (const id of ['critic', 'monetizer', 'hype', 'wrestler']) assert.ok(BRIEFS[id].length > 400, id);
  assert.match(BRIEFS.critic, /negative until every question/);
  for (const cat of Object.keys(CATEGORIES)) {
    assert.ok(expertBrief(cat).includes(CATEGORIES[cat].expert.name.toUpperCase()), cat);
    assert.ok(getPersona(expertId(cat)).name, cat);
  }
});

test('a Steal-a pitch brings in Pip, who asks a format question', async () => {
  const h = harness();
  await h.engine.hearFinal('My game is called Throw an Egg. You steal eggs from other bases and throw them into your nest where they earn cash.', { typed: true });
  const p = h.engine.state.pitches[0];
  assert.equal(p.category, 'steal');
  assert.ok(h.events.some((e) => e.type === 'expert' && e.category === 'steal'));
  assert.ok(h.lines().some((l) => l.who === 'expert:steal' && /Pip/.test(l.text)), 'expert introduces themselves');
  for (let i = 0; i < 6 && !p.questions.some((q) => q.by === 'expert:steal'); i++) await h.engine.hearFinal('It has more stuff and it is good.', { typed: true });
  assert.ok(p.questions.some((q) => q.by === 'expert:steal'), JSON.stringify(p.questions.map((q) => q.by)));
});

test('choosing a question: by click (focus) and by saying the name', async () => {
  const h = harness();
  await h.engine.hearFinal("It's a tycoon where you run a cat pizza shop.", { typed: true });
  await h.engine.hearFinal('More about the cats.', { typed: true });
  await h.engine.pause(3000);
  const p = h.engine.state.pitches[0];
  const vex = p.questions.find((q) => q.by === 'critic' && q.status === 'open');
  assert.ok(vex);
  h.engine.focus(vex.id);
  const before = vex.attempts || 0;
  await h.engine.hearFinal('Because cats.', { typed: true });
  assert.equal(vex.attempts, before + 1, 'the weak answer counted against the chosen question');
  const mint = p.questions.find((q) => q.by === 'monetizer' && q.status === 'open');
  if (mint) {
    await h.engine.hearFinal('Mint, there is a 2x game pass for 199 robux and a VIP server.', { typed: true });
    assert.equal(mint.status, 'answered');
  }
  h.engine.hint(vex.id);
  assert.ok(h.lines().some((l) => l.who === 'hype' && l.to === 'you'), 'hint from Sunny');
  h.engine.defer(vex.id);
  assert.equal(vex.deferred, true);
});

test('transcript is stored and export has it all', async () => {
  const h = harness();
  await h.engine.hearFinal('My game is called Kick an Egg. You steal eggs and kick them into your base.', { typed: true });
  await h.engine.hearFinal('Okay, my next idea is +1 Long Arm Escape where your arm grows +1 every second.', { typed: true });
  await h.engine.end();
  const st = h.engine.state;
  assert.equal(st.transcript.length, 2);
  assert.equal(st.transcript[1].pitchId, st.pitches[1].id);
  const d = sessionData(st, { id: 's-test' });
  assert.equal(d.pitches.length, 2);
  assert.equal(d.pitches[0].category, 'Steal-a');
  assert.equal(d.pitches[1].category, '+1 every second');
  const md = sessionMarkdown(st);
  assert.match(md, /## Your transcript/);
  assert.match(md, /Kick an Egg/);
  const html = sessionHtml({ ...st, transcript: [...st.transcript, { t: Date.now(), text: '<script>alert(1)</script>', source: 'typed' }] });
  assert.ok(!html.includes('<script>alert'), 'html export escapes text');
});

test('crowd members never repeat back to back', () => {
  const c = createCrowdcast(() => 0.3);
  const a = c.line('new');
  const b = c.line('new');
  assert.ok(a && b && a.name !== b.name);
});

test('AI contract: expert can speak, briefs are in the prompt, focus is passed', () => {
  const pitch = { id: 'p1', title: 'Throw an Egg', category: 'steal', fullText: 'steal eggs', spec: {}, versions: [{ v: 1 }], adopted: [], proposal: null,
    questions: [{ id: 'q1', by: 'expert:steal', topic: 'steal_verb', text: 'What changes?', status: 'open' }] };
  const prompt = buildBeatPrompt({ kind: 'utterance', text: 'you aim the throw', pitch, focusId: 'q1' });
  assert.match(prompt, /You are VEX/);
  assert.match(prompt, /You are PIP/);
  assert.match(prompt, /chose to answer this question \(focus\): q1/);
  const r = validateBeat({ resolved: [{ id: 'q1', status: 'answered' }], lines: [{ who: 'expert:steal', text: 'Good.' }, { who: 'expert:tycoon', text: 'wrong expert' }], questions: [{ by: 'expert:steal', topic: 'steal_ladder', text: 'Tiers?' }] }, { kind: 'utterance', pitch });
  assert.deepEqual(r.lines.map((l) => l.who), ['expert:steal', 'expert:steal']);
  assert.equal(r.questions[0].topic, 'steal_ladder');
});

test('sessions API stores and lists sessions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitcher-s-'));
  const app = createApp({ feedFile: null, sessionsDir: dir, aiOff: true });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const b = `http://127.0.0.1:${app.address().port}`;
  const h = await (await fetch(`${b}/api/health`)).json();
  assert.equal(h.sessions, true);
  assert.equal((await fetch(`${b}/api/sessions`, { method: 'POST', body: JSON.stringify({ id: '../evil', session: {} }) })).status, 400);
  assert.equal((await fetch(`${b}/api/sessions`, { method: 'POST', body: JSON.stringify({ id: 's-abc123', session: { startedAt: 'x', pitches: [{ title: 'T', monetizer: { verdict: 'PASS', score: 9 } }] } }) })).status, 200);
  const list = (await (await fetch(`${b}/api/sessions`)).json()).sessions;
  assert.equal(list[0].pitches[0].title, 'T');
  assert.equal((await (await fetch(`${b}/api/sessions/s-abc123`)).json()).id, 's-abc123');
  const res = await fetch(`${b}/`);
  assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
  app.close();
});

test('tar reader and zip writer round-trip', () => {
  const header = (name, size) => { const h = Buffer.alloc(512); h.write(name, 0); h.write(size.toString(8).padStart(11, '0'), 124); h[156] = 48; return h; };
  const body = Buffer.from('hello');
  const tar = Buffer.concat([header('package/a.txt', 5), body, Buffer.alloc(507), Buffer.alloc(1024)]);
  assert.equal(untar(gzipSync(tar).length ? tar : tar).get('package/a.txt').toString(), 'hello');
  const z = zip([{ name: 'x/y.txt', data: Buffer.from('zipped text '.repeat(50)) }]);
  assert.equal(z.readUInt32LE(0), 0x04034b50);
  const nameLen = z.readUInt16LE(26);
  const size = z.readUInt32LE(18);
  assert.equal(inflateRawSync(z.subarray(30 + nameLen, 30 + nameLen + size)).toString(), 'zipped text '.repeat(50));
});
