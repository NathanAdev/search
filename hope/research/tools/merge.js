// Merge candidate files: validate, drop broken signals/ideas, dedupe. Usage: node merge.js <scratchpad>
'use strict';
const fs = require('fs');
const path = require('path');

const S = process.argv[2];
const TODAY = Date.parse('2026-10-25');
const NICHES = new Set(['Productivity & Planning', 'Health & Fitness', 'Creators & Streamers', 'Hobbies & Crafts', 'Education & Study', 'Local Business & Small Shops', 'Home & DIY', 'Pets', 'Parenting & Family', 'Gaming Communities', 'Event Planning', 'Accessibility', 'Dev Tools', 'Travel', 'Food & Cooking', 'Mental Wellbeing', 'Gardening & Outdoors', 'Music & Audio', 'Photo & Video', 'Writing & Publishing', 'Collectors', 'Sports & Teams', 'Community & Nonprofit', 'Data & Documents', 'Seniors & Caregiving', 'Languages', 'Genealogy & History', 'Science & Maker']);
const BANNED = /\b(invoice|invoicing|payroll|payment|payments|crypto|bitcoin|trading|trader|stock|stocks|investing|investment|lending|loan|mortgage|bank|banking|tax|taxes|escrow|legal|lawyer|attorney|nsfw|adult|porn|onlyfans)\b/i;

