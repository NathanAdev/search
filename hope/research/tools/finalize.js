// Combine merged ideas + judged scores, compute Capital and Newability by formula, calibrate spread, write deliverables.
// Usage: node finalize.js <scratchpad> <outDir> <usdRon>
'use strict';
const fs = require('fs');
const path = require('path');

const [S, OUT, RATE_ARG] = process.argv.slice(2);
const USD_RON = parseFloat(RATE_ARG);
const TODAY = Date.parse('2026-10-25');
const JUDGED = ['replicatability', 'wtr', 'competition', 'marketability', 'satellite', 'want'];
const ALL = ['replicatability', 'wtr', 'competition', 'marketability', 'satellite', 'capital', 'want', 'newability'];
const WEIGHT = { satellite: 0.5 };

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const merged = read(path.join(S, 'merged.json'));
const scored = new Map();
for (const f of fs.readdirSync(path.join(S, 'scored')).filter((x) => x.endsWith('.json'))) {
  for (const r of read(path.join(S, 'scored', f))) scored.set(r.id, r);
}
const dropIds = new Set();
const dropFile = path.join(S, 'dropped_ids.json');
if (fs.existsSync(dropFile)) read(dropFile).forEach((d) => dropIds.add(d.id));

const clamp = (n) => Math.max(0, Math.min(99, Math.round(n)));

function interp(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let k = 1; k < points.length; k++) {
    const [x1, y1] = points[k], [x0, y0] = points[k - 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}
const CAPITAL_CURVE = [[0, 99], [15, 96], [30, 90], [60, 80], [120, 68], [250, 52], [500, 36], [1000, 20], [2500, 8], [5000, 0]];
function capitalScore(usd, paid) {
  const base = interp(CAPITAL_CURVE, usd);
  return clamp(paid ? Math.min(40, base * 0.5) : base);
}
const NEW_CURVE = [[0, 98], [14, 97], [30, 93], [60, 88], [90, 82], [150, 72], [210, 62], [270, 52], [330, 42], [365, 34], [545, 18], [730, 10], [1500, 4]];
function newabilityScore(signals) {
  const ages = signals.map((s) => (TODAY - Date.parse(s.date)) / 864e5).sort((a, b) => a - b);
  const base = interp(NEW_CURVE, Math.max(0, ages[0]));
  const recurring = ages.slice(1).filter((a) => a <= 365).length;
  return clamp(base + Math.min(10, recurring * 4));
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
const rows = [];
const missing = [];
const scorerDropped = [];
for (const i of merged) {
  if (dropIds.has(i.id)) continue;
  const sc = scored.get(i.id);
  if (!sc || JUDGED.some((k) => !Number.isFinite(+sc.scores?.[k]))) { missing.push(i.id); continue; }
  const flags = Array.isArray(sc.flags) ? sc.flags : [];
  if (sc.drop === true || flags.some((f) => /^(not_web_app|banned_money|adult|duplicate_of)/.test(f))) { scorerDropped.push({ id: i.id, name: i.name, reason: sc.drop_reason || flags.join(',') }); continue; }
  rows.push({ ...i, confidence: flags.includes('weak_signal') ? 'low' : i.confidence, scores: Object.fromEntries(JUDGED.map((k) => [k, +sc.scores[k]])), score_notes: sc.score_notes || {} });
}

// spread calibration: if a judged axis is bunched, stretch p5..p95 onto 8..94 (order preserved)
const calibration = {};
for (const k of JUDGED) {
  const v = rows.map((r) => r.scores[k]).sort((a, b) => a - b);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  const lo = pct(v, 0.05), hi = pct(v, 0.95);
  calibration[k] = { before: { mean: +mean.toFixed(1), sd: +sd.toFixed(1), p5: lo, p95: hi }, stretched: false };
  if (sd < 14 || hi - lo < 45) {
    for (const r of rows) r.scores[k] = clamp(8 + ((r.scores[k] - lo) / Math.max(1, hi - lo)) * 86);
    calibration[k].stretched = true;
  }
}
for (const r of rows) {
  r.scores.capital = capitalScore(r.capital_usd, r.uses_paid_api);
  r.scores.newability = newabilityScore(r.signals);
  r.scores = Object.fromEntries(ALL.map((k) => [k, clamp(r.scores[k])]));
  r.capital_ron = Math.round(r.capital_usd * USD_RON);
  let num = 0, den = 0;
  for (const k of ALL) { const w = WEIGHT[k] ?? 1; num += w * r.scores[k]; den += w; }
  r.overall_default = Math.round(num / den);
  // keep only notes for scores that are extreme (above 85 or below 25) or non-empty strings
  r.score_notes = Object.fromEntries(Object.entries(r.score_notes).filter(([k, v]) => ALL.includes(k) && typeof v === 'string' && v.trim()));
}
rows.sort((a, b) => b.overall_default - a.overall_default || b.scores.want - a.scores.want);
rows.forEach((r, n) => { r.id = 'GL-' + String(n + 1).padStart(3, '0'); delete r.merged_from; });

const final = rows;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'ideas.json'), JSON.stringify(final, null, 2));

const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const cols = ['id', 'name', 'niche', 'niche2', 'is_feature', 'feature_for', 'idea', 'description', 'overall_default', ...ALL, 'capital_usd', 'capital_ron', 'capital_note', 'uses_paid_api', 'paid_api_note', 'confidence',
  'primary_signal_url', 'primary_signal_date', 'all_signal_urls', 'all_signal_dates', 'why_hard_to_copy', 'web_delivery', 'satellite_name', 'satellite_what', 'marketing_where', 'marketing_target', 'marketing_funnel', 'cold_outreach', 'post_ideas', 'competitors', 'notes'];
const flat = (r) => {
  const sig = [...r.signals].sort((a, b) => b.date.localeCompare(a.date));
  const m = r.marketing;
  return {
    ...r, ...r.scores,
    primary_signal_url: sig[0].url, primary_signal_date: sig[0].date,
    all_signal_urls: sig.map((s) => s.url).join(' | '), all_signal_dates: sig.map((s) => s.date).join(' | '),
    satellite_name: r.satellite?.name, satellite_what: r.satellite?.what,
    marketing_where: m.where.join('; '), marketing_target: m.target, marketing_funnel: m.funnel, cold_outreach: m.cold_outreach, post_ideas: m.post_ideas.join(' | '),
    competitors: r.competitors_seen.map((c) => c.name).join('; '),
  };
};
fs.writeFileSync(path.join(OUT, 'ideas.csv'), '﻿' + [cols.join(','), ...final.map((r) => { const f = flat(r); return cols.map((c) => csvCell(f[c])).join(','); })].join('\r\n'));

const tpl = fs.readFileSync(path.join(__dirname, '..', 'dashboard.template.html'), 'utf8');
const html = tpl
  .replace('__IDEAS_JSON__', () => JSON.stringify(final).replace(/</g, '\\u003c'))
  .replace('__USD_RON__', String(USD_RON))
  .replace('__DATE__', new Date().toISOString().slice(0, 10));
fs.writeFileSync(path.join(OUT, 'dashboard.html'), html);

fs.writeFileSync(path.join(S, 'finalize_report.json'), JSON.stringify({ ideas: final.length, missing_scores: missing, scorer_dropped: scorerDropped, critic_dropped: [...dropIds], calibration }, null, 1));
console.log(JSON.stringify({ ideas: final.length, missing: missing.length, scorer_dropped: scorerDropped.length, critic_dropped: dropIds.size, stretched: Object.entries(calibration).filter(([, v]) => v.stretched).map(([k]) => k) }));
