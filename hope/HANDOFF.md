# Handoff: Gap Ledger (web app idea finder)

Written 2026-10-28 by the local Claude Code session "Overnight folder review". The user is moving this job to a cloud session and asked me to stop all work and only write this file. **Nothing below was re-checked at write time**; the "state" section says what I last verified and when.

## 1. The job

Source brief: `D:\hope\app-idea-finder-prompt.md` (read it first, it is the contract). In one line: find **100+ hard-to-copy WEB APP ideas** (or single features for existing web apps) that real people asked for in public, each with a **dated, linked, real** signal; score each 0-99 on eight axes; assign niches; add a marketing plan and, where it fits, a satellite free tool; ship a single-file filterable dashboard plus `ideas.json`, `ideas.csv`, and a final report.

Deliverables go in **`D:\hope\`** (project root): `dashboard.html`, `ideas.json`, `ideas.csv`, `REPORT.md`. None exist yet.

## 2. Decisions the user made (do not re-ask)

| Topic | Decision |
|---|---|
| X / Twitter | Use it through Claude in Chrome; the user's account is already logged in. Read-only. If it blocks, say so and move on. |
| Shortfall | If fewer than 100 ideas have real signals, **ship what's real and flag the gap**. Never pad or invent. |
| Stack and budget | Supabase free plan + Vercel free/hobby plan. Capital figures assume that. |
| Market | English, global. |
| Paid APIs | **Allowed, not excluded**, but they must score **way lower** on Startup Capital. I applied this to AI-model APIs too (the brief had banned AI-dependent apps); the dashboard tags such ideas "paid API" and has a switch to hide them. Mention this reading in the report so the user can overrule it. |
| Output scale | Scores 0-99. Overall = average of eight with Satellite at 0.5x; weights user-adjustable in the dashboard. |
| Session | Permission mode was `auto`. The user said "dont pack it up" earlier, then (2026-10-28) said to wrap up and move to the cloud, writing only. |

## 3. Hard rules (from the brief, still binding)

1. Real signals only: every idea needs a dated link; never invent a complaint, quote, date or statistic. Paraphrase, no long quotes.
2. Web apps only: no native, desktop, extension, hardware.
3. Banned: money-moving niches (payments, trading, investing, lending, banking, tax, crypto, invoicing, payroll, billing, escrow, legal) and 18+. (The AI/paid-API ban was relaxed, see above.)
4. Hard to copy and cheap to start.
5. Say plainly when blocked. Never bypass a CAPTCHA or a bot challenge.

User's global preferences that matter here: be direct, no flattery; ask before big or hard-to-undo changes; keep scratch files out of project folders; don't delete files; no debug output or commented-out code in finished work.

## 4. Blocked or limited sources (report these)

- **Reddit: blocked on every tool.** Claude in Chrome refuses navigation ("not allowed due to safety restrictions"), WebSearch returns a 400 domain block, WebFetch refuses reddit.com and old.reddit.com, and curl returns 403. The user later put a Reddit tab in the Chrome tab group (tab id 1887651587) and logged in; `get_page_text` on it still returned "This site is blocked", and its URL carried a Reddit JS-challenge token (`js_challenge=1&jsc_token=...`). **I did not work around it and the next session must not either** (no `javascript_tool` on that tab, no mirrors, no archives, no search-engine snippets). If the user wants Reddit covered, they paste threads.
- **X rate-limited:** after about 12 searches X returned "Something went wrong. Try reloading" for several minutes. The X agent stopped and wrote 13 ideas. A later retry after a cooldown, with gentler pacing, is reasonable.
- **Bluesky:** public API returned 403 to curl. **Mastodon** search returned empty without login. Both dropped.
- **Stack Exchange API:** anonymous quota is 300 requests/day per IP and is shared by every agent; about 43 were left after wave 1. Do not plan more SE sweeps today.
- **GitHub API:** unauthenticated core API is 60 requests/hour; `gh` CLI is not installed, so `verify.js` marks GitHub links "unverified" when rate-limited.
- **Third-party skills not installed:** startup-validator, validate-idea, Reddit Research Tool Pro. The brief says do not install them; use the built-in fallback and state this in the report.
- **Account rate limit:** running 11-14 agents in parallel hit the session limit twice (resets 1:20am and 1:30pm Bucharest time on 2026-10-26) and killed most agents mid-run. **Run at most 3-4 agents at a time.**

## 5. State when I last looked (2026-10-26 ~08:39 local, plus later agent reports)

Everything that matters is saved **in the project** at `D:\hope\research\` (708 KB, safe for GitHub). Call it `$S`. Layout: `candidates\*.json`, `tools\*.js`, `spec.md`, `score_spec.md`, `dashboard.template.html`, and empty `scored\` and `critic\` folders (kept in git with `.gitkeep`). The scripts take `$S` as an argument; `finalize.js` reads `dashboard.template.html` from the folder above `tools\`, so keep that file next to `tools\`.

Not saved on purpose: the original scratchpad (`C:\Users\nalex\AppData\Local\Temp\claude\D--hope\a9d08b52-1046-4206-8467-6ae621c0f438\scratchpad\`) and its copy at `D:\hope\_work\`. That is 35 MB of raw API dumps and agent scratch (`se`, `seB`, `hnB`, `apA_work`, `apB_work`, `hnA_work`, `gh_work`, `lem_tmp`, `fixture` and similar), all regenerable. The user approved deleting `D:\hope\_work\` and it was deleted on 2026-10-28 (its `scored\` and `critic\` folders were empty); `D:\hope\.gitignore` still lists `_work/` so a recreated scratch folder stays out of GitHub.

### Candidate files in `$S\candidates\` (raw researcher output, JSON arrays)

| Tag | Source | Status | Ideas |
|---|---|---|---|
| x | X via Chrome | finished (rate-limited) | 13 (9 niches only; 12 low-confidence) |
| seA | Stack Exchange, home/life sites | finished | 20 (10 are Travel: visa/ETA/arrival-card tools) |
| seB | Stack Exchange, games/music/work sites | finished | 12 (best: DicePool Lab) |
| hnB | Hacker News, business/creators/community | finished | 17 (best: Plug-In Solar Rulebook, Relic) |
| rev | reviews + forums via Chrome | died on rate limit, partial | 12 |
| hnA | Hacker News, productivity/dev/docs | died on rate limit, partial | 14 |
| lem | Lemmy | died on rate limit, partial | 8 |
| gh | GitHub feature requests | died on rate limit, partial | 16 |
| dsc | Discourse forums (wave 2) | died on rate limit | **no file** |
| apA | App Store reviews, life niches (wave 2) | died on rate limit, barely started | 1 |
| apB | App Store reviews, hobby niches (wave 2) | died on rate limit, partial | 8 |
| fb | public feedback boards (wave 2) | died on rate limit, partial | 3 |
| frA | niche forums: games/crafts/sport (wave 2) | died on rate limit, barely started | 2 |
| frB | niche forums: life/work/community (wave 2) | died on rate limit, barely started | 2 |

Counts were taken on 2026-10-28 from `research\candidates\`; all 13 files parse as valid JSON. **Total: 128 raw candidates**, before dedupe, link checks and the critic pass. Wave 1 was the first eight tags (x, seA, seB, hnA, hnB, lem, gh, rev) and wave 2 the rest. The agents that died wrote partial files, so apA, frA and frB are nearly empty and are the first to re-run, together with dsc. To recount:

```bash
cd "$S/candidates" && for f in *.json; do printf "%s: " "$f"; node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).length)}catch(e){console.log("INVALID "+e.message.slice(0,60))}' "$f"; done
```

128 raw candidates is above 100 on paper, but dedupe, dead-link removal and the critic pass will cut it, and many ideas are low-confidence. **Do not assume 100 survive.** More research (apA, dsc, frA, frB, fb, an X retry) is the cheapest way to build margin.

Thin or empty niches so far: Pets, Parenting & Family, Health & Fitness, Education & Study, Languages, Collectors, Music & Audio, Sports & Teams, Writing & Publishing, Mental Wellbeing, Creators & Streamers. Travel is over-represented. Where the agents used the yield findings: "is there a website that" and "I wish there was a website" worked on X; quoted-phrase OR queries returned noise and founder self-promotion; Stack Exchange search endpoint is noisy, pulling every question and filtering locally worked better.

### Tools I built (in `$S\tools\`, Node 24, no dependencies)

| Script | What it does | Command |
|---|---|---|
| `merge.js` | Reads `candidates\*.json`, validates fields and signals (drops Reddit URLs, bad dates, ideas without a valid signal), flags banned terms and non-canonical niches, dedupes by shared signal URL or name+idea token overlap (Jaccard 0.5), writes `merged.json` and `merge_report.json` | `node tools/merge.js "$S"` |
| `verify.js` | Checks each signal URL: HN (Algolia item), Stack Exchange, GitHub, Lemmy via their APIs with date comparison; other URLs by HTTP status; X marked unverified. `--apply` fixes dates, drops dead signals and ideas left with none. Writes `verify_report.json` | `node tools/verify.js "$S" --apply` |
| `split.js` | Splits `merged.json` into niche-ordered scoring batches in `scoreinput\batchNN.json` and writes `index.json` (compact id/name/niche/idea list for duplicate checks) | `node tools/split.js "$S" 30` |
| `apply_critic.js` | Applies critic verdicts (`critic\rN_*.json`) to `scored\*.json` and `dropped_ids.json` | `node tools/apply_critic.js "$S" 1` |
| `finalize.js` | Joins `merged.json` + `scored\*.json`, computes Capital and Newability by formula, calibrates spread, writes `ideas.json`, `ideas.csv`, `dashboard.html` into the out folder and `finalize_report.json` | `node tools/finalize.js "$S" "D:/hope" 4.77` |
| `report.js` | Writes `REPORT.md` from `ideas.json`, `finalize_report.json`, `verify_report.json` and a hand-written `report_notes.json` (`{missing_tools, blocked_sources, critic:{summary}, caveats}`) | `node tools/report.js "$S" "D:/hope" 4.77` |
| `make_fixture.js` | TEST ONLY: builds 40 fake ideas into a fixture folder to exercise the dashboard. Never ship its output. | `node tools/make_fixture.js "$S/fixture" 40` |

Also in `$S`: `spec.md` (the shared researcher spec: rules, canonical niches, JSON shape, source recipes incl. wave-2 recipes), `score_spec.md` (scorer and critic roles, axis definitions, anchors, output shapes), `dashboard.template.html` (finished dashboard with placeholders `__IDEAS_JSON__`, `__USD_RON__`, `__DATE__`).

None of these scripts have been run on real candidate data: `merge.js`, `verify.js`, `split.js` and `apply_critic.js` were only written, not executed. `finalize.js` and the dashboard were run on the fixture only. **Expect small bugs on first real run.**

## 6. Scoring design (already encoded in `finalize.js`)

- **Judged by a scorer agent** (0-99): replicatability, wtr, competition, marketability, satellite, want. Anchors, "rank first then number", and "search before giving competition >= 60" are in `score_spec.md`. Scorers write `scored\batchNN.json` with `{id, scores:{6 axes}, score_notes:{axis:"one line"}, flags:[], drop:false, drop_reason:""}`; a one-line note is required for every score above 85 or below 25. Flags `not_web_app`, `banned_money`, `adult`, `duplicate_of:<ID>` drop an idea in `finalize.js`; `weak_signal` sets confidence to low.
- **Computed, not judged:**
  - Newability: age in days of the newest signal on the curve (0d 98, 30d 93, 90d 82, 150d 72, 270d 52, 365d 34, 545d 18, 730d 10, 1500d 4) plus 4 points per other signal under 365 days old, max +10.
  - Startup Capital: `capital_usd` through the curve ($0 99, $15 96, $30 90, $60 80, $120 68, $250 52, $500 36, $1000 20, $2500 8, $5000 0). **If `uses_paid_api`, the score is halved and capped at 40.** `capital_usd` for paid-API ideas must already include about 3 months of API cost at about 500 monthly users.
- **Spread calibration:** per judged axis, if sd < 14 or p5-p95 range < 45, stretch p5..p95 onto 8..94 (order preserved). Say so in the report if it triggers.
- **Overall (default):** weighted average, Satellite 0.5, others 1.0. The dashboard recomputes it live from the user's weights.
- **USD/RON:** 4.77 (open.er-api.com gave 4.77491 on 2026-10-25). Refetch before final build: `curl -s https://open.er-api.com/v6/latest/USD | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).rates.RON))'`

