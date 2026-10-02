import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import { createOrdelyServer } from '../src/server.js';

async function fixture(t, extra = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ordely-test-'));
  const instance = createOrdelyServer({ env: {}, dataFile: path.join(directory, 'database.json'), ...extra });
  await new Promise(resolve => instance.server.listen(0, '127.0.0.1', resolve));
  const port = instance.server.address().port;
  t.after(async () => {
    for (const ws of instance.wss.clients) ws.terminate();
    await new Promise(resolve => instance.server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { ...instance, url: `http://127.0.0.1:${port}`, wsURL: `ws://127.0.0.1:${port}/voice`, dataFile: path.join(directory, 'database.json') };
}
async function connect(t, url) {
  const ws = new WebSocket(url), queue = [], pending = [];
  ws.on('message', (raw,binary) => {
    const message = binary ? { type: 'binary', buffer: raw } : JSON.parse(raw.toString());
    const waiter = pending.find(w => w.predicate(message));
    if (waiter) { pending.splice(pending.indexOf(waiter),1); clearTimeout(waiter.timer); waiter.resolve(message); }
    else queue.push(message);
  });
  ws.on('error',()=>{});
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  t.after(()=>ws.terminate());
  return {
    ws, send: message => ws.send(typeof message === 'string' ? message : JSON.stringify(message)),
    wait: (type, filter = () => true) => {
      const predicate = message => message.type === type && filter(message);
      const index = queue.findIndex(predicate);
      if(index !== -1) return Promise.resolve(queue.splice(index,1)[0]);
      return new Promise((resolve,reject)=>{
        const waiter={predicate,resolve};
        waiter.timer=setTimeout(()=>{pending.splice(pending.indexOf(waiter),1);reject(new Error(`Timeout ${type}; reçus : ${queue.map(m=>m.type+':'+(m.code||'')).join(',')}`));},2500);
        pending.push(waiter);
      });
    }
  };
}
const start = (client, extra = {}) => client.send({ type:'start', orderId:'ORD-DEMO-MULTI',mode:'browser',language:'fr-FR', ...extra });

test('HTTP : page unique, santé, configuration sans secrets',async t=>{
  const f=await fixture(t,{env:{DEEPGRAM_API_KEY:'DEEP-SECRET',ELEVENLABS_API_KEY:'ELEVEN-SECRET',ELEVENLABS_VOICE_ID:'demo'}});
  assert.equal((await fetch(f.url+'/health')).status,200);
  const config=await(await fetch(f.url+'/api/config')).text();assert.ok(!config.includes('DEEP-SECRET'));assert.ok(!config.includes('ELEVEN-SECRET'));
  assert.match(await(await fetch(f.url)).text(),/Conversation en direct/);
  assert.equal((await fetch(f.url+'/.env')).status,404);
  assert.equal((await fetch(f.url+'/server.js')).status,404);
});
test('HTTP : commande enrichie, total et produits',async t=>{
  const f=await fixture(t);const order=await(await fetch(f.url+'/api/orders/ORD-DEMO-MULTI')).json();
  assert.equal(order.total,3598);assert.equal(order.items[0].product.name,'Huawei P30 Pro');
  assert.equal((await fetch(f.url+'/api/orders/unknown')).status,404);
});
test('WS : attendre ready puis salut, aucun setTimeout approximatif',async t=>{
  const f=await fixture(t), c=await connect(t,f.wsURL);await c.wait('connected');start(c);
  assert.equal((await c.wait('session_ready')).mode,'browser');assert.match((await c.wait('assistant')).text,/Bonjour Ahmed/);
});
test('WS : JSON invalide ne tue pas le serveur',async t=>{
  const f=await fixture(t), c=await connect(t,f.wsURL);c.send('{broken');assert.equal((await c.wait('error')).code,'invalid_json');start(c);await c.wait('session_ready');
  assert.equal((await fetch(f.url+'/health')).status,200);
});
test('WS : phrase avant démarrage refusée',async t=>{const f=await fixture(t),c=await connect(t,f.wsURL);c.send({type:'user',text:'oui'});assert.equal((await c.wait('error')).code,'not_ready');});
test('WS : commande inconnue refusée, puis nouvelle tentative autorisée',async t=>{const f=await fixture(t),c=await connect(t,f.wsURL);start(c,{orderId:'bad'});assert.equal((await c.wait('error')).code,'start_failed');start(c);await c.wait('session_ready');});
test('WS : double démarrage refusé',async t=>{const f=await fixture(t),c=await connect(t,f.wsURL);start(c);await c.wait('session_ready');start(c);assert.equal((await c.wait('error')).code,'already_started');});
test('WS : état complet après modification et persistance JSON',async t=>{
  const f=await fixture(t),c=await connect(t,f.wsURL);start(c);await c.wait('session_ready');await c.wait('assistant');
  c.send({type:'user',id:'u1',text:'retire Oppo'});await c.wait('user_final');const result=await c.wait('assistant');
  assert.equal(result.order.total,2799);assert.equal(result.order.items[0].product.name,'Huawei P30 Pro');
  assert.equal(JSON.parse(fs.readFileSync(f.dataFile)).orders[0].items.length,1);
});
test('WS : phrase dupliquée avec même id exécutée une seule fois',async t=>{
  const f=await fixture(t),c=await connect(t,f.wsURL);start(c);await c.wait('session_ready');await c.wait('assistant');
  c.send({type:'user',id:'same',text:'annuler la commande'});await c.wait('assistant');
  c.send({type:'user',id:'same',text:'oui'});c.send({type:'user',id:'next',text:'prix'});const answer=await c.wait('assistant');assert.equal(answer.order.status,'NEW');
});
test('WS : streaming sans clés échoue clairement',async t=>{const f=await fixture(t),c=await connect(t,f.wsURL);start(c,{mode:'streaming'});assert.match((await c.wait('error')).message,/non configuré/);});
test('WS : interruption streaming annule la production et conserve le contexte',async t=>{
  const stt=new EventEmitter();stt.start=async()=>{};stt.close=()=>{};stt.sendAudio=()=>{};const signals=[];
  const tts=async({signal,onChunk})=>{signals.push(signal);await onChunk(Buffer.alloc(480));await new Promise(resolve=>{if(signal.aborted)resolve();else signal.addEventListener('abort',resolve,{once:true});});};
  const f=await fixture(t,{env:{DEEPGRAM_API_KEY:'mock',ELEVENLABS_API_KEY:'mock',ELEVENLABS_VOICE_ID:'mock'},sttFactory:()=>stt,tts});
  const c=await connect(t,f.wsURL);start(c,{mode:'streaming'});await c.wait('session_ready');const initial=await c.wait('assistant');
  await c.wait('audio_begin');const binary=await c.wait('binary');assert.equal(binary.buffer.readUInt32LE(0),1);assert.equal(binary.buffer.length,484);
  stt.emit('speech_start');assert.equal((await c.wait('interrupted')).id,initial.id);assert.equal(signals[0].aborted,true);
  stt.emit('interim',{id:'stt-1',text:'change mon adresse'});await c.wait('user_interim');
  stt.emit('final',{id:'stt-1',text:'change mon adresse'});const answer=await c.wait('assistant');assert.equal(answer.state.topic,'address_new');assert.equal(answer.order.status,'NEW');
});
test('HTTP : reset de démo limité à l’origine du site',async t=>{
  const f=await fixture(t);assert.equal((await fetch(f.url+'/api/demo/reset',{method:'POST',headers:{Origin:'https://example.invalid'}})).status,403);
  assert.equal((await fetch(f.url+'/api/demo/reset',{method:'POST'})).status,200);
});
test('WS : origine étrangère refusée',async t=>{
  const f=await fixture(t);const status=await new Promise(resolve=>{const ws=new WebSocket(f.wsURL,{origin:'https://evil.invalid'});ws.on('error',()=>{});ws.on('unexpected-response',(_req,response)=>{response.resume();resolve(response.statusCode);ws.terminate();});});assert.equal(status,403);
});

test('WS : origine réécrite par un hébergeur proxyfié acceptée',async t=>{
  const f=await fixture(t);
  const status=await new Promise(resolve=>{
    const ws=new WebSocket(f.wsURL,{origin:'https://ordely-demo.onrender.com',headers:{'x-forwarded-host':'ordely-demo.onrender.com','x-forwarded-proto':'https'}});
    ws.on('error',()=>{});
    ws.on('open',()=>{resolve(101);ws.terminate();});
    ws.on('unexpected-response',(_req,response)=>{response.resume();resolve(response.statusCode);ws.terminate();});
  });
  assert.equal(status,101);
});
