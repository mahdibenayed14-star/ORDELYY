import { PCMResampler, toPCM16, VoiceActivityDetector } from './audio-utils.js';
class OrdelyMic extends AudioWorkletProcessor {
  constructor() {
    super();
    this.resampler = new PCMResampler(sampleRate, 16000);
    this.vad = new VoiceActivityDetector(); this.frames = []; this.tick = 0;
    this.streaming = false; this.outputPlaying = false; this.muted = false;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'configure') {
        this.streaming = !!data.streaming; this.outputPlaying = !!data.outputPlaying;
        if (!!data.muted !== this.muted) { this.frames = []; this.resampler = new PCMResampler(sampleRate, 16000); }
        this.muted = !!data.muted;
        if (data.threshold) this.vad.threshold = data.threshold;
      }
    };
  }
  process(inputs, outputs) {
    // Le micro ne doit JAMAIS être renvoyé dans le haut-parleur.
    for (const output of outputs) for (const channel of output) channel.fill(0);
    const input = inputs[0]?.[0];
    if (!input) return true;
    const level = this.vad.process(input, sampleRate, this.outputPlaying);
    this.tick += input.length;
    if (this.tick >= sampleRate / 10) { this.tick = 0; this.port.postMessage({ type: 'level', ...level }); }
    if (!this.muted && level.event) this.port.postMessage({ type: level.event });
    if (this.streaming) {
      const samples = this.resampler.push(this.muted ? new Float32Array(input.length) : input);
      for (const sample of samples) {
        this.frames.push(sample);
        if (this.frames.length === 320) {
          const buffer = toPCM16(this.frames); this.frames = [];
          this.port.postMessage({ type: 'pcm', buffer }, [buffer]);
        }
      }
    }
    return true;
  }
}
registerProcessor('ordely-mic', OrdelyMic);
