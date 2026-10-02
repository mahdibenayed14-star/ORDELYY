import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const utils = fs.readFileSync(new URL('../public/assets/audio-utils.js',import.meta.url),'utf8').replace(/^export /gm,'');
const worklet = fs.readFileSync(new URL('../public/assets/mic-worklet.js',import.meta.url),'utf8').replace(/^import .*\n/,'');
function setup(){
  const messages=[],state={};
  const context={sampleRate:48000,AudioWorkletProcessor:class{constructor(){this.port={postMessage:message=>messages.push(message)};}},registerProcessor:(name,Processor)=>{state.name=name;state.Processor=Processor;}};
  vm.runInNewContext(utils+'\n'+worklet,context);
  return {processor:new state.Processor(),messages,state};
}
test('worklet : signal de sortie toujours nul, pas de retour micro au haut-parleur',()=>{
  const {processor}=setup(), output=new Float32Array(128).fill(1);
  assert.equal(processor.process([[new Float32Array(128).fill(.4)]],[[output]]),true);
  assert.ok(output.every(x=>x===0));
});
test('worklet : mode gratuit mesure sans exporter le PCM',()=>{
  const {processor,messages}=setup();for(let i=0;i<50;i++)processor.process([[new Float32Array(128).fill(.05)]],[[new Float32Array(128)]]);
  assert.ok(messages.some(m=>m.type==='level'));assert.ok(!messages.some(m=>m.type==='pcm'));
});
test('worklet : flux 16k mono, blocs de 20ms PCM16',()=>{
  const {processor,messages}=setup();processor.port.onmessage({data:{type:'configure',streaming:true}});
  for(let i=0;i<12;i++)processor.process([[new Float32Array(128).fill(.05)]],[[new Float32Array(128)]]);
  const chunks=messages.filter(m=>m.type==='pcm');assert.equal(chunks.length,1);assert.equal(chunks[0].buffer.byteLength,640);
});
test('worklet : micro coupé exporte seulement du silence en streaming',()=>{
  const {processor,messages}=setup();processor.port.onmessage({data:{type:'configure',streaming:true,muted:true}});
  for(let i=0;i<12;i++)processor.process([[new Float32Array(128).fill(.5)]],[[new Float32Array(128)]]);
  const pcm=new Int16Array(messages.find(m=>m.type==='pcm').buffer);assert.ok(pcm.every(x=>x===0));
});
