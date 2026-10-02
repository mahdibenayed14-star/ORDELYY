import { OrderEngine } from './order-engine.js';
const id = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
class Transport extends EventTarget {
  message(data) { this.dispatchEvent(new CustomEvent('message', { detail: data })); }
}
export class LocalTransport extends Transport {
  constructor(database, onChange = () => {}) { super(); this.engine = new OrderEngine(database); this.onChange = onChange; }
  async start({ orderId, language }) {
    this.session = this.engine.session(orderId, language); this.ready = true;
    this.message({ type: 'session_ready', mode: 'browser', state: this.session, order: this.engine.view(orderId) });
    const result = this.engine.greeting(this.session);
    this.message({ type: 'assistant', id: id('a'), ...result });
  }
  user(text, messageId) {
    if (!this.ready) throw new Error('Conversation non démarrée.');
    const result = this.engine.turn(this.session, text);
    if (result.changed) this.onChange(this.engine.db);
    this.message({ type: 'user_final', id: messageId, text });
    this.message({ type: 'assistant', id: id('a'), ...result });
  }
  interrupt() { /* la lecture est locale ; le contexte métier ne change pas */ }
  setAudio() {}
  sendAudio() { return false; }
  close() { this.ready = false; }
}
export class SocketTransport extends Transport {
  constructor(voicePath = 'voice') { super(); this.voicePath = voicePath; this.intentionalClose = false; }
  start(options) {
    const url = new URL(this.voicePath, document.baseURI);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(url); this.socket.binaryType = 'arraybuffer';
    const socket = this.socket;
    return new Promise((resolve, reject) => {
      this.rejectStart = reject;
      this.startTimer = setTimeout(() => { reject(new Error('Le serveur vocal n’a pas répondu à temps. Réessayez ; un hébergement gratuit peut être en veille.')); this.close(); }, 22000);
      socket.onopen = () => { if (!this.intentionalClose) socket.send(JSON.stringify({ type: 'start', ...options })); };
      socket.onmessage = ({ data }) => {
        if (this.intentionalClose) return;
        if (typeof data !== 'string') { this.message({ type: 'audio', buffer: data }); return; }
        let message;
        try { message = JSON.parse(data); } catch { return; }
        if (message.type === 'session_ready') {
          clearTimeout(this.startTimer); this.ready = true; this.rejectStart = null;
          this.message(message); resolve(); return;
        }
        if (message.type === 'error' && !this.ready) { clearTimeout(this.startTimer); reject(new Error(message.message)); }
        this.message(message);
      };
      socket.onerror = () => {
        if (!this.ready) { clearTimeout(this.startTimer); reject(new Error('Connexion au serveur impossible. Vérifiez l’URL HTTPS et le déploiement Node, pas GitHub Pages pour le streaming.')); }
      };
      socket.onclose = event => {
        clearTimeout(this.startTimer);
        const wasReady = this.ready; this.ready = false;
        if (this.intentionalClose) return;
        // Échec de démarrage : c'est la promesse start() qui décide de la suite
        // (bascule autonome côté application), jamais un message de déconnexion.
        if (!wasReady) { reject(new Error('Connexion fermée avant que la conversation soit prête.')); return; }
        this.message({ type: 'disconnected', code: event.code, message: event.code === 4008 ? 'Les commandes de démo ont été réinitialisées.' : 'Connexion fermée. Appuyez sur Démarrer pour reprendre. Aucun redémarrage silencieux.' });
      };
    });
  }
  send(message) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) throw new Error('Connexion non prête. Redémarrez la conversation.');
    this.socket.send(JSON.stringify(message));
  }
  user(text, id) { this.send({ type: 'user', text, id }); }
  interrupt() { if (this.ready) { try { this.send({ type: 'interrupt' }); } catch { /* fermeture simultanée */ } } }
  setAudio(enabled) { if (this.ready) { try { this.send({ type: 'set_audio', enabled }); } catch { /* fermeture simultanée */ } } }
  sendAudio(buffer) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return false;
    if (this.socket.bufferedAmount > 256 * 1024) return false;
    try { this.socket.send(buffer); return true; } catch { return false; }
  }
  close() {
    this.intentionalClose = true; clearTimeout(this.startTimer);
    this.rejectStart?.(new Error('Démarrage interrompu.')); this.rejectStart = null;
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'stop' }));
    this.socket?.close(); this.ready = false;
  }
}
