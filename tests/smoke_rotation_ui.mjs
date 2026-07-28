#!/usr/bin/env node
/*
 * Smoke — Relais-Automatik in der Oberfläche (echter Browser, Chromium).
 *
 * Sichert Klaus' Befund vom 2026-07-28 dauerhaft ab: Die Anzahl-Auswahl war auf
 * 4 gedeckelt, obwohl 9 Relais im Pool sind und ohne Automatik 5 laufen — das
 * Einschalten der Automatik machte die Verbindung also SCHLECHTER, während die
 * Erklärung „mehr = ausfallsicherer" versprach.
 *
 * Geprüft wird:
 *   - Die Auswahl deckt 2 … ganzer Pool ab (kein willkürlicher Deckel) und
 *     wächst mit, wenn der Pool wächst (sie wird aus RELAY_POOL erzeugt).
 *   - Voreinstellung = so viele, wie auch ohne Automatik laufen.
 *   - KERN: Das Einschalten der Automatik verbindet nie WENIGER Relais als
 *     vorher — kein Rückschritt bei der Ausfallsicherheit.
 *   - „alle" verbindet tatsächlich den ganzen Pool.
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_rotation_ui.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8442;
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

  const aktiv = () => p.evaluate(() =>
    [...document.querySelectorAll('#relays .pill')].filter((x) => x.style.opacity === '1').length);

  console.log('== Relais-Automatik (Oberfläche) ==');

  const poolN = await p.evaluate(() => document.querySelectorAll('#relays .pill').length);
  const opts = await p.evaluate(() => [...document.querySelectorAll('#rot-count option')].map((o) => ({ v: +o.value, t: o.textContent })));
  ok(poolN >= 5, 'Relais-Pool vorhanden (' + poolN + ')');
  ok(opts.length === poolN - 1, 'Auswahl deckt 2 … ganzer Pool ab (' + opts.length + ' Optionen bei ' + poolN + ' Relais)');
  ok(Math.max(...opts.map((o) => o.v)) === poolN, 'höchste Option = ganzer Pool, kein Deckel bei 4');
  ok(/alle/.test(opts[opts.length - 1].t), 'letzte Option ist als „alle" benannt');

  const vorher = await aktiv();
  const vorgabe = await p.evaluate(() => +document.getElementById('rot-count').value);
  ok(vorgabe === vorher, 'Voreinstellung (' + vorgabe + ') = so viele wie ohne Automatik laufen (' + vorher + ')');

  // KERN: Einschalten darf die Lage nie verschlechtern.
  await p.fill('#rot-secret', 'test-kreis');
  await p.dispatchEvent('#rot-secret', 'change');
  await p.check('#rot-on');
  await p.waitForTimeout(900);
  const nachher = await aktiv();
  ok(nachher >= vorher, 'Automatik verbindet nicht weniger als vorher (' + vorher + ' → ' + nachher + ')');
  ok(/Automatik läuft/.test(await p.textContent('#rot-status')), 'Status meldet den Betrieb');

  await p.selectOption('#rot-count', String(poolN));
  await p.waitForTimeout(900);
  ok((await aktiv()) === poolN, '„alle" verbindet tatsächlich den ganzen Pool');

  // Ausschalten stellt die manuelle Wahl wieder her.
  await p.uncheck('#rot-on');
  await p.waitForTimeout(600);
  ok((await aktiv()) === vorher, 'Ausschalten stellt die vorherige Auswahl wieder her');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
