# Pitcher

Pitch a Roblox game out loud to a live crowd of little Claude mascots. Four of them question you until they understand it, then write down what they understood.

There's also a small dashboard of your agents and what's next to do.

## Run it

```bash
cd pitcher
npm start
```

Open http://127.0.0.1:8787 in **Chrome or Edge**, the browsers that have speech recognition. Press **Start pitch**, allow the microphone, and talk. No microphone? Type in the box under the stage. **Run demo pitch** plays a scripted two-pitch session so you can watch everything work.

There's nothing to install: plain Node (20 or newer) and the browser, no npm dependencies.

## On stage

- **Three cameras:** `1` You (first person, looking at the crowd), `2` Side (tilted, from the corner), `3` Back (behind the crowd, looking at you on stage). The buttons in the top-left of the stage do the same.
- **The crowd:** about 20 claudes in theatre seats. The four in the front row are the ones that talk, and the rest clap, gasp and think.
- **Multiple pitches are detected automatically.**
  - Say "my next idea…", "another game…", or introduce a different genre ("imagine a racing game where…") to start a new pitch.
  - "Actually…", "instead…" or "let me change it so…" changes the current pitch, recorded as a new version.
  - "That's my pitch" tells the crowd you're done talking, so they ask their questions.
- **Chatroom (right panel):** everything said, including the four talking to each other (`Vex → Sunny`).
- **Pitches tab:** one card per detected pitch, showing Mint's meter, Vex's open and answered questions, and the versions.
- **Understanding tab:** a live draft, then the final write-up when you press **End pitch & write up**. Each claude writes what they understood in their own words, plus a shared summary. You can copy or download it as Markdown.

## The four claudes

| | Who | What they do |
|---|---|---|
| Red | **Vex**, the Critic | Always negative until every question he asked is answered. Weak answers get pushback. You convince him, or change the pitch. |
| Gold | **Mint**, the Monetizer | Asks how it makes Robux (game passes, developer products, private servers, Premium payouts, cosmetics…), wants prices and who pays, and gives a verdict: GREENLIT, MAYBE or PASS, from a points rubric you can see. |
| Green | **Sunny**, Hype | Genuinely positive. Names the strongest part and coaches you on how to answer Vex ("Psst! Tell him what happens in second one…"). |
| Blue | **Brawl**, the Wrestler | Wrestles your idea: throws a concrete twist ("what if your tycoon is a ship that sinks if you over-build?"). Say "yes" and it's written into the pitch. He also makes you pick the one heart of the game. |

All crowd behaviours are toggles in **Settings**:

- **Spoken voices (on):** the mic pauses while a claude talks, so it doesn't transcribe them. Tick *I'm wearing headphones* to keep it on.
- **Mid-pitch interruptions (on).**
- **Crowd chatter while you talk (on).**

## Who does the thinking

- **Scripted crowd:** works offline and instantly. It runs on rules and a Roblox game-design knowledge base (`public/js/roblox.js`): genres, saturation, monetization mechanisms, retention levers, exploit and safety topics. This is what was tested.
- **Claude Code CLI:** the default when the local server is running. The server runs `claude -p --output-format json` with your existing Claude login, so no API key is needed. Each beat is one call for the whole crowd, to keep the lag down. Heckles and side chatter never wait for the AI.
  - Every reply is checked before use (`public/js/aiContract.js`): unknown characters are dropped, only one new question is kept per reply, and Vex can't be "convinced" while any of his questions is open.
  - If the CLI fails, the scripted crowd answers instead and the chatroom says so.

Real-AI settings (environment variables):

| Variable | Default | Meaning |
|---|---|---|
| `PITCHER_CLAUDE_BIN` | `claude` | Path to the Claude Code executable |
| `PITCHER_MODEL` | `haiku` | Model alias passed as `--model`; empty uses the CLI default |
| `PITCHER_CLAUDE_ARGS` | `[]` | Extra CLI arguments as a JSON array, e.g. `["--max-turns","1"]` |
| `PITCHER_TIMEOUT_MS` | `90000` | Per-call timeout |
| `PITCHER_AI` | (unset) | `off` serves the app and dashboard with the scripted crowd only, for machines without Claude Code |
| `PORT` / `HOST` | `8787` / `127.0.0.1` | The server only listens on localhost, because it starts processes |

## Dashboard

The **Dashboard** tab shows agent cards and a "what's next" list. That list also includes your open questions from pitches, and Mint's biggest fix.

Feed it from anything:

```bash
curl -X POST http://127.0.0.1:8787/api/agents -H 'content-type: application/json' -d '{"agents":[{"id":"build","name":"Roblox builder","status":"running","task":"Lobby check-in","progress":0.4}],"next":[{"id":"n1","title":"Playtest lobby","owner":"you","priority":"high"}]}'
```

- **Status values:** `running`, `idle`, `blocked`, `done` or `error`.
- **Updates:** items are upserted by `id`; send `"replace": true` to start over.
- **Sample data:** until something posts, the dashboard shows clearly labelled sample agents.
- **Storage:** data is kept in `data/agents.json`, which is git-ignored.

## Tests

```bash
npm test
```

```bash
npm run test:e2e
```

- **Unit tests:** the pitch detector, spec extraction, Mint's rubric, the full two-pitch demo, Critic pushback, heckle rate-limiting, AI fallback, and the server and AI contract against a fake `claude` binary (`test/fixtures/fake-claude.mjs`).
- **End-to-end:** drives the real page in headless Chromium with a fake microphone and fake voices. It needs the `playwright` package. It covers all three cameras, live heckles, two pitches detected from speech, the write-up, the dashboard feed, the mic muting while a voice speaks, the CLI path, and the phone layout.

## Not tested yet

Testing from a cloud container can't use a real microphone, real voices or a real model, so these need a first run on your machine:

- Chrome's real speech recognition, including how it splits phrases and how it behaves when it auto-restarts.
- Real browser voices.
- The real `claude -p` reply format. The adapter reads the `result` field of the JSON output; if your CLI version differs, the error shows in the chatroom and the scripted crowd takes over.
