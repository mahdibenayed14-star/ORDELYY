#!/usr/bin/env node
// Vérifie un déploiement Ordely de bout en bout.
//
//   node scripts/verifier-deploiement.mjs                                   → http://localhost:10000
//   node scripts/verifier-deploiement.mjs https://ordely-demo.onrender.com  → serveur Node
//   node scripts/verifier-deploiement.mjs https://compte.github.io/ordely   → page GitHub Pages
//
// Deux modes détectés automatiquement :
//   • serveur Node : page + API + WebSocket /voice (démarrage réel de l’agent, français et derja)
//   • site statique (GitHub Pages) : page + ressources + langue, la voix tournant dans le navigateur
// Ce script doit fonctionner même sans « npm install » : la bibliothèque de WebSocket est
// optionnelle, et le contrôle vocal est simplement ignoré si elle est absente.
let WebSocketImplementation = globalThis.WebSocket;
try { WebSocketImplementation = (await import('ws')).default; } catch { /* repli sur le WebSocket global */ }

const base = (process.argv[2] || 'http://localhost:10000').replace(/\/+$/, '');
const httpTimeout = 25000;
const results = [];
const line = (mark, label, detail = '') => { results.push(mark === '✅'); console.log(`${mark} ${label}${detail ? ` — ${detail}` : ''}`); };
const ok = (label, detail) => line('✅', label, detail);
const bad = (label, detail) => line('❌', label, detail);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(path, timeout = httpTimeout) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(base + path, { signal: controller.signal, cache: 'no-store', redirect: 'follow' });
    return { status: response.status, type: response.headers.get('content-type') || '', body: await response.text(), url: response.url };
  } finally { clearTimeout(timer); }
}
async function attempt(path, retries = 2, delay = 12000) {
  let last;
  for (let index = 0; index <= retries; index++) {
    try { return await request(path); }
    catch (error) {
      last = error;
      if (index < retries) console.log(`   … nouvelle tentative dans ${delay / 1000} s (un service gratuit en veille peut mettre ~1 min à démarrer)`);
      if (index < retries) await wait(delay);
    }
  }
  throw last;
}
function checkVoice(language, timeout = 30000) {
  if (!WebSocketImplementation) return Promise.resolve({ ok: false, unavailable: true, reason: 'bibliothèque WebSocket absente : exécutez « npm install » pour ce contrôle' });
  const socketURL = base.replace(/^http/, 'ws') + '/voice';
  return new Promise(resolve => {
    const events = [], socket = new WebSocketImplementation(socketURL, { handshakeTimeout: timeout });
    const finish = result => { clearTimeout(timer); try { socket.terminate(); } catch { /* déjà fermé */ } resolve({ ...result, events }); };
    const timer = setTimeout(() => finish({ ok: false, reason: `aucune réponse en ${timeout / 1000} s` }), timeout);
    socket.on('open', () => socket.send(JSON.stringify({ type: 'start', orderId: 'ORD-DEMO-MULTI', mode: 'browser', language })));
    socket.on('message', raw => {
      let message; try { message = JSON.parse(raw.toString()); } catch { return; }
      events.push(message.type);
      if (message.type === 'error') finish({ ok: false, reason: `${message.code} : ${message.message}` });
      if (message.type === 'assistant') finish({ ok: true, text: message.text });
    });
    socket.on('error', error => finish({ ok: false, reason: error.message }));
    socket.on('unexpected-response', (_request, response) => { response.resume(); finish({ ok: false, reason: `HTTP ${response.statusCode} sur /voice (proxy, chemin ou hébergement statique)` }); });
  });
}

console.log(`\nVérification de ${base}\n${'─'.repeat(64)}`);
let mode = 'inconnu', pageHTML = '', streaming = false, version = null;

// 1. Serveur Node ?
try {
  const health = await attempt('/health', 1, 8000);
  if (health.status === 200 && health.type.includes('application/json')) {
    const data = JSON.parse(health.body);
    if (data.ok) { mode = 'serveur'; version = data.version; streaming = /streaming/.test(String(data.mode)); }
  }
} catch { /* probablement un site statique */ }

// 2. Page servie (dans les deux modes)
try {
  const page = await attempt('/', 1, 4000);
  pageHTML = page.body;
  if (page.status === 200 && /Ordely/.test(pageHTML)) {
    const ancienne = /Ordely V9|Conversation tunisienne/.test(pageHTML);
    if (ancienne) bad('Page servie', 'c’est encore l’ancienne version (V9) : republiez les fichiers corrigés');
    else ok('Page servie', `${Math.round(Buffer.byteLength(pageHTML) / 1024)} Ko${/DÉMO V10|Ordely V10/.test(pageHTML) ? ', version V10 confirmée' : ''}`);
  } else bad('Page servie', `HTTP ${page.status} ou contenu inattendu`);
} catch (error) { bad('Page servie', error.name === 'AbortError' ? 'pas de réponse (déploiement en cours ou URL incorrecte)' : error.message); }

