# Pitcher

Pitch a Roblox game out loud to a live crowd of little Claude mascots. You stand on a stage in a pixel-art theatre with about 20 claudes in the seats:

- **Four main claudes and an expert** question you, argue with each other in a chatroom, cheer, heckle, and write up what they understood. The expert depends on the kind of game you pitch.
- **Your transcript and the crowd's write-up** are saved, and you can export the whole session.
- **Speech runs on your own computer** by default, using open-source models: Whisper to hear you and Kokoro for the crowd's voices.

## Install

### Windows (no admin rights, no developer tools)

1. Get this folder: download the repository as a ZIP from GitHub, or a release zip made with `npm run package`, and unzip it.
2. Double-click **`install\Install-Pitcher.cmd`**.

It installs into `%LOCALAPPDATA%\Pitcher`:

- **Node.js:** uses your Node.js 20+ if you have one. Otherwise it downloads a single portable `node.exe`, checked against nodejs.org's SHA-256 list. Nothing is installed system-wide, and there's no npm or `node_modules`.
- **Speech runtimes:** downloads them (about 25 MB), each checked against a pinned hash.
- **Shortcuts:** adds a Start Menu and a Desktop shortcut. Pitcher opens in its own app window (Edge or Chrome). Its server starts hidden and stops itself 10 minutes after you close the window.
- **Uninstall:** run `%LOCALAPPDATA%\Pitcher\install\uninstall.ps1`. It offers to keep your saved sessions.

### macOS / Linux

```bash
sh install/install.sh
```

This needs Node.js 20+. It installs to `~/.local/share/pitcher` and adds a `pitcher` command; on Linux it also adds a menu entry.

### From source, for development

```bash
cd pitcher
```

```bash
npm run setup
```

```bash
npm start
```

`npm run setup` fetches the speech runtimes. Then open http://127.0.0.1:8787 in Chrome or Edge. There are still no npm dependencies.

### Disk and memory

- **Disk:** the app is under 1 MB, plus about 25 MB of speech runtimes. The browser caches the models on first use: about 75 MB for Whisper base and about 90 MB for Kokoro. A portable Node adds about 80 MB, only if you didn't already have Node.
- **Memory, estimated (not yet measured):** about 1 GB for the browser tab with both local models loaded. Each model runs in its own worker with 2 threads.
  - **Settings → Memory → Low** switches to Whisper tiny, at about 600 MB.
  - A real-AI turn starts one Claude Code process at a time, a few hundred MB while it thinks.

## On stage

| | |
|---|---|
| **Start pitch** | Turns on the mic. The first time, Whisper downloads (progress shows on the stage). No mic? Type in the box. |
| **Cameras** | `1` You (first person), `2` Side (tilted from the corner), `3` Back (behind the crowd, looking at you). |
| **Several pitches** | "My next idea…", or introduce a different game, and a new pitch starts. "Actually…" changes the current one, recorded as a new version. "That's my pitch" invites the questions. |
| **Choosing what to answer** | Every open question is a card under the stage. **Answer this** (or say "Vex, …" / "Mint, …") points your next words at it. Answer starters appear. **Hint** makes Sunny coach you, **Later** parks a question, `Q` cycles through them, `Esc` lets the crowd decide. |
| **Twists** | Brawl offers a twist. Say "yes" and it's written into the pitch. |
| **End pitch & write up** | Drum roll; every claude writes what they understood, plus a shared summary. |
| **Export** | Markdown (transcript, Q&A, write-up), a printable page, JSON data, or copy. |
| **Saved sessions** | Every session saves automatically with its full transcript (in `data/sessions/`, and in the browser). The Dashboard can reopen or export any of them. |
| **Ideas** | 100 ready-made Roblox ideas by category. **Pitch it for me** performs one on stage. Also in [`IDEAS.md`](IDEAS.md). |

## The crowd

| | Who | What they do |
|---|---|---|
| Red | **Vex**, the Critic | Always negative until every question he asked is answered. Weak answers get pushback. Convince him, or change the pitch. |
| Gold | **Mint**, the Monetizer | How does it make Robux, what does it cost, who pays? Gives GREENLIT / MAYBE / PASS from a visible points rubric. |
| Green | **Sunny**, Hype | Names the strongest part and coaches you on how to answer. |
| Blue | **Brawl**, the Wrestler | Throws one concrete twist at a time and makes you pick the heart of the game. |
| Mortarboard | **The expert** | Joins the expert seat when your pitch matches a category, and asks the questions a veteran of that format would ask. |

**Experts, one per category:**

