// Dashboard test: drives dashboard.html over HTTP (e.g. python3 -m http.server 8765 --directory hope) and compares every filter with a calculation from ideas.json.
// Usage: node dashtest.js <dashboard url> <path to ideas.json> <screenshot dir>   (needs the playwright package; 36 checks)
// Drives hope/dashboard.html over HTTP and compares each filter with an independent calculation from ideas.json.
const { chromium } = require('playwright');
const fs = require('fs');
const [URL, JSON_PATH, SHOTS] = process.argv.slice(2);
const IDEAS = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const K = ['replicatability', 'wtr', 'competition', 'marketability', 'satellite', 'capital', 'want', 'newability'];
const W = { satellite: 0.5 };
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };

const ov = (i, on = {}, w = {}) => {
  let n = 0, d = 0;
  for (const k of K) { if (on[k] === false) continue; const wt = w[k] ?? W[k] ?? 1; if (!(wt > 0)) continue; n += wt * i.scores[k]; d += wt; }
  return d ? Math.round(n / d) : 0;
};
const hay = (i) => [i.name, i.idea, i.description, i.niche, i.niche2, i.feature_for, ...i.signals.map((s) => s.summary + ' ' + s.platform)].filter(Boolean).join(' ').toLowerCase();

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('#cards .card');

  const txt = (sel) => page.$eval(sel, (e) => e.textContent.trim());
  const shown = async () => +(await txt('#nShown'));
  const setRange = (id, v) => page.$eval('#' + id, (e, val) => { e.value = String(val); e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const setNum = (id, v) => page.$eval('#' + id, (e, val) => { e.value = String(val); e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const toggle = (id) => page.click('#' + id);
  const firstName = () => page.$eval('#cards .card h2', (e) => e.textContent);
  const reset = async () => { await page.click('#resetAll'); };

  // 1 load
  check('loads without console or page errors', errors.length === 0, errors.join(' | '));
  check('total equals ideas.json', (await txt('#nTotal')) === String(IDEAS.length), await txt('#nTotal'));
  check('all ideas shown by default', (await shown()) === IDEAS.length, String(await shown()));
  check('first page has 24 cards', (await page.$$eval('#cards .card', (c) => c.length)) === 24);
  const ringInfo = await page.$$eval('#cards .card', (cards) => cards.map((c) => [...c.querySelectorAll('.ring-wrap')].map((r) => ({ n: r.querySelector('.ring-num')?.textContent, a: r.querySelector('svg')?.getAttribute('aria-label') }))));
  check('every card has 9 rings', ringInfo.every((r) => r.length === 9), ringInfo.map((r) => r.length).join(','));
  check('every ring prints a number 0-99 that matches its label', ringInfo.every((r) => r.every((x) => /^\d{1,2}$/.test(x.n) && +x.n <= 99 && x.a.includes(`: ${x.n} out of 99`))));
  const first = IDEAS[0];
  check('top card is the highest Overall in ideas.json', (await firstName()) === first.name, await firstName());

  // 2 low confidence
  await toggle('showLow');
  check('hide low-confidence', (await shown()) === IDEAS.filter((i) => i.confidence !== 'low').length, `${await shown()} vs ${IDEAS.filter((i) => i.confidence !== 'low').length}`);
  await reset();

  // 3 niche chip (also tests niche2)
  for (const niche of ['Travel', 'Hobbies & Crafts', 'Faith & Religion']) {
    await page.click(`#niches button.niche:has-text("${niche}")`);
    const exp = IDEAS.filter((i) => i.niche === niche || i.niche2 === niche).length;
    check(`niche chip ${niche}`, (await shown()) === exp, `${await shown()} vs ${exp}`);
    await reset();
  }
  await page.click('#niches button.niche:nth-child(1)'); await page.click('#niches button.niche:nth-child(2)');
  const chipNames = await page.$$eval('#niches button.niche[aria-pressed="true"]', (b) => b.map((x) => x.firstChild.textContent));
  const expTwo = IDEAS.filter((i) => chipNames.includes(i.niche) || chipNames.includes(i.niche2)).length;
  check('two niche chips combine as OR', (await shown()) === expTwo, `${chipNames.join('+')} ${await shown()} vs ${expTwo}`);
  await reset();

  // 4 search
  for (const q of ['solar', 'passport airport', 'zzzznothing']) {
    await page.fill('#q', q);
    const terms = q.split(/\s+/);
    const exp = IDEAS.filter((i) => terms.every((t) => hay(i).includes(t))).length;
    check(`search "${q}"`, (await shown()) === exp, `${await shown()} vs ${exp}`);
  }
  check('empty result shows the empty message', (await page.$('#cards .empty')) !== null);
  await reset();

  // 5 min slider and per-score switch
  await setRange('min-want', 60);
  check('min Want 60', (await shown()) === IDEAS.filter((i) => i.scores.want >= 60).length, `${await shown()} vs ${IDEAS.filter((i) => i.scores.want >= 60).length}`);
  await setRange('min-replicatability', 80);
  const both = IDEAS.filter((i) => i.scores.want >= 60 && i.scores.replicatability >= 80).length;
  check('two minimums combine', (await shown()) === both, `${await shown()} vs ${both}`);
  await toggle('on-want');
  const offWant = IDEAS.filter((i) => i.scores.replicatability >= 80).length;
  check('switching Want off removes its minimum', (await shown()) === offWant, `${await shown()} vs ${offWant}`);
  await reset();

  // 6 Satellite off changes Overall
  await toggle('on-satellite');
  const onSat = { satellite: false };
  const ranked = [...IDEAS].sort((a, b) => ov(b, onSat) - ov(a, onSat) || b.scores.want - a.scores.want);
  const topOv = await page.$eval('#cards .card .ring-wrap.overall .ring-num', (e) => +e.textContent);
  check('Satellite off: top Overall recomputed', topOv === ov(ranked[0], onSat), `${topOv} vs ${ov(ranked[0], onSat)}`);
  check('Satellite off: top card is the expected idea', (await firstName()) === ranked[0].name, `${await firstName()} vs ${ranked[0].name}`);
  const satOff = await page.$eval('#cards .card', (c) => [...c.querySelectorAll('.ring-wrap')].filter((r) => r.dataset.off === '1').length);
  check('Satellite ring is marked off', satOff === 1, String(satOff));
  await reset();

  // 7 weights
  await setNum('w-want', 4);
  const wt = { want: 4 };
  const rw = [...IDEAS].sort((a, b) => ov(b, {}, wt) - ov(a, {}, wt) || b.scores.want - a.scores.want);
  check('Want weight x4 re-ranks', (await firstName()) === rw[0].name, `${await firstName()} vs ${rw[0].name}`);
  await page.click('#resetW');
  check('reset weights restores order', (await firstName()) === first.name);
  await reset();

  // 8 sorts
  await page.selectOption('#sort', 'competition');
  const bestC = Math.max(...IDEAS.map((i) => i.scores.competition));
  const topC = await page.$eval('#cards .card', (c) => [...c.querySelectorAll('.ring-wrap')].find((r) => r.querySelector('.ring-lab').textContent === 'Competition').querySelector('.ring-num').textContent);
  check('sort by Competition', +topC === bestC, `${topC} vs ${bestC}`);
  await page.selectOption('#sort', 'cheapest');
  const minCash = Math.min(...IDEAS.map((i) => i.capital_usd));
  const cash = await page.$eval('#cards .card .cash', (e) => e.textContent);
  check('cheapest first', cash.includes('$' + minCash), cash);
  await reset();

  // 9 capital slider and currency
  const maxCap = await page.$eval('#cap', (e) => +e.max);
  await setRange('cap', 10);
  check('capital limit below every idea shows none', (await shown()) === IDEAS.filter((i) => i.capital_usd <= 10).length, `${await shown()}`);
  await setRange('cap', 15);
  check('capital limit $15 (slider steps by $5)', (await shown()) === IDEAS.filter((i) => i.capital_usd <= 15).length, `${await shown()} vs ${IDEAS.filter((i) => i.capital_usd <= 15).length}`);
  check('capital limit label after setting $15', (await txt('#capVal')) === '≤ $15', await txt('#capVal'));
  await page.click('[data-cur="RON"]');
  const ronLabel = await txt('#capVal');
  check('RON switch relabels the limit', /RON/.test(ronLabel), ronLabel);
  await reset();
  const capLabel = await txt('#capVal');
  check('reset puts the capital limit at the largest cost in the data', (capLabel === 'any' || capLabel === `≤ $${maxCap}`) && maxCap >= Math.max(...IDEAS.map((i) => i.capital_usd)) && (await shown()) === IDEAS.length, `${capLabel} max=${maxCap} shown=${await shown()}`);

  // 10 paging
  await page.click('#more');
  check('show more adds a page', (await page.$$eval('#cards .card', (c) => c.length)) === 48);

  // 11 theme and screenshots (light desktop, dark desktop, phone)
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  check('desktop is in light mode', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
  await page.screenshot({ path: SHOTS + '/desktop-light.png' });
  await page.click('#themeBtn');
  check('theme toggle flips to dark', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await page.screenshot({ path: SHOTS + '/desktop-dark.png' });
  await page.click('#themeBtn');

  const m = await browser.newContext({ viewport: { width: 375, height: 800 }, colorScheme: 'light' });
  const mp = await m.newPage();
  await mp.goto(URL, { waitUntil: 'load' });
  await mp.waitForSelector('#cards .card');
  const sw = await mp.evaluate(() => document.scrollingElement.scrollWidth);
  check('phone width has no horizontal scroll', sw <= 376, String(sw));
  await mp.screenshot({ path: SHOTS + '/phone-top.png' });
  await mp.screenshot({ path: SHOTS + '/phone-card.png', clip: { x: 0, y: 700, width: 375, height: 800 }, fullPage: true });

  check('no errors after all interactions', errors.length === 0, errors.join(' | '));
  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`).join('\n'));
  console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error('test crashed:', e); process.exit(2); });
