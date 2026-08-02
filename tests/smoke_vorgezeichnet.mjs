#!/usr/bin/env node
/*
 * Smoke — was ABSICHTLICH schon im HTML steht, muss zum Code passen.
 *
 * WARUM ES DAS GIBT (Lighthouse-Messung 2026-08-02)
 * Die Karte oben sprang beim Laden um mehr als 170 Pixel nach unten: die
 * Relais-Leiste und der Heim-Relais-Hinweis waren im HTML LEER und wurden erst
 * gefüllt, wenn die ganze Modul-Kette geladen war. Auf einem langsamen Gerät
 * dauerte das mehrere Sekunden; sobald der Inhalt kam, rutschte alles darunter
 * weg. Gemessener „Cumulative Layout Shift": 0,433 (gut wäre unter 0,1).
 *
 * Die Lösung war nicht, Platz zu reservieren, sondern den Inhalt gleich
 * hinzuschreiben — im voreingestellten Zustand, wörtlich so, wie ihn der Code
 * gleich darauf noch einmal erzeugt. Das ist wirksam, hat aber einen Preis:
 * es steht jetzt an ZWEI Stellen. Wer eine ändert und die andere vergisst,
 * baut eine stille Lüge in die Seite — sie zeigte dann beim Start etwas
 * anderes als eine Sekunde später.
 *
 * Genau davor schützt diese Prüfung. Sie ist der Preis für die Lösung, und
 * sie gehört untrennbar dazu.
 *
 * Geprüft wird:
 *   1. Die vorgezeichneten Relais-Pillen entsprechen RELAY_POOL — Anzahl,
 *      Reihenfolge, Beschriftung, und welche als „an" gezeichnet sind.
 *   2. Der vorgezeichnete Heim-Relais-Hinweis ist WÖRTLICH der Text, den
 *      heimStatus() in der Voreinstellung erzeugt.
 *   3. Der ❓-Knopf steht im HTML (sonst hängt ihn hilfe.js nachträglich an
 *      und schiebt die Kopfzeile).
 *
 * Rein statisch — kein Browser nötig, läuft in Millisekunden.
 * Aufruf: node tests/smoke_vorgezeichnet.mjs   ·   Exit 0 = grün.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

console.log('Kimboard — vorgezeichnetes HTML gegen den Code');

/* ── 1) Relais-Pillen ─────────────────────────────────────────────────────── */
// RELAY_POOL aus dem Skript lesen (die Liste, die der Code wirklich benutzt).
const poolRoh = /const RELAY_POOL = \[([\s\S]*?)\];/.exec(html);
const pool = poolRoh
  ? Array.from(poolRoh[1].matchAll(/'(wss:\/\/[^']+)'/g)).map((m) => m[1])
  : [];
ok(pool.length > 0, `RELAY_POOL gefunden (${pool.length} Relais)`);

// Wie viele sind voreingestellt an? Steht im Code als RELAY_POOL.slice(0, N).
const sliceRoh = /activeRelays = RELAY_POOL\.slice\(0,\s*(\d+)\)/.exec(html);
const anZahl = sliceRoh ? Number(sliceRoh[1]) : null;
ok(anZahl !== null, `Voreinstellung im Code gefunden: die ersten ${anZahl} sind an`);

// Der vorgezeichnete Block.
const block = /<div class="row" id="relays"[^>]*>([\s\S]*?)<\/div>/.exec(html);
const pillen = block
  ? Array.from(block[1].matchAll(/<span class="pill"[^>]*opacity:([\d.]+);"[^>]*>\s*<span class="dot([^"]*)"><\/span>([^<]*)<\/span>/g))
      .map((m) => ({ deckkraft: Number(m[1]), punkt: m[2].trim(), text: m[3] }))
  : [];

ok(pillen.length === pool.length,
  `gleich viele Pillen wie Relais (HTML ${pillen.length}, Code ${pool.length})`);

let textOk = true, zustandOk = true;
pool.forEach((url, i) => {
  const p = pillen[i];
  if (!p) { textOk = zustandOk = false; return; }
  const an = i < anZahl;
  const soll = (an ? '' : '+ ') + url.replace('wss://', '');
  if (p.text !== soll) { textOk = false; console.log(`      ↳ Pille ${i}: "${p.text}" statt "${soll}"`); }
  // an  → volle Deckkraft + wartender Punkt · aus → gedimmt + Punkt ohne Zustand
  const zustandSoll = an ? (p.deckkraft === 1 && p.punkt === 'try') : (p.deckkraft < 1 && p.punkt === '');
  if (!zustandSoll) { zustandOk = false; console.log(`      ↳ Pille ${i} (${an ? 'an' : 'aus'}): Deckkraft ${p.deckkraft}, Punkt "${p.punkt}"`); }
});
ok(textOk, 'Beschriftung + Reihenfolge stimmen mit RELAY_POOL überein');
ok(zustandOk, 'die ersten ' + anZahl + ' sind als „an" gezeichnet, der Rest als „aus"');

/* ── 2) Heim-Relais-Hinweis ───────────────────────────────────────────────── */
// Den Text so zusammensetzen, wie heimStatus() ihn im Normalfall erzeugt.
const heimRoh = /const HOME_RELAY = '(wss:\/\/[^']+)'/.exec(html);
const heimKurz = heimRoh ? heimRoh[1].replace('wss://', '') : '';
ok(!!heimKurz, `HOME_RELAY gefunden (${heimKurz})`);

const zweigRoh = /s\.textContent = '🏠 Geschrieben wird NUR auf ' \+ kurzRelay\(heim\.url\)\s*\+ ([\s\S]*?);\n/.exec(html);
const sollText = zweigRoh
  ? ('🏠 Geschrieben wird NUR auf ' + heimKurz
      + Array.from(zweigRoh[1].matchAll(/'([^']*)'/g)).map((m) => m[1]).join(''))
  : null;
ok(!!sollText, 'den Zweig aus heimStatus() gefunden');

const statusRoh = /<div class="status" id="heim-status"[^>]*>([\s\S]*?)<\/div>/.exec(html);
const istText = statusRoh ? statusRoh[1].trim() : '';
ok(istText.length > 0, 'der Hinweis ist im HTML vorgezeichnet (nicht leer)');
if (sollText && istText !== sollText) {
  console.log('      ↳ HTML : ' + JSON.stringify(istText.slice(0, 110)));
  console.log('      ↳ Code : ' + JSON.stringify(sollText.slice(0, 110)));
}
ok(sollText !== null && istText === sollText,
  'der vorgezeichnete Text ist WÖRTLICH der, den heimStatus() erzeugt');

/* ── 3) ❓-Knopf ──────────────────────────────────────────────────────────── */
ok(/<button id="hilfe-btn"[^>]*class="tbtn"/.test(html),
  'der ❓-Knopf steht im HTML (hilfe.js hängt ihn sonst nachträglich an)');
const hilfe = readFileSync(join(ROOT, 'assets/hilfe.js'), 'utf8');
ok(/getElementById\('hilfe-btn'\)/.test(hilfe) && /hilfeVerdrahtet/.test(hilfe),
  'hilfe.js findet einen vorhandenen Knopf und verdrahtet ihn trotzdem');

console.log(`\nErgebnis: ${pass} bestanden, ${fail} durchgefallen`);
process.exit(fail ? 1 : 0);
