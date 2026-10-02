import { test, expect } from '@playwright/test';
import { mockVoice } from './helpers.js';

test('le micro n’est pas ouvert au chargement ; démarrage auto du salut', async ({page})=>{
  await mockVoice(page); await page.goto('/?local=1');
  await expect(page.locator('#start')).toBeEnabled();
  expect(await page.evaluate(()=>window.__voiceLog)).not.toContain('recognition.start');
  await page.locator('#start').click();
  await expect(page.locator('.message.assistant')).toHaveCount(1);
  await expect(page.locator('#recognitionStatus')).toHaveText('ÉCOUTE');
  const settings=await page.evaluate(()=>({continuous:window.__recognizers[0].continuous,interim:window.__recognizers[0].interimResults}));
  expect(settings).toEqual({continuous:true,interim:true});
  await expect(page.locator('#stop')).toBeEnabled();
});
test('parole sans bouton : provisoire puis final, sans doublon',async({page})=>{
  await mockVoice(page);await page.goto('/?local=1');await page.locator('#start').click();
  await expect(page.locator('#recognitionStatus')).toHaveText('ÉCOUTE');
  await page.evaluate(()=>window.__emitRecognition('قداش',false));
  await expect(page.locator('.message.user.partial .message-body')).toHaveText('قداش');
  await page.evaluate(()=>window.__emitRecognition('قداش المجموع',true));
  await expect(page.locator('.message.user:not(.partial)')).toHaveCount(1);
  await expect(page.locator('.message.assistant')).toHaveCount(2);
  await expect(page.locator('.message.user')).toHaveCount(1);
});
test('interrompre coupe le TTS immédiatement mais pas la reconnaissance',async({page})=>{
  await mockVoice(page);await page.goto('/?local=1');await page.locator('#start').click();
  await expect(page.locator('#outputStatus')).toHaveText('PARLE');
  const before=await page.evaluate(()=>window.__voiceLog.filter(x=>x==='recognition.abort'||x==='recognition.stop').length);
  await page.evaluate(()=>window.__speechStart());
  await expect(page.locator('.message.assistant')).toHaveClass(/interrupted/);
  await expect(page.locator('#outputStatus')).toHaveText('INTERROMPU');
  expect(await page.evaluate(()=>window.__voiceLog.filter(x=>x==='recognition.abort'||x==='recognition.stop').length)).toBe(before);
  await page.evaluate(()=>window.__emitRecognition('l’adresse a changé',true));
  await expect(page.locator('.message.assistant')).toHaveCount(2);
  await expect(page.locator('#recognitionStatus')).toHaveText('ÉCOUTE');
});
test('la reconnaissance se relance après onend',async({page})=>{
  await mockVoice(page);await page.goto('/?local=1');await page.locator('#start').click();
  await expect(page.locator('#recognitionStatus')).toHaveText('ÉCOUTE');
  await page.evaluate(()=>window.__recognizers.at(-1).onend());
  await expect.poll(()=>page.evaluate(()=>window.__recognizers.length)).toBe(2);
  await expect(page.locator('#recognitionStatus')).toHaveText('ÉCOUTE');
});
test('permission refusée : diagnostic précis et conversation texte maintenue',async({page})=>{
  await mockVoice(page,{denied:true});await page.goto('/?local=1');await page.locator('#start').click();
  await expect(page.locator('#errorText')).toContainText('Micro refusé');
  await expect(page.locator('.message.assistant')).toHaveCount(1);
  await page.locator('#input').fill('prix');await page.locator('#send').click();
  await expect(page.locator('.message.assistant')).toHaveCount(2);
  await expect(page.locator('#captureStatus')).toHaveText('OFF');
});
test('reconnaissance absente : pas de faux état écoute',async({page})=>{
  await mockVoice(page,{recognition:false});await page.goto('/?local=1');await page.locator('#start').click();
  await expect(page.locator('#recognitionStatus')).toHaveText('ABSENTE');
  await expect(page.locator('#errorText')).toContainText('Reconnaissance vocale absente');
  await page.evaluate(()=>window.__finishSpeech());
  await expect(page.locator('#status')).toContainText('texte');
});
test('arrêter pendant la permission tardive libère aussi le micro',async({page})=>{
  await mockVoice(page,{delayedMicrophone:true});await page.goto('/?local=1');await page.locator('#start').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__allowMicrophone)).toBe('function');
  await page.locator('#stop').click();await page.evaluate(()=>window.__allowMicrophone());
  await expect.poll(()=>page.evaluate(()=>window.__track.readyState)).toBe('ended');
  await expect(page.locator('#captureStatus')).toHaveText('OFF');
  await expect(page.locator('.message.assistant')).toHaveCount(0);
});
test('arrêt final libère capture et reconnaissance',async({page})=>{
  await mockVoice(page);await page.goto('/?local=1');await page.locator('#start').click();
  await expect(page.locator('#recognitionStatus')).toHaveText('ÉCOUTE');await page.locator('#stop').click();
  await expect(page.locator('#captureStatus')).toHaveText('OFF');
  expect(await page.evaluate(()=>window.__track.readyState)).toBe('ended');
  await expect(page.locator('#start')).toBeEnabled();
});
test('texte français : changements et persistance locale après recharge',async({page})=>{
  await mockVoice(page);await page.goto('/?local=1');await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#language').selectOption('fr-FR');await page.locator('#textOnly').click();
  await page.locator('#input').fill('retire Oppo');await page.locator('#send').click();
  await expect(page.locator('#products .product')).toHaveCount(1);
  await expect(page.locator('#total')).toContainText('2');
  await page.locator('#stop').click();await page.reload();
  await expect(page.locator('#products .product')).toHaveCount(1);
});
test('affichage mobile sans débordement horizontal',async({page})=>{
  await mockVoice(page);await page.goto('/?local=1');await expect(page.locator('#start')).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