const dropped = [];
const flags = [];
let all = [];
for (const f of fs.readdirSync(path.join(S, 'candidates')).filter((x) => x.endsWith('.json'))) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(S, 'candidates', f), 'utf8').replace(/^﻿/, '')); }
  catch (e) { dropped.push({ file: f, reason: 'invalid JSON: ' + e.message }); continue; }
  if (!Array.isArray(arr)) { dropped.push({ file: f, reason: 'not an array' }); continue; }
  for (const i of arr) all.push({ ...i, _file: f });
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
function cleanSignal(s) {
  if (!s || typeof s !== 'object') return null;
  const url = str(s.url), date = str(s.date).slice(0, 10);
  if (!/^https?:\/\//i.test(url)) return null;
  if (/reddit\.com|redd\.it/i.test(url)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = Date.parse(date);
  if (!(t <= TODAY + 864e5) || !(t >= Date.parse('2018-01-01'))) return null;
  if (!str(s.summary)) return null;
  return { platform: str(s.platform) || 'web', url, date, summary: str(s.summary), engagement: str(s.engagement) || 'unknown' };
}

const ideas = [];
for (const raw of all) {
  const why = [];
  for (const k of ['name', 'idea', 'description', 'niche']) if (!str(raw[k])) why.push('missing ' + k);
  const signals = (Array.isArray(raw.signals) ? raw.signals : []).map(cleanSignal).filter(Boolean);
  if (!signals.length) why.push('no valid signal');
  if (why.length) { dropped.push({ id: raw.id, file: raw._file, name: raw.name, reason: why.join(', ') }); continue; }
  const seen = new Set();
  const uniq = signals.filter((s) => (seen.has(s.url) ? false : seen.add(s.url)));
  const niche = NICHES.has(raw.niche) ? raw.niche : raw.niche;
  if (!NICHES.has(raw.niche)) flags.push({ id: raw.id, flag: 'non-canonical niche: ' + raw.niche });
  const text = [raw.name, raw.idea, raw.description].join(' ');
  if (BANNED.test(text)) flags.push({ id: raw.id, name: raw.name, flag: 'banned-term match: ' + (text.match(BANNED) || [])[0] });
  const m = raw.marketing || {};
  ideas.push({
    id: str(raw.id) || 'x-' + ideas.length,
    name: str(raw.name),
    idea: str(raw.idea),
    description: str(raw.description),
    niche,
    niche2: str(raw.niche2) || null,
    is_feature: !!raw.is_feature,
    feature_for: str(raw.feature_for) || null,
    web_delivery: str(raw.web_delivery),
    why_hard_to_copy: str(raw.why_hard_to_copy),
    signals: uniq,
    competitors_seen: (Array.isArray(raw.competitors_seen) ? raw.competitors_seen : []).filter((c) => c && str(c.name)).map((c) => ({ name: str(c.name), url: str(c.url), note: str(c.note) })),
    satellite: raw.satellite && str(raw.satellite.name) ? { name: str(raw.satellite.name), what: str(raw.satellite.what), why_shared: str(raw.satellite.why_shared), handoff: str(raw.satellite.handoff) } : null,
    marketing: {
      where: (Array.isArray(m.where) ? m.where : []).map(str).filter(Boolean),
      target: str(m.target), funnel: str(m.funnel), cold_outreach: str(m.cold_outreach),
      post_ideas: (Array.isArray(m.post_ideas) ? m.post_ideas : []).map(str).filter(Boolean),
    },
    capital_usd: Number.isFinite(+raw.capital_usd) ? Math.max(0, +raw.capital_usd) : 15,
    capital_note: str(raw.capital_note),
    uses_paid_api: !!raw.uses_paid_api,
    paid_api_note: str(raw.paid_api_note) || null,
    confidence: ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'medium',
    notes: str(raw.notes),
    source_agent: raw._file.replace(/\.json$/, ''),
  });
}

// dedupe: shared signal URL plus a little name+idea overlap (one issue or app page can back different products), or high token overlap of name+idea
const STOP = new Set('a an the and or of for to in on with your my app tool web site website that this it is are be by from as at into can who what how per'.split(' '));
const toks = (i) => new Set((i.name + ' ' + i.idea).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
const jac = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };
const parent = ideas.map((_, n) => n);
const find = (n) => (parent[n] === n ? n : (parent[n] = find(parent[n])));
const byUrl = new Map();
const T = ideas.map(toks);
ideas.forEach((i, n) => i.signals.forEach((s) => { if (!byUrl.has(s.url)) byUrl.set(s.url, n); else if (jac(T[n], T[byUrl.get(s.url)]) >= 0.08) parent[find(n)] = find(byUrl.get(s.url)); }));
for (let a = 0; a < ideas.length; a++) for (let b = a + 1; b < ideas.length; b++) if (find(a) !== find(b) && jac(T[a], T[b]) >= 0.5) parent[find(a)] = find(b);

const groups = new Map();
ideas.forEach((i, n) => { const r = find(n); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
const merged = [];
const confRank = { high: 3, medium: 2, low: 1 };
for (const g of groups.values()) {
  g.sort((a, b) => b.signals.length - a.signals.length || confRank[b.confidence] - confRank[a.confidence] || b.description.length - a.description.length);
  const keep = g[0];
  if (g.length > 1) {
    const urls = new Set(keep.signals.map((s) => s.url));
    for (const o of g.slice(1)) {
      for (const s of o.signals) if (!urls.has(s.url)) { keep.signals.push(s); urls.add(s.url); }
      for (const c of o.competitors_seen) if (!keep.competitors_seen.some((k) => k.name === c.name)) keep.competitors_seen.push(c);
    }
    keep.merged_from = g.slice(1).map((o) => o.id + ' (' + o.name + ')');
  }
  merged.push(keep);
}

fs.writeFileSync(path.join(S, 'merged.json'), JSON.stringify(merged, null, 1));
fs.writeFileSync(path.join(S, 'merge_report.json'), JSON.stringify({ in: all.length, kept: merged.length, dropped, flags, duplicates_merged: ideas.length - merged.length }, null, 1));
const byAgent = {};
merged.forEach((i) => { byAgent[i.source_agent] = (byAgent[i.source_agent] || 0) + 1; });
console.log(JSON.stringify({ in: all.length, kept: merged.length, dropped: dropped.length, flags: flags.length, dupMerged: ideas.length - merged.length, byAgent }));
