import { PCMResampler, toPCM16, VoiceActivityDetector } from './audio-utils.js';
import { normalize } from './order-engine.js';

export class VoiceIO extends EventTarget {
  constructor() {
    super();
    this.context = null; this.stream = null; this.node = null; this.source = null;
    this.recognition = null; this.recognitionActive = false; this.recognitionWanted = false;
    this.sessionActive = false; this.mode = 'browser'; this.language = 'ar-TN'; this.muted = false;
    this.outputPlaying = false; this.outputEpoch = 0; this.sources = new Set();
    this.pendingFinal = []; this.interim = ''; this.seenFinal = new Set(); this.generation = 0;
    this.threshold = 0.018; this.streamingReady = false; this.lastSpokenText = '';
    this.retryCount = 0; this.blocked = false; this.lastOutputEnd = 0; this.captureEpoch = 0;
    this.nativeOnly = false; this.monitorFallbackTried = false;
  }
  emit(type, detail = {}) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  get supportsRecognition() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  get supportsSynthesis() { return !!window.speechSynthesis && !!window.SpeechSynthesisUtterance; }
  // Appelé directement par le clic, AVANT les opérations asynchrones/permissions.
  unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext && !this.context) this.context = new AudioContext();
    this.context?.resume().catch(() => {});
    if (this.supportsSynthesis && !this.primed) {
      this.primed = true;
      const utterance = new SpeechSynthesisUtterance(' ');
      utterance.volume = 0;
      speechSynthesis.speak(utterance);
    }
  }
  async openMicrophone() {
    if (!window.isSecureContext) throw new Error('Le micro exige une URL HTTPS sur téléphone. Une adresse http://192.168… ne convient pas.');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Micro indisponible dans ce navigateur ou cette fenêtre. Ouvrez le lien dans Chrome/Safari, hors navigateur intégré.');
    if (this.stream?.getAudioTracks().some(t => t.readyState === 'live')) return;
    this.unlock();
    if (!this.context) throw new Error('Web Audio est indisponible. Le mode texte reste utilisable.');
    const context = this.context, captureEpoch = ++this.captureEpoch;
    await context.resume();
    if (captureEpoch !== this.captureEpoch || context !== this.context) return;
    let requestedStream;
    try {
      requestedStream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1
      }, video: false });
    } catch (error) {
      const messages = {
        NotAllowedError: 'Micro refusé. Autorisez le micro dans les réglages du site et du téléphone, puis réessayez.',
        NotFoundError: 'Aucun microphone détecté. Vérifiez le casque ou le périphérique sélectionné.',
        NotReadableError: 'Micro occupé ou inaccessible. Fermez les autres appels/applications utilisant le micro.',
        AbortError: 'Ouverture du micro interrompue. Réessayez.'
      };
      throw new Error(messages[error.name] || `Impossible d’ouvrir le micro : ${error.message}`);
    }
    if (captureEpoch !== this.captureEpoch || context !== this.context) {
      requestedStream.getTracks().forEach(track => track.stop()); return;
    }
    const stream = this.stream = requestedStream;
    this.nativeOnly = false;
    this.source = context.createMediaStreamSource(stream);
    try {
      if (!context.audioWorklet || !window.AudioWorkletNode) throw new Error('AudioWorklet indisponible');
      if (!this.workletLoaded) {
        const workletURL = globalThis.__ORDELY_WORKLET_URL__ || new URL('./mic-worklet.js', import.meta.url);
        await context.audioWorklet.addModule(workletURL);
        this.workletLoaded = true;
      }
      // Arrêt demandé pendant le dialogue d'autorisation ou le chargement du worklet.
      if (this.stream !== stream) return;
      this.node = new AudioWorkletNode(this.context, 'ordely-mic');
      this.node.port.onmessage = ({ data }) => this.handleMicrophone(data);
    } catch (error) {
      if (this.stream !== stream) return;
      // Compatibilité anciens Safari. Le signal de sortie reste toujours muet.
      this.emit('notice', { message: 'AudioWorklet indisponible : capture compatible utilisée.' });
      const resampler = new PCMResampler(this.context.sampleRate), vad = new VoiceActivityDetector({ threshold: this.threshold });
      this.node = this.context.createScriptProcessor(2048, 1, 1);
      this.node.onaudioprocess = event => {
        event.outputBuffer.getChannelData(0).fill(0);
        const input = event.inputBuffer.getChannelData(0);
        vad.threshold = this.threshold;
        const level = vad.process(input, this.context.sampleRate, this.outputPlaying);
        this.handleMicrophone({ type: 'level', ...level });
        if (!this.muted && level.event) this.handleMicrophone({ type: level.event });
        if (this.mode === 'streaming' && this.streamingReady) this.handleMicrophone({ type: 'pcm', buffer: toPCM16(resampler.push(this.muted ? new Float32Array(input.length) : input)) });
      };
    }
    this.source.connect(this.node);
    this.silentGain = this.context.createGain(); this.silentGain.gain.value = 0;
    this.node.connect(this.silentGain); this.silentGain.connect(this.context.destination);
    for (const track of stream.getAudioTracks()) track.onended = () => {
      if (this.stream === stream) {
        this.stopRecognition(); this.emit('error', { message: 'Le micro a été déconnecté. Rebranchez-le puis activez le micro.' });
      }
    };
    this.configure();
    this.emit('microphone', { state: 'ready', device: stream.getAudioTracks()[0]?.label || 'Micro autorisé' });
  }
  handleMicrophone(data) {
    if (data.type === 'level') this.emit('level', { ...data, rms: this.muted ? 0 : data.rms });
    if (data.type === 'pcm' && this.sessionActive && this.streamingReady) this.emit('pcm', { buffer: data.buffer });
    if (data.type === 'speech_start' && this.sessionActive && !this.muted) this.emit('speech_start', { source: 'local-vad' });
    if (data.type === 'speech_end' && this.sessionActive && !this.muted) this.emit('speech_end');
  }
  configure() {
    this.node?.port?.postMessage({ type: 'configure', streaming: this.mode === 'streaming' && this.streamingReady,
      outputPlaying: this.outputPlaying, muted: this.muted, threshold: this.threshold });
  }
  enableListening(mode = 'browser', language = 'ar-TN') {
    this.mode = mode; this.language = language; this.sessionActive = true;
    this.blocked = false; this.retryCount = 0; this.muted = false; this.monitorFallbackTried = false;
    this.configure();
    if (mode === 'browser' && this.stream) { this.recognitionWanted = true; this.startRecognition(); }
    else this.emit('recognition', { state: mode === 'streaming' ? 'streaming' : 'text' });
  }
  setStreamingReady(value) { this.streamingReady = value; this.configure(); }
  likelyEcho(text) {
    if (!this.outputPlaying && Date.now() - this.lastOutputEnd > 900) return false;
    const input = normalize(text).split(' ').filter(Boolean), answer = normalize(this.lastSpokenText).split(' ');
    // Une réponse courte comme « oui » ne doit jamais être filtrée.
    return input.length >= 4 && input.filter(w => answer.includes(w)).length / input.length > 0.85;
  }
  startRecognition() {
    if (!this.sessionActive || this.muted || this.blocked || !this.recognitionWanted || this.recognition) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      this.blocked = true;
      this.emit('recognition', { state: 'unavailable' });
      this.emit('error', { message: 'Reconnaissance vocale absente. Essayez Chrome sur Android ou Safari sur iPhone. Le micro et le mode texte peuvent fonctionner sans transcription.' });
      return;
    }
    const recognition = new Recognition(), generation = ++this.generation;
    this.recognition = recognition;
    recognition.lang = this.language; recognition.continuous = true; recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    this.emit('recognition', { state: 'starting' });
    recognition.onstart = () => {
      if (this.recognition !== recognition) return;
      this.recognitionActive = true; this.emit('recognition', { state: 'listening' });
    };
    recognition.onspeechstart = () => {
      if (this.sessionActive && !this.muted) this.emit('speech_start', { source: 'recognizer' });
    };
    recognition.onresult = event => {
      if (!this.sessionActive || this.muted || this.recognition !== recognition) return;
      this.retryCount = 0; clearTimeout(this.finalTimer);
      const finals = [], partials = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i], text = result[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) {
          const key = `${generation}:${i}`;
          if (!this.seenFinal.has(key)) { this.seenFinal.add(key); finals.push(text); }
        } else partials.push(text);
      }
      const recognized = [...finals, ...partials].join(' ');
      if (recognized && this.likelyEcho(recognized)) {
        this.emit('notice', { message: 'Écho probable ignoré. Un casque améliore le test d’interruption.' });
        return;
      }
      this.pendingFinal.push(...finals); this.interim = partials.join(' ');
      const text = [...this.pendingFinal, this.interim].filter(Boolean).join(' ').slice(0, 2000);
      if (text) {
        if (this.outputPlaying) this.emit('speech_start', { source: 'transcript' });
        this.emit('interim', { text });
      }
      if (this.pendingFinal.length && !this.interim) this.finalTimer = setTimeout(() => this.flushFinal(), 750);
    };
    recognition.onerror = event => {
      if (this.recognition !== recognition || !this.sessionActive || this.muted) return;
      if (['aborted', 'no-speech'].includes(event.error)) return;
      if (event.error === 'audio-capture' && this.stream && !this.monitorFallbackTried) {
        // Certains téléphones n'acceptent pas getUserMedia + SpeechRecognition
        // simultanément. Laisser alors le service natif posséder seul le micro.
        this.monitorFallbackTried = true; this.recognitionActive = false;
        this.closeMicrophone({ keepRecognition: true });
        this.emit('notice', { message: 'Partage du micro refusé : mesure RMS/VAD désactivée, relance en écoute native seule.' });
        this.emit('recognition', { state: 'restarting' });
        try { recognition.abort(); } catch {}
        return;
      }
      const messages = {
        'not-allowed': 'Reconnaissance refusée. Vérifiez les permissions micro du navigateur et du système.',
        'service-not-allowed': 'Le service vocal du navigateur est bloqué sur cet appareil. Essayez un autre navigateur ou le mode texte.',
        'audio-capture': 'La reconnaissance ne peut pas accéder au micro. Fermez les autres applications audio.',
        'language-not-supported': 'La langue ar-TN n’est pas acceptée par ce service. Essayez Français dans la liste des langues.',
        network: 'Le service de reconnaissance du navigateur est inaccessible. Vérifiez Internet ; la page gratuite utilise quand même un service vocal du navigateur.'
      };
      if (event.error === 'network') this.retryCount += 1;
      else this.blocked = true;
      if (this.retryCount >= 3) this.blocked = true;
      this.emit('error', { message: messages[event.error] || `Erreur de reconnaissance : ${event.error}` });
      this.emit('recognition', { state: this.blocked ? 'blocked' : 'restarting' });
    };
    recognition.onend = () => {
      if (this.recognition !== recognition) return;
      this.recognition = null; this.recognitionActive = false;
      if (this.pendingFinal.length && !this.finalTimer) this.finalTimer = setTimeout(() => this.flushFinal(), 750);
      if (this.sessionActive && this.recognitionWanted && !this.muted && !this.blocked) {
        this.emit('recognition', { state: 'restarting' });
        this.restartTimer = setTimeout(() => this.startRecognition(), this.retryCount ? 1500 : 350);
      } else this.emit('recognition', { state: this.blocked ? 'blocked' : this.muted ? 'muted' : 'off' });
    };
    try { recognition.start(); }
    catch (error) {
      this.recognition = null; this.blocked = true;
      this.emit('recognition', { state: 'blocked' });
      this.emit('error', { message: `L’écoute n’a pas démarré : ${error.message}. Appuyez sur « Relancer l’écoute ».` });
    }
  }
  flushFinal() {
    clearTimeout(this.finalTimer); this.finalTimer = null;
    if (!this.sessionActive || this.muted || !this.pendingFinal.length) return;
    const text = this.pendingFinal.join(' ').slice(0, 2000);
    this.pendingFinal = []; this.interim = '';
    this.emit('final', { text });
  }
  stopRecognition() {
    this.recognitionWanted = false; clearTimeout(this.restartTimer); clearTimeout(this.finalTimer); this.finalTimer = null;
    this.pendingFinal = []; this.interim = ''; this.seenFinal.clear();
    const recognition = this.recognition; this.recognition = null; this.recognitionActive = false;
    try { recognition?.abort(); } catch { /* déjà arrêtée */ }
    this.emit('recognition', { state: 'off' });
  }
  resumeRecognition() {
    // Une relance manuelle doit aussi débloquer un service qui n'a pas émis onend.
    this.stopRecognition();
    this.blocked = false; this.retryCount = 0; this.recognitionWanted = true;
    this.startRecognition();
  }
  setMuted(value) {
    this.muted = value;
    for (const track of this.stream?.getAudioTracks() || []) track.enabled = !value;
    if (value) this.stopRecognition();
    else if (this.mode === 'browser' && this.sessionActive) this.resumeRecognition();
    this.configure(); this.emit('microphone', { state: value ? 'muted' : this.nativeOnly ? 'native' : 'ready' });
  }
  async voices() {
    if (!this.supportsSynthesis) return [];
    const voices = speechSynthesis.getVoices();
    if (voices.length) return voices;
    return new Promise(resolve => {
      const done = () => { clearTimeout(timer); speechSynthesis.removeEventListener('voiceschanged', done); resolve(speechSynthesis.getVoices()); };
      const timer = setTimeout(done, 1200);
      speechSynthesis.addEventListener('voiceschanged', done);
    });
  }
  async speak(text, language, id) {
    this.stopOutput();
    if (!this.supportsSynthesis) {
      this.emit('error', { message: 'Synthèse vocale indisponible. La réponse de l’agent est affichée en texte.' });
      return;
    }
    const epoch = this.outputEpoch;
    this.currentResponseId = id; this.lastSpokenText = text; this.outputPlaying = true;
    this.configure(); this.emit('output', { state: 'preparing', id });
    const voices = await this.voices();
    if (epoch !== this.outputEpoch) return;
    const prefix = language.split('-')[0];
    const voice = voices.find(v => v.lang.toLowerCase() === language.toLowerCase()) || voices.find(v => v.lang.toLowerCase().startsWith(prefix));
    if (voices.length && !voice && prefix === 'ar') {
      this.endOutput(epoch);
      this.emit('error', { message: 'Aucune voix arabe installée sur ce téléphone. La réponse reste en texte. Essayez Français pour vérifier le son ; une voix ar-TN n’est pas garantie en mode gratuit.' });
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || language; if (voice) utterance.voice = voice;
    utterance.rate = 0.98; utterance.volume = 1;
    let started = false;
    utterance.onstart = () => {
      if (epoch !== this.outputEpoch) return;
      started = true; this.emit('output', { state: 'speaking', id, voice: voice?.name || 'Voix système' });
    };
    utterance.onboundary = event => {
      if (epoch === this.outputEpoch) this.emit('boundary', { id, index: event.charIndex });
    };
    utterance.onend = () => this.endOutput(epoch);
    utterance.onerror = event => {
      if (epoch !== this.outputEpoch) return;
      this.endOutput(epoch);
      if (!['interrupted', 'canceled'].includes(event.error)) this.emit('error', { message: `La voix n’a pas été lue (${event.error}). Testez le son et vérifiez le volume multimédia.` });
    };
    speechSynthesis.cancel(); speechSynthesis.speak(utterance);
    this.outputStartTimer = setTimeout(() => {
      if (epoch === this.outputEpoch && !started) {
        this.stopOutput();
        this.emit('error', { message: 'La lecture vocale n’a pas démarré. Appuyez sur « Tester le son », vérifiez le volume puis redémarrez.' });
      }
    }, 4500);
    this.outputMaxTimer = setTimeout(() => {
      if (epoch === this.outputEpoch && this.outputPlaying) {
        this.stopOutput(); this.emit('notice', { message: 'Lecture bloquée ou trop longue : arrêt de sécurité. Le micro reste actif.' });
      }
    }, Math.max(25000, text.length * 160));
  }
  beginAudio(id, audioId, sampleRate) {
    this.stopOutput(); this.currentResponseId = id; this.currentAudioId = audioId;
    this.audioRate = sampleRate; this.audioDone = false; this.nextAudioTime = 0;
    this.outputPlaying = true; this.configure(); this.emit('output', { state: 'preparing', id });
  }
  queuePCM(buffer, audioId) {
    if (!this.context || !this.outputPlaying || audioId !== this.currentAudioId || buffer.byteLength < 2 || buffer.byteLength % 2) return;
    const epoch = this.outputEpoch, pcm = new DataView(buffer);
    const audio = this.context.createBuffer(1, buffer.byteLength / 2, this.audioRate), data = audio.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = pcm.getInt16(i * 2, true) / 32768;
    const source = this.context.createBufferSource(); source.buffer = audio; source.connect(this.context.destination);
    this.nextAudioTime = Math.max(this.context.currentTime + 0.04, this.nextAudioTime);
    if (this.nextAudioTime - this.context.currentTime > 120) { this.stopOutput(); this.emit('error', { message: 'Trop d’audio en attente. Lecture interrompue.' }); return; }
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      if (epoch === this.outputEpoch && this.audioDone && !this.sources.size) this.endOutput(epoch);
    };
    source.start(this.nextAudioTime); this.nextAudioTime += audio.duration;
    this.emit('output', { state: 'speaking', id: this.currentResponseId });
  }
  finishAudio(audioId) {
    if (audioId !== this.currentAudioId) return;
    this.audioDone = true;
    // « Production terminée » n'est PAS « lecture terminée ».
    if (!this.sources.size) this.endOutput(this.outputEpoch);
  }
  endOutput(epoch) {
    if (epoch !== this.outputEpoch) return;
    clearTimeout(this.outputStartTimer); clearTimeout(this.outputMaxTimer);
    this.outputPlaying = false; this.lastOutputEnd = Date.now(); this.configure();
    this.emit('output', { state: 'idle', id: this.currentResponseId });
  }
  stopOutput() {
    const id = this.currentResponseId, wasPlaying = this.outputPlaying;
    this.outputEpoch += 1; clearTimeout(this.outputStartTimer); clearTimeout(this.outputMaxTimer);
    if (this.supportsSynthesis) speechSynthesis.cancel();
    for (const source of this.sources) { source.onended = null; try { source.stop(); } catch {} }
    this.sources.clear(); this.nextAudioTime = 0; this.currentAudioId = null; this.audioDone = true;
    this.outputPlaying = false; if (wasPlaying) this.lastOutputEnd = Date.now(); this.configure();
    if (wasPlaying) this.emit('output', { state: 'interrupted', id });
    // Surtout : ne PAS arrêter SpeechRecognition ici.
  }
  testSound() {
    this.unlock();
    if (!this.context) throw new Error('Lecture audio indisponible.');
    const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.connect(gain); gain.connect(this.context.destination);
    oscillator.frequency.value = 660; gain.gain.value = 0.12;
    oscillator.start(); oscillator.stop(this.context.currentTime + 0.28);
    return this.context.resume();
  }
  closeMicrophone({ keepRecognition = false } = {}) {
    this.captureEpoch += 1; this.nativeOnly = keepRecognition;
    if (!keepRecognition) this.stopRecognition();
    if (this.node?.port) { this.node.port.onmessage = null; this.node.port.close?.(); }
    if (this.node && 'onaudioprocess' in this.node) this.node.onaudioprocess = null;
    try { this.source?.disconnect(); this.node?.disconnect(); this.silentGain?.disconnect(); } catch {}
    for (const track of this.stream?.getTracks() || []) { track.onended = null; track.stop(); }
    this.stream = null; this.source = null; this.node = null; this.streamingReady = false;
    this.emit('level', { rms: 0 }); this.emit('microphone', { state: keepRecognition ? 'native' : 'off' });
  }
  stop() {
    this.sessionActive = false; this.closeMicrophone(); this.stopOutput();
    this.context?.close().catch(() => {}); this.context = null; this.workletLoaded = false; this.primed = false;
  }
}
