#!/usr/bin/env node
/*
 * Smoke — Schritt 2: Sprach-/Bild-Nachricht im privaten DM.
 *
 * Beweist headless (echtes WebCrypto), dass ein Medien-Umschlag durch DIESELBE
 * E2E-DM-Verschlüsselung reist wie Text (kein neuer Kanal, kein Leck):
 *   - Der Umschlag {kbmt:1,k:'image'|'voice',...} wird für B verschlüsselt und
 *     kommt bei B 1:1 wieder heraus (Round-Trip, Bild + Sprache).
 *   - Der Absender A liest die eigene Medien-Nachricht selbst (ECDH symmetrisch).
 *   - Fremder C kann NICHT lesen → null (kein Leck der Mediendaten).
 *   - Der Geheimtext enthält die Base64-Nutzlast NICHT im Klartext.
 *   - parseDmMedia (Format-Vertrag, gespiegelt aus index.html) erkennt Medien
 *     und lehnt reinen Text / fremdes JSON ab.
 * NICHT geprüft (ehrlich): MediaRecorder-Aufnahme, Canvas-Verkleinerung, Live-Relais
 * — das ist Klaus' Browser-Sichttest.
 *
 * Aufruf: node tests/smoke_pinnwand_media.mjs   ·   Exit 0 = grün.
 */
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
if (!globalThis.atob) globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;

const M = await import('../modules/dm_crypto.js');

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name); } }

// --- Format-Vertrag, 1:1 gespiegelt aus index.html (Schritt 2) ---
function makeMediaEnvelope(kind, mime, b64, caption) {
  return JSON.stringify({ kbmt: 1, k: kind, m: mime, d: b64, c: caption || '' });
}
function parseDmMedia(s) {
  if (typeof s !== 'string' || s.charCodeAt(0) !== 123 || s.indexOf('"kbmt"') < 0) return null;
  try { const o = JSON.parse(s); if (o && o.kbmt === 1 && (o.k === 'voice' || o.k === 'image') && typeof o.d === 'string') return o; } catch (_e) { /* */ }
  return null;
}

console.log('== Schritt 2 — Sprach-/Bild-DM (E2E-Umschlag) ==');

const A = M.newIdentity();
const B = M.newIdentity();
const C = M.newIdentity();

const IMG_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD_2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw';
const imgEnv = makeMediaEnvelope('image', 'image/jpeg', IMG_B64, '');
const voiceEnv = makeMediaEnvelope('voice', 'audio/webm', 'GkXfo0AgQoaBAULygQ', '');

// Format-Erkennung
ok(parseDmMedia(imgEnv)?.k === 'image', 'parseDmMedia erkennt Bild-Umschlag');
ok(parseDmMedia(voiceEnv)?.k === 'voice', 'parseDmMedia erkennt Sprach-Umschlag');
ok(parseDmMedia('Was ist ein leichtes Sommeressen?') === null, 'reiner Text wird NICHT als Medium gelesen');
ok(parseDmMedia('{"foo":1}') === null, 'fremdes JSON wird NICHT als Medium gelesen');

// E2E-Round-Trip Bild: A -> B
const boxImg = await M.dmEncrypt(imgEnv, A.priv, B.pub);
ok(M.isDm(boxImg) && boxImg.startsWith('sbkimdm1:'), 'Bild-Umschlag → sbkimdm1-Chiffrat');
ok(boxImg.indexOf(IMG_B64) < 0, 'Chiffrat enthält die Bild-Base64 NICHT im Klartext');
const bReadsImg = await M.dmDecrypt(boxImg, B.priv, A.pub);
ok(bReadsImg === imgEnv, 'B liest den Bild-Umschlag 1:1 zurück');
ok(parseDmMedia(bReadsImg)?.d === IMG_B64, 'entschlüsselte Bilddaten identisch');

// Absender liest selbst (ECDH symmetrisch)
const aReadsOwn = await M.dmDecrypt(boxImg, A.priv, B.pub);
ok(aReadsOwn === imgEnv, 'Absender A liest die eigene Medien-Nachricht');

// Fremder C kann nicht lesen
const cReads = await M.dmDecrypt(boxImg, C.priv, A.pub);
ok(cReads === null, 'Fremder C kann das Medium NICHT lesen (kein Leck)');

// E2E-Round-Trip Sprache
const boxVoice = await M.dmEncrypt(voiceEnv, A.priv, B.pub);
const bReadsVoice = await M.dmDecrypt(boxVoice, B.priv, A.pub);
ok(bReadsVoice === voiceEnv && parseDmMedia(bReadsVoice)?.k === 'voice', 'Sprach-Umschlag Round-Trip A→B');

console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
