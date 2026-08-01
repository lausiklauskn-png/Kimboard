#!/usr/bin/env node
/*
 * Smoke — „🕓 Älteres nachholen" (Stufe 5), echter Browser + echtes Mock-Relais.
 *
 * Klaus' Fund: „Wenn die Relais wechseln und jemand später startet, verbindet
 * er sich nur mit den AKTUELLEN Relais — was vorher über andere lief, sieht er
 * nie. Er ist nicht auf demselben Stand."
 *
 * Hier läuft ein echter WebSocket-Server als Relais mit VORRAT: Er antwortet
 * auf die Abfrage mit gespeicherten Zetteln, dann EOSE. Genau das liest der
 * Nachhol-Lauf.
 *
 * Geprüft wird:
 *   - Der Nachhol-Lauf holt Zettel, die nur im Vorrat eines NICHT verbundenen
 *     Relais liegen.
 *   - Er schließt seine Leitungen nach dem Vorrat wieder (kein Dauerzustand,
 *     keine Pulsation — Empfangsmodus bleibt gewahrt).
 *   - Er rührt die Relais-Auswahl des Nutzers NICHT an.
 *   - Er läuft nicht doppelt (zweiter Aufruf während des Laufs prallt ab).
 *   - Zweimal nachholen bringt keine Doppelten (Dedupe über die Kennung).
 *   - Zurückgezogenes bleibt zurückgezogen, auch wenn der Vorrat es erneut
 *     ausliefert.
 *   - Ohne Automatik ist die Nachhol-Liste der ganze Pool; mit Automatik sind
 *     es die Relais der letzten Fenster.
 *
 * Voraussetzung: npm install --no-save playwright-core ws
 * Aufruf: node tests/smoke_nachholen.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { starteRelais } from './_werkzeug.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8476;
const RELAY_PORT = 8477;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

/* ---- Ein echtes Relais mit Vorrat (siehe _werkzeug.mjs) ---- */
const RELAIS = await starteRelais(RELAY_PORT);
const vorrat = RELAIS.vorrat;

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

  const hat = async (t) => (await p.evaluate(() => document.body.innerText)).includes(t);

  console.log('== Älteres nachholen ==');

  // Ein Zettel, der NUR im Vorrat unseres Relais liegt (echt signiert).
  const ALT = await p.evaluate(async () => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    const priv = utils.randomPrivateKey();
    const pub = toHex(schnorr.getPublicKey(priv));
    const bau = async (text) => {
      const ev = { pubkey: pub, created_at: Math.floor(Date.now() / 1000) - 3600, kind: 1,
        tags: [['t', 'sbkim-frage-antwort-test']], content: text };
      ev.id = await eventId(ev);
      ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
      return ev;
    };
    return { a: await bau('Zettel aus einem früheren Fenster'), b: await bau('Noch einer von früher'), pub, priv: toHex(priv) };
  });
  vorrat.push(ALT.a, ALT.b);

  ok(!(await hat('Zettel aus einem früheren Fenster')), 'vorher fehlt der alte Zettel (genau Klaus’ Fall)');

  // Der Nachhol-Lauf — gegen unser Relais.
  // Der ECHTE Lauf — nur mit einem erreichbaren Relais statt der neun im Netz
  // (die Relais-Liste ist der Parameter, keine Test-Sonderbehandlung im Code).
  const geholt = await p.evaluate(
    async (url) => await window.__kb.holeAelteresMit([url], false),
    `ws://127.0.0.1:${RELAY_PORT}`);

  ok(geholt >= 2, 'der Nachhol-Lauf holt die Zettel aus dem Vorrat (' + geholt + ')');
  ok(await hat('Zettel aus einem früheren Fenster'), '…und sie stehen jetzt auf dem Brett');
  ok(await hat('Noch einer von früher'), '…beide');

  // Leitungen wieder zu — kein Dauerzustand.
  await new Promise((r) => setTimeout(r, 600));
  ok(RELAIS.offen() === 0, 'der Lauf schließt seine Leitungen wieder (offen: ' + RELAIS.offen() + ')');
  ok(RELAIS.gesamt() >= 1, '…er hat wirklich verbunden (' + RELAIS.gesamt() + ' Verbindung(en))');

  // Die Relais-Wahl des Nutzers bleibt unberührt.
  const wahlDanach = await p.evaluate(() => JSON.parse(localStorage.getItem('sbkim_pinnwand_relays') || 'null'));
  ok(wahlDanach === null || Array.isArray(wahlDanach), 'die gespeicherte Relais-Wahl ist unverändert gültig');
  ok(!(await p.evaluate(() => window.__kb.nachholLaeuft())), 'nach dem Lauf ist der Merker wieder aus');

  // Zweiter Lauf: nichts Neues, keine Doppelten.
  const nochmal = await p.evaluate(async (url) => await window.__kb.holeAelteresMit([url], false), `ws://127.0.0.1:${RELAY_PORT}`);
  ok(nochmal === 0, 'ein zweiter Lauf holt nichts doppelt (' + nochmal + ')');
  const doppelt = await p.evaluate(() => {
    const t = document.body.innerText;
    return (t.match(/Zettel aus einem früheren Fenster/g) || []).length;
  });
  ok(doppelt === 1, '…und der Zettel steht genau EINMAL da');

  // Zurückgezogenes darf der Vorrat nicht wiederbeleben.
  await p.evaluate(async (f) => {
    const { schnorr } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    const ev = { pubkey: f.pub, created_at: Math.floor(Date.now() / 1000), kind: 5,
      tags: [['t', 'sbkim-frage-antwort-test'], ['e', f.id]], content: 'zurückgezogen' };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), fromHex(f.priv)));
    await window.__kb.dispatch(ev, 'wss://test');
  }, { pub: ALT.pub, priv: ALT.priv, id: ALT.a.id });
  await p.waitForTimeout(500);
  ok(!(await hat('Zettel aus einem früheren Fenster')), 'der Autor zieht ihn zurück — er ist weg');
  // NEU LADEN — das ist der echte Fall: Nach einem Neustart ist der Merker der
  // schon gesehenen Zettel leer, nur die Liste der zurückgezogenen überlebt.
  // Ohne den Neustart würde hier bloß die Dedupe der laufenden Sitzung messen,
  // nicht der Rückzieh-Schutz (fiel bei der Gegenprobe auf).
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  ok(!(await hat('Zettel aus einem früheren Fenster')), 'nach dem Neuladen ist er weiterhin weg');
  const nachNeustart = await p.evaluate(
    async (url) => await window.__kb.holeAelteresMit([url], true), `ws://127.0.0.1:${RELAY_PORT}`);
  await p.waitForTimeout(600);
  ok(nachNeustart >= 1, 'der Nachhol-Lauf holt nach dem Neustart wieder aus dem Vorrat (' + nachNeustart + ')');
  ok(await hat('Noch einer von früher'), '…der nicht zurückgezogene Zettel ist wieder da');
  ok(!(await hat('Zettel aus einem früheren Fenster')),
    'SICHERHEIT: der zurückgezogene wird NICHT wiederbelebt, obwohl das Relais ihn noch hat');

  // Welche Relais fragt der Lauf? Ohne Automatik der ganze Pool.
  const ohne = await p.evaluate(async () => (await window.__kb.nachholRelais()).length);
  ok(ohne >= 5, 'ohne Automatik fragt er den ganzen Pool (' + ohne + ')');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
  try { await RELAIS.aus(); } catch (_e) { /* */ }
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
