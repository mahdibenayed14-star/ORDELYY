import { OrderEngine, clone } from './order-engine.js';
import { VoiceIO } from './voice.js';
import { LocalTransport, SocketTransport } from './transport.js';

const $ = id => document.getElementById(id), voice = new VoiceIO();
const base = new URL('./', document.baseURI), storageKey = `ordely:v10:${base.pathname}`;
const uid = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
let seed, localDatabase, localEngine, transport, config = { backend: false, modes: { browser: true, streaming: false } };
let running = false, starting = false, initialized = false, ticket = 0, activeMode = 'browser';
let liveUserId = null, recognitionState = 'off', testingMic = false, micTestTimer, wakeLock;
let userSpeaking = false, sessionStorageOK = true, lastStreamDrop = 0;
const entries = new Map(), suppressed = new Set(), ignoredAudio = new Set(), events = [];
const statusLabels = { NEW: 'À CONFIRMER', CONFIRMED: 'CONFIRMÉE', CANCELLED: 'ANNULÉE', CALLBACK_REQUESTED: 'RAPPEL DEMANDÉ' };

function log(message) {
  events.push(`${new Date().toLocaleTimeString('fr-FR')}  ${message}`);
  if (events.length > 18) events.shift();
  $('eventLog').textContent = events.join('\n');
}
function setStatus(title, detail = '', state = 'ready') {
  $('status').textContent = title; $('statusDetail').textContent = detail; $('statusDot').dataset.state = state;
}
function error(message) {
  $('errorText').textContent = message; $('errorBox').hidden = false; log(message);
}
function listeningStatus() {
  if (!running) return;
  if (voice.muted) return setStatus('Micro coupé', 'Activez le micro pour reparler ; les messages texte restent disponibles.');
  if (activeMode === 'streaming' && voice.stream) return setStatus('À vous — Ordely écoute', 'Parlez sans bouton. Votre transcription apparaîtra au fil de la reconnaissance.', 'listening');
  if (voice.recognitionActive && !voice.blocked) return setStatus('À vous — Ordely écoute', 'Parlez sans bouton. Vous pouvez aussi interrompre la prochaine réponse.', 'listening');
  if (voice.stream && ['starting', 'restarting'].includes(recognitionState)) return setStatus('Micro ouvert — reconnaissance en démarrage', 'La barre mesure le micro ; attendez que la reconnaissance indique ÉCOUTE.', 'starting');
  setStatus('Conversation en texte disponible', 'La reconnaissance n’est pas active. Relancez l’écoute ou utilisez le champ texte.');
}
function renderOrder(order) {
  const customer = order.customer;
  $('customerName').textContent = customer.name; $('customerPhone').textContent = customer.phone;
  $('customerInitials').textContent = customer.name.split(' ').slice(0, 2).map(x => x[0]).join('');
  $('address').textContent = customer.address; $('altPhone').textContent = customer.altPhone || 'Non renseigné';
  $('orderState').textContent = statusLabels[order.status] || order.status;
  $('total').replaceChildren(document.createTextNode(order.total.toLocaleString('fr-FR') + ' '));
  const unit = document.createElement('small'); unit.textContent = 'DT'; $('total').append(unit);
  $('products').replaceChildren();
  for (const item of order.items) {
    const row = document.createElement('div'); row.className = 'product';
    const icon = document.createElement('span'); icon.className = 'product-icon'; icon.textContent = /casque/i.test(item.product.name) ? '◉' : /sneakers/i.test(item.product.name) ? '↗' : '▯';
    const details = document.createElement('div'), name = document.createElement('strong'), description = document.createElement('small');
    name.textContent = item.product.name;
    description.textContent = `${item.variant || ''}${item.size ? ` · taille ${item.size}` : ''} · quantité ${item.qty}`;
    details.append(name, description); row.append(icon, details); $('products').append(row);
  }
}
function bubble(role, text, id = uid(role), partial = false) {
  let entry = entries.get(id);
  const nearBottom = $('chat').scrollHeight - $('chat').scrollTop - $('chat').clientHeight < 90;
  if (!entry) {
    $('emptyChat')?.remove();
    const node = document.createElement('article'); node.className = `message ${role}`; node.dataset.id = id;
    const meta = document.createElement('div'); meta.className = 'meta';
    const who = document.createElement('strong'); who.textContent = role === 'user' ? 'VOUS' : role === 'assistant' ? 'ORDELY' : 'INFORMATION';
    const state = document.createElement('span'); state.className = 'message-state';
    const time = document.createElement('time'); time.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); time.dateTime = new Date().toISOString();
    meta.append(who, state, time);
    const body = document.createElement('div'); body.className = 'message-body'; body.dir = 'auto';
    node.append(meta, body); $('chat').append(node);
    entry = { id, role, text: '', node, body, state, time: time.dateTime, partial, interrupted: false }; entries.set(id, entry);
  }
  entry.text = text; entry.partial = partial; entry.body.textContent = text;
  entry.node.classList.toggle('partial', partial);
  entry.state.textContent = partial ? 'Transcription en cours…' : role === 'user' ? 'Reconnu / envoyé' : role === 'assistant' ? 'Réponse complète' : '';
  if (entry.interrupted) entry.state.textContent = 'Interrompu · texte de la réponse prévue';
  $('export').disabled = false;
  if (nearBottom || entries.size === 1) $('chat').scrollTop = $('chat').scrollHeight;
  return entry;
}
function markInterrupted(id) {
  const entry = entries.get(id);
  if (!entry || entry.role !== 'assistant') return;
  entry.interrupted = true; entry.node.classList.add('interrupted'); entry.state.textContent = 'Interrompu · texte de la réponse prévue';
}
function updateControls() {
  $('start').disabled = !initialized || starting || running;
  $('start').textContent = starting ? 'Connexion…' : '▶ Démarrer';
  $('textOnly').disabled = !initialized || starting || running;
  $('stop').disabled = !starting && !running;
  $('orders').disabled = !initialized || starting || running;
  $('mode').disabled = starting || running; $('language').disabled = starting || running;
  $('send').disabled = !initialized || starting;
  $('testMic').disabled = starting || running; $('testSound').disabled = false;
  $('micToggle').disabled = !running;
  $('micToggle').textContent = (voice.stream || voice.nativeOnly) ? voice.muted ? 'Activer' : 'Couper' : 'Activer micro';
  $('resumeListening').disabled = !running || activeMode !== 'browser' || (!voice.stream && !voice.nativeOnly) || voice.muted;
}
function refreshDiagnostics() {
  const rows = [
    ['Version', '10.0.0 · correction du 01/10/2026'],
    ['Contexte HTTPS', window.isSecureContext ? 'Oui (ou localhost autorisé)' : 'Non — micro bloqué sur téléphone'],
    ['Reconnaissance native', voice.supportsRecognition ? 'API présente ; service/langue à vérifier par un vrai essai' : 'Absente — mode texte ou serveur streaming'],
    ['Synthèse native', voice.supportsSynthesis ? 'API présente ; voix installées selon l’appareil' : 'Absente — réponse texte'],
    ['Capture', voice.nativeOnly ? 'Micro du service natif, mesure RMS/VAD désactivée (compatibilité téléphone)' : voice.stream ? voice.muted ? 'Périphérique ouvert, transmission coupée' : 'Micro ouvert, pas d’enregistrement conservé' : 'Arrêtée'],
    ['Reconnaissance', recognitionState],
    ['Connexion', config.backend ? transport?.ready ? 'WebSocket prêt' : 'Backend Node détecté' : 'Autonome — aucune connexion au serveur Ordely'],
    ['Persistance', config.backend ? 'Base JSON de démonstration sur le serveur' : sessionStorageOK ? 'Ce navigateur (localStorage)' : 'Mémoire seulement (stockage bloqué)'],
    ['Streaming facultatif', config.modes.streaming ? 'Configuré côté serveur — services externes' : 'Désactivé ; aucune clé requise pour le mode gratuit'],
    ['Réseau', navigator.onLine ? 'Connecté (le service vocal peut néanmoins être indisponible)' : 'Hors ligne — reconnaissance vocale non garantie'],
    ['Appareil', navigator.userAgent]
  ];
  $('diagnosticList').replaceChildren();
  for (const [label, value] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; $('diagnosticList').append(dt, dd); }
}
function storeDatabase(database) {
  localDatabase = database;
  try { localStorage.setItem(storageKey, JSON.stringify(database)); }
  catch { sessionStorageOK = false; log('Stockage local indisponible : modifications valables pour cette page seulement.'); }
  refreshDiagnostics();
}
async function requestJSON(relative, options = {}) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(new URL(relative, base), { cache: 'no-store', ...options, signal: controller.signal });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error(`Service indisponible (${response.status}).`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function loadOrders(selected) {
  const list = config.backend ? await requestJSON('api/orders') : localEngine.list();
  $('orders').replaceChildren();
  for (const order of list) {
    const option = document.createElement('option'); option.value = order.id;
    option.textContent = `${order.customer} · ${order.total.toLocaleString('fr-FR')} DT`;
    $('orders').append(option);
  }
  if (selected && list.some(o => o.id === selected)) $('orders').value = selected;
  await showSelectedOrder();
}
async function showSelectedOrder() {
  try { renderOrder(config.backend ? await requestJSON(`api/orders/${encodeURIComponent($('orders').value)}`) : localEngine.view($('orders').value)); }
  catch (fault) { error(fault.message); }
}
function transcriptId(message) { return message.id?.startsWith('stt-') ? `session-${ticket}-${message.id}` : message.id || liveUserId || uid('u'); }
function handleMessage(message) {
  if (message.type === 'session_ready') {
    running = true; starting = false; activeMode = message.mode;
    voice.enableListening(activeMode, $('language').value);
    if (activeMode === 'streaming') voice.setStreamingReady(true);
    renderOrder(message.order); updateControls(); refreshDiagnostics();
    log(`Session prête · ${activeMode} · ${$('language').value}`);
    listeningStatus();
    return;
  }
  if (message.type === 'assistant') {
    bubble('assistant', message.text, message.id); if (message.order) renderOrder(message.order);
    userSpeaking = false;
    if (activeMode === 'browser' && $('voiceEnabled').checked && !suppressed.has(message.id)) void voice.speak(message.text, $('language').value, message.id);
    else listeningStatus();
    return;
  }
  if (message.type === 'user_interim') {
    liveUserId = transcriptId(message); bubble('user', message.text, liveUserId, true);
    setStatus('Vous parlez…', 'Texte provisoire : il sera remplacé par la transcription finale.', 'listening'); return;
  }
  if (message.type === 'user_final') {
    const id = transcriptId(message); bubble('user', message.text, id, false);
    if (liveUserId === id) liveUserId = null; userSpeaking = false;
    return;
  }
  if (message.type === 'user_speaking') { onSpeechStart('service-STT'); return; }
  if (message.type === 'interrupted') { suppressed.add(message.id); markInterrupted(message.id); if (voice.currentResponseId === message.id) voice.stopOutput(); return; }
  if (message.type === 'audio_begin') {
    if (!running || !$('voiceEnabled').checked || suppressed.has(message.id)) { ignoredAudio.add(message.audioId); return; }
    voice.beginAudio(message.id, message.audioId, message.sampleRate); return;
  }
  if (message.type === 'audio') {
    if (message.buffer.byteLength < 6) return;
    const audioId = new DataView(message.buffer).getUint32(0, true);
    if (!ignoredAudio.has(audioId)) voice.queuePCM(message.buffer.slice(4), audioId);
    return;
  }
  if (message.type === 'audio_done') { voice.finishAudio(message.audioId); return; }
  if (message.type === 'error') { error(message.message); return; }
  if (message.type === 'disconnected') { stopSession(); error(message.message); setStatus('Connexion interrompue', 'Le micro et la lecture ont été arrêtés. Démarrez pour reprendre.', 'error'); }
}
async function startSession({ textOnly = false } = {}) {
  if (running || starting || !initialized) return;
  voice.unlock(); clearTimeout(micTestTimer);
  if (testingMic) { testingMic = false; voice.closeMicrophone(); $('testMic').textContent = '🎙 Tester le micro'; }
  const currentTicket = ++ticket;
  starting = true; activeMode = textOnly ? 'browser' : $('mode').value;
  $('errorBox').hidden = true; updateControls();
  setStatus(textOnly ? 'Démarrage en texte…' : 'Ouverture du micro…', textOnly ? 'Le micro reste éteint. La lecture vocale est facultative.' : 'Autorisez le micro dans la fenêtre du navigateur.', 'starting');
  try {
    if (!textOnly) {
      try { await voice.openMicrophone(); }
      catch (fault) {
        if (currentTicket !== ticket) return;
        error(fault.message);
        if (activeMode === 'streaming') throw new Error('Le streaming nécessite un micro autorisé. Essayez le mode texte ou le mode gratuit.');
        log('Conversation gratuite maintenue en texte malgré le micro indisponible.');
      }
    }
    if (currentTicket !== ticket) return;
    if (entries.size) bubble('system', 'Nouvelle session de démonstration.');
    suppressed.clear(); ignoredAudio.clear(); liveUserId = null;
    setStatus('Démarrage de la conversation…', config.backend ? 'Attente de l’accusé de réception du serveur, puis Ordely commence.' : 'Mode autonome : Ordely commence, sans serveur ni clé.', 'starting');
    const connect = async candidate => {
      transport = candidate;
      candidate.addEventListener('message', ({ detail }) => { if (ticket === currentTicket && transport === candidate) handleMessage(detail); });
      await candidate.start({ orderId: $('orders').value, language: $('language').value, mode: activeMode, voiceEnabled: $('voiceEnabled').checked });
    };
    let effectiveBackend = false;
    if (config.backend) {
      try { await connect(new SocketTransport(config.voicePath)); effectiveBackend = true; }
      catch (fault) {
        if (currentTicket !== ticket) return;
        // Le serveur vocal peut être en veille, bloqué par un réseau d'entreprise ou un proxy :
        // la démo ne doit jamais s'arrêter là, elle bascule en mode gratuit autonome.
        log(`Serveur vocal injoignable (${fault.message}) : bascule autonome.`);
        error(`Serveur vocal injoignable : ${fault.message} La conversation continue en mode gratuit, avec les commandes enregistrées sur cet appareil.`);
        if (activeMode === 'streaming') { activeMode = 'browser'; log('Le mode streaming exige le serveur : il est remplacé par le mode gratuit.'); }
        await connect(new LocalTransport(localDatabase, storeDatabase));
      }
    } else await connect(new LocalTransport(localDatabase, storeDatabase));
    if (currentTicket !== ticket) return;
    $('sessionMode').textContent = activeMode === 'streaming' ? 'Streaming · STT et TTS externes'
      : effectiveBackend ? 'Gratuit · voix navigateur, commandes serveur' : 'Gratuit · voix navigateur, commandes sur ce téléphone';
    if (navigator.wakeLock?.request) navigator.wakeLock.request('screen').then(lock => { if (ticket === currentTicket && running) wakeLock = lock; else lock.release(); }).catch(() => {});
  } catch (fault) {
    if (currentTicket !== ticket) return;
    stopSession(); error(fault.message); setStatus('Démarrage impossible', 'Le micro est arrêté. Corrigez le diagnostic puis réessayez.', 'error');
  } finally { if (currentTicket === ticket) { starting = false; updateControls(); refreshDiagnostics(); } }
}
function stopSession() {
  ticket += 1; starting = false; running = false; userSpeaking = false;
  clearTimeout(micTestTimer); testingMic = false;
  transport?.close(); transport = null;
  voice.stop(); wakeLock?.release().catch(() => {}); wakeLock = null;
  if (liveUserId && entries.has(liveUserId)) {
    const entry = entries.get(liveUserId); entry.state.textContent = 'Non finalisé · session arrêtée';
  }
  liveUserId = null;
  $('testMic').textContent = '🎙 Tester le micro'; updateControls(); refreshDiagnostics();
  setStatus('Arrêté — micro libéré', 'Vous pouvez démarrer une nouvelle session. Les modifications déjà validées sont conservées.');
  log('Session arrêtée · micro et audio libérés.');
}
function onSpeechStart(source) {
  if (!running || voice.muted) return;
  userSpeaking = true;
  if (voice.outputPlaying && $('bargeIn').checked) {
    const id = voice.currentResponseId; suppressed.add(id); markInterrupted(id);
    voice.stopOutput(); transport?.interrupt();
    setStatus('Agent interrompu — je vous écoute', 'Continuez votre phrase. Le contexte de la commande est conservé.', 'listening');
    log(`Interruption · ${source} · reconnaissance maintenue.`);
  }
  if (!liveUserId && activeMode === 'browser' && voice.recognitionWanted) {
    liveUserId = uid('u'); bubble('user', 'Voix détectée — transcription en attente…', liveUserId, true);
  }
}
async function submitText(text, fromVoice = false) {
  if (!text?.trim()) return;
  if (!running) { if (fromVoice) return; await startSession({ textOnly: true }); }
  if (!running || !transport?.ready) { error('La conversation n’est pas prête. Réessayez après le démarrage.'); return; }
  if (!fromVoice) {
    clearTimeout(voice.finalTimer); voice.finalTimer = null; voice.pendingFinal = []; voice.interim = '';
  }
  const id = liveUserId || uid('u'); liveUserId = null;
  if (voice.outputPlaying) { suppressed.add(voice.currentResponseId); markInterrupted(voice.currentResponseId); }
  voice.stopOutput(); transport.interrupt();
  bubble('user', text.trim(), id, false); userSpeaking = false;
  setStatus('Ordely prépare sa réponse…', 'La phrase finale est envoyée au moteur de commande.', 'starting');
  try { transport.user(text.trim(), id); }
  catch (fault) { error(fault.message); const entry = entries.get(id); entry.state.textContent = 'Échec de l’envoi'; listeningStatus(); }
}

voice.addEventListener('level', ({ detail }) => {
  const level = Math.min(100, Math.round(detail.rms * 500));
  $('meterFill').style.width = `${level}%`; $('meter').setAttribute('aria-valuenow', String(level));
});
voice.addEventListener('microphone', ({ detail }) => {
  const ready = detail.state === 'ready';
  $('captureStatus').textContent = ready ? 'ON' : detail.state === 'native' ? 'NATIF' : detail.state === 'muted' ? 'COUPÉ' : 'OFF';
  $('micLabel').textContent = ready ? testingMic ? 'Test micro · aucun envoi' : 'Micro ouvert' : detail.state === 'native' ? 'Micro natif · mesure désactivée' : detail.state === 'muted' ? 'Micro coupé' : 'Micro désactivé';
  if (detail.device) log(`Micro : ${detail.device}`);
  updateControls(); refreshDiagnostics();
});
voice.addEventListener('recognition', ({ detail }) => {
  recognitionState = detail.state;
  const labels = { starting: 'DÉMARRAGE', listening: 'ÉCOUTE', restarting: 'RELANCE', streaming: 'STREAMING', text: 'TEXTE', unavailable: 'ABSENTE', blocked: 'BLOQUÉE', muted: 'COUPÉE', off: 'OFF' };
  $('recognitionStatus').textContent = labels[detail.state] || detail.state;
  if (running && !voice.outputPlaying && !userSpeaking) listeningStatus();
  refreshDiagnostics(); updateControls();
});
voice.addEventListener('speech_start', ({ detail }) => onSpeechStart(detail.source));
voice.addEventListener('speech_end', () => { userSpeaking = false; });
voice.addEventListener('interim', ({ detail }) => {
  if (!running) return;
  liveUserId ||= uid('u'); bubble('user', detail.text, liveUserId, true);
  setStatus('Vous parlez…', 'La transcription provisoire est mise à jour ; la réponse suit la fin de votre phrase.', 'listening');
});
voice.addEventListener('final', ({ detail }) => { if (running) void submitText(detail.text, true); });
voice.addEventListener('pcm', ({ detail }) => {
  if (!running || activeMode !== 'streaming') return;
  if (!transport?.sendAudio(detail.buffer) && Date.now() - lastStreamDrop > 5000) { lastStreamDrop = Date.now(); error('Réseau audio saturé. Des blocs du micro n’ont pas été envoyés. Vérifiez la connexion.'); }
});
voice.addEventListener('output', ({ detail }) => {
  const labels = { preparing: 'PRÉPARE', speaking: 'PARLE', idle: 'SILENCIEUX', interrupted: 'INTERROMPU' };
  $('outputStatus').textContent = labels[detail.state] || detail.state;
  const entry = entries.get(detail.id);
  if (entry && !entry.interrupted) entry.state.textContent = detail.state === 'speaking' ? 'En lecture · réponse complète' : detail.state === 'preparing' ? 'Préparation du son · réponse complète' : 'Réponse complète';
  if (detail.state === 'interrupted') markInterrupted(detail.id);
  if (['preparing', 'speaking'].includes(detail.state)) setStatus('Ordely vous répond…', 'Le texte est déjà affiché. Vous pouvez parler pour interrompre.', 'agent');
  else if (running && !userSpeaking) listeningStatus();
});
voice.addEventListener('boundary', ({ detail }) => {
  const entry = entries.get(detail.id); if (entry) entry.node.dataset.spokenCharacters = String(detail.index);
});
voice.addEventListener('error', ({ detail }) => error(detail.message));
voice.addEventListener('notice', ({ detail }) => log(detail.message));

$('start').addEventListener('click', () => void startSession());
$('textOnly').addEventListener('click', () => void startSession({ textOnly: true }));
$('stop').addEventListener('click', stopSession);
$('orders').addEventListener('change', () => void showSelectedOrder());
$('dismissError').addEventListener('click', () => { $('errorBox').hidden = true; });
$('send').addEventListener('click', () => { const text = $('input').value; if (!text.trim()) return; $('input').value = ''; void submitText(text); });
$('input').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('send').click(); } });
for (const button of document.querySelectorAll('.example')) button.addEventListener('click', () => { $('input').value = button.dataset.text; $('input').focus(); });
$('sensitivity').addEventListener('input', () => { voice.threshold = Number($('sensitivity').value); $('thresholdValue').textContent = voice.threshold.toFixed(3).replace('.', ','); voice.configure(); });
$('voiceEnabled').addEventListener('change', () => { voice.unlock(); if (!$('voiceEnabled').checked) voice.stopOutput(); transport?.setAudio($('voiceEnabled').checked); });
$('testSound').addEventListener('click', () => {
  try { voice.testSound().then(() => log('Bip de test lancé. Vérifiez que vous l’entendez.')); }
  catch (fault) { error(fault.message); }
});
$('testMic').addEventListener('click', async () => {
  if (running || starting) return;
  voice.unlock();
  if (testingMic) { clearTimeout(micTestTimer); testingMic = false; voice.closeMicrophone(); $('testMic').textContent = '🎙 Tester le micro'; setStatus('Test micro terminé', 'La capture est arrêtée. Vous pouvez démarrer la conversation.'); return; }
  testingMic = true; $('testMic').textContent = 'Arrêter le test micro';
  setStatus('Test du micro — parlez pendant 8 secondes', 'La barre doit bouger. Ce test ne transcrit ni n’enregistre votre voix.', 'starting');
  try {
    await voice.openMicrophone();
    if (!testingMic) return;
    micTestTimer = setTimeout(() => { if (testingMic) $('testMic').click(); }, 8000);
    log('Test micro : capture uniquement, aucune transcription demandée.');
  } catch (fault) { testingMic = false; voice.closeMicrophone(); $('testMic').textContent = '🎙 Tester le micro'; error(fault.message); setStatus('Test micro impossible', 'Consultez le message de diagnostic.', 'error'); }
});
$('micToggle').addEventListener('click', async () => {
  if (!running) return;
  voice.unlock();
  try {
    if (!voice.stream && !voice.nativeOnly) { await voice.openMicrophone(); if (!running) return; voice.enableListening(activeMode, $('language').value); voice.setStreamingReady(activeMode === 'streaming'); }
    else voice.setMuted(!voice.muted);
    listeningStatus(); updateControls();
  } catch (fault) { error(fault.message); }
});
$('resumeListening').addEventListener('click', () => { voice.unlock(); voice.resumeRecognition(); });
$('export').addEventListener('click', () => {
  const text = ['Ordely V10 — transcription de démonstration', `Export : ${new Date().toISOString()}`, '', ...Array.from(entries.values()).map(entry => `[${entry.time}] ${entry.role === 'user' ? 'Vous' : entry.role === 'assistant' ? 'Ordely' : 'Information'}${entry.partial ? ' (provisoire)' : ''}${entry.interrupted ? ' (interrompu ; texte prévu)' : ''}\n${entry.text}\n`)].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `ordely-transcription-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('reset').addEventListener('click', async () => {
  if (!confirm('Réinitialiser uniquement les commandes fictives ? Les modifications de la démo seront effacées.')) return;
  stopSession();
  try {
    if (config.backend) await requestJSON('api/demo/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    else { localDatabase = clone(seed); localEngine = new OrderEngine(localDatabase); storeDatabase(localDatabase); }
    await loadOrders(); log('Commandes de démo réinitialisées.');
    bubble('system', 'Commandes fictives réinitialisées. Démarrez pour refaire l’essai.');
  } catch (fault) { error(fault.message); }
});
$('reload').addEventListener('click', async () => {
  stopSession();
  try {
    for (const registration of await navigator.serviceWorker?.getRegistrations?.() || []) if (registration.scope === base.href) await registration.unregister();
    if ('caches' in window) for (const key of await caches.keys()) if (key.startsWith('ordely')) await caches.delete(key);
  } catch { /* indisponible en navigation privée */ }
  location.reload();
});
window.addEventListener('online', refreshDiagnostics); window.addEventListener('offline', refreshDiagnostics);
window.addEventListener('pagehide', () => { if (running || starting || testingMic) stopSession(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) { stopSession(); log('Arrêt de confidentialité : application passée en arrière-plan.'); }
});

async function init() {
  try {
    if (window.self !== window.top) { $('frameNotice').hidden = false; $('standalone').href = location.href; }
    if (!window.isSecureContext) { $('environmentNotice').textContent = 'Le micro nécessite HTTPS sur téléphone. Utilisez l’URL GitHub Pages ; ouvrir un fichier HTML ou une IP locale HTTP ne suffit pas.'; $('environmentNotice').hidden = false; }
    else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) { $('environmentNotice').textContent = 'Sur iPhone, utilisez Safari et gardez l’écran allumé. L’écoute pendant la synthèse vocale peut varier selon iOS. Testez avec un casque ; le bouton Relancer l’écoute reste disponible.'; $('environmentNotice').hidden = false; }
    seed = globalThis.__ORDELY_SEED__ ? clone(globalThis.__ORDELY_SEED__) : await requestJSON('demo-data.json');
    try {
      const saved = localStorage.getItem(storageKey); localDatabase = saved ? JSON.parse(saved) : clone(seed);
      localEngine = new OrderEngine(localDatabase);
    } catch { localDatabase = clone(seed); localEngine = new OrderEngine(localDatabase); sessionStorageOK = false; }
    if (!globalThis.__ORDELY_PHONE__ && !new URL(location.href).searchParams.has('local')) {
      try { const detected = await requestJSON('api/config'); if (detected.backend && detected.version?.startsWith('10.')) config = detected; }
      catch { log('Aucun backend Node : mode gratuit autonome sélectionné.'); }
    }
    const streamingOption = $('mode').querySelector('option[value=streaming]');
    streamingOption.disabled = !config.modes.streaming;
    streamingOption.textContent = config.modes.streaming ? 'Streaming · services externes' : 'Streaming indisponible · facultatif';
    $('storageNote').textContent = config.backend ? 'Démo partagée sur le serveur. Aucun usage production.' : 'Sauvegarde sur ce téléphone uniquement. Aucun appel réel.';
    await loadOrders(); initialized = true;
    if (!voice.supportsRecognition) error('Ce navigateur n’expose pas la reconnaissance vocale. Sur téléphone, ouvrez le lien dans Chrome Android ou Safari iPhone. Le mode texte fonctionne.');
    setStatus('Prêt — micro arrêté', 'Appuyez une fois sur Démarrer, autorisez le micro, puis laissez Ordely commencer.');
    updateControls(); refreshDiagnostics(); log('Application prête. Aucun micro ouvert au chargement.');
    if (!globalThis.__ORDELY_PHONE__ && 'serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname }).then(registration => {
        registration.update().catch(() => {});
      }).catch(() => log('Cache hors ligne indisponible ; le site fonctionne en ligne.'));
    }
  } catch (fault) { error(`Chargement impossible : ${fault.message}. Servez le dossier public/ en HTTP(S), ne double-cliquez pas sur index.html.`); setStatus('Démo non chargée', 'Vérifiez la publication GitHub Pages ou le lancement npm start.', 'error'); }
}
void init();