## 7. Remaining pipeline (do in order)

1. Work in `D:\hope\research` (section 5). It already holds the candidates, specs, tools and template.
2. **Finish research with 3-4 agents at a time** (not 11). Re-run only tags whose file is missing or thin, using `spec.md`. Suggested priority: hnA, lem, gh, then apA/apB (App Store reviews via the public iTunes search + RSS endpoints are programmatic and high-volume), dsc, fb, frA, frB, and an X retry after a cooldown. Each prompt pattern I used: "FIRST read the full spec at <path>/spec.md and follow it exactly. Your tag: X. Your source: ... Your niches: ... Aim for 25-30 candidates (quality over padding). Write the JSON array to <path>/candidates/X.json. Write early and rewrite after every ~8 ideas. Final message: 120 words max." Tell each agent that paid-API ideas are allowed (`uses_paid_api`, `paid_api_note`, realistic `capital_usd`).
3. `merge.js`, then `verify.js --apply`, then read `merge_report.json` flags (banned-term matches, non-canonical niches) and fix by hand or drop.
4. `split.js`, then spawn **scorer agents** (one per batch, <= 4 at a time) with `score_spec.md` and the batch + `index.json`.
5. Spawn **critic agents** (different agent from the batch's scorer) per `score_spec.md`, outputs `critic\r1_batchNN.json`; run `apply_critic.js "$S" 1`. Run a **round 2** on adjusted and disputed ideas plus a sample; the brief requires "critic pass with no unresolved objections" (gauntlet-loop style).
6. Spot-check X-sourced signals in Chrome (the script cannot verify X).
7. `finalize.js` into `D:\hope`; write `report_notes.json`; `report.js`.
8. **Test the dashboard on the real data** (see section 8), then deliver.

## 8. Dashboard ("Gap Ledger", `dashboard.template.html`)

Design: warm paper palette, deep blue accent, Instrument Serif headings, Schibsted Grotesk body, Spline Sans Mono for numbers (Google Fonts with Georgia/system fallbacks); light and dark themes (toggle in the masthead); no purple gradients, no icon-in-circle cards. Rings use the dataviz status colors (green #0ca30c, amber #fab219, red #d03b3b) at thirds: red 0-33, amber 34-66, green 67-99, number always printed in the middle.

Features built: niche multi-select chips with live counts (also the per-niche summary), summary strip (total, matching, feature ideas), search, sort by Overall / cheapest first / any score, per-score on/off checkbox + minimum slider + weight box, capital max slider with USD/RON switch, show/hide feature ideas, low-confidence ideas and paid-API ideas, "all on", "reset weights", "clear all filters", 24-card pages with "show more", mobile filter drawer. Card order follows brief section 8 (name, idea, description, why-now signals, rings, marketing + satellite).

Test status: on 40 fake ideas, an automated in-page script confirmed 20 checks (counts after every filter matched an independent calculation; Satellite off removed it from filtering and Overall; sort orders; paging; every ring prints a number; 9 rings per card). Mobile 375px had no horizontal scroll. **Not yet tested with real data or in light mode on a wide screen.** Preview note: the built-in browser renders `file://` pages outside the project as static snapshots (no JavaScript); serve the output folder over HTTP to test, e.g. `python -m http.server 8765 --bind 127.0.0.1` (Python is at `C:\Users\nalex\AppData\Local\Programs\Python\Python314\python.exe`) and open `http://127.0.0.1:8765/dashboard.html`. A reusable test script is easy to rewrite: set each control, dispatch `input`/`change`, compare `#nShown` with a filter computed from `#ideas-data`.

Not done and optional: an export-filtered-results button (not required by the brief).

## 9. Known weak spots to be honest about in the report

- Yield without Reddit is lower than the brief assumed; the 100+ goal may not be reached and the user pre-approved shipping the real count with the gap flagged.
- Many X and wave-1 ideas are low-confidence (one or two posts each).
- Replicatability and Want are the shakiest axes; vibe-coder reproducibility is a judgment call. The critic pass exists to challenge it.
- Duplicate detection is heuristic (shared URL, token overlap). Critics must also check against `index.json`.
- Travel ideas from seA cluster around official government visa and arrival-card sites; check the "hard to copy" claim and legal sensitivity (data accuracy, not legal advice) before keeping them all.

## 10. First three things the cloud session should do

1. Read `app-idea-finder-prompt.md`, then this file, then `research/spec.md` and `research/score_spec.md`.
2. Count candidates (command in section 5) and run `merge.js` to see the real number.
3. Decide with the user, in one short message, whether to spend the next rate-limit window on more research (suggested: App Store reviews, Discourse, feedback boards) or to score what exists and ship with the gap flagged.

## 11. Update 2026-10-28, first cloud session (Linux container, repo at `/home/user/search`)

**Research could not continue here: the container's network policy is "limited".** Probed with curl (CONNECT returns 403) and WebFetch (host does not resolve). Denied: `hn.algolia.com`, `news.ycombinator.com`, `api.stackexchange.com` and every `*.stackexchange.com` site, `lemmy.world`, `lemmy.ml`, `itunes.apple.com`, `apps.apple.com`, `play.google.com`, `x.com`, `forum.obsidian.md`, `community.home-assistant.io`, `forums.ankiweb.net`, `boardgamegeek.com`, `www.trustpilot.com`, `www.producthunt.com`, `www.indiehackers.com`, `chromewebstore.google.com`, `open.er-api.com`, `web.archive.org`, `bsky.social`, `mastodon.social`, `lobste.rs`, `dev.to`. Only `api.github.com` and `raw.githubusercontent.com` connect, and that access uses the session's own GitHub credentials (15,000 requests/hour), which are scoped to `nathanadev/search`; so GitHub issue sweeps of other repos were not run.

Other limits found:
- **Claude in Chrome is not available in the cloud session**, so X, review sites and the X spot-check (step 6) need the local session or pasted threads.
- **WebSearch works but cannot replace the APIs.** Tested twice (standard and extended): it returns undated vendor pages and old threads (the pet-rescue hits were 2022-2023) and I cannot open them to see a date, so it can check competition but cannot produce a signal that meets hard rule 1.
- To resume research the user must change the environment's Network access (cloud environment menu in the session title bar, Edit; steps at https://code.claude.com/docs/en/cloud-environments#network-access) to allow at least the hosts above. Wave-2 priorities and the hosts they need: apA/apB `itunes.apple.com`; dsc the Discourse hosts named in `research/spec.md`; hnA `hn.algolia.com`; lem `lemmy.world`; fb and frA/frB the forum or board hosts found by search; USD/RON `open.er-api.com`.

What was done:
- Ran `merge.js` on the real data for the first time: **128 raw candidates in, 122 kept, 6 merged as duplicates, 0 dropped**. Output: `research/merged.json`, `research/merge_report.json`. Kept per tag: apA 1, apB 6, rev 11, fb 3, frA 2, frB 2, gh 13, hnA 14, hnB 17, lem 8, seA 20, seB 12, x 13.
- Ran `split.js` on a scratch copy: it works (5 batches of about 25 plus the 122-entry `index.json`). Output not committed because it is regenerable and would go stale if more candidates arrive.
- Not run: `verify.js` (its hosts are blocked), `apply_critic.js`, `finalize.js`, `report.js` and any scorer or critic agents. No agents were spawned.

Numbers in `merged.json`: 82 low, 39 medium, 1 high confidence; all 122 have `is_feature: false` (the feature-idea toggle will have nothing to show unless new research adds some) and `uses_paid_api: false`. Signals by platform: stackexchange 119, hn 93, github 82, appstore 44, x 22, lemmy 12, web 13, forum 4, trustpilot 3. Only 2 ideas have a newest signal older than 2025-10-25. Niche counts: Travel 13, Hobbies & Crafts 10, Languages 8, Gaming Communities 8, Food & Cooking 7, Education & Study 7, Data & Documents 7, Home & DIY 6, Community & Nonprofit 6; Pets, Health & Fitness and Writing & Publishing have 0-1.

Triage of the 9 `merge_report.json` flags (decisions for the scorer and critic, nothing was edited in the candidates):
- Keyword false positives, keep: `frB-001` PackStation (says no payments handled), `gh-008` Parts Bin Online and `hnB-001` Batchbook ("stock" means inventory), `hnB-014` Gran Screen ("adult" means adult children), `seA-009` TicketAccess (a directory of ticketing options, no money handled), `x-001` Open Slots Finder (links out to makers' own payment pages).
- Judgment calls to put to the user or critic: `hnB-017` Plug-In Solar Rulebook (a regulations lookup, not legal services, but it must carry sources, last-verified dates and a not-advice notice); `x-008` If Something Happens Binder (a document organiser, one post, high liability, keep only if it stays clearly non-legal).
- `x-003` Hours Any Day: one post, new niche "Faith & Religion" (only idea in it), and the English breviary text is copyrighted; likely a drop unless an openly licensed text exists.

## 12. Update 2026-10-28, scoring pass (same cloud session)

The user chose to score what exists instead of waiting for network access. Done inline, no agents spawned.

- **merge.js bug fixed.** One shared signal URL merged unrelated ideas (a calendar tool absorbed a genealogy tool and a trip planner; a volunteer rota absorbed a songbook idea; a bracket tool absorbed a league scheduler). A shared URL now merges only if name+idea token overlap is at least 0.08 (real duplicates measured 0.10-0.15, false merges 0.00-0.06). Result: **126 merged ideas** (was 122), only `rev-001`+`apB-003` and `rev-010`+`apB-005` stay merged. `merged.json` and `merge_report.json` were regenerated.
- **All 126 scored** (`research/scored/batch01-05.json`, six judged axes, one-line note on every score above 85 or below 25). Competitor web searches were run for every idea expected to score 60+ on Competition and for suspected hidden incumbents. Marketability was re-ranked once after the first run showed a narrow band (sd 10.9), so no axis needed `finalize.js` spread calibration.
- **8 duplicates flagged and dropped:** `hnB-006`→`gh-015`, `seB-002`→`rev-006`, `rev-004`→`fb-002`, `gh-006`→`rev-009`, `x-008`→`hnB-015`, `gh-011`→`apA-001`, `gh-005`→`rev-001`, `lem-002`→`apB-008`. **118 ideas remain** (1 high, 40 medium, 77 low confidence).
- **Critic round 1 was not independent:** the same agent re-attacked the 11 highest-ranked ideas (`critic/r1_batch01.json`, applied with `apply_critic.js`): 9 adjusted, 2 ok. Nothing else had a second look. The brief's "critic pass with no unresolved objections" is **not met**.
- **Deliverables generated** in this folder: `ideas.json`, `ideas.csv`, `dashboard.html`, `REPORT.md` (draft; `research/report_notes.json` holds its caveats). `report.js` no longer claims a critic agent ran.
- **Dashboard tested on real data** with `research/tools/dashtest.js` (Playwright, 36 checks including every filter, weights, Satellite off, sorts, capital and RON, paging, light and dark, phone width): all pass.
- **Known weaknesses of the result:** no signal link opened (`verify.js` not runnable here); Startup Capital is about $12 for every idea so it does not discriminate; the 14 Travel ideas are one product family from one Q&A site; Newability is measured from 2026-10-25 and USD/RON 4.77 is from that date; there are no feature ideas and no paid-API ideas.
- **Next steps with open network:** run `verify.js --apply`, then more research for thin niches (Pets, Health & Fitness, Writing & Publishing, Mental Wellbeing, Dev Tools), then independent critic agents (3-4 at a time) on all batches, then re-run `finalize.js` and `report.js`.