if (mode === 'inconnu' && /Ordely/.test(pageHTML)) mode = 'statique';

if (mode === 'serveur') {
  console.log('   hébergement détecté : serveur Node.js');
  if (version) {
    if (String(version).startsWith('10.')) ok('Santé du service', `version ${version}, streaming ${streaming ? 'configuré' : 'inactif (mode gratuit)'}`);
    else bad('Version déployée', `attendu 10.x, reçu ${version} — le déploiement n’est pas à jour`);
  }
  try {
    const config = await request('/api/config');
    if (config.status === 200) ok('API de configuration', streaming ? 'mode streaming disponible' : 'mode gratuit seul (aucune clé)');
    else bad('API de configuration', `HTTP ${config.status}`);
  } catch (error) { bad('API de configuration', error.message); }
  try {
    const orders = await request('/api/orders');
    const list = orders.status === 200 ? JSON.parse(orders.body) : null;
    if (Array.isArray(list)) ok('Commandes de démonstration', `${list.length} commandes côté serveur`);
    else bad('Commandes de démonstration', `HTTP ${orders.status}`);
  } catch (error) { bad('Commandes de démonstration', error.message); }
  for (const [label, language] of [['français', 'fr-FR'], ['derja', 'ar-TN']]) {
    const result = await checkVoice(language);
    if (result.ok) ok(`Démarrage vocal en ${label}`, label === 'derja' ? `« ${String(result.text).slice(0, 56)}… »` : result.events.join(' → '));
    else if (result.unavailable) console.log(`ℹ️  Démarrage vocal en ${label} : ignoré (${result.reason})`);
    else bad(`Démarrage vocal en ${label}`, result.reason);
  }
} else if (mode === 'statique') {
  console.log('   hébergement détecté : site statique (GitHub Pages ou équivalent) — la voix tourne dans le navigateur');
  // Détection empirique : une page multi-fichiers répond sur assets/app.js, pas la version autonome.
  let multiFile = false;
  try { multiFile = (await request('/assets/app.js', 10000)).status === 200; } catch { /* considéré comme autonome */ }
  if (!multiFile) {
    ok('Page autonome', 'fichier unique : aucune ressource externe à charger');
    if (/__ORDELY_SEED__/.test(pageHTML)) ok('Données de démonstration', 'incluses dans la page');
    else bad('Données de démonstration', 'graine absente du fichier unique');
    if (/(?:src|href)="https?:\/\//i.test(pageHTML)) bad('Ressources externes', 'la page dépend d’un fichier externe : la publication est incomplète');
  } else {
    for (const asset of ['assets/app.js', 'assets/voice.js', 'assets/order-engine.js', 'assets/transport.js', 'assets/audio-utils.js', 'assets/mic-worklet.js', 'assets/styles.css', 'demo-data.json']) {
      try {
        const file = await request('/' + asset, 10000);
        if (file.status === 200) ok(`Ressource ${asset}`, `${Math.round(Buffer.byteLength(file.body) / 1024)} Ko`);
        else bad(`Ressource ${asset}`, `HTTP ${file.status} — fichier manquant sur l’hébergement`);
      } catch (error) { bad(`Ressource ${asset}`, error.message); }
    }
  }
  const voice = await checkVoice('fr-FR', 8000);
  if (voice.ok) ok('WebSocket /voice', 'présent : serveur Node détecté derrière la page');
  else console.log('ℹ️  Pas de serveur vocal : normal sur un hébergement statique. La page bascule d’elle-même en mode autonome (reconnaissance du navigateur).');
  const https = base.startsWith('https://') || /^localhost|^127\./.test(base.replace(/^https?:\/\//, ''));
  if (https) ok('Contexte sécurisé', 'HTTPS/localhost : le microphone sera autorisé');
  else bad('Contexte sécurisé', 'le micro est refusé en http:// : publiez en HTTPS');
} else {
  bad('Hébergement', 'aucune page Ordely détectée à cette adresse');
}

const passed = results.filter(Boolean).length, total = results.length;
console.log(`${'─'.repeat(64)}\nRésultat : ${passed}/${total} contrôles réussis (${mode})`);
if (passed < total) {
  console.log(`
Pistes selon le contrôle en échec :
  • Page servie échoue   → l’URL est incorrecte, le déploiement n’est pas terminé, ou le site publié est l’ancienne version.
  • Ressource manquante  → le dossier assets/ et demo-data.json doivent être publiés avec index.html (pas seulement la page).
  • Santé/API en échec   → hébergez le projet complet en Node (Render) ; GitHub Pages ne sert que la page statique.
  • Démarrage vocal KO   → vérifiez que npm start tourne en local, ou que le service Render est réveillé (plan gratuit).
  • HTTPS en échec       → le microphone exige https:// sur téléphone (GitHub Pages ou Render le fournissent).`);
}
console.log(passed === total ? '✅ Déploiement conforme : vous pouvez faire l’essai sur téléphone.' : '⚠️  Corrigez les points ci-dessus avant la démonstration.');
process.exitCode = passed === total ? 0 : 1;
