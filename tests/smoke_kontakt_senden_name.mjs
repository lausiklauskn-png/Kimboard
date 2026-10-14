#!/usr/bin/env node
/*
 * Smoke — „Kontakt senden": der Name des Empfängers ist Text, nie HTML.
 *
 * Befund Sage 2026-10-14 (docs/sessions/archiv/2026-10-14_angriffsflaeche_mycel.md):
 * `openKontaktSenden` setzte `contactName(...)` roh in `box.innerHTML`. Der Name
 * kann aus einer angenommenen Gruppeneinladung stammen, also von einem Fremden.
 * Geprüft wird im echten Browser: kein Element aus dem Namen, nichts ausgeführt,
 * der Name steht wörtlich da.
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_kontakt_senden_name.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8471;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 50)); }

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  await p.route(/^(?!http:\/\/127\.0\.0\.1).*/, (r) => r.abort());
  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!(window.__kb && window.__kb.setPrivatAn));
  const NAME = '<img src=x onerror="window.__kx=1">Mallory';
  await p.evaluate((NAME) => {
    const a = 'a'.repeat(64), b = 'b'.repeat(64);
    const k = window.__kb.contacts(); k[a] = { name: NAME }; k[b] = { name: 'Bob' };
    window.__kb.setPrivatAn([a]);
  }, NAME);
  // Der echte Weg: ➕ → „Kontakt senden"
  await p.click('#anhang');
  await p.waitForFunction(() => Array.from(document.querySelectorAll('#anhang-menu button')).some((x) => /Kontakt senden/.test(x.textContent)));
  await p.evaluate(() => Array.from(document.querySelectorAll('#anhang-menu button')).find((x) => /Kontakt senden/.test(x.textContent)).click());
  await p.waitForSelector('#kontakt-senden');
  await p.waitForTimeout(600);   // ein onerror feuert erst nach dem Laden des Bildes
  const r = await p.evaluate((NAME) => {
    const box = document.getElementById('kontakt-senden');
    return { da: !!box, img: box ? box.querySelectorAll('img').length : -1, lief: typeof window.__kx,
             text: box ? box.textContent.includes(NAME) : false };
  }, NAME);
  ok(r.da, 'das Fenster „Kontakt senden" geht auf');
  ok(r.img === 0, 'kein Element aus dem Namen (img=' + r.img + ')');
  ok(r.lief === 'undefined', 'nichts aus dem Namen ausgeführt');
  ok(r.text, 'der Name steht wörtlich da');
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n${pass} grün · ${fail} ROT`);
process.exit(fail ? 1 : 0);
