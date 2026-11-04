import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEMO } from '../../public/js/demo.js';
import { classify, isAffirmation, isEndCue } from '../../public/js/detector.js';
import { createEngine } from '../../public/js/engine.js';
import { autoTitle, extractSpec, titleFrom } from '../../public/js/extract.js';
import { createMockProvider, evaluateAnswer } from '../../public/js/provider-mock.js';
import { revenueSketch, scoreMonetization } from '../../public/js/scoring.js';

function harness(settings = {}) {
  let now = 1_000_000;
  const events = [];
  const engine = createEngine({ provider: createMockProvider({ seed: 3 }), fallback: createMockProvider({ seed: 4 }), clock: () => now, settings, onEvent: (e) => events.push(e) });
  engine.start();
  return { engine, events, advance: (ms) => { now += ms; }, lines: () => events.filter((e) => e.type === 'lines').flatMap((e) => e.lines) };
}

async function runDemo(h) {
  for (const step of DEMO) {
    if (step.pause) { h.advance(2500); await h.engine.pause(2500); } else { h.advance(4000); await h.engine.hearFinal(step.say); }
  }
  await h.engine.idle();
}

test('extracts genre, title, monetization and retention', () => {
  const s = extractSpec('It is called Haunted Hotel Tycoon. A tycoon with a 2x game pass for 199 robux and a daily login chest.');
  assert.deepEqual(s.genres.includes('tycoon'), true);
  assert.deepEqual(s.monetization.mechanisms, ['gamepass']);
  assert.deepEqual(s.monetization.prices, [199]);
  assert.ok(s.retention.includes('daily'));
  assert.equal(titleFrom("My game is called Haunted Hotel Tycoon. It's great"), 'Haunted Hotel Tycoon');
  assert.equal(autoTitle('a haunted hotel tycoon for ghosts', ['tycoon']), 'Haunted Hotel Tycoon');
});

test('detector: first pitch, new pitch cue, revision, end cue, affirmation', () => {
  const active = { genres: ['tycoon'], tokens: new Set(['hotel', 'ghost']), segments: 3 };
  assert.equal(classify('hi', {}).action, 'ignore');
  assert.equal(classify('It is a tycoon where you run a ghost hotel', {}).action, 'new');
  assert.equal(classify('Okay my next idea is a racing game', { active }).action, 'new');
  assert.equal(classify('Actually, let me change it so the hotel is underwater', { active }).action, 'revise');
  assert.equal(classify('Imagine a racing game where the track is lava and karts melt', { active }).action, 'new');
  assert.equal(classify('Imagine a racing game where the track is lava', { active, awaitingAnswer: true }).action, 'continue');
  assert.ok(isEndCue("That's my pitch."));
  assert.ok(isAffirmation('Yes, let us do that twist'));
  assert.ok(!isAffirmation('No, keep it'));
});

test('answer judging needs topic words, not just length', () => {
  assert.equal(evaluateAnswer('retention', 'Because it is really really fun and cool and people will like it a lot').ok, false);
  assert.equal(evaluateAnswer('retention', 'A daily login chest plus a weekly event with limited rooms').ok, true);
  assert.equal(evaluateAnswer('price', 'The game pass is 199 robux').ok, true);
});

test('monetizer rubric moves with the pitch', () => {
  const weak = scoreMonetization(extractSpec('A tycoon where you build a hotel. It is free.'));
  const strong = scoreMonetization(extractSpec('A tycoon where you build rooms and earn coins and upgrade, unlike others the guests are real players. Game pass 199 robux, VIP server, skins. 2 percent pay. Daily rewards, streaks and weekly events with friends.'));
  assert.equal(weak.verdict, 'PASS');
  assert.ok(strong.score > weak.score + 30, `${strong.score} vs ${weak.score}`);
  assert.match(revenueSketch(extractSpec('game pass 199 robux')).text, /199 R\$/);
});

