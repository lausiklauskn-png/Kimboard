#!/usr/bin/env node
/*
 * Smoke — B7: Pinnwand E2E-Direktnachricht (ECDH auf Nostr-Schlüsseln + TOFU/SAS).
 *
 * Beweist die sicherheits-kritischen Eigenschaften headless (echtes WebCrypto):
 *   - Round-Trip: A verschlüsselt für B → B liest (mit A's Pub). Klartext == Original.
 *   - Sender liest selbst: A liest die eigene Nachricht mit B's Pub (ECDH symmetrisch).
 *   - Fremder C kann NICHT lesen (mit A's Pub) → null (kein Leck).
 *   - Falscher Schlüssel / Manipulation → null (fail-soft).
 *   - Sicherheitsnummer (SAS): symmetrisch (A,B)==(B,A); verschieden für anderes Paar (MITM sichtbar).
 *
 * Aufruf: node tests/smoke_pinnwand_dm.mjs   ·   Exit 0 = grün.
 */
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
if (!globalThis.atob) globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
// noble-secp256k1 erkennt seinen Zufalls-/Hash-Provider über `self.crypto`
// (Browser-Muster) beim Modul-Laden — vor dem Import setzen.
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;

const M = await import('../modules/dm_crypto.js');

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name); } }

console.log('== B7 — Pinnwand E2E (ECDH + TOFU/SAS) ==');

const A = M.newIdentity();
const B = M.newIdentity();
const C = M.newIdentity();
ok(A.pub.length === 64 && B.pub.length === 64, 'Identitäten erzeugt (x-only Pubkeys)');
ok(M.pubFromPriv(A.priv) === A.pub, 'pubFromPriv reproduziert den Pubkey');

const SECRET = 'Nur für dich, B: Treffpunkt 18 Uhr.';
const box = await M.dmEncrypt(SECRET, A.priv, B.pub); // A -> B
ok(M.isDm(box) && box.startsWith('sbkimdm1:'), 'dmEncrypt liefert sbkimdm1-Umschlag');
ok(box.indexOf(SECRET) < 0, 'Umschlag enthält KEINEN Klartext');

// B liest (mit A's Pubkey, da A der Absender ist)
ok((await M.dmDecrypt(box, B.priv, A.pub)) === SECRET, 'B entschlüsselt (mit A-Pub) == Original');
// A (Sender) liest die eigene Nachricht (mit B's Pub, dem Empfänger) — ECDH symmetrisch
ok((await M.dmDecrypt(box, A.priv, B.pub)) === SECRET, 'A liest eigene Nachricht (mit B-Pub)');

// Fremder C kann nicht lesen
ok((await M.dmDecrypt(box, C.priv, A.pub)) === null, 'Fremder C -> null (kein Leck)');
ok((await M.dmDecrypt(box, B.priv, C.pub)) === null, 'falscher Gegen-Pubkey -> null');

// Manipulation erkannt (AES-GCM)
const tampered = box.slice(0, -4) + (box.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
ok((await M.dmDecrypt(tampered, B.priv, A.pub)) === null, 'manipulierter Umschlag -> null');

// Nicht-DM-Eingaben fail-soft
ok((await M.dmDecrypt('normaler text', B.priv, A.pub)) === null, 'Nicht-DM-Text -> null');
ok(M.isDm('sbkimenc1:...') === false, 'isDm trennt vom Passwort-Weg (sbkimenc1)');

// --- Regression: privater Schlüssel als Uint8Array (wie die echte App ihn reicht) ---
// index.html macht `const priv = fromHex(privHex)` → Bytes, NICHT Hex-Text.
// Vor dem Fix stürzte das mit „h.substr is not a function" ab (Browser-Befund 18.07).
function fromHex(h) { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
const aPrivBytes = fromHex(A.priv);
const bPrivBytes = fromHex(B.priv);
const boxBytes = await M.dmEncrypt(SECRET, aPrivBytes, B.pub);      // A(Bytes) -> B
ok(M.isDm(boxBytes), 'dmEncrypt akzeptiert Uint8Array-Priv (App-Fall)');
ok((await M.dmDecrypt(boxBytes, bPrivBytes, A.pub)) === SECRET, 'B(Bytes) entschlüsselt Uint8Array-Nachricht == Original');
ok((await M.dmDecrypt(boxBytes, B.priv, A.pub)) === SECRET, 'Bytes-Umschlag auch mit Hex-Priv lesbar (beide Wege gemischt)');

// Sicherheitsnummer (SAS)
const sasAB = await M.safetyNumber(A.pub, B.pub);
const sasBA = await M.safetyNumber(B.pub, A.pub);
ok(sasAB === sasBA && sasAB.length > 0, 'Sicherheitsnummer symmetrisch (A,B)==(B,A)');
const sasAC = await M.safetyNumber(A.pub, C.pub);
ok(sasAC !== sasAB, 'Sicherheitsnummer verschieden für anderes Paar (MITM sichtbar)');

console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail === 0 ? 0 : 1);
