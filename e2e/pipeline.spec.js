import { test, expect } from '@playwright/test';
import { mockVoice } from './helpers.js';

test('AudioWorklet réel : niveau audio mesuré, aucun sidetone et micro libéré',async({page})=>{
  await mockVoice(page,{realAudio:true});await page.goto('/?local=1');await page.locator('#start').click();
  await expect(page.locator('#captureStatus')).toHaveText('ON');
  await expect.poll(async()=>Number(await page.locator('#meter').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  expect(await page.locator('#eventLog').textContent()).not.toContain('capture compatible');
  await page.locator('#stop').click();expect(await page.evaluate(()=>window.__track.readyState)).toBe('ended');
});
test('page téléphone autonome : aucune API ni ressource externe',async({page})=>{
  await mockVoice(page);const requests=[];page.on('request',request=>requests.push(request.url()));
  await page.goto('/telephone/');await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#start').click();await expect(page.locator('.message.assistant')).toHaveCount(1);
  await expect(page.locator('#recognitionStatus')).toHaveText('ÉCOUTE');
  expect(requests.some(url=>url.includes('/api/')||url.includes('/demo-data.json')||url.includes('/assets/'))).toBe(false);
  expect(requests.filter(url=>!url.startsWith('http://localhost:10000/')&&!url.startsWith('data:')&&!url.startsWith('blob:'))).toHaveLength(0);
});
test('page téléphone autonome : worklet intégré en Blob réellement exécutable',async({page})=>{
  await mockVoice(page,{realAudio:true});await page.goto('/telephone/');await page.locator('#start').click();
  await expect(page.locator('#captureStatus')).toHaveText('ON');
  await expect.poll(async()=>Number(await page.locator('#meter').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  expect(await page.locator('#eventLog').textContent()).not.toContain('capture compatible');
});
test('mode serveur gratuit : ready, salut, texte utilisateur et réponse',async({page})=>{
  await mockVoice(page);await page.goto('/');await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#language').selectOption('fr-FR');await page.locator('#start').click();
  await expect(page.locator('.message.assistant')).toHaveCount(1);
  await expect(page.locator('#sessionMode')).toContainText('commandes serveur');
  await page.evaluate(()=>window.__emitRecognition('prix',true));
  await expect(page.locator('.message.assistant')).toHaveCount(2);
  await expect(page.locator('.message.user')).toHaveCount(1);
});
test('PCM : audio_done attend la fin réelle des sources, pas le dernier chunk réseau',async({page})=>{
  await mockVoice(page);await page.goto('/?local=1');
  const result=await page.evaluate(async()=>{
    const {VoiceIO}=await import('/assets/voice.js');const io=new VoiceIO();io.unlock();io.beginAudio('a1',1,24000);
    io.queuePCM(new Int16Array([1,2,3,4]).buffer,1);io.finishAudio(1);
    const before=io.outputPlaying;window.__sources.at(-1).onended();const after=io.outputPlaying;io.stop();return {before,after};
  });expect(result).toEqual({before:true,after:false});
});
test('PCM : interruption purge toutes les sources, les anciens chunks sont ignorés',async({page})=>{
  await mockVoice(page);await page.goto('/?local=1');
  const result=await page.evaluate(async()=>{
    const {VoiceIO}=await import('/assets/voice.js');const io=new VoiceIO();io.unlock();io.beginAudio('a1',1,24000);
    io.queuePCM(new Int16Array([1,2,3,4]).buffer,1);const oldSource=window.__sources.at(-1);
    io.stopOutput();io.beginAudio('a2',2,24000);const count=window.__sources.length;
    io.queuePCM(new Int16Array([1,2,3,4]).buffer,1);
    const result={noResurrection:oldSource.onended===null,oldChunkIgnored:window.__sources.length===count};io.stop();return result;
  });expect(result).toEqual({noResurrection:true,oldChunkIgnored:true});
});
test('erreur réseau STT : reprises bornées, relance manuelle possible',async({page})=>{
  await mockVoice(page);await page.goto('/?local=1');await page.locator('#start').click();
  await expect(page.locator('#recognitionStatus')).toHaveText('ÉCOUTE');
  await page.evaluate(()=>{const rec=window.__recognizers.at(-1);for(let i=0;i<3;i++)rec.onerror({error:'network'});rec.onend();});
  await expect(page.locator('#recognitionStatus')).toHaveText('BLOQUÉE');
  await page.locator('#resumeListening').click();await expect(page.locator('#recognitionStatus')).toHaveText('ÉCOUTE');
});

test('serveur vocal injoignable : bascule autonome, la démo ne s’arrête jamais',async({page})=>{
  await mockVoice(page);
  await page.routeWebSocket(/\/voice$/,ws=>ws.close());
  await page.goto('/');await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#start').click();
  await expect(page.locator('.message.assistant')).toHaveCount(1);
  await expect(page.locator('#errorText')).toContainText('Serveur vocal injoignable');
  await expect(page.locator('#sessionMode')).toContainText('sur ce téléphone');
  await page.locator('#input').fill('prix');await page.locator('#send').click();
  await expect(page.locator('.message.assistant')).toHaveCount(2);
});
