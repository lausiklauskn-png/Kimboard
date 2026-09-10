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

// Wie viele sind voreingestellt an? Steht im Code als benannte Konstante,
// aus der der Satz geschnitten wird — seit dem 2026-09-10 nicht mehr als Zahl
// im Schnitt selbst (die lief mit der Rotations-Automatik auseinander).
const sliceRoh = /const VORGEWAEHLT = (\d+);/.exec(html);
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

/* ── 1b) Die zweite eigene Tür (Klaus 2026-09-10) ──────────────────────────
 *
 * `relay.pwa-toolpoint.de` liegt seit dem 2026-08-11 als zweiter Caddy-Block
 * auf DEMSELBEN Relais-Container wie relay.family-projekt.de. Es gehört in die
 * Liste — aber NICHT in den Default-Aktiv-Satz: der zählt fünf VERSCHIEDENE
 * Speicher, und daraus vier zu machen und weiter „fünf gestreut" zu schreiben
 * wäre eine Zahl, die etwas anderes verspricht, als sie hält. */
const TOOLPOINT = 'wss://relay.pwa-toolpoint.de';
const HEIM_TUER = 'wss://relay.family-projekt.de';
ok(pool.includes(TOOLPOINT), 'das Toolpoint-Relais steht in RELAY_POOL');
ok(pool.indexOf(TOOLPOINT) < anZahl,
  'es ist voreingestellt AN (Klaus 2026-09-10: „mach den Default-Satz auf sechs")');

/* ⚠ DER KERN: die Streuung darf dabei NICHT geschrumpft sein.
 *
 * relay.pwa-toolpoint.de und relay.family-projekt.de sind zwei Türen in
 * DENSELBEN Nachrichten-Speicher (zweiter Caddy-Block auf demselben Container,
 * family-project/Caddyfile.example). Wer die zweite Tür in einen Fünfer-Satz
 * schiebt, hat vier verschiedene Speicher und schreibt weiter „fünf" — deshalb
 * ist der Satz auf sechs gehoben. Gemessen wird genau das: wie viele
 * VERSCHIEDENE Speicher im Default-Satz stehen. */
const zweiteTuer = (u) => (u === TOOLPOINT ? HEIM_TUER : u);
const speicher = new Set(pool.slice(0, anZahl).map(zweiteTuer));
ok(speicher.size === 5,
  `der Default-Satz deckt weiter fünf verschiedene Speicher ab (${speicher.size} bei ${anZahl} Pillen)`);
ok(pool.slice(0, anZahl).includes(HEIM_TUER),
  'und das Heim-Relais ist darunter');

/* ⚠ UND DIE ZAHL DARF NUR EINMAL DASTEHEN.
 *
 * Am 2026-09-10 ist der Default-Satz auf sechs gestiegen — und die
 * Rotations-Automatik behielt ihre eigene, abgeschriebene 5. Damit hätte ihr
 * Einschalten wieder EIN Relais gekostet, also genau Klaus' Befund vom
 * 2026-07-28 zurückgeholt. Gefunden hat es `smoke_rotation_ui.mjs` im
 * Browser; hier wird es ohne Browser festgenagelt: die Automatik LIEST die
 * Zahl, sie schreibt sie nicht ab. */
ok(anZahl === 6, `VORGEWAEHLT steht auf sechs (gemessen: ${anZahl})`);
ok(/activeRelays = RELAY_POOL\.slice\(0, VORGEWAEHLT\)/.test(html),
  'der Default-Satz wird daraus geschnitten, nicht aus einer zweiten Zahl');
ok(/const ROT_COUNT_DEFAULT = VORGEWAEHLT;/.test(html),
  'die Rotations-Automatik liest dieselbe Konstante ab, statt sie abzuschreiben');
ok(!/const ROT_COUNT_DEFAULT = \d/.test(html),
  'und trägt keine eigene Zahl mehr (die lief am 2026-09-10 auseinander)');

/* Der Grund muss DASTEHEN — sonst kürzt die nächste Sitzung den Satz wieder
   auf fünf, „weil da eine Dopplung drin ist", und nimmt dabei einen echten
   Speicher mit. */
ok(/ZWEI NAMEN SIND KEINE ZWEITE POSTSTELLE/.test(html),
  'und der Grund steht daneben (zwei Namen, ein Speicher)');
ok(/DESHALB SIND ES SECHS UND NICHT FÜNF/.test(html),
  'samt der Begründung, warum der Satz sechs zählt und nicht fünf');
ok(!/Default: 5 gestreut/.test(html),
  'die alte Angabe „5 gestreut" steht nirgends mehr — sie wäre jetzt falsch');
ok(!/Erster Eintrag: Klaus' EIGENES, log-freies, neutrales Toolpoint-Relay/.test(html),
  'die überholte Toolpoint-Behauptung im Kopf ist weg');

/* Beide eigenen Türen tragen „(eigenes)" im Heim-Wähler. Ein Vergleich mit
   HOME_RELAY allein liesse die zweite wie eine fremde aussehen. */
const eigeneRoh = /const EIGENE_RELAIS = \[([^\]]*)\]/.exec(html);
const eigene = eigeneRoh ? Array.from(eigeneRoh[1].matchAll(/'(wss:\/\/[^']+)'/g)).map((m) => m[1]) : [];
ok(eigene.length === 2 && eigene.includes(TOOLPOINT),
  `beide eigenen Poststellen sind benannt (${eigene.map((u) => u.replace('wss://', '')).join(', ')})`);
ok(/EIGENE_RELAIS\.includes\(url\) \? ' \(eigenes\)'/.test(html),
  'der Heim-Wähler markiert BEIDE als „(eigenes)", nicht nur das Heim-Relais');
ok(eigene.every((u) => pool.includes(u)),
  'und jede davon steht auch wirklich im Pool');

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
