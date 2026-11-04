// Runs one prompt through the Claude Code CLI in print mode and returns the model's text.
// Uses the login already on this machine; no API key. Configure with environment variables:
//   PITCHER_CLAUDE_BIN    path to the claude executable (default "claude")
//   PITCHER_CLAUDE_PREFIX JSON array of arguments placed before -p (used by tests to run a fake CLI)
//   PITCHER_MODEL         model alias passed with --model (default "haiku"; empty to use the CLI default)
//   PITCHER_CLAUDE_ARGS   JSON array of extra arguments, e.g. ["--max-turns","1"]
//   PITCHER_TIMEOUT_MS    per-call timeout (default 90000)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const parseArr = (s) => { if (!s) return []; const v = JSON.parse(s); if (!Array.isArray(v)) throw new Error('expected a JSON array'); return v.map(String); };

export function cliConfig(env = process.env) {
  return {
    bin: env.PITCHER_CLAUDE_BIN || 'claude',
    prefix: parseArr(env.PITCHER_CLAUDE_PREFIX),
    model: env.PITCHER_MODEL ?? 'haiku',
    extra: parseArr(env.PITCHER_CLAUDE_ARGS),
    timeoutMs: +(env.PITCHER_TIMEOUT_MS || 90000),
  };
}

// A clean working folder, so the CLI does not pick up this repo's project files or settings.
const workDir = join(tmpdir(), 'pitcher-cli');
mkdirSync(workDir, { recursive: true });

export function runClaude(prompt, cfg = cliConfig()) {
  const args = [...cfg.prefix, '-p', '--output-format', 'json', ...(cfg.model ? ['--model', cfg.model] : []), ...cfg.extra];
  return new Promise((resolve, reject) => {
    const child = spawn(cfg.bin, args, { cwd: workDir, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`claude CLI timed out after ${cfg.timeoutMs} ms`)); }, cfg.timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(new Error(e.code === 'ENOENT' ? `claude CLI not found (${cfg.bin}); install Claude Code or set PITCHER_CLAUDE_BIN` : e.message)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude CLI exited ${code}: ${(err || out).trim().slice(0, 300)}`));
      let parsed;
      try { parsed = JSON.parse(out); } catch { return resolve(out); } // plain text output
      if (parsed && parsed.is_error) return reject(new Error(`claude CLI error: ${String(parsed.result || parsed.subtype || 'unknown').slice(0, 300)}`));
      resolve(typeof parsed?.result === 'string' ? parsed.result : out);
    });
    child.stdin.end(prompt);
  });
}
