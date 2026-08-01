#!/usr/bin/env node
/*
 * alle.mjs — führt ALLE Prüfungen aus und fasst zusammen.
 *
 * WARUM ES DAS GIBT (Lehre vom 2026-08-01): Es gibt zwei Sorten Prüfungen, und
 * wer nur eine kennt, hält Rotes für Grün.
 *
 *   1. `npm test` — Drift-Guard (byte-1:1-Kopien der SBKIM-Module), Vollständig-
 *      keit der App-Schale, Ladeordnung. Läuft in Millisekunden.
 *   2. `tests/smoke_*.mjs` — die Browser-Prüfungen (echtes Chromium, teils mit
 *      echten Mini-Relais). Dauern zusammen einige Minuten.
 *
 * An genau dieser Trennung ist der Drift-Guard einmal unbemerkt rot geworden,
 * weil nur die Browser-Prüfungen liefen. Dieser Läufer nimmt beide.
 *
 * Aufruf: node tests/alle.mjs        (alles)
 *         node tests/alle.mjs kontakt   (nur Suiten, deren Name „kontakt" enthält)
 * Exit 0 = alles grün.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HIER, '..');
const filter = process.argv[2] || '';

const suiten = readdirSync(HIER)
  .filter((f) => f.startsWith('smoke_') && f.endsWith('.mjs'))
  .filter((f) => !filter || f.includes(filter))
  .sort();

let rot = 0;
const zeilen = [];

if (!filter) {
  process.stdout.write('npm test (Drift-Guard + Schale) … ');
  const r = spawnSync('npm', ['test'], { cwd: ROOT, encoding: 'utf8' });
  const aus = (r.stdout || '') + (r.stderr || '');
  const durch = /# fail 0/.test(aus) && r.status === 0;
  console.log(durch ? 'grün' : 'ROT');
  if (!durch) {
    rot++;
    // Nur die Fehlerzeilen zeigen — der ganze TAP-Strom hilft niemandem.
    for (const z of aus.split('\n')) if (/^not ok|Modul-Kopie|error:|AssertionError/.test(z)) console.log('   ' + z.trim());
  }
  zeilen.push(['npm test', durch ? 'grün' : 'ROT']);
}

for (const s of suiten) {
  process.stdout.write(s.replace(/^smoke_|\.mjs$/g, '') + ' … ');
  const r = spawnSync('node', [join(HIER, s)], { cwd: ROOT, encoding: 'utf8' });
  const aus = (r.stdout || '') + (r.stderr || '');
  const m = aus.match(/(\d+) ok, (\d+) FAIL/) || aus.match(/(\d+)\/(\d+) Proben grün/);
  const durch = r.status === 0;
  const zahl = m ? (m[0].includes('Proben') ? m[0] : m[1] + ' Proben') : '—';
  console.log(durch ? zahl + ' grün' : 'ROT (' + zahl + ')');
  if (!durch) {
    rot++;
    for (const z of aus.split('\n')) if (/\s{2}FAIL|Error|error:/.test(z)) console.log('   ' + z.trim());
  }
  zeilen.push([s, durch ? zahl : 'ROT']);
}

console.log('\n' + '='.repeat(52));
console.log(rot ? `${rot} von ${zeilen.length} Prüfungen ROT` : `alle ${zeilen.length} Prüfungen grün`);
console.log('Ehrlich: Der Browser-Lauf am Tablet ersetzt das nicht — und wird davon nicht ersetzt.');
process.exit(rot ? 1 : 0);
