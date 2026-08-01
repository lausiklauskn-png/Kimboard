#!/usr/bin/env node
/*
 * Smoke — Heim-Relais: schmal senden, breit lesen (echter Browser, zwei echte Relais).
 *
 * Klaus' Datenschutz-Einwand 2026-08-01: „Mein eigenes Relais sollte das
 * Hauptrelais sein, wo die Daten gespeichert werden — weil ich selbst
 * entscheiden kann, wer dort was macht. Werden die Daten auf andere Relais
 * übergeleitet, besteht ein Risiko."
 *
 * Befund davor: JEDER Zettel ging an ALLE verbundenen Relais — auch die
 * verschlüsselten und die Rückzieh-Bitten.
 *
 * Hier laufen ZWEI echte Mini-Relais: ein „Heim"-Relais und ein „fremdes".
 * Beide protokollieren, was bei ihnen ankommt. Gemessen wird also nicht eine
 * Absicht im Code, sondern was tatsächlich wo landet.
 *
 * Geprüft wird:
 *   - Ein Zettel landet NUR beim Heim-Relais, nicht beim fremden.
 *   - Das gilt auch für private (verschlüsselte) Zettel und für Antworten.
 *   - GELESEN wird trotzdem von beiden — ein Zettel, den nur das fremde Relais
 *     hat, erscheint weiterhin.
 *   - Abgeschaltet („nur dorthin senden" aus) geht es wieder an beide.
 *   - Ist das Heim-Relais nicht erreichbar, wird GEFRAGT; wer ablehnt, sendet
 *     nichts — es wird nie heimlich über fremde gestreut.
 *   - Die Voreinstellung ist an, und das Heim-Relais ist Klaus' eigenes.
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_heim_relais.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { starteRelais, testSeite } from './_werkzeug.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8478;
const HEIM_PORT = 8479, FREMD_PORT = 8480;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

/* ---- Zwei echte Relais: ein „Heim"-Relais und ein fremdes ---- */
const HEIM = await starteRelais(HEIM_PORT);
const FREMD = await starteRelais(FREMD_PORT);
const HEIM_URL = HEIM.url, FREMD_URL = FREMD.url;

