#!/usr/bin/env node
/*
 * Smoke — Kontakte-Fenster: der automatische Weg steht vorn (echter Browser).
 *
 * Klaus' Frage 2026-08-01: „Ist das richtig, dass ich auf Privat gestellt, meine
 * Kennung kopiert und an meinen Kontakt schicke?" — NEIN. Der Schlüssel reist in
 * jedem Zettel mit; man tippt nur auf den Namen. Gefragt hat er, weil „🔑 Dein
 * eigener Schlüssel" ganz oben und groß stand und sich dadurch wie der normale
 * Weg las. Er ist die AUSNAHME (nur nötig, wenn jemand nie geschrieben hat).
 *
 * Geprüft wird:
 *   - Oben steht der automatische Weg samt Entwarnung („nichts abtippen und
 *     nichts verschicken").
 *   - Der eigene Schlüssel und die Handeingabe stecken im ZUGEKLAPPTEN
 *     Ausnahme-Bereich — beim Öffnen also nicht sichtbar.
 *   - Aufgeklappt sind beide erreichbar (nichts ist verloren gegangen).
 *   - Kontakte werden mit Sicherheitsnummer gelistet.
 *
 * MESSUNG DER SICHTBARKEIT (Lehre): Ein zugeklapptes <details> behält die
 * Layout-Größe (`getBoundingClientRect().height` > 0) und `offsetParent` bleibt
 * gesetzt — nur gemalt wird nichts. Verlässlich ist hier `checkVisibility()`.
 * (Beim ➕-Menü war es `display:none`, da genügt `offsetParent`.)
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_kontakte_fenster.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8458;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 820, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);

  // Der eigene Schlüssel-Block, an seinem Text erkannt.
  const keySichtbar = () => p.evaluate(() => {
    const k = [...document.querySelectorAll('div')].find((x) => x.textContent.trim().startsWith('🔑 Dein eigener Schlüssel'));
    return !!k && (k.checkVisibility ? k.checkVisibility() : k.offsetParent !== null);
  });

  await p.evaluate(() => window.__kb.pinContact('a'.repeat(64), 'Klaus Handy'));
  await p.waitForTimeout(300);
  await p.click('#dm-contacts');
  await p.waitForTimeout(700);

  console.log('== Kontakte-Fenster ==');

  const txt = await p.textContent('body');
  ok(/So bekommst du Kontakte/.test(txt), 'oben steht, wie man Kontakte bekommt');
  ok(/tippe auf seinen Namen/i.test(txt), '…nämlich per Tipp auf den Namen');
  ok(/nichts abtippen und nichts verschicken/.test(txt), '…mit der ausdrücklichen Entwarnung');

  const zu = await p.evaluate(() => {
    const d = document.getElementById('kontakte-ausnahme');
    return !!d && !d.open;
  });
  ok(zu, 'der Ausnahme-Bereich ist zugeklappt');
  ok(await p.evaluate(() => {
    const d = document.getElementById('kontakte-ausnahme');
    const k = [...document.querySelectorAll('div')].find((x) => x.textContent.trim().startsWith('🔑 Dein eigener Schlüssel'));
    return !!(d && k && d.contains(k));
  }), 'der eigene Schlüssel steckt DARIN (nicht mehr oben)');
  ok((await keySichtbar()) === false, '…und ist beim Öffnen des Fensters nicht sichtbar');
  ok(await p.evaluate(() => {
    const inp = document.querySelector('#kontakte-ausnahme input[placeholder*="64 Hex"]');
    return !!inp && (inp.checkVisibility ? !inp.checkVisibility() : true);
  }), 'auch die Handeingabe ist zugeklappt');
  ok(/nie geschrieben/.test(txt), 'der Bereich sagt, wann man ihn überhaupt braucht');

  ok(/Klaus Handy/.test(txt), 'Kontakte werden gelistet');
  ok(/Sicherheitsnummer/.test(txt), '…mit Sicherheitsnummer');

  // Aufklappen: nichts ist verloren gegangen
  await p.click('#kontakte-ausnahme summary');
  await p.waitForTimeout(400);
  ok(await keySichtbar(), 'aufgeklappt: der eigene Schlüssel ist erreichbar');
  ok(await p.evaluate(() => {
    const inp = document.querySelector('#kontakte-ausnahme input[placeholder*="64 Hex"]');
    return !!inp && (inp.checkVisibility ? inp.checkVisibility() : true);
  }), 'aufgeklappt: die Handeingabe ist erreichbar');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
