// Open-source speech that runs on this computer: Whisper for the mic, Kokoro for the crowd's voices.
// Same interfaces as speech.js (createMic / createVoices), so the rest of the app does not care which is used.
// Memory: each model lives in its own worker with 2 threads; whisper-base.en q8 plus Kokoro q8 stay around 1 GB
// for the whole tab. "Low memory" uses whisper-tiny.en.

export const STT_MODELS = { normal: 'Xenova/whisper-base.en', low: 'Xenova/whisper-tiny.en' };
// Kokoro voice per speaker. Experts and anyone else fall back by index.
export const KOKORO_VOICES = { critic: 'am_onyx', monetizer: 'am_puck', hype: 'af_bella', wrestler: 'am_fenrir' };
const EXPERT_VOICES = ['bf_emma', 'bm_george', 'af_nicole', 'bm_fable', 'af_sarah', 'am_michael', 'bf_isabella', 'am_eric'];

function workerUrl(name) { return new URL(`./workers/${name}`, import.meta.url); }

// A tiny request/response wrapper around a worker.
function rpc(worker) {
  let n = 0;
  const pending = new Map();
  const listeners = new Set();
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.id != null && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.type === 'error') reject(new Error(m.message)); else resolve(m);
    }
    for (const fn of listeners) fn(m);
  };
  worker.onerror = (e) => { for (const fn of listeners) fn({ type: 'error', message: e.message || 'worker failed' }); };
  return {
    call(msg, transfer) { const id = ++n; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker.postMessage({ ...msg, id }, transfer || []); }); },
    send(msg) { worker.postMessage(msg); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    terminate() { worker.terminate(); for (const { reject } of pending.values()) reject(new Error('stopped')); pending.clear(); },
  };
}

function loadModel(w, msg, onProgress, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { off(); reject(new Error('model download timed out')); }, timeoutMs);
    const off = w.on((m) => {
      if (m.type === 'progress' && onProgress) onProgress(m);
      if (m.type === 'ready') { clearTimeout(t); off(); resolve(); }
      if (m.type === 'error' && m.id == null) { clearTimeout(t); off(); reject(new Error(m.message)); }
    });
    w.send(msg);
  });
}

// Overall download progress from Transformers.js progress events (one per file).
export function progressTracker(onPct) {
  const files = new Map();
  return (m) => {
    if (m.file && Number.isFinite(m.total) && m.total > 0) files.set(m.file, { loaded: m.loaded || 0, total: m.total });
    if (m.status === 'done' && m.file && files.has(m.file)) files.get(m.file).loaded = files.get(m.file).total;
    let a = 0, b = 0;
    for (const f of files.values()) { a += f.loaded; b += f.total; }
    if (b) onPct(Math.round((a / b) * 100), Math.round(b / 1048576));
  };
}

