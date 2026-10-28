// Apply critic verdicts to scored files and the drop list. Usage: node apply_critic.js <scratchpad> <round>
// critic file entries: {id, verdict: "ok"|"adjust"|"drop", adjustments?: {axis: int}, reason: string}
'use strict';
const fs = require('fs');
const path = require('path');
const [S, ROUND] = process.argv.slice(2);
const AXES = ['replicatability', 'wtr', 'competition', 'marketability', 'satellite', 'want'];
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));

const scoredFiles = fs.readdirSync(path.join(S, 'scored')).filter((f) => f.endsWith('.json'));
const byId = new Map();
for (const f of scoredFiles) for (const r of read(path.join(S, 'scored', f))) byId.set(r.id, { file: f, rec: r });

const dropFile = path.join(S, 'dropped_ids.json');
const dropped = fs.existsSync(dropFile) ? read(dropFile) : [];
const log = [];
const touched = new Set();
let counts = { ok: 0, adjust: 0, drop: 0, unknown: 0 };

const criticFiles = fs.readdirSync(path.join(S, 'critic')).filter((f) => f.startsWith(`r${ROUND}_`) && f.endsWith('.json'));
for (const f of criticFiles) {
  for (const c of read(path.join(S, 'critic', f))) {
    const hit = byId.get(c.id);
    if (!hit) { counts.unknown++; continue; }
    if (c.verdict === 'drop') {
      if (!dropped.some((d) => d.id === c.id)) dropped.push({ id: c.id, reason: c.reason, round: +ROUND });
      counts.drop++; log.push({ id: c.id, action: 'drop', reason: c.reason });
    } else if (c.verdict === 'adjust' && c.adjustments) {
      for (const [k, v] of Object.entries(c.adjustments)) {
        if (!AXES.includes(k) || !Number.isFinite(+v)) continue;
        log.push({ id: c.id, axis: k, from: hit.rec.scores[k], to: Math.max(0, Math.min(99, Math.round(+v))), reason: c.reason });
        hit.rec.scores[k] = Math.max(0, Math.min(99, Math.round(+v)));
        hit.rec.score_notes = { ...(hit.rec.score_notes || {}), [k]: (c.reason || '').slice(0, 220) };
      }
      touched.add(hit.file); counts.adjust++;
    } else counts.ok++;
  }
}
for (const f of touched) {
  const arr = read(path.join(S, 'scored', f)).map((r) => byId.get(r.id).rec);
  fs.writeFileSync(path.join(S, 'scored', f), JSON.stringify(arr, null, 1));
}
fs.writeFileSync(dropFile, JSON.stringify(dropped, null, 1));
fs.writeFileSync(path.join(S, `critic_applied_r${ROUND}.json`), JSON.stringify(log, null, 1));
console.log(JSON.stringify(counts));
