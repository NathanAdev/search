// Verify signal URLs exist and (where an API exposes it) that the stated date matches. Usage: node verify.js <scratchpad> [--apply]
// Reads merged.json, writes verify_report.json; with --apply rewrites merged.json (fix dates, drop dead signals, drop ideas with none left).
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const S = process.argv[2];
const APPLY = process.argv.includes('--apply');
const ideas = JSON.parse(fs.readFileSync(path.join(S, 'merged.json'), 'utf8'));
const UA = 'gap-ledger-research/1.0 (read-only verification)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const day = (iso) => String(iso).slice(0, 10);
const dayDiff = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

let ghOk = false;
try { execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' }); ghOk = true; } catch { /* unauthenticated: GitHub checks fall back to unverified when rate limited */ }

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (r.status === 404) return { notFound: true };
  if (!r.ok) return { error: r.status };
  return { json: await r.json() };
}

async function check(sig) {
  const u = new URL(sig.url);
  const host = u.hostname.replace(/^www\./, '');
  try {
    if (host === 'news.ycombinator.com' && u.pathname === '/item') {
      const r = await getJson('https://hn.algolia.com/api/v1/items/' + u.searchParams.get('id'));
      if (r.notFound) return { status: 'not_found' };
      if (r.error) return { status: 'unverified', why: 'hn ' + r.error };
      return { status: 'ok', actual: day(r.json.created_at) };
    }
    const se = u.pathname.match(/^\/(?:q|questions|a)\/(\d+)/);
    if (se && /(stackexchange\.com|stackoverflow\.com|superuser\.com|serverfault\.com|askubuntu\.com|mathoverflow\.net)$/.test(host)) {
      const site = host.endsWith('.stackexchange.com') ? host.split('.')[0] : host.replace(/\.(com|net)$/, '');
      const r = await getJson(`https://api.stackexchange.com/2.3/questions/${se[1]}?site=${site}`);
      if (r.error) return { status: 'unverified', why: 'se ' + r.error };
      const q = r.json.items && r.json.items[0];
      if (!q) return { status: 'not_found' };
      return { status: 'ok', actual: new Date(q.creation_date * 1000).toISOString().slice(0, 10) };
    }
    const gh = u.pathname.match(/^\/([^/]+)\/([^/]+)\/(issues|pull|discussions)\/(\d+)/);
    if (host === 'github.com' && gh && gh[3] !== 'discussions') {
      const api = `repos/${gh[1]}/${gh[2]}/issues/${gh[4]}`;
      if (ghOk) {
        try { const o = JSON.parse(execFileSync('gh', ['api', api], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); return { status: 'ok', actual: day(o.created_at) }; }
        catch { return { status: 'not_found' }; }
      }
      const r = await getJson('https://api.github.com/' + api);
      if (r.notFound) return { status: 'not_found' };
      if (r.error) return { status: 'unverified', why: 'github ' + r.error };
      return { status: 'ok', actual: day(r.json.created_at) };
    }
    const lem = u.pathname.match(/^\/post\/(\d+)/);
    if (lem) {
      const r = await getJson(`https://${u.hostname}/api/v3/post?id=${lem[1]}`);
      if (r.notFound) return { status: 'not_found' };
      if (r.error) return { status: 'unverified', why: 'lemmy ' + r.error };
      return { status: 'ok', actual: day(r.json.post_view.post.published) };
    }
    if (/(^|\.)(x\.com|twitter\.com)$/.test(host)) return { status: 'unverified', why: 'x needs browser' };
    const r = await fetch(sig.url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; gap-ledger-research)' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (r.status === 404 || r.status === 410) return { status: 'not_found' };
    if (r.status >= 400) return { status: 'unverified', why: 'http ' + r.status };
    return { status: 'ok_exists', actual: null };
  } catch (e) {
    return { status: 'unverified', why: String(e.message || e).slice(0, 80) };
  }
}

(async () => {
  const unique = new Map();
  ideas.forEach((i) => i.signals.forEach((s) => { if (!unique.has(s.url)) unique.set(s.url, s); }));
  const results = new Map();
  const list = [...unique.values()];
  let n = 0;
  const worker = async () => {
    while (n < list.length) {
      const s = list[n++];
      results.set(s.url, await check(s));
      await sleep(250);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  const report = { total: list.length, ok: 0, ok_exists: 0, date_fixed: 0, not_found: [], unverified: [] };
  for (const s of list) {
    const r = results.get(s.url);
    if (r.status === 'ok') {
      report.ok++;
      if (dayDiff(r.actual, s.date) > 1) report.date_fixed++;
    } else if (r.status === 'ok_exists') report.ok_exists++;
    else if (r.status === 'not_found') report.not_found.push(s.url);
    else report.unverified.push({ url: s.url, why: r.why });
  }
  let droppedIdeas = [];
  if (APPLY) {
    const kept = [];
    for (const i of ideas) {
      const sigs = [];
      for (const s of i.signals) {
        const r = results.get(s.url);
        if (r.status === 'not_found') continue;
        if (r.status === 'ok' && dayDiff(r.actual, s.date) > 1) { s.date_claimed = s.date; s.date = r.actual; }
        s.verified = r.status === 'ok' ? 'api' : r.status === 'ok_exists' ? 'exists' : 'no';
        sigs.push(s);
      }
      if (sigs.length) { i.signals = sigs; kept.push(i); } else droppedIdeas.push({ id: i.id, name: i.name });
    }
    fs.writeFileSync(path.join(S, 'merged.json'), JSON.stringify(kept, null, 1));
  }
  report.dropped_ideas = droppedIdeas;
  fs.writeFileSync(path.join(S, 'verify_report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ...report, not_found: report.not_found.length, unverified: report.unverified.length, dropped_ideas: droppedIdeas.length }));
})();
