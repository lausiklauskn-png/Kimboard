#!/usr/bin/env node
/*
 * Smoke — Stufe 2+3: ➕-Anhang-Menü und „Kontakt senden" (echter Browser).
 *
 * WhatsApp bündelt alles Mitzuschickende hinter einer Büroklammer; genauso hier.
 * Geprüft wird:
 *   - Das ➕-Menü öffnet, enthält Sprachnotiz · Bild · Kontakt senden, und
 *     schließt wieder (Klick daneben).
 *   - Ohne privaten Empfänger sagt das Menü das VORHER („erst Privat an
 *     wählen") — statt erst nach dem Tippen abzuweisen.
 *   - Die alten Einzelknöpfe existieren weiter (Handler unverändert), sind aber
 *     nicht mehr sichtbar.
 *   - Datenvertrag: Visitenkarte bauen/lesen, Müll wird abgelehnt.
 *   - Eine empfangene Visitenkarte wird als KARTE gezeigt (nicht als JSON) und
 *     NICHT still gespeichert: erst „Annehmen" merkt den Kontakt, „Ablehnen"
 *     speichert nichts.
 *   - SICHERHEIT: Ein Name mit HTML/Skript wird als TEXT dargestellt, nie als
 *     Auszeichnung ausgeführt (`esc` ist in dieser App bewusst ein No-Op).
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_anhang_kontakt.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8446;
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

  const menuText = () => p.evaluate(() => {
    const m = document.getElementById('anhang-menu');
    return (m && !m.hidden) ? m.innerText : '';
  });

  console.log('== Stufe 2+3 — Anhang-Menü und Kontakt senden ==');

  // 1. Menü vorhanden, Einzelknöpfe zurückgetreten
  ok(await p.$('#anhang'), '➕-Knopf in der Eingabezeile');
  ok(await p.evaluate(() => !!document.getElementById('dmvoice') && !!document.getElementById('dmimg')),
    'die geprüften Einzelknöpfe existieren weiter (Handler unverändert)');
  ok(await p.evaluate(() => document.getElementById('dmvoice').hidden && document.getElementById('dmimg').hidden),
    '…sind aber nicht mehr einzeln sichtbar');

  // 2. Menü öffnet mit allen Einträgen
  await p.click('#anhang'); await p.waitForTimeout(300);
  const t = await menuText();
  ok(/Sprachnotiz/.test(t) && /Bild/.test(t) && /Kontakt senden/.test(t), 'Menü enthält alle drei Einträge');
  ok(/Privat an/.test(t), 'ohne privaten Empfänger sagt das Menü das vorher: „erst Privat an wählen"');

  // 3. Schließt bei Klick daneben
  await p.click('#qmsg'); await p.waitForTimeout(300);
  ok((await menuText()) === '', 'Menü schließt bei Klick daneben');

  // 4. Datenvertrag der Visitenkarte
  const vertrag = await p.evaluate(() => {
    const k = 'a'.repeat(64);
    const card = window.__kb.makeContactCard('Anna', k);
    return {
      rund: JSON.stringify(window.__kb.parseContactCard(card)) === JSON.stringify({ name: 'Anna', pub: k }),
      text: window.__kb.parseContactCard('nur ein normaler Zettel') === null,
      muell: window.__kb.parseContactCard('{"foo":1}') === null,
      kaputt: window.__kb.parseContactCard('{kaputt') === null,
      falscherKey: window.__kb.parseContactCard(JSON.stringify({ kbct: 1, n: 'X', k: 'zz' })) === null,
    };
  });
  ok(vertrag.rund, 'Visitenkarte: bauen und lesen ergibt dasselbe');
  ok(vertrag.text && vertrag.muell && vertrag.kaputt, 'Text/fremdes JSON/kaputtes JSON werden abgelehnt');
  ok(vertrag.falscherKey, 'Karte mit unsinnigem Schlüssel wird abgelehnt');

  // 5. Empfangene Karte: wird angezeigt, aber NICHT still gespeichert
  const BOES = '<img src=x onerror="window.__XSS=1">Böser Name';
  const FREMDER = await p.evaluate(async (boes) => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    // Ein Fremder schickt MIR privat eine Visitenkarte (mit bösartigem Namen).
    const priv = utils.randomPrivateKey();
    const pub = toHex(schnorr.getPublicKey(priv));
    const { dmEncrypt } = await import('./modules/dm_crypto.js');
    const karte = window.__kb.makeContactCard(boes, 'd'.repeat(64));
    const ev = {
      pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
      tags: [['t', 'sbkim-frage-antwort-test'], ['p', window.__kb.me()], ['enc', 'dm1']],
      content: await dmEncrypt(karte, priv, window.__kb.me()),
    };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
    await window.__kb.dispatch(ev, 'wss://test');
    return pub;
  }, BOES);
  await p.waitForTimeout(700);

  ok(await p.$('.kb-contactcard'), 'empfangene Visitenkarte wird als Karte gezeigt (nicht als JSON)');
  ok(!(await p.evaluate(() => document.body.innerText.includes('"kbct"'))), '…der rohe Datensatz erscheint nirgends');
  ok(await p.evaluate(() => !window.__kb.contacts()['d'.repeat(64)]), 'nichts wird still gespeichert');

  // SICHERHEIT: bösartiger Name darf nicht als HTML wirken
  ok(await p.evaluate(() => window.__XSS === undefined), 'HTML im Namen wird NICHT ausgeführt');
  ok(await p.evaluate(() => document.querySelectorAll('.kb-contactcard img').length === 0), '…und erzeugt kein Element');
  ok(await p.evaluate((b) => document.querySelector('.kb-contactcard').innerText.includes(b.slice(0, 20)),
    BOES), '…sondern steht sichtbar als Text da');

  // 6. Ablehnen speichert nichts
  await p.click('.kb-cc-reject'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !window.__kb.contacts()['d'.repeat(64)]), 'Ablehnen speichert nichts');
  ok(await p.evaluate(() => document.querySelector('.kb-contactcard').innerText.includes('Abgelehnt')), '…und sagt das auch');

  // 7. Annehmen merkt den Kontakt (zweite Karte)
  await p.evaluate(async (absender) => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const { dmEncrypt } = await import('./modules/dm_crypto.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    const priv = utils.randomPrivateKey();
    const pub = toHex(schnorr.getPublicKey(priv));
    const karte = window.__kb.makeContactCard('Onkel Otto', 'e'.repeat(64));
    const ev = {
      pubkey: pub, created_at: Math.floor(Date.now() / 1000) + 1, kind: 1,
      tags: [['t', 'sbkim-frage-antwort-test'], ['p', window.__kb.me()], ['enc', 'dm1']],
      content: await dmEncrypt(karte, priv, window.__kb.me()),
    };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
    await window.__kb.dispatch(ev, 'wss://test');
  }, FREMDER);
  await p.waitForTimeout(700);
  p.once('dialog', (d) => d.accept('Onkel Otto'));
  const accepts = await p.$$('.kb-cc-accept');
  ok(accepts.length >= 1, 'zweite Karte mit Annehmen-Knopf da');
  await accepts[accepts.length - 1].click();
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => !!window.__kb.contacts()['e'.repeat(64)]), 'Annehmen merkt den Kontakt');
  ok(await p.evaluate(() => !!document.querySelector('#dm-to option[value="' + 'e'.repeat(64) + '"]')),
    '…und er steht sofort in „Privat an"');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
