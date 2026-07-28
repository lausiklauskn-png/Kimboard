#!/usr/bin/env node
/*
 * Smoke — Hilfe & Erklär-Blasen (assets/hilfe.js), echter Browser (Chromium).
 *
 * Prüft im laufenden Browser:
 *   - VOLLSTÄNDIGKEIT: Jedes sichtbare Bedien-Element (Knopf, Feld, Auswahl,
 *     Status-Lampe) hat eine Erklärung. Kommt später ein neues Element dazu
 *     und wird vergessen, schlägt GENAU diese Prüfung fehl.
 *   - Die Hilfe öffnet, enthält die Testanleitung (alle drei Tests), die
 *     Sicherheitsnummer und die ehrliche Grenze samt Signal/Tor.
 *   - ERKLÄR-MODUS: Antippen ERKLÄRT und führt die Aktion NICHT aus
 *     (an der Schriftgröße messbar); Kontakte-/Siegel-Fenster bleiben zu.
 *   - Das Hilfe-Fenster bleibt im Erklär-Modus bedienbar (man kommt heraus).
 *   - Die Status-Lampen bleiben antippbar (die Hinweis-Pille verdeckt sie nicht).
 *   - Nach dem Ausschalten ist alles wieder normal bedienbar; die Wahl
 *     überlebt das Neuladen.
 *
 * Voraussetzung: playwright-core (lokal, ohne Speichern):
 *   npm install --no-save playwright-core
 * Aufruf: node tests/smoke_hilfe.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8421;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 900, height: 1100 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);

  const bubbleText = () => p.evaluate(() => {
    const d = [...document.querySelectorAll('div')].find((x) => /verstanden/.test(x.textContent) && x.style.position === 'fixed');
    return d ? d.textContent : '';
  });
  const closeBubble = () => p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].filter((x) => x.textContent === 'verstanden');
    if (b[0]) b[0].click();
  });
  const isVisible = (sel) => p.evaluate((q) => {
    const n = document.querySelector(q);
    return !!(n && n.offsetParent !== null);
  }, sel);
  const freeToClick = (sel) => p.evaluate((q) => {
    const n = document.querySelector(q);
    if (!n) return 'fehlt';
    const r = n.getBoundingClientRect();
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return (n === t || n.contains(t)) ? 'frei' : 'verdeckt';
  }, sel);

  console.log('== Hilfe & Erklär-Blasen ==');

  // 1. Vollständigkeit
  const missing = await p.evaluate(() => {
    const t = window.__hilfe.texte;
    const skip = new Set(['dmimgfile', 'hilfe-schalter']); // versteckt bzw. Teil der Hilfe selbst
    const out = [];
    document.querySelectorAll("button[id], input[id], select[id], textarea[id], [id^='sbkim-widget-slot']").forEach((n) => {
      if (skip.has(n.id)) return;
      if (n.offsetParent === null && n.type !== 'checkbox') return; // unsichtbar
      if (!t[n.id]) out.push(n.id);
    });
    return out;
  });
  ok(missing.length === 0, 'jedes sichtbare Bedien-Element hat eine Erklärung (fehlt: ' + missing.join(', ') + ')');

  // 2. Hilfe-Fenster + Anleitung
  ok(await p.$('#hilfe-btn'), 'Hilfe-Knopf in der Werkzeugleiste');
  ok(!(await p.$('#hilfe-fenster')), 'Hilfe-Fenster anfangs zu');
  await p.click('#hilfe-btn'); await p.waitForTimeout(500);
  ok(await p.$('#hilfe-fenster'), 'Hilfe-Fenster öffnet');
  const txt = await p.textContent('#hilfe-fenster');
  ok(/Erster Test/.test(txt) && /zu zweit/.test(txt) && /Relais automatisch/.test(txt), 'Anleitung enthält alle drei Tests');
  ok(/Sicherheitsnummer/.test(txt), 'Anleitung erklärt die Sicherheitsnummer');
  ok(/Signal/.test(txt) && /Tor/.test(txt), 'ehrliche Grenze samt Signal/Tor genannt');
  ok(/klemmt/.test(txt), 'Abschnitt „wenn etwas klemmt" vorhanden');

  // 3. Erklär-Modus an, Hilfe bleibt bedienbar
  await p.check('#hilfe-schalter'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__hilfe.isOn()), 'Erklär-Modus an');
  await p.click('#hilfe-close'); await p.waitForTimeout(450);
  ok(!(await p.$('#hilfe-fenster')), 'Hilfe-Fenster schließt auch im Erklär-Modus (man kommt heraus)');

  // 4. Status-Lampen bleiben erreichbar und werden erklärt
  ok((await freeToClick('#sbkim-widget-slot-siegel')) === 'frei', 'Status-Lampen bleiben antippbar (Hinweis-Pille verdeckt sie nicht)');
  await p.click('#sbkim-widget-slot-siegel'); await p.waitForTimeout(500);
  ok(/SIEGEL/.test(await bubbleText()), 'Status-Lampe wird erklärt');
  ok(!(await isVisible('#sbkim-siegel-modal, .sbkim-siegel-modal')), '…und das Siegel-Fenster bleibt zu');
  await closeBubble(); await p.waitForTimeout(250);

  // 5. Kern: erklärt STATT ausgeführt (messbar an der Schriftgröße)
  const fs = await p.evaluate(() => getComputedStyle(document.body).fontSize);
  await p.click('#tb-zoom'); await p.waitForTimeout(450);
  ok(/Text vergr/.test(await bubbleText()), 'Antippen eines Knopfes zeigt die Erklärung');
  ok((await p.evaluate(() => getComputedStyle(document.body).fontSize)) === fs, '…und führt die Aktion NICHT aus');
  await closeBubble(); await p.waitForTimeout(250);

  await p.click('#dm-contacts'); await p.waitForTimeout(500);
  ok(/Kontakte/.test(await bubbleText()), 'Kontakte werden erklärt');
  ok(!(await isVisible("input[placeholder*='Schlüssel (64']")), '…und das Kontakte-Fenster bleibt zu');
  await closeBubble(); await p.waitForTimeout(250);

  await p.click('#rot-secret'); await p.waitForTimeout(450);
  ok(/Kreis-Geheimnis/.test(await bubbleText()), 'auch Eingabefelder werden erklärt');
  await closeBubble(); await p.waitForTimeout(200);

  // 6. Beenden → wieder normal bedienbar
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].filter((x) => x.textContent === 'beenden');
    if (b[0]) b[0].click();
  });
  await p.waitForTimeout(350);
  ok(!(await p.evaluate(() => window.__hilfe.isOn())), '„beenden" schaltet den Modus aus');
  await p.click('#tb-zoom'); await p.waitForTimeout(400);
  ok((await p.evaluate(() => getComputedStyle(document.body).fontSize)) !== fs, 'danach wirkt der Knopf wieder normal');

  // 7. Wahl überlebt das Neuladen
  await p.evaluate(() => window.__hilfe.setMode(true));
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1800);
  ok(await p.evaluate(() => window.__hilfe.isOn()), 'die Wahl überlebt das Neuladen');
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