// ---------------- microphone with voice-activity detection ----------------
// Calls onInterim while you talk (a quick partial transcript every few seconds), onFinal per phrase, onPause after silence.
export async function createLocalMic({ win = globalThis, memory = 'normal', pauseMs = 1800, onInterim, onFinal, onPause, onState, onError, onProgress, onLevel, makeWorker } = {}) {
  const w = rpc(makeWorker ? makeWorker('stt') : new Worker(workerUrl('stt-worker.js'), { type: 'module' }));
  await loadModel(w, { type: 'load', model: STT_MODELS[memory] || STT_MODELS.normal, dtype: 'q8', threads: 2 }, onProgress);

  let ctx = null, stream = null, node = null, src = null;
  let wanted = false, muted = false;
  let lastHeard = 0, pauseFired = true, timer = 0;
  const RATE = 16000;
  const WIN = 480; // 30 ms
  let buf = []; // Float32Array chunks of the current phrase
  let bufLen = 0;
  let pre = []; // 300 ms of audio before speech starts
  let speaking = false, quietMs = 0, loudWins = 0, noise = 0.004, lastPartialAt = 0, busy = false;
  let carry = new Float32Array(0);
  let levelTick = 0;

  const PROC = `class P extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('pitcher-tap',P)`;

  const join = (chunks, len) => { const out = new Float32Array(len); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out; };

  async function transcribe(audio, partial) {
    if (busy && partial) return;
    busy = true;
    try {
      const r = await w.call({ type: 'transcribe', audio, partial }, [audio.buffer]);
      if (!r.text) return;
      if (partial) onInterim?.(r.text);
      else { lastHeard = Date.now(); pauseFired = false; onFinal?.(r.text); }
    } catch (e) { onError?.(`Local speech recognition failed: ${e.message}`); } finally { busy = false; }
  }

  function endPhrase() {
    const audio = join(buf, bufLen);
    buf = []; bufLen = 0; speaking = false; quietMs = 0;
    if (audio.length > RATE * 0.35) transcribe(audio, false);
  }

  function onSamples(chunk) {
    if (muted) return;
    let data = new Float32Array(carry.length + chunk.length);
    data.set(carry); data.set(chunk, carry.length);
    let i = 0;
    for (; i + WIN <= data.length; i += WIN) {
      const win = data.subarray(i, i + WIN);
      let e = 0; for (let k = 0; k < win.length; k++) e += win[k] * win[k];
      const rms = Math.sqrt(e / win.length);
      if (onLevel && (levelTick = (levelTick + 1) % 3) === 0) onLevel(Math.min(1, rms * 12));
      const thr = Math.max(0.012, noise * 3.2);
      const loud = rms > thr;
      if (!speaking) {
        noise = noise * 0.97 + Math.min(rms, 0.05) * 0.03;
        pre.push(win.slice(0)); if (pre.length > 10) pre.shift();
        loudWins = loud ? loudWins + 1 : 0;
        if (loudWins >= 3) { speaking = true; buf = [...pre]; bufLen = pre.reduce((s, x) => s + x.length, 0); pre = []; lastHeard = Date.now(); pauseFired = false; }
      } else {
        buf.push(win.slice(0)); bufLen += win.length;
        quietMs = loud ? 0 : quietMs + 30;
        if (loud) { lastHeard = Date.now(); pauseFired = false; }
        if (quietMs >= 650 || bufLen >= RATE * 12) endPhrase();
        else if (bufLen >= RATE * 2.5 && Date.now() - lastPartialAt > 2500) { lastPartialAt = Date.now(); transcribe(join(buf, bufLen), true); }
      }
    }
    carry = data.slice(i);
  }

  const tick = () => { if (!pauseFired && lastHeard && !speaking && Date.now() - lastHeard >= pauseMs) { pauseFired = true; onPause?.(Date.now() - lastHeard); } };

  return {
    kind: 'whisper',
    async start() {
      if (wanted) return;
      wanted = true; muted = false;
      try {
        stream = await win.navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        ctx = new win.AudioContext({ sampleRate: RATE });
        await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([PROC], { type: 'text/javascript' })));
        src = ctx.createMediaStreamSource(stream);
        node = new win.AudioWorkletNode(ctx, 'pitcher-tap');
        node.port.onmessage = (e) => onSamples(e.data);
        src.connect(node);
        clearInterval(timer); timer = setInterval(tick, 250);
        onState?.('listening');
      } catch (e) {
        wanted = false;
        onError?.(e.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in the address bar, or type instead.' : `Could not open the microphone: ${e.message}`);
        onState?.('off');
      }
    },
    stop() {
      wanted = false; clearInterval(timer);
      if (speaking) endPhrase();
      try { src?.disconnect(); node?.disconnect(); } catch { /* already gone */ }
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close(); ctx = null; stream = null;
      onState?.('off');
    },
    mute(on) { if (on === muted) return; muted = on; if (on) { buf = []; bufLen = 0; speaking = false; } if (wanted) onState?.(on ? 'muted' : 'listening'); },
    get listening() { return wanted && !muted; },
    silentFor: () => (lastHeard ? Date.now() - lastHeard : 0),
    destroy() { this.stop(); w.terminate(); },
  };
}

// ---------------- crowd voices ----------------
export async function createLocalVoices({ win = globalThis, onProgress, makeWorker } = {}) {
  const w = rpc(makeWorker ? makeWorker('tts') : new Worker(workerUrl('tts-worker.js'), { type: 'module' }));
  await loadModel(w, { type: 'load', dtype: 'q8' }, onProgress);
  let current = null;
  const others = new Map();
  const voiceFor = (id) => {
    if (KOKORO_VOICES[id]) return KOKORO_VOICES[id];
    if (!others.has(id)) others.set(id, EXPERT_VOICES[others.size % EXPERT_VOICES.length]);
    return others.get(id);
  };
  return {
    kind: 'kokoro',
    async speak(id, text) {
      const r = await w.call({ type: 'speak', text, voice: voiceFor(id), speed: id === 'hype' ? 1.08 : 1 });
      const url = URL.createObjectURL(r.blob);
      await new Promise((resolve) => {
        const a = new win.Audio(url);
        current = a;
        const done = () => { URL.revokeObjectURL(url); if (current === a) current = null; resolve(); };
        a.onended = done; a.onerror = done;
        a.play().catch(done);
      });
    },
    cancel() { if (current) { current.pause(); current = null; } },
    destroy() { w.terminate(); },
  };
}
