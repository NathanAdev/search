// Stands in for `claude -p --output-format json` in tests. Reads the prompt on stdin and prints a result envelope.
// FAKE_CLAUDE_MODE: "ok" (default), "garbage" (non-JSON reply), "error" (is_error envelope), "crash" (exit 1).
let prompt = '';
process.stdin.on('data', (d) => { prompt += d; });
process.stdin.on('end', () => {
  const mode = process.env.FAKE_CLAUDE_MODE || 'ok';
  if (mode === 'crash') { process.stderr.write('boom'); process.exit(1); }
  if (mode === 'error') { process.stdout.write(JSON.stringify({ type: 'result', is_error: true, result: 'Not logged in' })); return; }
  if (!process.argv.includes('-p') || !process.argv.includes('--output-format')) { process.stdout.write(JSON.stringify({ type: 'result', is_error: true, result: 'bad flags' })); return; }
  let reply;
  if (mode === 'garbage') reply = 'Sure! Here is my answer without any JSON.';
  else if (prompt.includes('The pitch is over')) reply = '```json\n' + JSON.stringify({ shared: 'A ghost hotel tycoon.', sections: [{ title: 'The game', items: ['Run a hotel for ghosts'] }], perPersona: { critic: 'Still not sold.' } }) + '\n```';
  else {
    const id = (prompt.match(/"id":"(q\d+)"/) || [])[1];
    reply = 'Here you go: ' + JSON.stringify({
      resolved: id ? [{ id, status: 'answered' }, { id: 'q-does-not-exist', status: 'answered' }] : [],
      questions: [{ by: 'critic', topic: 'retention', text: 'Why come back tomorrow?' }, { by: 'monetizer', topic: 'price', text: 'Second question, should be dropped.' }],
      lines: [{ who: 'hype', kind: 'say', text: 'Love it!' }, { who: 'intruder', text: 'not a persona' }, { who: 'critic', kind: 'chat', to: 'hype', text: 'Calm down.' }],
      proposal: { by: 'wrestler', text: 'What if the hotel floats' },
      criticDone: true,
    });
  }
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: reply, session_id: 'fake' }));
});
