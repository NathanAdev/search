import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../server.js';
import { cliConfig } from '../../lib/cli.js';
import { createRemoteProvider } from '../../public/js/provider-remote.js';

const fake = fileURLToPath(new URL('../fixtures/fake-claude.mjs', import.meta.url));
let server;
let base;

before(async () => {
  const cli = cliConfig({ PITCHER_CLAUDE_BIN: process.execPath, PITCHER_CLAUDE_PREFIX: JSON.stringify([fake]), PITCHER_TIMEOUT_MS: '10000' });
  server = createApp({ feedFile: join(mkdtempSync(join(tmpdir(), 'pitcher-')), 'agents.json'), cli });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const pitch = {
  id: 'p1', title: 'Haunted Hotel Tycoon', fullText: 'A tycoon for ghosts.', spec: { genres: ['tycoon'], loop: [], hook: [], audience: [], retention: [], retentionText: [], monetization: { mechanisms: [], prices: [], text: [], free: false, p2w: false, conversion: false }, session: [], social: [], scope: [], words: 4 },
  utterances: 1, questions: [{ id: 'q1', seq: 1, by: 'critic', topic: 'saturation', text: 'Why yours?', status: 'open' }], versions: [{ v: 1, note: 'First version' }], adopted: [], proposal: null,
};

test('serves the app and refuses path traversal', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Pitcher/);
  const bad = await fetch(`${base}/..%2fserver.js`);
  assert.ok([403, 404].includes(bad.status));
});

test('agents feed starts as sample data and accepts upserts', async () => {
  const a = await (await fetch(`${base}/api/agents`)).json();
  assert.equal(a.source, 'sample');
  const b = await (await fetch(`${base}/api/agents`, { method: 'POST', body: JSON.stringify({ agents: [{ id: 'x', name: 'Builder', status: 'running', task: 'Lobby', progress: 2 }], next: [{ id: 'n', title: 'Do it', priority: 'nope' }] }) })).json();
  assert.equal(b.source, 'feed');
  assert.equal(b.agents[0].progress, 1);
  assert.equal(b.next[0].priority, 'medium');
});

test('beat via fake CLI: reply is validated and the critic invariant enforced', async () => {
  const provider = createRemoteProvider({ base });
  const r = await provider.beat({ kind: 'utterance', text: 'Unlike others, guests are real players', pitch, chatTail: [] });
  assert.deepEqual(r.resolved.map((x) => x.id), ['q1']);
  assert.equal(r.questions.length, 1, 'only one new question kept');
  assert.ok(r.lines.every((l) => ['critic', 'monetizer', 'hype', 'wrestler'].includes(l.who)));
  assert.ok(r.lines.some((l) => l.question), 'the question is spoken');
  assert.equal(r.proposal.text, 'the hotel floats');
  assert.equal(r.criticDone, false, 'critic cannot be done while he just asked a new question');
});

test('understanding via fake CLI fills gaps from the local builder', async () => {
  const provider = createRemoteProvider({ base });
  const u = await provider.understanding({ pitch });
  assert.equal(u.shared, 'A ghost hotel tycoon.');
  assert.equal(u.perPersona.critic, 'Still not sold.');
  assert.ok(u.perPersona.monetizer.length > 10, 'missing persona text comes from the local builder');
  assert.match(u.markdown, /## The game/);
});

test('CLI failures become clear errors', async () => {
  for (const [mode, re] of [['garbage', /no JSON/], ['error', /Not logged in/], ['crash', /exited 1/]]) {
    process.env.FAKE_CLAUDE_MODE = mode;
    const res = await fetch(`${base}/api/ai/beat`, { method: 'POST', body: JSON.stringify({ request: { kind: 'silence', pitch } }) });
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, re);
  }
  delete process.env.FAKE_CLAUDE_MODE;
  const missing = createApp({ cli: cliConfig({ PITCHER_CLAUDE_BIN: '/nonexistent/claude' }), feedFile: null });
  await new Promise((r) => missing.listen(0, '127.0.0.1', r));
  const res = await fetch(`http://127.0.0.1:${missing.address().port}/api/ai/beat`, { method: 'POST', body: JSON.stringify({ request: { kind: 'silence', pitch } }) });
  assert.match((await res.json()).error, /not found/);
  missing.close();
});

test('PITCHER_AI=off: health reports no AI and AI routes refuse', async () => {
  const off = createApp({ feedFile: null, aiOff: true });
  await new Promise((r) => off.listen(0, '127.0.0.1', r));
  const b = `http://127.0.0.1:${off.address().port}`;
  assert.equal((await (await fetch(`${b}/api/health`)).json()).ai, null);
  assert.equal((await fetch(`${b}/api/ai/beat`, { method: 'POST', body: '{}' })).status, 503);
  off.close();
});
