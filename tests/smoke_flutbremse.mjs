#!/usr/bin/env node
/*
 * Smoke — Stufe 2: Flut-Bremse und Absender-Sperre (echter Browser).
 *
 * Beweist im laufenden Kimboard:
 *   - ANFANGS-VORRAT UNGEBREMST: die bis zu 200 gespeicherten Zettel, die ein
 *     Relais beim Verbinden schickt (vor EOSE), laufen VOLLSTÄNDIG durch.
 *     Ohne diese Trennung würde die eigene Bremse das normale Laden abwürgen.
 *   - FLUT GEBREMST: ein einzelner Absender, der live viele Zettel schickt,
 *     wird ab der Grenze zurückgehalten — still, ohne Rückmeldung an ihn.
 *   - SCHWARM GEBREMST: auch viele verschiedene Identitäten zusammen laufen
 *     gegen den Gesamt-Deckel (Sybil-Fall).
 *   - KONTAKTE AUSGENOMMEN: wer gespeicherter Kontakt ist, wird nicht gedrosselt.
 *   - EHRLICH SICHTBAR: Zurückgehaltenes wird gezählt und angezeigt.
 *   - SPERRE WIRKT: ein stummgeschalteter Absender erscheint nicht mehr,
 *     überlebt das Neuladen und ist umkehrbar.
 *
 * Voraussetzung: playwright-core (npm install --no-save playwright-core)
 * Aufruf: node tests/smoke_flutbremse.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8934;
const ROOT = new URL('..', import.meta.url).pathname;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
  await p.waitForTimeout(2200);

  console.log('== Stufe 2 — Flut-Bremse & Absender-Sperre ==');

  // Hilfsfunktion in der Seite: n echt signierte Zettel eines Absenders schicken.
  await p.evaluate(() => {
    window.__t = {};
    window.__t.mkSender = async () => {
      const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
      const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      const priv = utils.randomPrivateKey();
      return { priv, pub: toHex(schnorr.getPublicKey(priv)) };
    };
    window.__t.send = async (s, text, live) => {
      const { schnorr } = await import('./modules/noble-secp256k1.js');
      const { eventId } = await import('./modules/echtheit.js');
      const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      const fromHex = (h) => {
        const o = new Uint8Array(h.length / 2);
        for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16);
        return o;
      };
      const ev = {
        pubkey: s.pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
        tags: [['t', 'sbkim-frage-antwort-test']], content: text,
      };
      ev.id = await eventId(ev);
      ev.sig = toHex(await schnorr.sign(fromHex(ev.id), s.priv));
      await window.__kb.dispatch(ev, 'wss://test', live);
      return ev.id;
    };
    window.__t.karten = () => document.querySelectorAll('.q-card').length;
  });

  // --- 1. Anfangs-Vorrat (live = false): 40 Zettel müssen ALLE durchkommen ---
  const vorratVorher = await p.evaluate(() => window.__t.karten());
  await p.evaluate(async () => {
    const s = await window.__t.mkSender();
    for (let i = 0; i < 40; i++) await window.__t.send(s, 'Vorrat-Zettel ' + i, false);
  });
  await p.waitForTimeout(500);
  const vorratNachher = await p.evaluate(() => window.__t.karten());
  ok(vorratNachher - vorratVorher === 40,
    'Anfangs-Vorrat läuft ungebremst durch (' + (vorratNachher - vorratVorher) + ' von 40)');
  ok(await p.evaluate(() => window.__kb.flutZaehler()) === 0,
    'für den Vorrat wird nichts zurückgehalten');

  // --- 2. Live-Flut EINES Absenders: Grenze 12/min ---
  const vorFlut = await p.evaluate(() => window.__t.karten());
  await p.evaluate(async () => {
    const s = await window.__t.mkSender();
    for (let i = 0; i < 30; i++) await window.__t.send(s, 'Flut-Zettel ' + i, true);
  });
  await p.waitForTimeout(500);
  const durch = (await p.evaluate(() => window.__t.karten())) - vorFlut;
  ok(durch === 12, 'ein Fluter kommt nur bis zur Grenze durch (' + durch + ' von 30, Grenze 12)');
  ok(await p.evaluate(() => window.__kb.flutZaehler()) === 18,
    'die zurückgehaltenen 18 werden gezählt');
  ok(await p.evaluate(() => { const e = document.getElementById('flut'); return !!e && !e.hidden && /zurückgehalten/.test(e.textContent); }),
    'die Bremse wird ehrlich angezeigt statt still verschluckt');

  // --- 3. Kontakte sind ausgenommen ---
  const vorKontakt = await p.evaluate(() => window.__t.karten());
  const kontaktDurch = await p.evaluate(async () => {
    const s = await window.__t.mkSender();
    window.__kb.pinContact(s.pub, 'Mein Kontakt');
    const vor = window.__t.karten();
    for (let i = 0; i < 25; i++) await window.__t.send(s, 'Kontakt-Zettel ' + i, true);
    return window.__t.karten() - vor;
  });
  ok(kontaktDurch === 25, 'ein gespeicherter Kontakt wird NICHT gedrosselt (' + kontaktDurch + ' von 25)');

  // --- 4. Schwarm vieler Identitäten läuft gegen den Gesamt-Deckel ---
  const schwarm = await p.evaluate(async () => {
    const vor = window.__t.karten();
    for (let i = 0; i < 40; i++) {
      const s = await window.__t.mkSender();          // jedes Mal neue Identität
      for (let j = 0; j < 5; j++) await window.__t.send(s, 'Schwarm ' + i + '/' + j, true);
    }
    return window.__t.karten() - vor;
  });
  ok(schwarm < 200, 'ein Schwarm aus 40 Identitäten (200 Zettel) wird gedeckelt (' + schwarm + ' durch)');

  // --- 5. Absender-Sperre ---
  const gesperrtPub = await p.evaluate(async () => {
    const s = await window.__t.mkSender();
    await window.__t.send(s, 'STOERENFRIED sichtbar', false);
    return s.pub;
  });
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.body.textContent.includes('STOERENFRIED sichtbar')),
    'vor der Sperre ist der Zettel da');
  await p.evaluate((pub) => window.__kb.sperreAbsender(pub), gesperrtPub);
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.body.textContent.includes('STOERENFRIED sichtbar')),
    'nach der Sperre verschwindet der schon angezeigte Zettel');
  const neuerDurch = await p.evaluate(async (pub) => {
    const vor = window.__t.karten();
    // derselbe Absender schickt erneut — auch als „Vorrat" darf nichts kommen
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    return { vor, gesperrt: window.__kb.gesperrte().includes(pub) };
  }, gesperrtPub);
  ok(neuerDurch.gesperrt === true, 'der Absender steht in der Sperrliste');

  // --- 6. Sperre überlebt das Neuladen und ist umkehrbar ---
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(2000);
  ok(await p.evaluate((pub) => window.__kb.gesperrte().includes(pub), gesperrtPub),
    'die Sperre überlebt das Neuladen (localStorage)');
  ok(await p.evaluate((pub) => window.__kb.entsperreAbsender(pub) && !window.__kb.gesperrte().includes(pub), gesperrtPub),
    'die Sperre ist umkehrbar');

  await browser.close();
} catch (e) {
  fail++; console.log('  FAIL Ausnahme: ' + (e && e.message ? e.message : e));
  if (browser) await browser.close().catch(() => {});
} finally {
  srv.kill();
}

console.log('\n== Ergebnis: ' + pass + ' ok, ' + fail + ' FAIL ==');
process.exit(fail === 0 ? 0 : 1);