test('full demo: two pitches, critic negative until all answered, twist adopted, understanding written', async () => {
  const h = harness({ interruptions: false, chatter: false });
  await runDemo(h);
  const { pitches } = h.engine.state;
  assert.equal(pitches.length, 2, pitches.map((p) => p.title).join(' | '));
  const [hotel, kart] = pitches;
  assert.equal(hotel.title, 'Haunted Hotel Tycoon');
  assert.equal(kart.title, 'Lava Kart');
  const critic = hotel.questions.filter((q) => q.by === 'critic');
  assert.ok(critic.length >= 3, `critic asked ${critic.length}`);
  // Invariant: while any critic question is open the critic is never convinced.
  if (hotel.criticMood === 'convinced') assert.ok(critic.every((q) => q.status === 'answered'));
  assert.equal(hotel.criticMood, 'convinced', 'the demo answers everything Vex asks');
  const convincedLines = h.lines().filter((l) => l.who === 'critic' && /every question answered|nothing left/i.test(l.text));
  assert.equal(convincedLines.length, 1, convincedLines.map((l) => l.text).join(' | '));
  assert.ok(hotel.questions.some((q) => q.by === 'monetizer'), 'monetizer asked');
  assert.ok(hotel.adopted.length === 1 || hotel.proposal === null, 'twist handled');
  assert.ok(hotel.versions.length >= 1);
  await h.engine.end();
  for (const p of pitches) {
    assert.ok(p.understanding.markdown.includes(p.title));
    assert.ok(p.understanding.markdown.includes('## Money'));
  }
  const who = new Set(h.lines().map((l) => l.who));
  for (const id of ['critic', 'monetizer', 'hype', 'wrestler']) assert.ok(who.has(id), `${id} spoke`);
  assert.ok(h.lines().some((l) => l.kind === 'chat' && l.to), 'crowd talked to each other');
});

test('critic pushes back on a weak answer and Sunny coaches', async () => {
  const h = harness({ interruptions: false, chatter: false });
  await h.engine.hearFinal("It's a tycoon where you run a pizza shop for cats and grow it.", { typed: true });
  const q = h.engine.state.pitches[0].questions.find((x) => x.by === 'critic');
  assert.ok(q, 'critic asked a question');
  h.advance(3000);
  await h.engine.hearFinal('Because it is fun.', { typed: true });
  const lines = h.lines();
  assert.ok(lines.some((l) => l.who === 'critic' && /vague|theme|reason|verbs|slow|names|hope|dead|plan/i.test(l.text)), 'critic pushback');
  assert.ok(lines.some((l) => l.who === 'hype' && /psst|say|tell|give|mention/i.test(l.text)), 'sunny hint');
  assert.equal(h.engine.state.pitches[0].criticMood === 'convinced', false);
});

test('mid-pitch heckles are rate limited and once per keyword', () => {
  const h = harness({ interruptions: true });
  h.engine.hearFinal('It is a tycoon where you run a hotel and it is a tycoon with pets');
  return h.engine.idle().then(() => {
    h.engine.hearInterim('another tycoon with pets');
    h.engine.hearInterim('pets pets');
    h.advance(10000);
    h.engine.hearInterim('pets again and a tycoon');
    const heckles = h.lines().filter((l) => l.kind === 'heckle');
    assert.equal(heckles.length, 2, heckles.map((x) => x.text).join(' | '));
  });
});

test('provider failure falls back to the scripted crowd and says so', async () => {
  let now = 0;
  const events = [];
  const broken = { name: 'claude-cli', beat: async () => { throw new Error('claude not found'); }, understanding: async () => { throw new Error('nope'); } };
  const engine = createEngine({ provider: broken, fallback: createMockProvider(), clock: () => (now += 1000), onEvent: (e) => events.push(e) });
  engine.start();
  await engine.hearFinal("It's an obby where the floor is lava and you climb a tower", { typed: true });
  await engine.end();
  assert.ok(engine.state.chat.some((m) => m.who === 'system' && /Real AI failed/.test(m.text)));
  assert.ok(engine.state.pitches[0].understanding.markdown.length > 100);
});
