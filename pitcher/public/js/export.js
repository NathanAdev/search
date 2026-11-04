// Exports a whole session: your transcript, the chatroom, every pitch with its questions, scores and write-up.
import { CATEGORIES } from './categories.js';
import { getPersona, nameOf } from './personas.js';
import { topicLabel } from './provider-mock.js';
import { buildUnderstanding } from './understanding.js';

const iso = (t) => (t ? new Date(t).toISOString() : null);
const clock = (t, start) => { const s = Math.max(0, Math.round((t - (start || t)) / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

export function sessionData(state, meta = {}) {
  const start = state.startedAt || state.transcript[0]?.t || Date.now();
  return {
    app: 'Pitcher', format: 1, id: meta.id || null, exportedAt: new Date().toISOString(), startedAt: iso(start), provider: state.providerName,
    transcript: state.transcript.map((x) => ({ at: iso(x.t), clock: clock(x.t, start), text: x.text, source: x.source, pitch: state.pitches.find((p) => p.id === x.pitchId)?.title || null })),
    chat: state.chat.map((m) => ({ at: iso(m.t), clock: clock(m.t, start), who: m.who, name: m.who === 'crowd' ? m.name : nameOf(m.who), kind: m.kind, to: m.to || null, text: m.text })),
    pitches: state.pitches.map((p) => {
      const u = p.understanding || buildUnderstanding(p);
      return {
        n: p.n, title: p.title, category: p.category ? CATEGORIES[p.category]?.label : null, versions: p.versions.map((v) => ({ v: v.v, at: iso(v.at), note: v.note })),
        genres: p.spec.genres, monetization: p.spec.monetization.mechanisms, prices: p.spec.monetization.prices, retention: p.spec.retention,
        critic: p.criticMood, monetizer: { verdict: p.monetizer.verdict, score: p.monetizer.score, reasons: p.monetizer.reasons },
        questions: p.questions.map((q) => ({ by: nameOf(q.by), role: getPersona(q.by)?.role, topic: topicLabel(q.topic), question: q.text, status: q.status, answer: q.answer || null, weakAnswers: q.attempts || 0 })),
        adoptedTwists: p.adopted, understanding: { final: !!p.understanding, shared: u.shared, sections: u.sections, perPersona: Object.fromEntries(Object.entries(u.perPersona).map(([id, t]) => [nameOf(id), t])) },
      };
    }),
  };
}

export function sessionMarkdown(state, meta = {}) {
  const d = sessionData(state, meta);
  const out = [`# Pitcher session, ${d.startedAt?.slice(0, 16).replace('T', ' ')}`, '', `${d.pitches.length} pitch${d.pitches.length === 1 ? '' : 'es'}. Crowd brain: ${d.provider}.`, ''];
  for (const p of d.pitches) {
    out.push(`## ${p.n}. ${p.title}`, '', `- Category: ${p.category || 'none detected'}`, `- Vex (Critic): ${p.critic}`, `- Mint (Monetizer): ${p.monetizer.verdict}, ${p.monetizer.score}/100`, `- Versions: ${p.versions.length}${p.adoptedTwists.length ? `; twists taken: ${p.adoptedTwists.join('; ')}` : ''}`, '');
    out.push('### Questions', '', ...(p.questions.length ? p.questions.map((q) => `- **${q.by}** (${q.topic}, ${q.status}): ${q.question}${q.answer ? `\n  - You: "${q.answer}"` : ''}`) : ['- None asked.']), '');
    out.push('### What the crowd understood', '', p.understanding.shared, '');
    for (const s of p.understanding.sections) out.push(`**${s.title}**`, ...s.items.map((i) => `- ${i}`), '');
    out.push(...Object.entries(p.understanding.perPersona).map(([n, t]) => `> **${n}:** ${t}`), '');
  }
  out.push('## Your transcript', '', ...(d.transcript.length ? d.transcript.map((x) => `- \`${x.clock}\` ${x.text}${x.source === 'typed' ? ' *(typed)*' : ''}`) : ['- (nothing said)']), '');
  out.push('## Chatroom', '', ...d.chat.map((m) => `- \`${m.clock}\` **${m.name}**${m.to && m.to !== 'you' ? ` → ${nameOf(m.to)}` : ''}: ${m.text}`), '');
  return out.join('\n');
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function sessionHtml(state, meta = {}) {
  const d = sessionData(state, meta);
  const colour = (name) => { const id = Object.keys({ critic: 1, monetizer: 1, hype: 1, wrestler: 1 }).find((k) => nameOf(k) === name); return id ? getPersona(id).color : '#8a7f9e'; };
  const pitches = d.pitches.map((p) => `<section><h2>${p.n}. ${esc(p.title)}</h2>
<p class="meta">${esc(p.category || 'No category')} · Vex ${esc(p.critic)} · Mint ${esc(p.monetizer.verdict)} ${p.monetizer.score}/100 · ${p.versions.length} version${p.versions.length > 1 ? 's' : ''}</p>
<p>${esc(p.understanding.shared)}</p>
${p.understanding.sections.map((s) => `<h3>${esc(s.title)}</h3><ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')}
<h3>In their own words</h3>${Object.entries(p.understanding.perPersona).map(([n, t]) => `<blockquote style="border-color:${colour(n)}"><b>${esc(n)}:</b> ${esc(t)}</blockquote>`).join('')}</section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pitcher session</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 16px;color:#1d1a22;background:#fff}h1{font-size:26px}h2{margin-top:34px;border-bottom:2px solid #eee;padding-bottom:4px}.meta{color:#6b6478;font-size:13px}blockquote{margin:8px 0;padding:4px 12px;border-left:4px solid}li{margin:2px 0}.t{color:#6b6478;font:12px ui-monospace,monospace;margin-right:6px}@media print{h2{break-before:page}}</style></head><body>
<h1>Pitcher session</h1><p class="meta">${esc(d.startedAt)} · ${d.pitches.length} pitches · crowd brain: ${esc(d.provider)}</p>${pitches}
<h2>Your transcript</h2><ul>${d.transcript.map((x) => `<li><span class="t">${x.clock}</span>${esc(x.text)}</li>`).join('')}</ul>
<h2>Chatroom</h2><ul>${d.chat.map((m) => `<li><span class="t">${m.clock}</span><b>${esc(m.name)}</b>: ${esc(m.text)}</li>`).join('')}</ul></body></html>`;
}