// Dieselbe Seite, nur mit den Test-Adressen (siehe _werkzeug.mjs).
const SEITE = testSeite(ROOT, [HEIM_URL, FREMD_URL], '.tmp-heim-test.html');
const QUELLE = SEITE.quelle;

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));

  // Beide Test-Relais anhaken (Lesen breit), Heim bleibt die Voreinstellung.
  await p.addInitScript(([h, f]) => {
    localStorage.setItem('sbkim_pinnwand_relays', JSON.stringify([h, f]));
  }, [HEIM_URL, FREMD_URL]);

  console.log('== Heim-Relais: schmal senden, breit lesen ==');

  await p.goto(`http://127.0.0.1:${PORT}/${SEITE.datei}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);

  // Voreinstellung im ausgelieferten Code (unabhängig vom Test-Aufbau).
  const quelle = await p.evaluate(async () => {
    const t = await (await fetch('./index.html')).text();  // die ECHTE Seite, nicht die Testkopie
    return {
      heimKonst: /const HOME_RELAY = 'wss:\/\/relay\.family-projekt\.de'/.test(t),
      nurHeimAn: /let heim = \{ url: HOME_RELAY, nurHeim: true \}/.test(t),
    };
  });
  ok(quelle.heimKonst, 'das Heim-Relais ist relay.family-projekt.de (Klaus’ eigenes)');
  ok(quelle.nurHeimAn, '„nur dorthin senden" ist die VOREINSTELLUNG, kein Häkchen für Kenner');

  const verbunden = await p.evaluate(() => document.getElementById('sendhint').textContent);
  ok(/verbunden/.test(verbunden), 'beide Relais sind verbunden: ' + verbunden);
  ok(/schreibt nur auf/.test(verbunden), '…und der Hinweis sagt, wohin geschrieben wird');

  const ziele = await p.evaluate(() => window.__kb.sendZiele());
  ok(ziele.length === 1, 'es gibt genau EIN Sende-Ziel (' + ziele.length + ')');
  ok(String(ziele[0]).includes(String(HEIM_PORT)), '…und das ist das Heim-Relais');

  // ---------- Ein öffentlicher Zettel ----------
  const vorH = HEIM.empfangen.length, vorF = FREMD.empfangen.length;
  await p.evaluate(async () => {
    document.getElementById('qmsg').value = 'Öffentlicher Zettel';
    document.getElementById('ask').click();
    await new Promise((r) => setTimeout(r, 900));
  });
  await new Promise((r) => setTimeout(r, 400));
  ok(HEIM.empfangen.length === vorH + 1, 'der Zettel kommt beim Heim-Relais an');
  ok(FREMD.empfangen.length === vorF, 'DER PUNKT: beim fremden Relais kommt NICHTS an');

  // ---------- Ein privater (verschlüsselter) Zettel ----------
  const ANNA = await p.evaluate(async () => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const pub = toHex(schnorr.getPublicKey(utils.randomPrivateKey()));
    window.__kb.pinContact(pub, 'Anna');
    window.__kb.setPrivatAn([pub]);
    return pub;
  });
  const vorH2 = HEIM.empfangen.length, vorF2 = FREMD.empfangen.length;
  await p.evaluate(async () => {
    document.getElementById('qmsg').value = 'Streng privat';
    document.getElementById('ask').click();
    await new Promise((r) => setTimeout(r, 900));
  });
  await new Promise((r) => setTimeout(r, 400));
  ok(HEIM.empfangen.length === vorH2 + 1, 'auch der private Zettel geht nach Hause');
  ok(FREMD.empfangen.length === vorF2, '…und NICHT zum fremden Relais (auch verschlüsselt nicht)');
  ok(String(HEIM.empfangen[HEIM.empfangen.length - 1].content).startsWith('sbkimdm1:'),
    '…er ist dabei verschlüsselt (das Heim-Relais liest ihn auch nicht)');
  ok(ANNA.length === 64, 'Empfängerschlüssel ist gültig');

  // ---------- Breit lesen: was nur das FREMDE Relais hat, erscheint trotzdem ----------
  const fremdZettel = await p.evaluate(async () => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    const priv = utils.randomPrivateKey();
    const ev = { pubkey: toHex(schnorr.getPublicKey(priv)), created_at: Math.floor(Date.now() / 1000),
      kind: 1, tags: [['t', 'sbkim-frage-antwort-test']], content: 'Nur beim fremden Relais' };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
    return ev;
  });
  FREMD.vorrat.push(fremdZettel);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2400);
  ok(await p.evaluate(() => document.body.innerText.includes('Nur beim fremden Relais')),
    'BREIT LESEN: ein Zettel, den nur das fremde Relais hat, erscheint trotzdem');

  // ---------- Heim-Relais nicht erreichbar → es wird GEFRAGT ----------
  // `srv.close()` allein wartet ewig auf die offene Browser-Leitung — die
  // Leitungen müssen zuerst weg (daran hing der Lauf).
  await HEIM.aus();
  await p.waitForTimeout(1500);   // der Browser merkt den Ausfall
  let gefragt = false, dialogText = '';
  p.once('dialog', (d) => { gefragt = true; dialogText = d.message(); d.dismiss(); });
  const vorF3 = FREMD.empfangen.length;
  await p.evaluate(async () => {
    window.__kb.setPrivatAn([]);
    document.getElementById('qmsg').value = 'Bei ausgefallenem Heim-Relais';
    document.getElementById('ask').click();
    await new Promise((r) => setTimeout(r, 900));
  });
  await new Promise((r) => setTimeout(r, 500));
  ok(gefragt, 'ist das Heim-Relais aus, wird GEFRAGT (nicht heimlich umgeschaltet)');
  ok(/nicht erreichbar/.test(dialogText), '…die Frage benennt den Grund');
  ok(/nur noch BITTEN zu löschen/.test(dialogText), '…und die Folge, wenn man zustimmt');
  ok(FREMD.empfangen.length === vorF3, 'ABGELEHNT → es geht NICHTS an fremde Relais');

  // ---------- Abgeschaltet: dann wieder an alle ----------
  p.on('dialog', (d) => d.accept());
  await p.evaluate(() => {
    document.getElementById('heim-nur').checked = false;
    document.getElementById('heim-nur').dispatchEvent(new Event('change'));
  });
  await p.waitForTimeout(500);
  const vorF4 = FREMD.empfangen.length;
  await p.evaluate(async () => {
    document.getElementById('qmsg').value = 'Jetzt an alle';
    document.getElementById('ask').click();
    await new Promise((r) => setTimeout(r, 900));
  });
  await new Promise((r) => setTimeout(r, 400));
  ok(FREMD.empfangen.length === vorF4 + 1, 'ohne die Einstellung geht es wieder an fremde Relais');
  ok(/schreibt an alle/.test(await p.evaluate(() => document.getElementById('sendhint').textContent)),
    '…und der Hinweis warnt davor');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
  SEITE.weg();
  try { await HEIM.aus(); } catch (_e) { /* */ }
  try { await FREMD.aus(); } catch (_e) { /* */ }
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
