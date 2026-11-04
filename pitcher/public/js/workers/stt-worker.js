// Speech-to-text in a worker: Whisper (open source) via Transformers.js, running locally on the CPU.
// Messages in:  {type:'load', model, dtype, threads} | {type:'transcribe', id, audio: Float32Array (16 kHz mono), partial}
// Messages out: {type:'progress', ...} | {type:'ready'} | {type:'text', id, text, partial} | {type:'error', message}
import { env, pipeline } from '../../vendor/transformers.min.js';

env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = new URL('../../vendor/', import.meta.url).href;

let asr = null;
// Whisper invents these on silence or noise; never treat them as speech.
const JUNK = /^\s*(?:\[[^\]]*\]|\([^)]*\)|thank you\.?|thanks for watching\.?|you|bye\.?|\.+)\s*$/i;

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      env.backends.onnx.wasm.numThreads = m.threads || 2;
      asr = await pipeline('automatic-speech-recognition', m.model, {
        dtype: m.dtype || 'q8', device: 'wasm',
        progress_callback: (p) => self.postMessage({ type: 'progress', ...p }),
      });
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'transcribe') {
      if (!asr) throw new Error('model not loaded');
      const out = await asr(m.audio, { chunk_length_s: 30 });
      const text = String(out.text || '').replace(/\s+/g, ' ').trim();
      self.postMessage({ type: 'text', id: m.id, text: JUNK.test(text) ? '' : text, partial: !!m.partial });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String(err?.message || err) });
  }
};
