import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepgramSTT, streamSpeech } from '../src/providers.js';
test('STT : provisoire, segments finaux, une seule phrase métier', () => {
  const stt=new DeepgramSTT({key:'mock'}), interim=[], final=[];
  stt.on('interim',m=>interim.push(m)); stt.on('final',m=>final.push(m));
  const result=(text,is_final=false,speech_final=false,start=0)=>stt.accept({type:'Results',is_final,speech_final,start,duration:.5,channel:{alternatives:[{transcript:text}]}});
  result('change'); result('change mon adresse',true); result('à Tunis',false,false,1); result('à Tunis',true,true,1);
  stt.accept({type:'UtteranceEnd'});
  assert.equal(final.length,1); assert.equal(final[0].text,'change mon adresse à Tunis'); assert.ok(interim.length>=3);
});
test('STT : résultats finaux dupliqués non exécutés deux fois', () => {
  const stt=new DeepgramSTT({key:'mock'}), final=[]; stt.on('final',m=>final.push(m));
  const event={type:'Results',is_final:true,start:0,duration:1,channel:{alternatives:[{transcript:'oui'}]}};
  stt.accept(event); stt.accept(event); stt.accept({type:'UtteranceEnd'}); assert.equal(final[0].text,'oui');
});
test('STT : SpeechStarted déclenche l’interruption', () => { const stt=new DeepgramSTT({key:'mock'}); let count=0; stt.on('speech_start',()=>count++); stt.accept({type:'SpeechStarted'}); assert.equal(count,1); });
test('TTS : chunks impairs réassemblés, PCM complet et paramètres corrects', async () => {
  const out=[], requests=[];
  const fetchImpl=async(url,options)=>{requests.push({url,options}); return new Response(new ReadableStream({start(controller){controller.enqueue(Uint8Array.from([1,2,3]));controller.enqueue(Uint8Array.from([4,5,6,7,8]));controller.close();}}));};
  await streamSpeech({key:'not-a-real-key',voiceId:'demo',text:'Bonjour',language:'fr-FR',onChunk:chunk=>out.push(chunk),fetchImpl});
  assert.deepEqual([...Buffer.concat(out)],[1,2,3,4,5,6,7,8]); assert.ok(out.every(c=>c.length%2===0));
  assert.match(requests[0].url,/output_format=pcm_24000/); assert.equal(JSON.parse(requests[0].options.body).language_code,'fr');
});
test('TTS : refus fournisseur explicite, pas de faux succès', async () => { await assert.rejects(()=>streamSpeech({key:'mock',voiceId:'demo',text:'x',onChunk:()=>{},fetchImpl:async()=>new Response('unauthorized',{status:401})}),/401/); });
test('TTS : flux vide refusé', async () => { await assert.rejects(()=>streamSpeech({key:'mock',voiceId:'demo',text:'x',onChunk:()=>{},fetchImpl:async()=>new Response(new Uint8Array())}),/aucun audio/); });
