// Write REPORT.md from the final ideas. Usage: node report.js <scratchpad> <outDir> <usdRon>
// Reads <scratchpad>/report_notes.json: {missing_tools: [], blocked_sources: [], critic: {...}, caveats: []}
'use strict';
const fs = require('fs');
const path = require('path');
const [S, OUT, RATE] = process.argv.slice(2);
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const ideas = read(path.join(OUT, 'ideas.json'));
const notes = read(path.join(S, 'report_notes.json'));
const fin = read(path.join(S, 'finalize_report.json'));
const ver = fs.existsSync(path.join(S, 'verify_report.json')) ? read(path.join(S, 'verify_report.json')) : null;

const link = (i) => `[${i.name}](${i.signals[0].url})`;
const money = (i) => (i.capital_usd === 0 ? 'free' : `$${i.capital_usd} / ${i.capital_ron} RON`);
const row = (i, n) => `| ${n} | ${i.id} | ${link(i)} | ${i.niche} | ${i.overall_default} | ${money(i)} | ${i.uses_paid_api ? 'paid API' : ''} |`;
const head = '| # | ID | Idea | Niche | Overall | Cash to launch | Note |\n|---|---|---|---|---|---|---|';

const byOverall = [...ideas].sort((a, b) => b.overall_default - a.overall_default);
const cheapest = [...ideas].sort((a, b) => a.capital_usd - b.capital_usd || b.overall_default - a.overall_default);
const niches = {};
ideas.forEach((i) => { niches[i.niche] = (niches[i.niche] || 0) + 1; });
const low = ideas.filter((i) => i.confidence === 'low');
const feat = ideas.filter((i) => i.is_feature).length;
const paid = ideas.filter((i) => i.uses_paid_api).length;

const out = [];
out.push('# Gap Ledger: run report', '');
out.push(`Compiled ${new Date().toISOString().slice(0, 10)}. USD 1 = RON ${RATE}.`, '');
out.push('## Result', '');
out.push(`- **${ideas.length} ideas** are in the ledger (${feat} are feature ideas for existing web apps, ${paid} rely on a paid API). See "Critic pass" below for how far they were challenged.`);
out.push('- Files: `dashboard.html` (open in any browser, no server needed), `ideas.json`, `ideas.csv`, this report.');
out.push(`- Ideas per niche: ${Object.entries(niches).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '');
if (notes.missing_tools?.length) out.push('## Tools that were missing', '', ...notes.missing_tools.map((t) => `- ${t}`), '');
out.push('## Blocked or limited sources', '', ...notes.blocked_sources.map((t) => `- ${t}`), '');
out.push('## Top 10 by Overall (default weights, Satellite at 0.5)', '', head, ...byOverall.slice(0, 10).map((i, n) => row(i, n + 1)), '');
out.push('## Top 10 cheapest to start (ties broken by Overall)', '', head, ...cheapest.slice(0, 10).map((i, n) => row(i, n + 1)), '');
out.push(`## Low-confidence ideas (${low.length})`, '', low.length ? low.map((i) => `- ${i.id} ${link(i)}: ${i.notes || 'thin signal'}`).join('\n') : 'None.', '');
out.push('## How the scores were made', '');
out.push('- **Judged (0-99):** Replicatability, WTR, Competition, Marketability, Satellite, Want.');
out.push('- **Computed by formula, not opinion:** Newability (age of the newest signal, plus a bonus for each other signal under 12 months old) and Startup Capital (from the cash estimate on a fixed curve; ideas that rely on a paid API are halved and capped at 40).');
out.push('- Overall = weighted average of the eight (Satellite 0.5, others 1.0); the dashboard lets you change weights and switch scores off.');
const stretched = Object.entries(fin.calibration).filter(([, v]) => v.stretched).map(([k]) => k);
out.push(stretched.length ? `- Spread calibration stretched these bunched axes onto the full range (order preserved): ${stretched.join(', ')}.` : '- No axis needed spread calibration.');
if (ver) out.push(`- Signal check: ${ver.total} unique source links tested by script; ${ver.ok} confirmed with an API (dates compared), ${ver.ok_exists} confirmed to exist, ${ver.not_found.length} dead links removed, ${ver.unverified.length} could not be checked automatically (X pages and rate-limited hosts).`);
if (notes.critic) out.push(`- Critic pass: ${notes.critic.summary}`);
out.push('');
if (notes.caveats?.length) out.push('## Caveats', '', ...notes.caveats.map((t) => `- ${t}`), '');
fs.writeFileSync(path.join(OUT, 'REPORT.md'), out.join('\n'));
console.log('report written');
