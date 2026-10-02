// Le même moteur, sans dépendance, est utilisé sur GitHub Pages et côté Node.
// Il n'utilise PAS de LLM : seules les opérations métier validées sont exécutées.
export const clone = value => JSON.parse(JSON.stringify(value));
export function normalize(value = '') {
  return String(value).normalize('NFKD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
}
const word = (text, pattern) => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${pattern})(?=$|[^\\p{L}\\p{N}])`, 'u').test(text);
const digitText = value => String(value).replace(/[٠-٩۰-۹]/g, d => String('٠١٢٣٤٥٦٧٨٩'.includes(d) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(d) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const yes = text => /^(oui|ouais|yes|ok|okay|d accord|exactement|ey|ay|اي|ايه|نعم|باهي|مريقل|صحيح|s7i7)(?:[\s,.!؟]*$|\s+(?:je confirme|c est correct|confirme|نثبت|اكد)(?:\s+(?:la commande|الطلبية|الcommande))?[\s.!؟]*$)/u.test(text)
  || /^(?:je confirme(?: la commande)?|confirmer la commande|نثبت الطلبية|اكد الطلبية|نثبت الcommande)[.!؟]*$/u.test(text);
const no = text => /^(non|no|لا|la|موش|مش)(?:$|[\s.!؟])/u.test(text);
const aliases = {
  huawei: ['هواوي بي 30 برو', 'هواوي', 'الهواوي'],
  oppo: ['اوبو رينو خمسة', 'اوبو رينو 5', 'اوبو', 'الاوبو', 'اوپو'],
  casque: ['كاسك', 'الكاسك', 'سماعات'],
  sneakers: ['سبادري', 'سنيكرز']
};
const colors = {
  noir: ['noir', 'black', 'اسود', 'اكحل', 'كحل', 'لاكحل', 'الاكحل', 'لكحل'],
  blanc: ['blanc', 'blanche', 'white', 'ابيض'],
  bleu: ['bleu', 'bleue', 'blue', 'ازرق'],
  rouge: ['rouge', 'red', 'احمر']
};
const numbers = { un: 1, une: 1, one: 1, واحد: 1, واحدة: 1, deux: 2, two: 2, زوز: 2, اثنين: 2,
  trois: 3, three: 3, ثلاثة: 3, اربعة: 4, quatre: 4, خمسة: 5, cinq: 5,
  ستة: 6, six: 6, سبعة: 7, sept: 7, ثمانية: 8, huit: 8, تسعة: 9, neuf: 9, عشرة: 10, dix: 10 };
export function parsePhone(input) {
  let text = digitText(input);
  let digits = text.replace(/\D/g, '');
  if (!digits) {
    const tokens = normalize(text).split(/[^\p{L}]+/u).filter(Boolean);
    const phoneWords = { ...numbers, zero: 0, صفر: 0 };
    if (tokens.length === 8 && tokens.every(t => phoneWords[t] !== undefined && phoneWords[t] < 10)) digits = tokens.map(t => phoneWords[t]).join('');
  }
  if (digits.length === 11 && digits.startsWith('216')) digits = digits.slice(3);
  return /^[24579]\d{7}$/.test(digits) ? digits : null;
}
export function parseQuantity(input) {
  const text = normalize(digitText(input));
  if (/[−-]\s*\d|\d[.,]\d/.test(text)) return null;
  const numeric = text.match(/(?:^|[^\p{L}\d])([1-9]\d?)(?=$|[^\p{L}\d])/u);
  if (numeric) return Number(numeric[1]) <= 20 ? Number(numeric[1]) : null;
  return Object.entries(numbers).find(([name]) => word(text, name))?.[1] ?? null;
}
export function parseCallbackMinutes(input) {
  const text = normalize(digitText(input));
  if (/demi.?heure|نص ساعة|نصف ساعة/.test(text)) return 30;
  if (/غدوة|demain|tomorrow/.test(text)) return 1440;
  if (/ساعتين|deux heures/.test(text)) return 120;
  if (/ساعة|heure|hour/.test(text)) return (parseQuantity(text) ?? 1) * 60;
  if (/دقيقة|دقايق|دقائق|minutes?/.test(text)) {
    const m = text.match(/\b(\d{1,3})\b/);
    return m && +m[1] >= 1 && +m[1] <= 240 ? +m[1] : null;
  }
  return null;
}
export class OrderEngine {
  constructor(database, { now = () => Date.now() } = {}) {
    this.db = database;
    this.now = now;
    if (!['orders', 'customers', 'products'].every(k => Array.isArray(database[k]))) throw new Error('Base de démo invalide.');
    for (const order of database.orders) {
      if (!this.customer(order) || !Array.isArray(order.items) || !order.items.length) throw new Error('Commande invalide.');
      for (const item of order.items) if (!this.product(item.productId) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20) throw new Error('Article invalide.');
    }
  }
  product(id) { return this.db.products.find(p => p.id === id); }
  customer(order) { return this.db.customers.find(c => c.id === order.customerId); }
  order(id) {
    const order = this.db.orders.find(o => o.id === id);
    if (!order) throw new Error('Commande inconnue.');
    return order;
  }
  total(order) { return order.items.reduce((sum, item) => sum + this.product(item.productId).price * item.qty, 0); }
  summary(order) { return order.items.map(i => `${this.product(i.productId).name} ${i.variant || ''}${i.size ? ` · ${i.size}` : ''} × ${i.qty}`).join(' + '); }
  view(id) {
    const order = this.order(id);
    return { ...clone(order), customer: clone(this.customer(order)), total: this.total(order),
      items: order.items.map(i => ({ ...clone(i), product: clone(this.product(i.productId)) })) };
  }
  list() { return this.db.orders.map(o => ({ id: o.id, customer: this.customer(o).name, total: this.total(o), status: o.status })); }
  session(orderId, language = 'ar-TN') {
    this.order(orderId);
    return { orderId, language: language === 'fr-FR' ? 'fr-FR' : 'ar-TN', topic: 'confirm', pending: null, turn: 0 };
  }
  reply(session, ar, fr, changed = false) {
    return { text: session.language === 'fr-FR' ? fr : ar, changed, state: clone(session), order: this.view(session.orderId) };
  }
  greeting(s) {
    const o = this.order(s.orderId), c = this.customer(o);
    if (['CONFIRMED', 'CANCELLED'].includes(o.status)) return this.reply(s,
      `عسلامة ${c.name.split(' ')[0]}. الطلبية هاذي ${o.status === 'CONFIRMED' ? 'تاكدت' : 'تلغات'} قبل. باش تعاود تجربة جديدة، اضغط على تصفير الديمو.`,
      `Bonjour ${c.name.split(' ')[0]}. Cette commande est déjà ${o.status === 'CONFIRMED' ? 'confirmée' : 'annulée'}. Réinitialisez la démo pour refaire le scénario.`);
    return this.reply(s,
      `عسلامة ${c.name.split(' ')[0]}، أنا Ordely. نكلمك على الطلبية: ${this.summary(o)}. المجموع ${this.total(o)} دينار. العنوان ${c.address}. تحب تبدل حاجة ولا تاكد الطلبية؟`,
      `Bonjour ${c.name.split(' ')[0]}, je suis Ordely. Votre commande : ${this.summary(o)}. Total : ${this.total(o)} dinars. Adresse : ${c.address}. Voulez-vous modifier un détail ou confirmer cette commande ?`);
  }
  selectedItems(order, text) {
    return order.items.filter(item => {
      const name = normalize(this.product(item.productId).name);
      return text.includes(name) || word(text, name.split(' ')[0]) || (aliases[name.split(' ')[0]] || []).some(alias => word(text, alias));
    });
  }
  withoutProductNames(text) {
    let clean = text;
    for (const p of this.db.products) {
      clean = clean.replace(normalize(p.name), '');
      for (const alias of aliases[normalize(p.name).split(' ')[0]] || []) clean = clean.replace(alias, '');
      clean = clean.replace(normalize(p.name).split(' ')[0], '');
    }
    return clean;
  }
  colorValue(text, product) {
    for (const variant of product.variants) if (text.includes(normalize(variant))) return variant;
    const canonical = Object.keys(colors).find(k => colors[k].some(alias => word(text, alias)));
    if (!canonical) return null;
    return product.variants.find(v => colors[canonical].some(alias => word(normalize(v), alias))) ?? null;
  }
  sizeValue(text, product) {
    let value = product.sizes.find(v => word(text, normalize(v)));
    if (!value && /small|smol|صغير/.test(text)) value = product.sizes.includes('S') ? 'S' : null;
    if (!value && /medium|متوسط/.test(text)) value = product.sizes.includes('M') ? 'M' : null;
    if (!value && /large|كبير/.test(text)) value = product.sizes.includes('L') ? 'L' : null;
    return value ?? null;
  }
  askItem(s, kind, rawText) {
    const order = this.order(s.orderId), selected = this.selectedItems(order, normalize(rawText));
    const item = selected.length === 1 ? selected[0] : order.items.length === 1 ? order.items[0] : null;
    if (!item) {
      s.topic = 'item_target'; s.pending = { kind, rawText };
      return this.reply(s, `على اني منتوج؟ ${order.items.map(i => this.product(i.productId).name).join(' ولا ')}؟`,
        `Pour quel produit : ${order.items.map(i => this.product(i.productId).name).join(' ou ')} ?`);
    }
    return this.editItem(s, kind, item, rawText);
  }
  editItem(s, kind, item, rawText) {
    const product = this.product(item.productId), text = normalize(rawText);
    const value = kind === 'quantity' ? parseQuantity(this.withoutProductNames(text)) : kind === 'color' ? this.colorValue(text, product) : this.sizeValue(text, product);
    if (value === null) {
      s.topic = 'item_value'; s.pending = { kind, productId: item.productId };
      if (kind === 'quantity') return this.reply(s, 'قداش تحب من قطعة؟ من واحد لعشرين.', 'Quelle quantité ? De 1 à 20 pièces.');
      const options = kind === 'color' ? product.variants : product.sizes;
      if (!options.length) {
        s.topic = 'confirm'; s.pending = null;
        return this.reply(s, 'المنتوج هاذا ما عندوش مقاسات. تحب تبدل حاجة اخرى؟', 'Ce produit ne propose pas de tailles. Souhaitez-vous modifier autre chose ?');
      }
      return this.reply(s, `الاختيارات الموجودة: ${options.join('، ')}. شنوة تختار؟`, `Choix disponibles : ${options.join(', ')}. Lequel souhaitez-vous ?`);
    }
    item[kind === 'quantity' ? 'qty' : kind === 'color' ? 'variant' : 'size'] = value;
    s.topic = 'confirm'; s.pending = null;
    return this.reply(s, `مريقل، ${product.name}: ${item.variant || ''} ${item.size || ''} × ${item.qty}. المجموع ولى ${this.total(this.order(s.orderId))} دينار. تاكد الطلبية ولا تبدل حاجة اخرى؟`,
      `C'est noté : ${product.name}, ${item.variant || ''} ${item.size || ''}, quantité ${item.qty}. Total : ${this.total(this.order(s.orderId))} dinars. Confirmez-vous la commande ou souhaitez-vous une autre modification ?`, true);
  }
  registerCallback(s, phone) {
    const order = this.order(s.orderId);
    order.callback = { requestedAt: new Date(s.pending.callbackAt).toISOString(), phone, status: 'REQUESTED' };
    order.status = 'CALLBACK_REQUESTED'; s.topic = 'general'; s.pending = null;
    return this.reply(s, `سجلت طلب معاودة الاتصال على ${phone}. هاذي ديمو: ما فماش مكالمة حقيقية مبرمجة.`,
      `Demande de rappel enregistrée au ${phone}. C'est une démo : aucun appel téléphonique réel n'est programmé.`, true);
  }
  turn(s, input) {
    const raw = String(input ?? '').trim();
    if (!raw || raw.length > 2000) throw new Error('Phrase vide ou trop longue (2 000 caractères maximum).');
    const text = normalize(raw), order = this.order(s.orderId), customer = this.customer(order);
    s.turn += 1;
    const respond = (ar, fr, changed = false) => this.reply(s, ar, fr, changed);
    const prohibit = /\bne\b.*\bpas\b|\bn (?:annule|enleve|change|modifie) pas\b|ما.*(?:تلغيش|تفسخش|تنحيش|تبدلش)/u.test(text);
    const negative = no(text) || prohibit;
    if (prohibit) { s.topic = 'general'; s.pending = null; return respond('باهي، ما نبدل حتى شي. شنوة تحب نراجع؟', 'D’accord, je ne modifie rien. Que souhaitez-vous vérifier ?'); }
    const price = word(text, 'prix|price|total|montant|قداش|بقداش|المجموع|السوم') && !/كمية|quantite/.test(text);
    const fieldIntent = /adresse|address|3onwen|3onwan|عنوان/.test(text) ? 'address'
      : /numero|telephone|phone|نمرة|نيميرو|تليفون/.test(text) ? 'phone'
      : /couleur|color|لون/.test(text) ? 'color'
      : /taille|size|قياس|مقاس/.test(text) ? 'size'
      : /quantite|quantity|كمية|pieces?|قطعة|قطع/.test(text) ? 'quantity' : null;
    if (price) return respond(`المجموع ${this.total(order)} دينار.`, `Le total est de ${this.total(order)} dinars.`);
    if (['CONFIRMED', 'CANCELLED'].includes(order.status)) return this.greeting(s);
    // Une réponse à une question de champ est traitée AVANT les intentions globales.
    if (s.topic === 'cancel_confirm' && (yes(text) || no(text))) {
      if (no(text)) { s.topic = 'confirm'; s.pending = null; return respond('باهي، ما نلغي حتى شي. شنوة تحب تبدل؟', 'D’accord, je n’annule rien. Que souhaitez-vous modifier ?'); }
      order.status = 'CANCELLED'; s.topic = 'done'; s.pending = null;
      return respond('مريقل، تلغات الطلبية. يعطيك الصحة.', 'Votre commande a été annulée. Merci.', true);
    }
    if (s.topic === 'address_confirm' && (yes(text) || no(text))) {
      if (no(text)) { s.topic = 'address_new'; s.pending = null; return respond('باهي، أعطيني العنوان الصحيح.', 'D’accord, indiquez l’adresse correcte.'); }
      customer.address = s.pending.address; s.topic = 'confirm'; s.pending = null;
      return respond(`بدلت العنوان الى ${customer.address}. توا، تاكد الطلبية كاملة ولا تبدل حاجة اخرى؟`,
        `Adresse modifiée : ${customer.address}. Confirmez-vous maintenant toute la commande, ou souhaitez-vous modifier autre chose ?`, true);
    }
    const wantsCancel = !negative && word(text, 'annul(?:e|er|ation)?|cancel|fassakh|fasa5|فسخ|فسّخ|تلغي|الغي|نلغي|نلغيها|الغاء');
    const wantsCallback = (/rappel|rappelle.?moi|rappeler/.test(text) && !/adresse|couleur|numero|produit|commande|prix/.test(text))
      || /عاود.*اتصل|عاودو.*اتصل|نعاودو.*نتصل|baad.*se3a|بعد ساعة|apres une heure/.test(text);
    if (wantsCancel) { s.topic = 'cancel_confirm'; s.pending = null; return respond('تحب نلغي الطلبية نهائيا؟ قول اي ولا لا.', 'Souhaitez-vous annuler définitivement la commande ? Dites oui ou non.'); }
    if (wantsCallback) {
      const minutes = parseCallbackMinutes(text);
      if (!minutes) { s.topic = 'callback_time'; s.pending = null; return respond('بعد قداش نطلبولك معاودة الاتصال؟', 'Dans combien de temps souhaitez-vous demander un rappel ?'); }
      s.topic = 'callback_phone'; s.pending = { callbackAt: this.now() + minutes * 60000 };
      return respond(`سجلت الوقت بعد ${minutes} دقيقة. نستعمل نفس النيميرو ${customer.phone}؟ قول اي ولا اعطيني نيميرو اخر.`,
        `Rappel demandé dans ${minutes} minutes. Utiliser le même numéro, ${customer.phone} ? Dites oui, ou donnez un autre numéro.`);
    }
    const pendingField = s.topic.startsWith('address_') ? 'address' : s.topic === 'phone_new' ? 'phone'
      : s.topic.startsWith('item_') ? s.pending?.kind : s.topic.startsWith('callback_') ? 'callback' : null;
    if (fieldIntent && pendingField && fieldIntent !== pendingField) { s.topic = 'general'; s.pending = null; }
    if (s.topic === 'callback_time') {
      const minutes = parseCallbackMinutes(text);
      if (!minutes) return respond('مثلا: بعد ساعة، ولا بعد 30 دقيقة.', 'Par exemple : dans une heure, ou dans 30 minutes.');
      s.topic = 'callback_phone'; s.pending = { callbackAt: this.now() + minutes * 60000 };
      return respond(`باهي، بعد ${minutes} دقيقة. نفس النيميرو؟`, `D'accord, dans ${minutes} minutes. Utiliser le même numéro ?`);
    }
    if (s.topic === 'callback_phone') {
      if (yes(text)) return this.registerCallback(s, customer.altPhone || customer.phone);
      const p = parsePhone(raw);
      if (p) { customer.altPhone = p; return this.registerCallback(s, p); }
      return respond('قول اي لنفس النيميرو، ولا أعطيني ثمانية أرقام لنيميرو اخر.', 'Dites oui pour le même numéro, ou donnez les 8 chiffres d’un autre numéro.');
    }
    if (s.topic === 'address_new') {
      if (no(text)) { s.topic = 'confirm'; s.pending = null; return respond('باهي، نخلي العنوان القديم. تحب تبدل حاجة اخرى؟', 'D’accord, je conserve l’adresse actuelle. Une autre modification ?'); }
      if (yes(text) || raw.length < 6) return respond('أعطيني العنوان الجديد بالتفصيل، موش كان اي.', 'Indiquez l’adresse complète, pas seulement oui.');
      s.topic = 'address_confirm'; s.pending = { address: raw };
      return respond(`فهمت العنوان الجديد: ${raw}. صحيح؟`, `J’ai compris cette nouvelle adresse : ${raw}. Est-ce correct ?`);
    }
    if (s.topic === 'phone_new') {
      const p = parsePhone(raw);
      if (!p) return respond('النيميرو يلزمو ثمانية أرقام صحيحة. مثال: 22222222.', 'Il faut un numéro tunisien valide de 8 chiffres, par exemple 22222222.');
      customer.altPhone = p; s.topic = 'confirm'; s.pending = null;
      return respond(`زدت النيميرو ${p}. تاكد الطلبية ولا تبدل حاجة اخرى؟`, `Numéro supplémentaire enregistré : ${p}. Confirmez-vous la commande ou souhaitez-vous une autre modification ?`, true);
    }
    if (s.topic === 'item_target') {
      const matches = this.selectedItems(order, text);
      if (matches.length === 1) {
        const { kind, rawText } = s.pending;
        return this.editItem(s, kind, matches[0], `${rawText} ${raw}`);
      }
      // Un changement explicite de sujet reste possible.
    }
    if (s.topic === 'item_value') {
      const { kind, productId } = s.pending, item = order.items.find(i => i.productId === productId);
      const value = kind === 'quantity' ? parseQuantity(text) : kind === 'color' ? this.colorValue(text, this.product(productId)) : this.sizeValue(text, this.product(productId));
      if (value !== null && item) return this.editItem(s, kind, item, raw);
    }
    const addressIntent = /adresse|address|3onwen|3onwan|عنوان/.test(text);
    if (addressIntent) {
      const readOnly = /rappelle|rappel|ذكرني|ذكّرني|quelle|c est quoi|شنوة|شنو/.test(text) && !/change|modif|بدل|تبدل|تبدلت/.test(text);
      if (readOnly) return respond(`العنوان اللي عندنا: ${customer.address}.`, `Adresse actuelle : ${customer.address}.`);
      const inline = raw.match(/(?:adresse\s*(?:est|:|=)|adresse\s+(?:à|a|vers)|العنوان الجديد\s*(?:هو|:))\s*(.{6,})/iu)?.[1];
      if (inline) { s.topic = 'address_confirm'; s.pending = { address: inline.trim() }; return respond(`العنوان الجديد ${inline.trim()}. صحيح؟`, `Nouvelle adresse : ${inline.trim()}. Est-ce correct ?`); }
      s.topic = 'address_new'; s.pending = null;
      return respond(`العنوان الحالي ${customer.address}. أعطيني العنوان الجديد بالتفصيل.`, `Adresse actuelle : ${customer.address}. Indiquez votre nouvelle adresse complète.`);
    }
    if (/numero|telephone|phone|نمرة|نيميرو|تليفون/.test(text)) {
      const p = parsePhone(raw);
      if (p) { customer.altPhone = p; s.topic = 'confirm'; s.pending = null; return respond(`سجلت النيميرو ${p}. تاكد الطلبية ولا تبدل حاجة اخرى؟`, `Numéro supplémentaire enregistré : ${p}. Confirmez-vous la commande ou souhaitez-vous une autre modification ?`, true); }
      if (/rappelle|ذكرني|quel est/.test(text)) return respond(`النيميرو ${customer.phone}${customer.altPhone ? ` وزادة ${customer.altPhone}` : ''}.`, `Numéro actuel : ${customer.phone}${customer.altPhone ? ` ; autre numéro : ${customer.altPhone}` : ''}.`);
      s.topic = 'phone_new'; s.pending = null; return respond('أعطيني النيميرو اللي تحب تزيدو، ثمانية أرقام.', 'Donnez les 8 chiffres du numéro à ajouter.');
    }
    const removeMatch = text.match(/(?:^|\s)(?:و)?(?:نحي|nahhi|na7i|enleve|retire|supprime|remove)\s+(.+)$/u);
    const keepOnly = /(?:خليلي|خلي|garde|khalili|khali).*(?:كان|seulement|uniquement)|juste.*(?:huawei|oppo|casque|sneakers)/u.test(text);
    if (!negative && (removeMatch || keepOnly)) {
      const targeted = this.selectedItems(order, removeMatch ? removeMatch[1] : text);
      const ids = new Set(targeted.map(i => i.productId));
      const remaining = order.items.filter(i => removeMatch ? !ids.has(i.productId) : ids.has(i.productId));
      if (!targeted.length) return respond('اني منتوج تحب تنحي؟ أعطيني اسمو.', 'Quel produit souhaitez-vous retirer ? Indiquez son nom.');
      if (!remaining.length) return respond('ما ننجمش نخلي طلبية فارغة. تحب تلغيها؟ قول نحب نلغي الطلبية.', 'Je ne peux pas laisser une commande vide. Pour annuler, dites « annuler la commande ».');
      order.items = remaining; s.topic = 'confirm'; s.pending = null;
      return respond(`مريقل، خليتلك ${this.summary(order)}. المجموع ${this.total(order)} دينار. تاكد الطلبية ولا تبدل حاجة اخرى؟`,
        `Il reste : ${this.summary(order)}. Total : ${this.total(order)} dinars. Confirmez-vous la commande ou souhaitez-vous une autre modification ?`, true);
    }
    const reminder = /ذكرني|rappelle|quel(?:le)?|c est quoi|شنوة/.test(text);
    if (/couleur|color|لون/.test(text)) {
      if (reminder) return respond(order.items.map(i => `${this.product(i.productId).name}: ${i.variant}`).join('، '), order.items.map(i => `${this.product(i.productId).name} : ${i.variant}`).join(', '));
      return this.askItem(s, 'color', raw);
    }
    if (/taille|size|قياس|مقاس/.test(text)) return this.askItem(s, 'size', raw);
    if (/quantite|quantity|كمية|pieces?|قطعة|قطع/.test(text) || (this.selectedItems(order, text).length && parseQuantity(this.withoutProductNames(text)) !== null)) return this.askItem(s, 'quantity', raw);
    if (yes(text) && s.topic === 'confirm') {
      order.status = 'CONFIRMED'; s.topic = 'done'; s.pending = null;
      return respond(`مريقل، تأكدت الطلبية. المجموع ${this.total(order)} دينار، والعنوان ${customer.address}. يعطيك الصحة.`,
        `Commande confirmée. Total : ${this.total(order)} dinars. Livraison à ${customer.address}. Merci.`, true);
    }
    if (negative) { s.topic = 'general'; s.pending = null; return respond('باهي، ما نثبت وما نلغي حتى شي. شنوة تحب تبدل؟', 'D’accord, je ne confirme ni n’annule rien. Que souhaitez-vous modifier ?'); }
    if (yes(text)) { s.topic = 'confirm'; return this.greeting(s); }
    return respond('باش ما نبدل حتى شي بالغلط، وضحلي: منتوج، كمية، لون، قياس، عنوان، نمرة، سوم، معاودة اتصال ولا الغاء؟',
      'Pour éviter une mauvaise modification, précisez : produit, quantité, couleur, taille, adresse, téléphone, prix, rappel ou annulation.');
  }
}
