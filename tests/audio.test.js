import test from 'node:test';
import assert from 'node:assert/strict';
import { PCMResampler, toPCM16, VoiceActivityDetector } from '../public/assets/audio-utils.js';
for (const rate of [44100,48000,16000]) test(`rééchantillonnage ${rate} → 16000, sans dérive de blocs`, () => {
  const resampler = new PCMResampler(rate); let count=0;
  for(let offset=0;offset<rate;offset+=128) count+=resampler.push(new Float32Array(Math.min(128,rate-offset)).fill(.25)).length;
  assert.equal(count,16000);
});
test('PCM little-endian et saturation', () => { const data=new DataView(toPCM16([-2,0,2])); assert.equal(data.getInt16(0,true),-32768); assert.equal(data.getInt16(2,true),0); assert.equal(data.getInt16(4,true),32767); });
test('VAD ignore le bruit faible et une impulsion brève', () => { const vad=new VoiceActivityDetector(); assert.equal(vad.process(new Float32Array(480).fill(.003),48000).event,null); assert.equal(vad.process(new Float32Array(480).fill(.1),48000).event,null); assert.equal(vad.process(new Float32Array(480),48000).event,null); });
test('VAD détecte la voix après 120 ms et la fin après 400 ms', () => { const vad=new VoiceActivityDetector(); let event; for(let i=0;i<12;i++) event=vad.process(new Float32Array(480).fill(.1),48000).event; assert.equal(event,'speech_start'); for(let i=0;i<40;i++) event=vad.process(new Float32Array(480),48000).event; assert.equal(event,'speech_end'); });
test('VAD garde un seuil plus élevé pendant la lecture pour limiter l’écho', () => { const vad=new VoiceActivityDetector(); const normal=vad.process(new Float32Array(480),48000).threshold; const playing=vad.process(new Float32Array(480),48000,true).threshold; assert.ok(playing>normal); });
