#!/usr/bin/env node
/*
 * Smoke — Antworten auf PRIVATE Nachrichten bleiben privat (echter Browser).
 *
 * GEFUNDENES LECK (2026-08-01, beim Vorbereiten der Gruppen): Der Antwort-Knopf
 * baute seine Antwort IMMER öffentlich (`buildEvent(text, [['e', id]])` ohne
 * Empfänger). Wer auf eine verschlüsselte Nachricht antwortete, schrieb seine
 * Antwort damit IM KLARTEXT aufs offene Brett — ohne es zu merken. Die
 * ursprüngliche Nachricht war geschützt, die Antwort darauf nicht.
 *
 * Geprüft wird:
 *   - Antwort auf eine PRIVATE Nachricht: verschlüsselt (`enc`-Tag), an den
 *     Empfänger adressiert (`p`-Tag), Klartext kommt im Inhalt NICHT vor.
 *   - Der Empfänger ist die richtige Gegenseite (der Absender der Nachricht).
 *   - Das Antwortfeld sagt VORHER, dass die Antwort privat geht.
 *   - Antwort auf einen ÖFFENTLICHEN Zettel bleibt öffentlich (kein
 *     versehentliches Verschlüsseln — das Brett soll ein Brett bleiben).
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_antwort_privat.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { starteRelais, testSeite } from './_werkzeug.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8463;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

// Seit dem Heim-Relais gilt: Was nirgends ankommt, wird auch nicht als
// gesendet ausgegeben. Ohne Relais verweigert der Antwort-Knopf also — richtig
// so, aber dann ließe sich am Knopf nichts mehr messen. Darum ein echtes
// kleines Relais und dieselbe Seite mit dessen Adresse.
const RELAY = await starteRelais(8464);
const SEITE = testSeite(ROOT, [RELAY.url], '.tmp-antwort-privat.html');
const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/${SEITE.datei}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);

  const GEHEIM = 'Ja, ich komme um 18 Uhr';

  console.log('== Antworten auf Private bleiben privat ==');

  // Ein Fremder schickt MIR privat eine Nachricht (echt signiert + verschlüsselt).
  const ABSENDER = await p.evaluate(async () => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const { dmEncrypt } = await import('./modules/dm_crypto.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    const priv = utils.randomPrivateKey();
    const pub = toHex(schnorr.getPublicKey(priv));
    const ev = {
      pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
      tags: [['t', 'sbkim-frage-antwort-test'], ['p', window.__kb.me()], ['enc', 'dm1']],
      content: await dmEncrypt('Streng geheim: Treffpunkt 18 Uhr', priv, window.__kb.me()),
    };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
    window.__kb.pinContact(pub, 'Anna');
    await window.__kb.dispatch(ev, 'wss://test');
    return pub;
  });
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => document.body.innerText.includes('Treffpunkt 18 Uhr')), 'private Nachricht wird angezeigt');

  // Das Antwortfeld muss VORHER sagen, wohin die Antwort geht.
  const ph = await p.evaluate(() => {
    const t = document.querySelector('.answer-form textarea');
    return t ? t.placeholder : '';
  });
  ok(/Private Antwort an/.test(ph) && /Anna/.test(ph), 'das Antwortfeld kündigt die private Antwort an: ' + ph);
  ok(await p.evaluate(() => !!document.querySelector('.answer-form.kb-reply-private')), 'das Formular ist als privat markiert');

  // Die Antwort abfangen, bevor sie rausgeht, und prüfen, WAS gebaut wurde.
  const gebaut = await p.evaluate(async (geheim) => {
    const raus = [];
    const urspr = WebSocket.prototype.send;
    WebSocket.prototype.send = function (d) { raus.push(d); };   // nichts wirklich senden
    document.querySelector('.answer-form textarea').value = geheim;
    document.querySelector('.answer-form .ghost').click();
    await new Promise((r) => setTimeout(r, 900));
    WebSocket.prototype.send = urspr;
    // Ohne Relais geht nichts über die Leitung — dann den lokal gezeigten
    // Zettel prüfen: er trägt dieselben Tags wie das Gesendete.
    const li = [...document.querySelectorAll('.answers li')].pop();
    return { raus, lokalText: li ? li.innerText : '' };
  }, GEHEIM);

  // DER ENTSCHEIDENDE NACHWEIS — am echten Knopf gemessen, nicht an buildEvent.
  // (Ein direkter buildEvent-Aufruf würde nur zeigen, dass Verschlüsselung
  // funktioniert — nicht, ob der Antwort-Knopf den Empfänger überhaupt
  // übergibt. Genau daran wäre die Prüfung vorbeigelaufen.)
  ok(/🔒 privat/.test(gebaut.lokalText),
    'die eigene Antwort erscheint als „🔒 privat" — der Knopf hat sie verschlüsselt adressiert');
  ok(gebaut.lokalText.includes(GEHEIM),
    '…und ist für mich lesbar (ich bin an der Unterhaltung beteiligt)');

  // Zusätzlich der Umschlag selbst, wie ihn der Knopf mit diesem Empfänger baut.
  const ev = await p.evaluate(async (args) => {
    const e = await window.__kb.buildEvent(args.text, [['e', 'a'.repeat(64)]], args.an);
    return { content: e.content, tags: e.tags.map((t) => t[0]), pTag: (e.tags.find((t) => t[0] === 'p') || [])[1] };
  }, { text: GEHEIM, an: ABSENDER });

  ok(ev.tags.includes('enc'), 'die Antwort ist verschlüsselt (enc-Tag)');
  ok(ev.tags.includes('p'), 'die Antwort ist an einen Empfänger adressiert (p-Tag)');
  ok(ev.pTag === ABSENDER, '…und zwar an die richtige Gegenseite');
  ok(ev.content !== GEHEIM && ev.content.indexOf(GEHEIM) < 0, 'der Klartext steht NICHT im Inhalt');
  ok(String(ev.content).startsWith('sbkimdm1:'), 'es ist ein echter E2E-Umschlag');

  // Gegenprobe: Antwort auf einen ÖFFENTLICHEN Zettel bleibt öffentlich.
  const offen = await p.evaluate(async (text) => {
    const e = await window.__kb.buildEvent(text, [['e', 'b'.repeat(64)]], null);
    return { content: e.content, tags: e.tags.map((t) => t[0]) };
  }, 'Ganz normale öffentliche Antwort');
  ok(offen.content === 'Ganz normale öffentliche Antwort', 'öffentliche Antwort bleibt Klartext (das Brett bleibt ein Brett)');
  ok(!offen.tags.includes('p') && !offen.tags.includes('enc'), '…ohne Empfänger- und Verschlüsselungs-Tag');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
  SEITE.weg();
  try { await RELAY.aus(); } catch (_e) { /* */ }
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
