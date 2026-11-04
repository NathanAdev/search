// Pitcher's local server: serves the app, the dashboard feed, and the real-AI routes (Claude Code CLI).
// Listens on 127.0.0.1 only by default, because the AI routes start processes on this machine.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBeatPrompt, buildUnderstandingPrompt, extractJson, validateBeat, validateUnderstanding } from './public/js/aiContract.js';
import { createFeed } from './lib/agents.js';
import { cliConfig, runClaude } from './lib/cli.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = resolve(ROOT, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
const MAX_BODY = 2 * 1024 * 1024;
// One Claude Code process at a time keeps memory use low (each CLI process is a few hundred MB).
const MAX_CLI = 1;
// Cross-origin isolation lets the speech models use several threads; "credentialless" still allows the model download.
const ISOLATION = { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'credentialless' };

export function createApp({ feedFile = join(ROOT, 'data', 'agents.json'), sessionsDir = join(ROOT, 'data', 'sessions'), cli = cliConfig(), run = runClaude, aiOff = process.env.PITCHER_AI === 'off', onPing = () => {} } = {}) {
  const feed = createFeed(feedFile);
  if (sessionsDir) mkdirSync(sessionsDir, { recursive: true });
  const SID = /^[a-z0-9-]{6,48}$/;
  let running = 0;
  const waiting = [];
  const limited = async (fn) => {
    if (running >= MAX_CLI) await new Promise((r) => waiting.push(r));
    running++;
    try { return await fn(); } finally { running--; waiting.shift()?.(); }
  };

  const send = (res, code, body, type = 'application/json') => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...ISOLATION });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
  };
  const readJson = (req) => new Promise((ok, fail) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { fail(Object.assign(new Error('body too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { fail(Object.assign(new Error('invalid JSON'), { code: 400 })); } });
    req.on('error', fail);
  });

  async function api(req, res, path) {
    if (path === '/api/health' && req.method === 'GET') {
      onPing();
      return send(res, 200, { ok: true, ai: aiOff ? null : { kind: 'claude-cli', bin: cli.bin, model: cli.model || '(cli default)' }, speech: { local: existsSync(join(PUBLIC, 'vendor', 'manifest.json')) }, sessions: !!sessionsDir });
    }
    if (path === '/api/sessions' && req.method === 'GET') {
      if (!sessionsDir) return send(res, 200, { sessions: [] });
      const list = [];
      for (const f of readdirSync(sessionsDir).filter((x) => x.endsWith('.json'))) {
        try { const d = JSON.parse(await readFile(join(sessionsDir, f), 'utf8')); list.push({ id: d.id, startedAt: d.startedAt, savedAt: d.savedAt, pitches: (d.pitches || []).map((p) => ({ title: p.title, verdict: p.monetizer?.verdict, score: p.monetizer?.score, critic: p.critic, category: p.category })) }); } catch { /* skip broken file */ }
      }
      return send(res, 200, { sessions: list.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))).slice(0, 100) });
    }
    if (path === '/api/sessions' && req.method === 'POST') {
      if (!sessionsDir) return send(res, 404, { error: 'sessions are not stored on this server' });
      const body = await readJson(req);
      if (!SID.test(body?.id || '') || !body.session || typeof body.session !== 'object') return send(res, 400, { error: 'need {id, session}' });
      const data = { ...body.session, id: body.id, savedAt: new Date().toISOString() };
      await writeFile(join(sessionsDir, `${body.id}.json`), JSON.stringify(data, null, 1));
      return send(res, 200, { ok: true, id: body.id, savedAt: data.savedAt });
    }
    const m = path.match(/^\/api\/sessions\/([a-z0-9-]{6,48})$/);
    if (m && req.method === 'GET' && sessionsDir) {
      try { return send(res, 200, JSON.parse(await readFile(join(sessionsDir, `${m[1]}.json`), 'utf8'))); } catch { return send(res, 404, { error: 'no such session' }); }
    }
    if (aiOff && path.startsWith('/api/ai/')) return send(res, 503, { error: 'real AI is switched off (PITCHER_AI=off)' });
    if (path === '/api/agents' && req.method === 'GET') return send(res, 200, feed.get());
    if (path === '/api/agents' && req.method === 'POST') return send(res, 200, feed.post(await readJson(req)));
    if (path === '/api/ai/beat' && req.method === 'POST') {
      const { request } = await readJson(req);
      if (!request?.pitch?.questions) return send(res, 400, { error: 'missing request.pitch' });
      const text = await limited(() => run(buildBeatPrompt(request), cli));
      return send(res, 200, validateBeat(extractJson(text), request));
    }
    if (path === '/api/ai/understanding' && req.method === 'POST') {
      const { pitch } = await readJson(req);
      if (!pitch?.spec) return send(res, 400, { error: 'missing pitch' });
      const text = await limited(() => run(buildUnderstandingPrompt(pitch), cli));
      return send(res, 200, validateUnderstanding(extractJson(text), pitch));
    }
    return send(res, 404, { error: 'not found' });
  }

  async function serveStatic(res, path) {
    const rel = normalize(decodeURIComponent(path === '/' ? '/index.html' : path)).replace(/^([/\\])+/, '');
    const file = resolve(PUBLIC, rel);
    if (file !== PUBLIC && !file.startsWith(PUBLIC + sep)) return send(res, 403, 'forbidden', 'text/plain');
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': rel.startsWith('vendor') ? 'public, max-age=604800' : 'no-cache', ...ISOLATION });
      res.end(body);
    } catch { send(res, 404, 'not found', 'text/plain'); }
  }

  return createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    try {
      if (path.startsWith('/api/')) await api(req, res, path);
      else if (req.method === 'GET') await serveStatic(res, path);
      else send(res, 405, { error: 'method not allowed' });
    } catch (err) {
      send(res, err.code === 413 || err.code === 400 ? err.code : 502, { error: err.message });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = +(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  const off = process.env.PITCHER_AI === 'off';
  // PITCHER_AUTOSTOP=<minutes>: the desktop launcher sets this so the server exits once the app window has been closed for a while.
  const stopAfter = +(process.env.PITCHER_AUTOSTOP || 0) * 60000;
  let lastPing = Date.now();
  const server = createApp({ onPing: () => { lastPing = Date.now(); } });
  if (stopAfter) setInterval(() => { if (Date.now() - lastPing > stopAfter) { console.log('No Pitcher window open; stopping.'); process.exit(0); } }, 15000).unref();
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') { console.log(`Pitcher is already running on port ${port}.`); process.exit(0); }
    throw e;
  });
  server.listen(port, host, () => console.log(`Pitcher on http://${host}:${port}  (AI: ${off ? 'off, scripted crowd only' : `claude CLI "${cliConfig().bin}", model ${cliConfig().model || 'default'}`})`));
}
