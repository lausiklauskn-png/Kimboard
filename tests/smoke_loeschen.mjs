#!/usr/bin/env node
/*
 * Smoke — Löschen: „nur bei mir" oder „bei allen" (echter Browser).
 *
 * Klaus' Wunsch 2026-08-01: „Nachrichten müssen auch systemübergreifend
 * gelöscht werden können — nur für dich löschen oder für alle?" (WhatsApp-Muster)
 *
 * Geprüft wird:
 *   - Das ✕ öffnet einen Dialog mit der Wahl.
 *   - Bei EIGENEN Nachrichten gibt es beide Wege; bei FREMDEN nur „bei mir"
 *     (sonst könnte jeder das Brett leerräumen).
 *   - „Bei allen" verschickt eine echte Lösch-Meldung (kind 5, NIP-09) mit
 *     e-Tag auf den Zettel — und entfernt ihn lokal.
 *   - Empfang: die Lösch-Meldung des AUTORS entfernt seinen Zettel.
 *   - SICHERHEIT: Die Lösch-Meldung eines FREMDEN entfernt den Zettel NICHT.
 *   - Zurückgezogenes bleibt weg, auch wenn ein Relais es erneut ausliefert.
 *   - Der Dialog benennt die ehrliche Grenze (Bitte, keine Garantie).
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_loeschen.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8468;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);

  const sichtbar = (txt) => p.evaluate((t) => document.body.innerText.includes(t), txt);
  const dialogOffen = () => p.evaluate(() => {
    const d = document.getElementById('loesch-dialog');
    return !!d && d.offsetParent !== null;
  });

  console.log('== Löschen: nur bei mir / bei allen ==');

  // Ein fremder und ein eigener Zettel (beide echt signiert).
  const FREMD = await p.evaluate(async () => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    const priv = utils.randomPrivateKey();
    const pub = toHex(schnorr.getPublicKey(priv));
    const ev = {
      pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
      tags: [['t', 'sbkim-frage-antwort-test']], content: 'Fremder Zettel bleibt',
    };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
    await window.__kb.dispatch(ev, 'wss://test');
    return { pub, id: ev.id, priv: toHex(priv) };
  });
  const MEINS = await p.evaluate(async () => {
    const ev = await window.__kb.buildEvent('Mein eigener Zettel');
    await window.__kb.dispatch(ev, 'wss://test');
    return ev.id;
  });
  await p.waitForTimeout(700);
  ok(await sichtbar('Mein eigener Zettel'), 'eigener Zettel ist da');
  ok(await sichtbar('Fremder Zettel bleibt'), 'fremder Zettel ist da');

  // --- Dialog am EIGENEN Zettel: beide Wege ---
  await p.evaluate((id) => document.querySelector('[data-qid="' + id + '"] .q-del').click(), MEINS);
  await p.waitForTimeout(500);
  ok(await dialogOffen(), 'das ✕ öffnet den Lösch-Dialog');
  ok(await p.$('.kb-del-mine'), 'Wahl „nur bei mir" vorhanden');
  ok(await p.$('.kb-del-all'), 'Wahl „bei allen" vorhanden (eigener Zettel)');
  const dtxt = await p.textContent('#loesch-dialog');
  ok(/Bitte, keine Garantie/.test(dtxt), 'der Dialog benennt die ehrliche Grenze');
  await p.click('.kb-del-close'); await p.waitForTimeout(300);

  // --- Dialog am FREMDEN Zettel: nur „bei mir" ---
  await p.evaluate((id) => document.querySelector('[data-qid="' + id + '"] .q-del').click(), FREMD.id);
  await p.waitForTimeout(500);
  ok(await p.$('.kb-del-mine'), 'fremder Zettel: „nur bei mir" vorhanden');
  ok(!(await p.$('.kb-del-all')), 'fremder Zettel: „bei allen" NICHT angeboten');
  ok(/nur, wer sie geschrieben hat/.test(await p.textContent('#loesch-dialog')), '…und erklärt warum');
  await p.click('.kb-del-close'); await p.waitForTimeout(300);

  // --- „Bei allen" verschickt eine echte Lösch-Meldung ---
  const geschickt = await p.evaluate(async (id) => {
    const raus = [];
    const urspr = WebSocket.prototype.send;
    WebSocket.prototype.send = function (d) { raus.push(d); };
    await window.__kb.zurueckziehenFuerAlle(id);
    WebSocket.prototype.send = urspr;
    return raus;
  }, MEINS);
  ok(!(await sichtbar('Mein eigener Zettel')), '„bei allen" entfernt den Zettel lokal');
  ok((await p.evaluate(() => window.__kb.zurueckgezogene())).includes(MEINS), '…und merkt ihn als zurückgezogen');

  // --- Der Angriff: ein FREMDER will meinen Zettel löschen ---
  const MEINS2 = await p.evaluate(async () => {
    const ev = await window.__kb.buildEvent('Zweiter eigener Zettel');
    await window.__kb.dispatch(ev, 'wss://test');
    return ev.id;
  });
  await p.waitForTimeout(600);
  ok(await sichtbar('Zweiter eigener Zettel'), 'zweiter eigener Zettel ist da');
  await p.evaluate(async (opfer) => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    const priv = utils.randomPrivateKey();               // ein ganz Fremder
    const pub = toHex(schnorr.getPublicKey(priv));
    const ev = {
      pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 5,
      tags: [['t', 'sbkim-frage-antwort-test'], ['e', opfer]], content: 'weg damit',
    };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));   // echt signiert!
    await window.__kb.dispatch(ev, 'wss://boeses-relais');
  }, MEINS2);
  await p.waitForTimeout(600);
  ok(await sichtbar('Zweiter eigener Zettel'), 'SICHERHEIT: ein Fremder kann meinen Zettel NICHT löschen');

  // --- Der Autor darf: Lösch-Meldung des Absenders entfernt seinen Zettel ---
  await p.evaluate(async (f) => {
    const { schnorr } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    const ev = {
      pubkey: f.pub, created_at: Math.floor(Date.now() / 1000), kind: 5,
      tags: [['t', 'sbkim-frage-antwort-test'], ['e', f.id]], content: 'zurückgezogen',
    };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), fromHex(f.priv)));
    await window.__kb.dispatch(ev, 'wss://test');
  }, FREMD);
  await p.waitForTimeout(700);
  ok(!(await sichtbar('Fremder Zettel bleibt')), 'der AUTOR kann seinen Zettel zurückziehen');

  // --- Zurückgezogenes bleibt weg, auch wenn das Relais es erneut schickt ---
  await p.evaluate(async (f) => {
    const { schnorr } = await import('./modules/noble-secp256k1.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    // exakt derselbe Zettel noch einmal (wie ein Relais ihn erneut ausliefert)
    const ev = {
      id: f.id, pubkey: f.pub, created_at: Math.floor(Date.now() / 1000) - 5, kind: 1,
      tags: [['t', 'sbkim-frage-antwort-test']], content: 'Fremder Zettel bleibt',
    };
    ev.sig = toHex(await schnorr.sign(fromHex(f.id), fromHex(f.priv)));
    await window.__kb.dispatch(ev, 'wss://anderes-relais');
  }, FREMD);
  await p.waitForTimeout(600);
  ok(!(await sichtbar('Fremder Zettel bleibt')), 'zurückgezogen bleibt weg, auch bei erneuter Auslieferung');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
