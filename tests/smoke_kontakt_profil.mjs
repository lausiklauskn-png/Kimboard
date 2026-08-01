#!/usr/bin/env node
/*
 * Smoke — Stufe 3b: Kontakt-Profil beim Tippen auf den Namen (echter Browser).
 *
 * WhatsApp-Muster: Ein Tipp auf den Namen zeigt das PROFIL. Vorher öffnete sich
 * auch bei bekannten Kontakten nur die Namens-Abfrage, und die Sicherheitsnummer
 * lag versteckt in der Kontakt-Verwaltung — also nicht dort, wo man sie sucht.
 *
 * Geprüft wird:
 *   - UNBEKANNT: Tipp auf den Namen fragt nach dem Namen (= aufnehmen), es
 *     öffnet sich KEIN Profil.
 *   - BEKANNT: Tipp auf den Namen öffnet das Profil mit einer ECHTEN, aus
 *     beiden Schlüsseln berechneten Sicherheitsnummer (nicht „…“).
 *   - „Privat schreiben" setzt den Empfänger und schließt das Profil.
 *   - „Umbenennen" wirkt sofort — im Profil UND am Zettel.
 *   - „Entfernen" löscht den Kontakt und macht am Zettel wieder „➕ Kontakt".
 *   - Am EIGENEN Namen passiert nichts (man ist nicht sein eigener Kontakt).
 *
 * Sichtbarkeit wird an der DARSTELLUNG geprüft (offsetParent), nie an einem
 * Attribut — siehe die Lehre aus dem ➕-Menü-Fehler vom 2026-08-01.
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_kontakt_profil.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8453;
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

  const profilOffen = () => p.evaluate(() => {
    const b = document.getElementById('kontakt-profil');
    return !!b && b.offsetParent !== null;      // die Darstellung entscheidet
  });

  // Ein echter fremder Zettel (echt signiert — sonst verwirft ihn echtheit.js).
  const FREMD = await p.evaluate(async () => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    const priv = utils.randomPrivateKey();
    const pub = toHex(schnorr.getPublicKey(priv));
    const ev = {
      pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
      tags: [['t', 'sbkim-frage-antwort-test']], content: 'Zettel von einem Fremden',
    };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
    await window.__kb.dispatch(ev, 'wss://test');
    await window.__kb.dispatch(await window.__kb.buildEvent('Mein eigener Zettel'), 'wss://test');
    return pub;
  });
  await p.waitForTimeout(600);

  console.log('== Stufe 3b — Kontakt-Profil ==');

  const namePub = (f) => '[data-pub="' + f + '"]';

  // 1. UNBEKANNT → aufnehmen, kein Profil
  let gefragt = false;
  p.once('dialog', (d) => { gefragt = true; d.accept('Nachbarin Eva'); });
  await p.click(namePub(FREMD));
  await p.waitForTimeout(700);
  ok(gefragt, 'unbekannter Name: es wird nach dem Namen gefragt (aufnehmen)');
  ok(!(await profilOffen()), '…und KEIN Profil geöffnet');
  ok(await p.evaluate((f) => !!window.__kb.contacts()[f], FREMD), 'Kontakt ist jetzt gespeichert');

  // 2. BEKANNT → Profil mit echter Sicherheitsnummer
  await p.click(namePub(FREMD));
  await p.waitForTimeout(700);
  ok(await profilOffen(), 'bekannter Kontakt: Tipp auf den Namen öffnet das Profil');
  const txt = await p.textContent('#kontakt-profil');
  ok(/Nachbarin Eva/.test(txt), 'Profil zeigt den Namen');
  ok(txt.includes(FREMD), 'Profil zeigt die Kennung');
  const sn = (await p.textContent('.kb-sn')).trim();
  ok(sn.length >= 6 && sn !== '…', 'Sicherheitsnummer ist berechnet: ' + sn.slice(0, 28));
  ok(/vorlesen/.test(txt) && /kein Fremder/.test(txt), '…mit dem Hinweis, wozu sie dient');

  // Sie muss zur Verwaltung passen (dieselbe Berechnung, beide Richtungen gleich)
  const snRef = await p.evaluate(async (f) => {
    const { safetyNumber } = await import('./modules/dm_crypto.js');
    return await safetyNumber(window.__kb.me(), f);
  }, FREMD);
  ok(sn === snRef, 'Sicherheitsnummer stimmt mit der Berechnung überein');

  // 3. „Privat schreiben"
  await p.click('.kb-prof-write');
  await p.waitForTimeout(600);
  ok(!(await profilOffen()), '„Privat schreiben" schließt das Profil');
  ok(await p.evaluate((f) => document.getElementById('dm-to').value === f, FREMD),
    '…und setzt den Empfänger auf diese Person');

  // 4. Umbenennen wirkt sofort — im Profil und am Zettel
  await p.click(namePub(FREMD)); await p.waitForTimeout(600);
  p.once('dialog', (d) => d.accept('Eva'));
  await p.click('.kb-prof-rename');
  await p.waitForTimeout(700);
  ok(/👤 Eva/.test(await p.textContent('#kontakt-profil')), 'Umbenennen wirkt sofort im Profil');
  ok(await p.evaluate((f) => document.querySelector('[data-pub="' + f + '"]').textContent.includes('Eva'), FREMD),
    '…und sofort am Zettel');

  // 5. Entfernen
  p.once('dialog', (d) => d.accept());
  await p.click('.kb-prof-remove');
  await p.waitForTimeout(700);
  ok(!(await profilOffen()), 'Entfernen schließt das Profil');
  ok(await p.evaluate((f) => !window.__kb.contacts()[f], FREMD), '…und der Kontakt ist weg');
  ok(await p.evaluate((f) => !!document.querySelector('.kb-addcontact[data-pub-btn="' + f + '"]'), FREMD),
    '…am Zettel steht wieder „➕ Kontakt"');

  // 6. Eigener Name: nichts passiert
  const eigene = await p.evaluate(() => {
    const me = window.__kb.me();
    const n = document.querySelector('[data-pub="' + me + '"]');
    return { da: !!n, klickbar: n ? n.classList.contains('kb-who-click') : null };
  });
  ok(eigene.da && eigene.klickbar === false, 'der eigene Name ist nicht als Kontakt antippbar');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