| Expert | Category |
|---|---|
| Pip | Steal-a games, including retextures like throw / kick / launch an egg |
| Tick | +1 every second |
| Sprout | Grow / farm |
| Bastion | Tower defense |
| Hop | Obby |
| Ledger | Tycoon |
| Hush | Co-op horror |
| Ember | Survival nights |
| Combo | Battlegrounds |
| Neighbor | Roleplay |
| Vogue | Dress-up |
| Paws | Pets |
| Sleuth | Social deduction |
| Warden | Escape |
| Confetti | Party |
| Finder | Find-the |

- **Their knowledge:** conventions, pitfalls, monetization and question banks live in `public/js/categories.js`.
- **Their system briefs:** for the four mains and every expert, in `public/js/prompts.js`.

**The rest of the room:** Gus, Bea, Lil Tim, Grandma Glitch, Dana, xX_Noob_Xx, Prof. Pixel, Mo, Kiki and Ollie react with their own pre-set lines (`public/js/crowdcast.js`).

**Crowd sounds:** applause, cheers, gasps, laughs, boos and stingers are synthesized live with Web Audio, so there are no sound files.

**Toggles in Settings:** spoken voices (with the mic muted while a claude talks, unless you tick *headphones*), mid-pitch interruptions, chatter, crowd lines and sounds.

## Speech engines

| | Default | Fallback |
|---|---|---|
| Hearing you | **Whisper** (`Xenova/whisper-base.en`, or tiny in low-memory mode), local, private | The browser's speech recognition (Chrome / Edge) |
| Crowd voices | **Kokoro-82M** (`onnx-community/Kokoro-82M-v1.0-ONNX`), local, one voice per claude | Browser voices, or off |

- **Runtimes:** both run through Transformers.js 3.5.1 and kokoro-js 1.2.1 (Apache-2.0). `scripts/fetch-vendor.mjs` downloads them from the npm registry and verifies their integrity hashes.
- **Models:** downloaded from Hugging Face by the browser the first time, then cached.
- **Fallback:** if a model can't load, Pitcher says so in the chat and uses the fallback.

## Who does the thinking

- **Claude Code CLI:** the default when the server has it. It runs `claude -p --output-format json` with your existing Claude login, so no API key is needed.
  - **Model:** Sonnet by default.
  - **One call per beat:** returns lines for the whole crowd. Heckles and side chatter come from a local layer and never wait for it.
  - **Replies are checked** (`public/js/aiContract.js`): unknown speakers are dropped, there's one new question per reply, and Vex can't be convinced while any of his questions is open.
- **Scripted crowd:** works offline and instantly, built on the same knowledge base. It's what the tests exercise, and the fallback if the CLI fails.

| Variable | Default | Meaning |
|---|---|---|
| `PITCHER_MODEL` | `sonnet` | Model alias passed as `--model`; empty uses the CLI default |
| `PITCHER_CLAUDE_BIN` | `claude` | Path to Claude Code (on Windows, an npm-installed `claude.cmd` is found automatically) |
| `PITCHER_CLAUDE_ARGS` | `[]` | Extra CLI arguments as a JSON array |
| `PITCHER_TIMEOUT_MS` | `90000` | Per-call timeout |
| `PITCHER_AI` | (unset) | `off` uses only the scripted crowd |
| `PITCHER_AUTOSTOP` | (unset) | Minutes without an open window before the server exits (the launchers set 10) |
| `PORT` / `HOST` | `8787` / `127.0.0.1` | Localhost only, because the server starts processes |

## Dashboard feed

```bash
curl -X POST http://127.0.0.1:8787/api/agents -H 'content-type: application/json' -d '{"agents":[{"id":"build","name":"Roblox builder","status":"running","task":"Lobby check-in","progress":0.4}],"next":[{"id":"n1","title":"Playtest lobby","owner":"you","priority":"high"}]}'
```

- **Status values:** `running`, `idle`, `blocked`, `done` or `error`.
- **Updates:** items are upserted by `id`; send `"replace": true` to start over.
- **What's next:** the list also includes your open questions from pitches, and Mint's biggest fix.

## Build a release, and tests

```bash
npm run package
```

This writes `dist/Pitcher-<version>.zip`: only runtime files plus the installers and the verified speech runtimes, about 6 MB.

```bash
npm test
```

```bash
npm run test:e2e
```

- **Unit tests:** detection, the crowd brain, experts, all 100 ideas mapping to their categories, choosing questions, exports, sessions, the CLI contract against a fake `claude`, and the tar and zip code.
- **End-to-end:** drives headless Chromium. It uses fake browser speech, and Chromium's fake microphone feeding the real Whisper capture and voice-detection path, with the model workers stubbed. It covers every view, export, saved sessions, and the phone layout.

## Not tested yet

This was built in a cloud container that couldn't download the speech models or use a real mic, speaker or Claude login. So these need their first run on your machine:

- Real Whisper and Kokoro inference, including their actual memory use.
- Chrome's own speech recognition.
- The Windows and macOS installers.
- The real `claude -p` reply format. If it differs, the chat says so and the scripted crowd takes over.
