#!/usr/bin/env node
/*
 * Smoke — Wieder wegnehmen: Kontakt entfernen + eigene Nachrichten zurückziehen.
 *
 * Klaus' Befund 2026-08-01: „Der Kontakt muss auch wieder entfernt werden
 * können … und ich sehe noch nicht das Löschen der Nachrichten." Danach, am
 * Zettel selbst: „Kontakt entfernen geht aber nicht direkt im Antwortfeld."
 * Sein Vorschlag: „Kontakt plus und minus würde auch gehen."
 *
 * Beides gab es schon — aber zu versteckt. Geprüft wird darum, dass es DORT
 * greifbar ist, wo man es sucht:
 *   - Am Zettel steht bei einem Kontakt „➖ Kontakt" an genau der Stelle, wo
 *     vorher „➕ Kontakt" stand (Spiegelbild, gleicher Platz).
 *   - Ein Tipp darauf entfernt ihn wirklich (nach Rückfrage) — der Knopf
 *     wechselt sofort zurück auf ➕, ohne Neuladen.
 *   - Rückfrage abgelehnt = nichts passiert.
 *   - Er verschwindet auch aus „Privat an" (sonst stünde er dort weiter).
 *   - „🗑 Meine zurückziehen" zieht ALLE eigenen Nachrichten zurück und lässt
 *     fremde unberührt.
 *
 * Gemessen wird an der DARSTELLUNG und am ECHTEN Knopf — nicht an Attributen
 * und nicht durch direkten Aufruf der Hilfsfunktionen.
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_kontakt_weg.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8471;
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

  const sichtbar = (t) => p.evaluate((x) => document.body.innerText.includes(x), t);

  console.log('== Wieder wegnehmen: Kontakt + eigene Nachrichten ==');

  // Ein fremder Zettel (echt signiert — sonst verwirft echtheit.js ihn).
  const FREMD = await p.evaluate(async () => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    const priv = utils.randomPrivateKey();
    const pub = toHex(schnorr.getPublicKey(priv));
    const ev = {
      pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
      tags: [['t', 'sbkim-frage-antwort-test']], content: 'Fremder Zettel bleibt stehen',
    };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
    await window.__kb.dispatch(ev, 'wss://test');
    return pub;
  });
  await p.waitForTimeout(700);

  const sel = (kl) => '.' + kl + '[data-pub-btn="' + FREMD + '"]';
  ok(await p.$(sel('kb-addcontact')), 'am fremden Zettel steht zuerst „➕ Kontakt"');

  // --- Aufnehmen (über den echten Knopf) ---
  p.once('dialog', (d) => d.accept('Anna'));
  await p.click(sel('kb-addcontact'));
  await p.waitForTimeout(500);

  const nachAufnahme = await p.evaluate((s) => {
    const b = document.querySelector(s);
    return b ? { text: b.innerText.trim(), sichtbar: b.offsetParent !== null } : null;
  }, sel('kb-iscontact'));
  ok(!!nachAufnahme, 'nach dem Aufnehmen steht dort ein Knopf für den Kontakt-Zustand');
  ok(nachAufnahme && /➖/.test(nachAufnahme.text), '…und zwar das MINUS — Spiegelbild zum Plus: ' + (nachAufnahme && nachAufnahme.text));
  ok(nachAufnahme && /Kontakt/.test(nachAufnahme.text), '…beschriftet („➖ Kontakt", nicht nur ein Zeichen)');
  ok(nachAufnahme && nachAufnahme.sichtbar === true, '…und wirklich sichtbar (Darstellung, nicht Attribut)');
  ok((await p.evaluate(() => document.querySelectorAll('.kb-addcontact').length)) === 0, 'das ➕ ist verschwunden (nicht doppelt)');

  // --- Rückfrage ABLEHNEN: nichts darf passieren ---
  p.once('dialog', (d) => d.dismiss());
  await p.click(sel('kb-iscontact'));
  await p.waitForTimeout(400);
  ok(await p.$(sel('kb-iscontact')), 'Rückfrage abgelehnt → der Kontakt bleibt');
  ok(await p.evaluate((f) => !!window.__kb.contacts()[f], FREMD), '…auch im Speicher unverändert');

  // --- Wirklich entfernen, direkt am Zettel ---
  p.once('dialog', (d) => d.accept());
  await p.click(sel('kb-iscontact'));
  await p.waitForTimeout(500);

  ok(!(await p.evaluate((f) => !!window.__kb.contacts()[f], FREMD)), 'Rückfrage bestätigt → der Kontakt ist weg');
  ok(await p.$(sel('kb-addcontact')), '…und der Knopf steht sofort wieder auf „➕ Kontakt" (ohne Neuladen)');
  ok((await p.evaluate(() => document.querySelectorAll('.kb-iscontact').length)) === 0, '…kein ➖ bleibt zurück');
  const inAuswahl = await p.evaluate((f) => [...document.querySelectorAll('#dm-to option')].some((o) => o.value === f), FREMD);
  ok(inAuswahl === false, '…und er steht auch nicht mehr in „Privat an"');
  ok(await p.$('.kb-mute[data-mute-pub="' + FREMD + '"]'), '…der Stumm-Knopf ist wieder da (gilt nur für Nicht-Kontakte)');

  // --- Zweiter Weg: dasselbe im Kontakt-Profil (auf den Namen tippen) ---
  p.once('dialog', (d) => d.accept('Anna'));
  await p.click(sel('kb-addcontact'));
  await p.waitForTimeout(400);
  await p.click('.kb-who-click[data-pub="' + FREMD + '"]');
  await p.waitForTimeout(500);
  ok(await p.$('.kb-prof-remove'), 'im Profil gibt es „🗑 Entfernen"');
  p.once('dialog', (d) => d.accept());
  await p.click('.kb-prof-remove');
  await p.waitForTimeout(500);
  ok(!(await p.evaluate((f) => !!window.__kb.contacts()[f], FREMD)), '…und es entfernt ihn ebenfalls');
  ok(!(await p.$('.kb-prof-remove')), '…das Profil schließt sich danach');

  // --- „🗑 Meine zurückziehen": eigene weg, fremde bleiben ---
  await p.evaluate(async () => {
    for (const t of ['Mein erster Zettel', 'Mein zweiter Zettel']) {
      const ev = await window.__kb.buildEvent(t);
      await window.__kb.dispatch(ev, 'wss://test');
    }
  });
  await p.waitForTimeout(700);
  ok(await sichtbar('Mein erster Zettel'), 'zwei eigene Zettel liegen auf dem Brett');

  const knopfDa = await p.evaluate(() => {
    const b = document.getElementById('meine-zurueckziehen');
    return !!b && b.offsetParent !== null;
  });
  ok(knopfDa, 'der Knopf „🗑 Meine zurückziehen" ist sichtbar (nicht versteckt)');

  // Rückfrage erst ablehnen — es darf nichts verschwinden.
  p.once('dialog', (d) => d.dismiss());
  await p.click('#meine-zurueckziehen');
  await p.waitForTimeout(400);
  ok(await sichtbar('Mein erster Zettel'), 'Rückfrage abgelehnt → nichts wird zurückgezogen');

  // Jetzt bestätigen.
  const raus = await p.evaluate(async () => {
    const gesendet = [];
    const urspr = WebSocket.prototype.send;
    WebSocket.prototype.send = function (d) { gesendet.push(d); };
    window.confirm = () => true;
    document.getElementById('meine-zurueckziehen').click();
    await new Promise((r) => setTimeout(r, 1200));
    WebSocket.prototype.send = urspr;
    return gesendet;
  });
  ok(!(await sichtbar('Mein erster Zettel')) && !(await sichtbar('Mein zweiter Zettel')),
    'bestätigt → ALLE eigenen Nachrichten sind weg');
  ok(await sichtbar('Fremder Zettel bleibt stehen'), 'SICHERHEIT: der fremde Zettel bleibt unberührt');
  ok((await p.evaluate(() => window.__kb.zurueckgezogene().length)) >= 2,
    '…und beide sind als zurückgezogen gemerkt (kommen nicht wieder)');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
