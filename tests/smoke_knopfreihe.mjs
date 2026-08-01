#!/usr/bin/env node
/*
 * Smoke — die Knopfreihe über dem Brett liegt in EINER Linie.
 *
 * Klaus' Sichttest 2026-08-01 (drei Bilder vom Tablet): „Optisch sieht das
 * nicht gut aus, die Knöpfe liegen nicht in einer Reihe, sondern versetzt.
 * Sie sollten alle in einer Reihe liegen, damit es optisch nicht aus dem
 * Rahmen fällt."
 *
 * Ursache: Die drei Knöpfe lagen einzeln in einer `.row` mit
 * `justify-content: space-between`. Das verteilte sie über die volle Breite
 * (Beschriftung ganz links, „Meine zurückziehen" in der Mitte, „Leeren" ganz
 * rechts) und schob „Ausgeblendet" in die nächste Zeile.
 *
 * Geprüft wird an der ECHTEN Darstellung, bei zwei Breiten:
 *   - Alle drei stehen auf derselben Höhe (eine Linie, nicht versetzt).
 *   - Sie stehen dicht beieinander (Gruppe), nicht über die Breite verteilt.
 *   - Sie sind gleich hoch.
 *   - Am Handy, wo sie umbrechen dürfen: sie bilden saubere Zeilen mit
 *     gemeinsamer linker Kante — kein Treppenmuster.
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_knopfreihe.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8474;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const MASSE = (p) => p.evaluate(() => {
  const ids = ['meine-zurueckziehen', 'board-clear', 'ausgeblendet'];
  const r = ids.map((id) => {
    const b = document.getElementById(id);
    const x = b.getBoundingClientRect();
    return { id, top: Math.round(x.top), left: Math.round(x.left), right: Math.round(x.right), h: Math.round(x.height) };
  });
  return { r, breite: document.documentElement.clientWidth };
});

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

  console.log('== Knopfreihe über dem Brett ==');

  // ---------- Tablet/DeX: 900 px — alle drei in EINER Zeile ----------
  const p = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1600);

  const m = await MASSE(p);
  const tops = m.r.map((x) => x.top);
  const gleicheHoehe = Math.max(...tops) - Math.min(...tops);
  ok(gleicheHoehe <= 2, 'alle drei Knöpfe stehen auf derselben Höhe (Versatz ' + gleicheHoehe + ' px)');

  const hoehen = m.r.map((x) => x.h);
  ok(Math.max(...hoehen) - Math.min(...hoehen) <= 2, 'sie sind gleich hoch (' + hoehen.join('/') + ' px)');

  // Dicht beieinander: die Lücke zwischen benachbarten Knöpfen ist ein Abstand,
  // keine halbe Bildschirmbreite. Genau das war der optische Bruch.
  const sortiert = [...m.r].sort((a, b) => a.left - b.left);
  const luecken = [];
  for (let i = 1; i < sortiert.length; i++) luecken.push(sortiert[i].left - sortiert[i - 1].right);
  ok(Math.max(...luecken) <= 16, 'sie stehen als Gruppe beieinander (größte Lücke ' + Math.max(...luecken) + ' px)');

  // ---------- Handy: 360 px — Umbruch erlaubt, aber sauber ----------
  const p2 = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await p2.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(1600);
  const m2 = await MASSE(p2);

  // Knöpfe nach Zeilen gruppieren und je Zeile prüfen.
  const zeilen = new Map();
  for (const b of m2.r) {
    const key = [...zeilen.keys()].find((k) => Math.abs(k - b.top) <= 3);
    (zeilen.get(key === undefined ? (zeilen.set(b.top, []), b.top) : key)).push(b);
  }
  let sauber = true, treppe = 0;
  for (const [, gruppe] of zeilen) {
    const t = gruppe.map((x) => x.top);
    if (Math.max(...t) - Math.min(...t) > 2) sauber = false;
    const s = [...gruppe].sort((a, b) => a.left - b.left);
    for (let i = 1; i < s.length; i++) treppe = Math.max(treppe, s[i].left - s[i - 1].right);
  }
  ok(sauber, 'am Handy bildet jede Zeile eine gerade Linie (kein Treppenmuster)');
  ok(treppe <= 16, '…und die Knöpfe je Zeile bleiben beieinander (größte Lücke ' + treppe + ' px)');
  const kanten = [...zeilen.values()].map((g) => Math.min(...g.map((x) => x.left)));
  ok(Math.max(...kanten) - Math.min(...kanten) <= 2 || zeilen.size === 1,
    '…und die Zeilen haben dieselbe linke Kante');

  // Kein Knopf darf über den Rand hinausragen.
  ok(m2.r.every((b) => b.right <= m2.breite), 'kein Knopf ragt aus dem Fenster (Breite ' + m2.breite + ')');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
