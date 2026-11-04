// Pitcher's local server: serves the app, the dashboard feed, and the real-AI routes (Claude Code CLI).
// Listens on 127.0.0.1 only by default, because the AI routes start processes on this machine.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBeatPrompt, buildUnderstandingPrompt, extractJson, validateBeat, validateUnderstanding } from './public/js/aiContract.js';
import { createFeed } from './lib/agents.js';
import { cliConfig, runClaude } from './lib/cli.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = resolve(ROOT, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const MAX_BODY = 512 * 1024;
const MAX_CLI = 2;

export function createApp({ feedFile = join(ROOT, 'data', 'agents.json'), cli = cliConfig(), run = runClaude, aiOff = process.env.PITCHER_AI === 'off' } = {}) {
  const feed = createFeed(feedFile);
  let running = 0;
  const waiting = [];
  const limited = async (fn) => {
    if (running >= MAX_CLI) await new Promise((r) => waiting.push(r));
    running++;
    try { return await fn(); } finally { running--; waiting.shift()?.(); }
  };

  const send = (res, code, body, type = 'application/json') => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
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
    if (path === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, ai: aiOff ? null : { kind: 'claude-cli', bin: cli.bin, model: cli.model || '(cli default)' } });
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
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
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
  createApp().listen(port, host, () => console.log(`Pitcher on http://${host}:${port}  (AI: ${off ? 'off, scripted crowd only' : `claude CLI "${cliConfig().bin}", model ${cliConfig().model || 'default'}`})`));
}
