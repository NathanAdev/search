// Text-to-speech in a worker: Kokoro-82M (open source, Apache-2.0) via kokoro-js, running locally.
// Messages in:  {type:'load', dtype} | {type:'speak', id, text, voice, speed}
// Messages out: {type:'progress', ...} | {type:'ready', voices} | {type:'audio', id, blob} | {type:'error', id, message}
import { KokoroTTS, env } from '../../vendor/kokoro.web.js';

env.wasmPaths = new URL('../../vendor/', import.meta.url).href;
let tts = null;

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: m.dtype || 'q8', device: 'wasm',
        progress_callback: (p) => self.postMessage({ type: 'progress', ...p }),
      });
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'speak') {
      if (!tts) throw new Error('voice model not loaded');
      const audio = await tts.generate(m.text, { voice: m.voice || 'af_heart', speed: m.speed || 1 });
      self.postMessage({ type: 'audio', id: m.id, blob: audio.toBlob() });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String(err?.message || err) });
  }
};
