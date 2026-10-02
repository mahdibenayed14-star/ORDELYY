// Rééchantillonnage continu : aucune dérive entre les blocs 44,1 / 48 kHz.
export class PCMResampler {
  constructor(inputRate, outputRate = 16000) {
    if (inputRate < outputRate || outputRate <= 0) throw new Error('Fréquences non prises en charge.');
    this.ratio = inputRate / outputRate;
    this.remaining = this.ratio; this.sum = 0; this.weight = 0;
  }
  push(input) {
    const output = [];
    for (const sample of input) {
      let available = 1;
      while (available > 1e-9) {
        const take = Math.min(available, this.remaining);
        this.sum += sample * take; this.weight += take;
        this.remaining -= take; available -= take;
        if (this.remaining < 1e-9) {
          output.push(Math.max(-1, Math.min(1, this.sum / this.weight)));
          this.remaining = this.ratio; this.sum = 0; this.weight = 0;
        }
      }
    }
    return Float32Array.from(output);
  }
}
export function toPCM16(input) {
  const buffer = new ArrayBuffer(input.length * 2), view = new DataView(buffer);
  input.forEach((sample, i) => { const x = Math.max(-1, Math.min(1, sample)); view.setInt16(i * 2, Math.round(x * (x < 0 ? 32768 : 32767)), true); });
  return buffer;
}
export class VoiceActivityDetector {
  constructor({ threshold = 0.018, attackMs = 120, releaseMs = 400 } = {}) {
    this.threshold = threshold; this.attackMs = attackMs; this.releaseMs = releaseMs;
    this.noise = 0.001; this.attack = 0; this.silence = 0; this.speaking = false;
  }
  process(input, rate, outputPlaying = false) {
    const rms = Math.sqrt(input.reduce((sum, x) => sum + x * x, 0) / Math.max(input.length, 1));
    const duration = input.length / rate * 1000;
    const threshold = Math.max(this.threshold * (outputPlaying ? 1.5 : 1), this.noise * 3.5);
    let event = null;
    if (rms > threshold) {
      this.attack += duration; this.silence = 0;
      if (!this.speaking && this.attack >= this.attackMs) { this.speaking = true; event = 'speech_start'; }
    } else {
      this.attack = 0; this.silence += duration;
      if (!this.speaking && !outputPlaying) this.noise = this.noise * 0.98 + Math.min(rms, this.threshold) * 0.02;
      if (this.speaking && this.silence >= this.releaseMs) { this.speaking = false; event = 'speech_end'; }
    }
    return { rms, threshold, speaking: this.speaking, event };
  }
}
