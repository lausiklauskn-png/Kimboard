#!/usr/bin/env node
/*
 * Smoke — Echtheit eingehender Zettel (modules/echtheit.js).
 *
 * WARUM DIESER TEST DER WICHTIGSTE IST
 * Ein Relais gehört uns nicht und kann `pubkey`/`content` verändern. Ohne die
 * Prüfung wäre jede Absender-Anzeige und jede darauf gebaute Regel (Kontakte,
 * Zugehörigkeit, Meldungen) wertlos. Dieser Test beweist mit ECHTER Krypto:
 *
 *   - ein richtig signierter Zettel wird ANGENOMMEN
 *   - ein Zettel mit verändertem Text wird ABGELEHNT
 *   - ein Zettel mit untergeschobenem Absender wird ABGELEHNT
 *     (auch dann, wenn die id passend nachgerechnet wurde — die Signatur nicht)
 *   - fremde Signatur unter eigener id: ABGELEHNT
 *   - verstümmelte/unvollständige Zettel: ABGELEHNT, ohne zu werfen
 *
 * Aufruf: node tests/smoke_echtheit.mjs   ·   Exit 0 = grün.
 */
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
// noble-secp256k1 erkennt seinen Zufalls-/Hash-Provider über `self.crypto`
// (Browser-Muster) beim Modul-Laden — vor dem Import setzen.
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;

const { schnorr, utils } = await import('../modules/noble-secp256k1.js');
const { isAuthentic, eventId } = await import('../modules/echtheit.js');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
};

// Zwei Identitäten: die ehrliche und die des Angreifers.
const privA = utils.randomPrivateKey();
const pubA = toHex(schnorr.getPublicKey(privA));
const privB = utils.randomPrivateKey();
const pubB = toHex(schnorr.getPublicKey(privB));

async function sign(priv, pub, content, created_at = 1800000000) {
  const ev = { pubkey: pub, created_at, kind: 1, tags: [['t', 'sbkim-frage-antwort-test']], content };
  ev.id = await eventId(ev);
  ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
  return ev;
}

console.log('== Echtheit eingehender Zettel ==');

// --- 1. Der ehrliche Fall ---
const echt = await sign(privA, pubA, 'Wo bekomme ich bedruckte Tassen?');
ok(await isAuthentic(echt) === true, 'echt signierter Zettel wird angenommen');

// --- 2. Inhalt verändert (Relais schreibt den Text um) ---
const textGeaendert = { ...echt, content: 'Kauf Drogen bei mir' };
ok(await isAuthentic(textGeaendert) === false, 'veränderter Text wird abgelehnt');

// --- 3. Absender untergeschoben, id NICHT nachgerechnet ---
const absenderGetauscht = { ...echt, pubkey: pubB };
ok(await isAuthentic(absenderGetauscht) === false, 'fremder Absender wird abgelehnt');

// --- 4. Der schlaue Angriff: Absender getauscht UND id sauber nachgerechnet.
//        Nur die Signatur kann er nicht erzeugen — genau das fängt Prüfung 2. ---
const schlau = { ...echt, pubkey: pubB };
schlau.id = await eventId(schlau);
ok(await isAuthentic(schlau) === false,
   'untergeschobener Absender MIT nachgerechneter id wird abgelehnt (Signatur trägt nicht)');

// --- 5. Fremde Signatur unter der eigenen id ---
const fremdSigniert = await sign(privA, pubA, 'harmlos');
fremdSigniert.sig = toHex(await schnorr.sign(fromHex(fremdSigniert.id), privB));
ok(await isAuthentic(fremdSigniert) === false, 'Signatur eines anderen Schlüssels wird abgelehnt');

// --- 6. Tags verändert (z. B. Empfänger umgebogen) ---
const tagsGeaendert = { ...echt, tags: [['t', 'ein-anderes-brett']] };
ok(await isAuthentic(tagsGeaendert) === false, 'veränderte Tags werden abgelehnt');

// --- 7. Fail-soft: Müll wirft nicht, sondern gilt als unecht ---
for (const [name, bad] of [
  ['null', null],
  ['leeres Objekt', {}],
  ['id fehlt', { pubkey: pubA, created_at: 1, kind: 1, tags: [], content: 'x', sig: 'aa' }],
  ['sig kein Hex', { ...echt, sig: 'keine-hex-zeichen!!' }],
  ['sig zu kurz', { ...echt, sig: 'abcd' }],
  ['created_at als Text', { ...echt, created_at: '1800000000' }],
]) {
  let threw = false, res = null;
  try { res = await isAuthentic(bad); } catch { threw = true; }
  ok(!threw && res === false, 'fail-soft: ' + name + ' → unecht, ohne zu werfen');
}

// --- 8. Sender und Prüfer rechnen dieselbe id (kein Auseinanderlaufen) ---
ok(await eventId(echt) === echt.id, 'eventId() stimmt mit der beim Senden erzeugten id überein');

console.log('\n== Ergebnis: ' + pass + ' ok, ' + fail + ' FAIL ==');
process.exit(fail === 0 ? 0 : 1);
