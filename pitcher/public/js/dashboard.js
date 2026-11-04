// Dashboard view: your agents (from the JSON feed, or sample data) and what's next to do.
import { PERSONAS } from './personas.js';
import { topicLabel } from './provider-mock.js';

const STATUS_COLOR = { running: 'var(--ok)', idle: 'var(--muted)', blocked: 'var(--warn)', done: 'var(--wrestler)', error: 'var(--bad)' };
const ago = (t) => { if (!t) return ''; const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`; };

export function createDashboard({ el, root, getLive, loadRecent, fetchImpl = (...a) => fetch(...a), everyMs = 5000 }) {
  let timer = 0;
  let last = null;

  async function load() {
    try {
      const r = await fetchImpl('/api/agents', { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      last = await r.json();
    } catch {
      last = { source: 'offline', agents: [], next: [] };
    }
    render();
  }

  function pitchItems() {
    const out = [];
    for (const p of getLive().pitches) {
      for (const q of p.questions.filter((x) => x.status === 'open')) out.push({ title: `Answer ${PERSONAS[q.by].name} on ${topicLabel(q.topic)} (${p.title})`, owner: 'you', priority: q.by === 'critic' ? 'high' : 'medium' });
      const worst = p.monetizer.reasons.filter((r) => r.d < 0).sort((a, b) => a.d - b.d)[0];
      if (worst) out.push({ title: `Mint wants: fix "${worst.text}" (${p.title})`, owner: 'you', priority: 'medium' });
    }
    return out;
  }

  function render() {
    const data = last || { source: 'loading', agents: [], next: [] };
    root.source.textContent = data.source === 'sample' ? 'sample data · nothing has posted to the feed yet' : data.source === 'feed' ? 'live feed' : data.source === 'offline' ? 'no server · start it with npm start' : 'loading…';
    root.agents.replaceChildren(...(data.agents.length ? data.agents.map((a) => el('article', { class: 'agent', style: `--c:${STATUS_COLOR[a.status] || 'var(--muted)'}` },
      el('div', { class: 'st', text: `${a.status}${a.updatedAt ? ` · ${ago(a.updatedAt)}` : ''}` }),
      el('h3', { text: a.name }),
      el('p', { text: a.task }),
      a.detail ? el('p', { text: a.detail }) : null,
      Number.isFinite(a.progress) ? el('div', { class: 'meter', style: '--c:var(--accent)' }, el('i', { style: `width:${Math.round(a.progress * 100)}%` })) : null))
      : [el('p', { class: 'empty', text: 'No agents reported yet.' })]));
    const next = [...pitchItems(), ...data.next.filter((n) => !n.done)];
    root.next.replaceChildren(...(next.length ? next.map((n) => el('li', {}, n.title, el('span', { class: `prio ${n.priority}`, text: n.priority }), n.owner ? el('span', { class: 'hint', text: ` · ${n.owner}` }) : null))
      : [el('li', { class: 'empty', text: 'Nothing queued.' })]));
    const recent = loadRecent();
    root.recent.replaceChildren(...(recent.length ? recent.slice(0, 8).map((r) => el('li', {}, el('b', { text: r.title }), ` · Mint ${r.verdict} ${r.score} · Vex ${r.critic}${r.open.length ? ` · open: ${r.open.join(', ')}` : ''}`))
      : [el('li', { class: 'empty', text: 'Finished pitches show up here.' })]));
  }

  return {
    show() { clearInterval(timer); load(); timer = setInterval(load, everyMs); },
    hide() { clearInterval(timer); },
    render,
  };
}
