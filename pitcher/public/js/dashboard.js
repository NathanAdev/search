// Dashboard view: your agents (from the JSON feed, or sample data), what's next, and every saved pitch session.
import { getPersona } from './personas.js';
import { topicLabel } from './provider-mock.js';

const STATUS_COLOR = { running: 'var(--ok)', idle: 'var(--muted)', blocked: 'var(--warn)', done: '#4c8df6', error: 'var(--bad)' };
const ago = (t) => { if (!t) return ''; const s = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };

export function createDashboard({ el, root, getLive, loadSessions, openSession, fetchImpl = (...a) => fetch(...a), everyMs = 5000 }) {
  let timer = 0;
  let last = null;
  let sessions = [];

  async function load() {
    try {
      const r = await fetchImpl('/api/agents', { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      last = await r.json();
    } catch { last = { source: 'offline', agents: [], next: [] }; }
    sessions = await loadSessions();
    render();
  }

  function pitchItems() {
    const out = [];
    for (const p of getLive().pitches) {
      for (const q of p.questions.filter((x) => x.status === 'open')) out.push({ title: `Answer ${getPersona(q.by)?.name} on ${topicLabel(q.topic)} (${p.title})`, owner: 'you', priority: q.by === 'critic' ? 'high' : 'medium' });
      const worst = p.monetizer.reasons.filter((r) => r.d < 0).sort((a, b) => a.d - b.d)[0];
      if (worst) out.push({ title: `Mint wants: fix "${worst.text}" (${p.title})`, owner: 'you', priority: 'medium' });
    }
    return out;
  }

  function render() {
    const data = last || { source: 'loading', agents: [], next: [] };
    root.source.textContent = data.source === 'sample' ? 'sample data · nothing has posted to the feed yet' : data.source === 'feed' ? 'live feed' : data.source === 'offline' ? 'no server · start Pitcher with its launcher' : 'loading…';
    root.agents.replaceChildren(...(data.agents.length ? data.agents.map((a) => el('article', { class: 'agent', style: `--c:${STATUS_COLOR[a.status] || 'var(--muted)'}` },
      el('div', { class: 'st', text: `${a.status}${a.updatedAt ? ` · ${ago(a.updatedAt)}` : ''}` }), el('h3', { text: a.name }), el('p', { text: a.task }),
      a.detail ? el('p', { text: a.detail }) : null,
      Number.isFinite(a.progress) ? el('div', { class: 'meter', style: '--c:var(--accent)' }, el('i', { style: `width:${Math.round(a.progress * 100)}%` })) : null))
      : [el('p', { class: 'empty', text: 'No agents reported yet.' })]));
    const next = [...pitchItems(), ...data.next.filter((n) => !n.done)];
    root.next.replaceChildren(...(next.length ? next.map((n) => el('li', {}, n.title, el('span', { class: `prio ${n.priority}`, text: n.priority }), n.owner ? el('span', { class: 'hint', text: ` · ${n.owner}` }) : null))
      : [el('li', { class: 'empty', text: 'Nothing queued.' })]));
    root.recent.replaceChildren(...(sessions.length ? sessions.slice(0, 12).map((s) => el('li', { 'data-session': s.id },
      el('b', { text: s.pitches.map((p) => p.title).join(', ') || 'Untitled session' }),
      el('div', { class: 'hint', text: `${ago(s.savedAt)} · ${s.pitches.map((p) => `${p.title}: Mint ${p.verdict} ${p.score}, Vex ${p.critic}`).join(' · ')}` }),
      el('div', { class: 'acts' }, el('button', { text: 'View', onclick: () => openSession(s.id, 'view') }), el('button', { text: 'Markdown', onclick: () => openSession(s.id, 'md') }),
        el('button', { text: 'Page', onclick: () => openSession(s.id, 'html') }), el('button', { text: 'JSON', onclick: () => openSession(s.id, 'json') }))))
      : [el('li', { class: 'empty', text: 'Finished pitches are saved here automatically, with the full transcript.' })]));
  }

  return { show() { clearInterval(timer); load(); timer = setInterval(load, everyMs); }, hide() { clearInterval(timer); }, render };
}
