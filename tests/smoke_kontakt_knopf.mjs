#!/usr/bin/env node
/*
 * Smoke — Stufe 1: sichtbarer „➕ Kontakt"-Knopf am Zettel (echter Browser).
 *
 * Klaus' Befund 2026-07-28: Wie ein Kontakt überhaupt entsteht, war nicht zu
 * erkennen — der Absender-Name war nur unsichtbar klickbar. Geprüft wird:
 *   - An einem FREMDEN Zettel steht ein sichtbarer Knopf „➕ Kontakt";
 *     am EIGENEN Zettel nicht.
 *   - Ein Klick merkt den Kontakt (kein Schlüssel-Abtippen nötig — der
 *     Schlüssel steckt schon im Zettel).
 *   - Danach wechselt die Beschriftung SOFORT von der kryptischen Kennung auf
 *     den Namen, und der Knopf wird zum Kontakt-Zeichen 👤 — ohne Neuladen.
 *   - Das gilt auch an ANTWORTEN, nicht nur an Fragen.
 *   - Im Erklär-Modus wird der Knopf erklärt statt ausgeführt.
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_kontakt_knopf.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8443;
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

  // Zwei Zettel einschleusen: einer von einem Fremden, einer von mir selbst.
  // WICHTIG: beide werden ECHT signiert. Seit der Echtheitsprüfung
  // (modules/echtheit.js) verwirft die App Zettel mit Fantasie-Signatur —
  // ein Test mit `sig: '0'.repeat(128)` würde (zu Recht) nichts mehr anzeigen.
  const { FREMD, FREMD_ID } = await p.evaluate(async () => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => {
      const o = new Uint8Array(h.length / 2);
      for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16);
      return o;
    };
    // Ein echter fremder Absender (eigenes Schlüsselpaar).
    const priv = utils.randomPrivateKey();
    const pub = toHex(schnorr.getPublicKey(priv));
    const ev = {
      pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
      tags: [['t', 'sbkim-frage-antwort-test']], content: 'Zettel von einem Fremden',
    };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
    await window.__kb.dispatch(ev, 'wss://test');
    // Mein eigener Zettel — von der App selbst signiert.
    await window.__kb.dispatch(await window.__kb.buildEvent('Mein eigener Zettel'), 'wss://test');
    return { FREMD: pub, FREMD_ID: ev.id };
  });
  await p.waitForTimeout(600);

  console.log('== Stufe 1 — „➕ Kontakt" am Zettel ==');

  const cards = await p.evaluate(() => document.querySelectorAll('.q-card').length);
  ok(cards >= 2, 'beide Testzettel werden angezeigt (' + cards + ')');

  const btns = await p.evaluate(() => document.querySelectorAll('.kb-addcontact').length);
  ok(btns === 1, 'genau EIN Kontakt-Knopf — nur am fremden Zettel, nicht am eigenen (' + btns + ')');
  ok(await p.evaluate((f) => !!document.querySelector('.kb-addcontact[data-pub-btn="' + f + '"]'), FREMD),
    'der Knopf hängt am fremden Absender');
  ok((await p.textContent('.kb-addcontact')).includes('Kontakt'), 'Knopf ist beschriftet („➕ Kontakt")');

  // Vor dem Merken: kryptische Kennung, kein Name.
  const vorher = await p.evaluate((f) => document.querySelector('[data-pub="' + f + '"]').textContent, FREMD);
  ok(!/Freundin/.test(vorher), 'vorher steht nur die Kennung da: ' + vorher.slice(0, 24));

  // Klick auf den Knopf → Name eingeben (prompt) → gemerkt.
  p.once('dialog', (d) => d.accept('Freundin Anna'));
  await p.click('.kb-addcontact');
  await p.waitForTimeout(700);

  ok(await p.evaluate((f) => !!window.__kb.contacts()[f], FREMD), 'Kontakt ist gespeichert');
  const nachher = await p.evaluate((f) => document.querySelector('[data-pub="' + f + '"]').textContent, FREMD);
  ok(/Freundin Anna/.test(nachher), 'Beschriftung wechselt SOFORT auf den Namen: ' + nachher.slice(0, 30));
  ok((await p.evaluate(() => document.querySelectorAll('.kb-addcontact').length)) === 0, 'Knopf verschwindet nach dem Merken');
  ok((await p.evaluate(() => document.querySelectorAll('.kb-iscontact').length)) >= 1, 'stattdessen steht der Kontakt-Zustand da (➖ Kontakt — zum Wieder-Entfernen)');
  ok(await p.evaluate((f) => !!document.querySelector('#dm-to option[value="' + f + '"]'), FREMD),
    'der Kontakt steht sofort in „Privat an" zur Auswahl');

  // Auch an ANTWORTEN muss der Knopf erscheinen — ebenfalls echt signiert.
  const FREMD2 = await p.evaluate(async (fragenId) => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => {
      const o = new Uint8Array(h.length / 2);
      for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16);
      return o;
    };
    const priv = utils.randomPrivateKey();
    const pub = toHex(schnorr.getPublicKey(priv));
    const ev = {
      pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
      tags: [['t', 'sbkim-frage-antwort-test'], ['e', fragenId]],
      content: 'Eine Antwort von jemand anderem',
    };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
    await window.__kb.dispatch(ev, 'wss://test');
    return pub;
  }, FREMD_ID);
  await p.waitForTimeout(600);
  ok(await p.evaluate((f2) => !!document.querySelector('.a-head .kb-addcontact[data-pub-btn="' + f2 + '"]'), FREMD2),
    'auch an einer Antwort steht der Knopf');

  // ── ECHTHEIT, End-zu-End im echten Browser ────────────────────────────────
  // Ein bösartiges Relais schiebt einen Zettel unter fremdem Namen ein. Er darf
  // NICHT erscheinen — sonst wäre jede Kontakt-Regel wertlos.
  const vorFaelschung = await p.evaluate(() => document.querySelectorAll('.q-card').length);
  const faelschungAngenommen = await p.evaluate(async () => {
    const { eventId } = await import('./modules/echtheit.js');
    // Absender: ein bereits bekannter Kontakt — der schlimmste Fall.
    const opfer = Object.keys(window.__kb.contacts())[0];
    const ev = {
      pubkey: opfer, created_at: Math.floor(Date.now() / 1000), kind: 1,
      tags: [['t', 'sbkim-frage-antwort-test']],
      content: 'GEFÄLSCHT — angeblich von einem Kontakt',
    };
    ev.id = await eventId(ev);                 // id sauber nachgerechnet …
    ev.sig = '0'.repeat(128);                  // … aber Signatur erfunden
    await window.__kb.dispatch(ev, 'wss://boeses-relais');
    return document.body.textContent.includes('GEFÄLSCHT');
  });
  await p.waitForTimeout(400);
  const nachFaelschung = await p.evaluate(() => document.querySelectorAll('.q-card').length);
  ok(faelschungAngenommen === false, 'gefälschter Zettel wird NICHT angezeigt (Text kommt nirgends vor)');
  ok(nachFaelschung === vorFaelschung, 'gefälschter Zettel erzeugt keine Karte (' + vorFaelschung + ' → ' + nachFaelschung + ')');
  ok(await p.evaluate(() => { const e = document.getElementById('echtheit'); return !!e && !e.hidden && /verworfen/.test(e.textContent); }),
    'die Verwerfung wird ehrlich angezeigt statt still verschluckt');

  // Erklär-Modus: der Knopf wird erklärt statt ausgeführt.
  await p.evaluate(() => window.__hilfe.setMode(true));
  await p.waitForTimeout(300);
  await p.click('.kb-addcontact');
  await p.waitForTimeout(500);
  const bubble = await p.evaluate(() => {
    const d = [...document.querySelectorAll('div')].find((x) => /verstanden/.test(x.textContent) && x.style.position === 'fixed');
    return d ? d.textContent : '';
  });
  ok(/Kontakt/.test(bubble) && /Schlüssel/.test(bubble), 'im Erklär-Modus wird der Knopf erklärt');
  ok((await p.evaluate((f2) => Object.keys(window.__kb.contacts()).includes(f2), FREMD2)) === false,
    '…und NICHT ausgeführt (kein zweiter Kontakt entstanden)');
  await p.evaluate(() => window.__hilfe.setMode(false));

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
