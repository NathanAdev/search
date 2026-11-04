// Real-AI provider: asks the local Pitcher server, which runs the Claude Code CLI. Same contract as the mock.
export function createRemoteProvider({ base = '', fetchImpl = (...a) => fetch(...a), timeoutMs = 120000 } = {}) {
  async function post(path, body) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `server answered ${res.status}`);
      return data;
    } catch (err) {
      throw new Error(err.name === 'AbortError' ? 'the AI took too long' : err.message);
    } finally { clearTimeout(t); }
  }
  return {
    name: 'claude-cli',
    beat: (request) => post('/api/ai/beat', { request }),
    understanding: ({ pitch }) => post('/api/ai/understanding', { pitch }),
  };
}
