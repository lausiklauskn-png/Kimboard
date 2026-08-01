#!/usr/bin/env node
/*
 * Smoke — Ausblenden: einzeln, rückgängig, wiederfindbar (echter Browser).
 *
 * Klaus' Sorge 2026-08-01: „Wenn tausende Nachrichten, die ich nicht mehr haben
 * will, plötzlich wieder auf meiner Pinnwand sind, ist das auch schlecht" —
 * das E-Mail-Postfach, das alte Post immer wieder hervorholt.
 *
 * Geprüft wird darum:
 *   - Ausgeblendetes bleibt weg, auch wenn ein Relais es erneut ausliefert.
 *   - Die Merk-Grenze liegt ÜBER dem, was die Relais nachliefern können
 *     (200 je Relais × 9 = 1800) — sonst verursacht die Grenze genau das
 *     Wiederauftauchen, vor dem sie schützen soll. Und für beide Listen gleich.
 *   - Eine EINZELNE Antwort lässt sich ausblenden, ohne den ganzen Strang.
 *   - „↩ Rückgängig" holt das gerade Ausgeblendete sofort zurück — beim
 *     einzelnen Zettel, bei der Antwort und beim 🧹 Leeren.
 *   - „👁 Ausgeblendet" zeigt die Zahlen und holt alle zurück; stummgeschaltete
 *     Absender lassen sich dort wieder sichtbar machen (die Hilfe versprach das
 *     bisher für „Einstellungen", die es gar nicht gab).
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_ausgeblendet.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8473;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const PRE = `
  const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
  const { eventId } = await import('./modules/echtheit.js');
  const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
`;

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);

  const hat = async (t) => (await p.evaluate(() => document.body.innerText)).includes(t);

  console.log('== Ausblenden: einzeln, rückgängig, wiederfindbar ==');

  // --- Die Grenze muss über dem Relais-Vorrat liegen ---
  const grenze = await p.evaluate(() => window.__kb.merkGrenze());
  ok(grenze >= 1800, 'die Merk-Grenze liegt über dem, was die Relais nachliefern (' + grenze + ' ≥ 1800)');
  const beideGleich = await p.evaluate(() => {
    const roh = document.documentElement.innerHTML;
    return !/slice\(-500\)/.test(roh);   // die alte Sonderregel darf weg sein
  });
  ok(beideGleich, 'keine abweichende 500er-Grenze mehr für die zurückgezogenen');

  // --- Ein fremder Zettel mit zwei Antworten ---
  const F = await p.evaluate(async (pre) => {
    return await new Function('return (async () => {' + pre + `
      const priv = utils.randomPrivateKey();
      const pub = toHex(schnorr.getPublicKey(priv));
      const mk = async (content, tags) => {
        const ev = { pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
          tags: [['t', 'sbkim-frage-antwort-test']].concat(tags || []), content };
        ev.id = await eventId(ev);
        ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
        await window.__kb.dispatch(ev, 'wss://test');
        return ev;
      };
      const q = await mk('Wer kommt zum Grillen?');
      const a1 = await mk('Ich komme gern', [['e', q.id]]);
      const a2 = await mk('Ich bringe Salat', [['e', q.id]]);
      return { pub, priv: toHex(priv), qid: q.id, a1: a1.id, a2: a2.id };
    })()`)();
  }, PRE);
  await p.waitForTimeout(900);
  ok(await hat('Wer kommt zum Grillen?'), 'Zettel mit zwei Antworten steht auf dem Brett');
  ok(await hat('Ich bringe Salat'), '…die zweite Antwort ist da');

  // --- Einzelne Antwort ausblenden (das ✕ an der Antwort) ---
  const adel = await p.$('[data-aid="' + F.a2 + '"] .a-del');
  ok(!!adel, 'jede Antwort hat ein eigenes ✕');
  await adel.click();
  await p.waitForTimeout(400);
  await p.click('.kb-del-mine');
  await p.waitForTimeout(400);
  ok(!(await hat('Ich bringe Salat')), 'die einzelne Antwort ist ausgeblendet');
  ok(await hat('Ich komme gern'), '…die andere Antwort bleibt');
  ok(await hat('Wer kommt zum Grillen?'), '…und der Zettel selbst auch (nicht der ganze Strang weg)');

  // --- „↩ Rückgängig" holt sie sofort zurück ---
  ok(await p.$('.kb-undo'), 'in der Meldung steht „↩ Rückgängig"');
  await p.click('.kb-undo');
  await p.waitForTimeout(400);
  ok(await hat('Ich bringe Salat'), 'Rückgängig holt die Antwort sofort zurück');
  ok(!(await p.evaluate((id) => window.__kb.ausgeblendete().includes(id), F.a2)),
    '…und streicht sie aus der Ausblend-Liste');

  // --- Nochmal ausblenden, diesmal endgültig: bleibt weg, auch bei Nachlieferung ---
  await p.click('[data-aid="' + F.a2 + '"] .a-del');
  await p.waitForTimeout(400);
  await p.click('.kb-del-mine');
  await p.waitForTimeout(400);
  await p.evaluate(async (args) => {
    await new Function('f', 'return (async () => {' + args.pre + `
      const ev = { id: f.a2, pubkey: f.pub, created_at: Math.floor(Date.now() / 1000) - 3, kind: 1,
        tags: [['t', 'sbkim-frage-antwort-test'], ['e', f.qid]], content: 'Ich bringe Salat' };
      ev.sig = toHex(await schnorr.sign(fromHex(f.a2), fromHex(f.priv)));
      await window.__kb.dispatch(ev, 'wss://anderes-relais');
    })()`)(args.f);
  }, { pre: PRE, f: F });
  await p.waitForTimeout(600);
  ok(!(await hat('Ich bringe Salat')), 'ausgeblendet bleibt weg, auch wenn ein Relais sie erneut schickt');

  // --- 🧹 Leeren: alles weg, aber mit Rückgängig ---
  await p.click('#board-clear');
  await p.waitForTimeout(500);
  ok(!(await hat('Wer kommt zum Grillen?')), '🧹 leeren blendet das ganze Brett aus');
  ok(await p.$('.kb-undo'), '…auch dafür gibt es „↩ Rückgängig"');
  await p.click('.kb-undo');
  await p.waitForTimeout(500);
  ok(await hat('Wer kommt zum Grillen?'), '…und es holt das Brett zurück');

  // --- Das Fenster „👁 Ausgeblendet" ---
  await p.evaluate((pub) => window.__kb.sperreAbsender(pub), F.pub);
  await p.click('#ausgeblendet');
  await p.waitForTimeout(500);
  const fenster = await p.evaluate(() => {
    const f = document.getElementById('ausgeblendet-fenster');
    return f && f.offsetParent !== null ? f.innerText : null;
  });
  ok(!!fenster, 'das Fenster „👁 Ausgeblendet" öffnet sich');
  ok(/Ausgeblendete Nachrichten:\s*\d+/.test(fenster || ''), '…nennt die Zahl der ausgeblendeten Nachrichten');
  ok(/Zurückgezogene Nachrichten:\s*\d+/.test(fenster || ''), '…und die der zurückgezogenen');
  ok(/nur die Kennung, nicht den Text/.test(fenster || ''),
    '…und sagt ehrlich, warum man einzelne nicht heraussuchen kann');
  // Die Fenster müssen ÜBER der SBKIM-Status-Leiste liegen (Modul 17: 9990,
  // ihr Modal 9999). Vorher lagen sie bei 80–96 — die Lampen saßen auf jedem
  // Dialog und fingen unten rechts die Tipps ab.
  const ueberLeiste = await p.evaluate(() => {
    const box = document.getElementById('ausgeblendet-fenster');
    const z = Number(getComputedStyle(box.parentNode).zIndex) || 0;
    const w = document.getElementById('sbkim-widget');
    const wz = w ? (Number(getComputedStyle(w).zIndex) || 0) : 0;
    return { z, wz };
  });
  ok(ueberLeiste.z > ueberLeiste.wz,
    'das Fenster liegt über der Status-Leiste (' + ueberLeiste.z + ' > ' + ueberLeiste.wz + ')');
  // Am ECHTEN Element gemessen, nicht an einer Zahl im Test: eine Meldung
  // erzeugen und nachsehen, wo sie liegt. (Eine hier hingeschriebene 10050
  // würde nur beweisen, dass ich rechnen kann — nicht, dass die App es tut.)
  const toastZ = await p.evaluate(() => {
    window.__kb.toastRueckgaengig('Prüfung', () => { });
    const t = document.querySelector('.kb-undo-toast');
    return t ? (Number(getComputedStyle(t).zIndex) || 0) : -1;
  });
  ok(toastZ > ueberLeiste.wz, '…und die Meldung mit „↩ Rückgängig" ebenfalls (' + toastZ + ')');
  await p.evaluate(() => { const t = document.querySelector('.kb-undo-toast'); if (t) t.remove(); });

  ok(await p.$('.kb-unmute'), 'stummgeschaltete Absender stehen dort mit Knopf zum Wieder-Zeigen');
  await p.click('.kb-unmute');
  await p.waitForTimeout(500);
  ok(!(await p.evaluate((pub) => window.__kb.gesperrte().includes(pub), F.pub)),
    '…der Knopf hebt die Stummschaltung wirklich auf');

  // --- Alle wieder einblenden ---
  const vorher = await p.evaluate(() => window.__kb.ausgeblendete().length);
  ok(vorher > 0, 'es ist noch etwas ausgeblendet (' + vorher + ')');
  p.once('dialog', (d) => d.accept());
  await p.click('.kb-unhide-all');
  await p.waitForTimeout(2500);          // die Seite lädt danach neu
  ok((await p.evaluate(() => window.__kb.ausgeblendete().length)) === 0,
    '„Alle wieder einblenden" leert die Ausblend-Liste');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
