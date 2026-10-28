// TEST ONLY: synthetic ideas to exercise the dashboard. Never shipped. Usage: node make_fixture.js <dir> <n>
'use strict';
const fs = require('fs');
const path = require('path');
const [D, N] = [process.argv[2], +process.argv[3] || 40];
fs.mkdirSync(path.join(D, 'scored'), { recursive: true });
fs.mkdirSync(path.join(D, 'candidates'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '..', 'dashboard.template.html'), path.join(D, 'dashboard.template.html'));
const niches = ['Gardening & Outdoors', 'Pets', 'Local Business & Small Shops', 'Education & Study', 'Accessibility', 'Hobbies & Crafts', 'Food & Cooking'];
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ideas = [], scored = [];
for (let n = 0; n < N; n++) {
  const id = 'T-' + String(n + 1).padStart(3, '0');
  const days = Math.floor(rnd() * 500);
  const date = new Date(Date.parse('2026-10-25') - days * 864e5).toISOString().slice(0, 10);
  ideas.push({
    id, name: 'Test idea ' + (n + 1) + (n % 7 === 0 ? ' with an unusually long working title to test wrapping' : ''),
    idea: 'One-line statement of the test idea number ' + (n + 1) + '.',
    description: 'Fixture description. It runs in a browser, serves a narrow group, and is hard to copy because of a fictional moat. '.repeat(1 + (n % 2)),
    niche: niches[n % niches.length], niche2: n % 5 === 0 ? 'Travel' : null,
    is_feature: n % 6 === 0, feature_for: n % 6 === 0 ? 'ExampleApp' : null,
    web_delivery: 'PWA on Supabase + Vercel free.', why_hard_to_copy: 'Fictional moat for layout testing.',
    signals: [{ platform: 'hn', url: 'https://news.ycombinator.com/item?id=1' + n, date, summary: 'Fixture paraphrase of a complaint.', engagement: n % 3 ? '12 points' : 'unknown' },
      ...(n % 4 === 0 ? [{ platform: 'x', url: 'https://x.com/a/status/' + n, date, summary: 'Second fixture signal.', engagement: 'unknown' }] : [])],
    competitors_seen: [{ name: 'Rival ' + n, url: 'https://example.com', note: 'paid' }],
    satellite: n % 3 ? { name: 'Quiz ' + n, what: 'A short quiz.', why_shared: 'Shows a score.', handoff: 'Offers the main app.' } : null,
    marketing: { where: ['Forum A', 'Directory B'], target: 'Hobbyists', funnel: 'Quiz to app', cold_outreach: 'Offer a free setup', post_ideas: ['Post one', 'Post two'] },
    capital_usd: [12, 12, 40, 150, 400, 900][n % 6], capital_note: 'domain', uses_paid_api: n % 9 === 0, paid_api_note: n % 9 === 0 ? 'Example API, about $0.01 per call' : null,
    confidence: n % 8 === 0 ? 'low' : 'high', notes: '', source_agent: 'fixture',
  });
  const r = () => Math.round(5 + rnd() * 90);
  scored.push({ id, scores: { replicatability: r(), wtr: r(), competition: r(), marketability: r(), satellite: r(), want: r() }, score_notes: n % 5 === 0 ? { want: 'Fixture note explaining an extreme score.' } : {} });
}
fs.writeFileSync(path.join(D, 'merged.json'), JSON.stringify(ideas));
fs.writeFileSync(path.join(D, 'scored', 'fixture.json'), JSON.stringify(scored));
