// The dashboard feed: agents and "what's next" items. Anything can POST status here; it is kept in memory
// and mirrored to data/agents.json. With no feed yet, it serves clearly marked sample data.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SAMPLE = {
  agents: [
    { id: 'gap-ledger', name: 'Gap Ledger researcher', status: 'blocked', task: 'Verify 118 idea signals', detail: 'Research hosts are blocked by the cloud network policy', updatedAt: null },
    { id: 'roblox-build', name: 'Roblox build agent', status: 'running', task: 'Prototype Haunted Hotel lobby', detail: 'Writing the server-side coin validation', progress: 0.4, updatedAt: null },
    { id: 'pitch-scribe', name: 'Pitch scribe', status: 'idle', task: 'Waiting for the next pitch', detail: 'Writes the crowd\'s understanding into a brief', updatedAt: null },
  ],
  next: [
    { id: 'n1', title: 'Allow research hosts so verify.js can run', owner: 'you', priority: 'high' },
    { id: 'n2', title: 'Playtest the lobby check-in flow', owner: 'roblox-build', priority: 'medium' },
  ],
};
const STATUS = ['running', 'idle', 'blocked', 'done', 'error'];
const str = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');

export function createFeed(file) {
  let data = null;
  if (file && existsSync(file)) { try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { data = null; } }
  const save = () => { if (file) writeFileSync(file, JSON.stringify(data, null, 1)); };
  return {
    get() {
      if (!data) {
        const now = Date.now();
        return { source: 'sample', agents: SAMPLE.agents.map((a, i) => ({ ...a, updatedAt: now - (i + 1) * 95000 })), next: SAMPLE.next };
      }
      return { source: 'feed', ...data };
    },
    // Upsert by id. Body: { agents?: [...], next?: [...], replace?: boolean }
    post(body) {
      if (!body || typeof body !== 'object') throw new Error('expected a JSON object');
      if (!data || body.replace) data = { agents: [], next: [] };
      for (const a of Array.isArray(body.agents) ? body.agents : []) {
        if (!a || !str(a.id, 80)) continue;
        const clean = { id: str(a.id, 80), name: str(a.name, 80) || a.id, status: STATUS.includes(a.status) ? a.status : 'idle', task: str(a.task, 200), detail: str(a.detail, 400),
          ...(Number.isFinite(a.progress) ? { progress: Math.max(0, Math.min(1, a.progress)) } : {}), updatedAt: Date.now() };
        const i = data.agents.findIndex((x) => x.id === clean.id);
        if (i >= 0) data.agents[i] = clean; else data.agents.push(clean);
      }
      for (const n of Array.isArray(body.next) ? body.next : []) {
        if (!n || !str(n.id, 80)) continue;
        const clean = { id: str(n.id, 80), title: str(n.title, 200), owner: str(n.owner, 80), priority: ['high', 'medium', 'low'].includes(n.priority) ? n.priority : 'medium', done: !!n.done };
        const i = data.next.findIndex((x) => x.id === clean.id);
        if (i >= 0) data.next[i] = clean; else data.next.push(clean);
      }
      save();
      return this.get();
    },
  };
}
