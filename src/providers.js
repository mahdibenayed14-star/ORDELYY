import WebSocket from 'ws';
import { EventEmitter } from 'node:events';

export class DeepgramSTT extends EventEmitter {
  constructor({ key, model = 'nova-3', language = 'ar-TN', WebSocketClass = WebSocket, url = 'wss://api.deepgram.com/v1/listen' }) {
    super(); this.options = { key, model, language, WebSocketClass, url };
    this.parts = []; this.segments = new Set(); this.utterance = 1; this.closed = false;
  }
  get currentId() { return `stt-${this.utterance}`; }
  async start() {
    const { key, model, language, WebSocketClass, url } = this.options;
    const endpoint = new URL(url);
    for (const [k, v] of Object.entries({ model, language, encoding: 'linear16', sample_rate: 16000, channels: 1,
      interim_results: true, vad_events: true, endpointing: 650, utterance_end_ms: 1200, punctuate: true, smart_format: true })) endpoint.searchParams.set(k, String(v));
    const ws = this.ws = new WebSocketClass(endpoint, { headers: { Authorization: `Token ${key}` }, handshakeTimeout: 12000 });
    await new Promise((resolve, reject) => {
      let ready = false;
      this.connectTimer = setTimeout(() => { reject(new Error('Le service de transcription ne répond pas.')); ws.terminate(); }, 13000);
      ws.on('open', () => {
        clearTimeout(this.connectTimer); ready = true;
        if (this.closed) { ws.close(); reject(new Error('Session arrêtée.')); return; }
        this.keepAlive = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'KeepAlive' })); }, 8000);
        this.keepAlive.unref?.(); resolve();
      });
      ws.on('unexpected-response', (_request, response) => {
        response.resume(); clearTimeout(this.connectTimer);
        const error = new Error(`Deepgram a refusé la connexion (${response.statusCode}). Vérifiez la clé, les crédits et le modèle/langue.`);
        reject(error); ws.terminate();
      });
      ws.on('error', () => {
        clearTimeout(this.connectTimer);
        const error = new Error('Connexion Deepgram impossible. Vérifiez la configuration et le réseau du serveur.');
        if (!ready) reject(error); else if (!this.closed) this.emit('fault', error);
      });
      ws.on('close', () => {
        clearInterval(this.keepAlive); clearTimeout(this.connectTimer);
        if (!ready) reject(new Error('Connexion Deepgram fermée avant le démarrage.'));
        else if (!this.closed) this.emit('fault', new Error('Le service de transcription a fermé la connexion.'));
      });
      ws.on('message', raw => {
        if (this.closed) return;
        try { this.accept(JSON.parse(raw.toString())); } catch { /* message inconnu, pas de crash */ }
      });
    });
  }
  accept(message) {
    if (message.type === 'Error') { this.emit('fault', new Error('Erreur du service Deepgram. Vérifiez le modèle, la langue et les crédits.')); return; }
    if (message.type === 'SpeechStarted') { this.emit('speech_start'); return; }
    if (message.type === 'UtteranceEnd') { this.flush(); return; }
    if (message.type !== 'Results') return;
    const text = message.channel?.alternatives?.[0]?.transcript?.trim() || '';
    if (message.is_final && text) {
      const key = `${message.start}:${message.duration}:${text}`;
      if (!this.segments.has(key)) { this.parts.push(text); this.segments.add(key); }
    }
    const partial = [...this.parts, !message.is_final ? text : ''].filter(Boolean).join(' ');
    if (partial) this.emit('interim', { id: this.currentId, text: partial.slice(0, 2000) });
    if (message.speech_final) this.flush();
  }
  flush() {
    if (!this.parts.length) return;
    const final = { id: this.currentId, text: this.parts.join(' ').slice(0, 2000) };
    this.parts = []; this.segments.clear(); this.utterance += 1;
    this.emit('final', final);
  }
  sendAudio(buffer) { if (!this.closed && this.ws?.readyState === WebSocket.OPEN) this.ws.send(buffer, { binary: true }); }
  close() {
    this.closed = true; clearInterval(this.keepAlive); clearTimeout(this.connectTimer);
    if (this.ws?.readyState === WebSocket.OPEN) { this.ws.send(JSON.stringify({ type: 'CloseStream' })); this.ws.close(); }
    else if (this.ws?.readyState === WebSocket.CONNECTING) this.ws.terminate();
  }
}

export async function streamSpeech({ key, voiceId, model = 'eleven_turbo_v2_5', text, language = 'ar-TN', signal, onChunk,
  fetchImpl = fetch, baseURL = 'https://api.elevenlabs.io/v1' }) {
  const timeout = AbortSignal.timeout(45000), combinedSignal = AbortSignal.any([signal, timeout].filter(Boolean));
  const url = `${baseURL}/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=pcm_24000`;
  const response = await fetchImpl(url, { method: 'POST', signal: combinedSignal,
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/pcm' },
    body: JSON.stringify({ text, model_id: model, language_code: language.startsWith('fr') ? 'fr' : 'ar' }) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`ElevenLabs a refusé la voix (${response.status}). Vérifiez la clé, les crédits, l’identifiant de voix et l’accès au PCM 24 kHz.`);
  }
  if (!response.body) throw new Error('Le service vocal a renvoyé un flux audio vide.');
  let carry = Buffer.alloc(0), total = 0;
  for await (const bytes of response.body) {
    combinedSignal.throwIfAborted();
    const chunk = carry.length ? Buffer.concat([carry, Buffer.from(bytes)]) : Buffer.from(bytes);
    const end = chunk.length - chunk.length % 2;
    carry = chunk.subarray(end);
    total += end;
    if (total > 24000 * 2 * 120) throw new Error('Flux audio trop long : arrêt de sécurité.');
    if (end) await onChunk(chunk.subarray(0, end));
  }
  if (!total) throw new Error('Le service vocal n’a produit aucun audio.');
}
