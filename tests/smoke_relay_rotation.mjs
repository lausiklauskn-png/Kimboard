#!/usr/bin/env node
/*
 * Smoke — Schritt 3: berechneter Relais-Wechsel (Kreis-Rotation).
 *
 * Beweist headless die Eigenschaften, auf die sich der Kreis verlässt:
 *   - EINIGKEIT: gleiches Geheimnis + gleiche Zeit ⇒ überall dieselbe Auswahl
 *     (auch bei leicht abweichenden Uhren innerhalb desselben Fensters).
 *   - WECHSEL: über die Fenster hinweg ändert sich die Auswahl wirklich
 *     (nicht immer dasselbe Relais).
 *   - TRENNUNG: ein anderes Gruppen-Geheimnis ⇒ andere Auswahl.
 *   - ÜBERLAPPUNG: `union` enthält aktuelles UND voriges Fenster (niemand geht
 *     beim Umschalten verloren).
 *   - POOL-TREUE: es werden nur Relais aus dem erlaubten Pool gewählt, ohne
 *     Doppelte; Ansagen mit fremden Adressen werden ABGELEHNT.
 *   - FAIL-SOFT: leerer Pool / kein Geheimnis / Müll-Ansage werfen nicht.
 *
 * Aufruf: node tests/smoke_relay_rotation.mjs   ·   Exit 0 = grün.
 */
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const R = await import('../modules/relay_rotation.js');

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name); } }

const POOL = [
  'wss://relay.family-projekt.de', 'wss://relay.damus.io', 'wss://nos.lol',
  'wss://relay.nostr.band', 'wss://relay.primal.net', 'wss://relay.snort.social',
  'wss://nostr.mom', 'wss://offchain.pub', 'wss://relay.mostr.pub',
];
const SECRET = 'unser-kreis-geheimnis';
const P = 5 * 60 * 1000; // 5 Minuten
const T0 = 1_800_000_000_000; // fester Zeitpunkt (kein Date.now → reproduzierbar)

console.log('== Schritt 3 — berechneter Relais-Wechsel ==');

// --- Einigkeit im selben Fenster (auch bei Uhren-Versatz von 30 s) ---
const a = await R.currentRelays(SECRET, POOL, { count: 3, periodMs: P, now: T0 + 10_000 });
const b = await R.currentRelays(SECRET, POOL, { count: 3, periodMs: P, now: T0 + 40_000 });
ok(a.current.join() === b.current.join(), 'zwei Geräte im selben Fenster wählen dieselben Relais');
ok(a.windowIdx === b.windowIdx, 'gleiche Fenster-Nummer trotz 30 s Uhren-Versatz');

// --- Wechsel über die Fenster ---
const w1 = await R.relaysForWindow(SECRET, POOL, 3, 1000);
const w2 = await R.relaysForWindow(SECRET, POOL, 3, 1001);
const w3 = await R.relaysForWindow(SECRET, POOL, 3, 1002);
ok(w1.join() !== w2.join() || w2.join() !== w3.join(), 'die Auswahl ändert sich über die Fenster (kein Dauer-Relais)');
let changed = 0;
for (let i = 0; i < 20; i++) {
  const x = await R.relaysForWindow(SECRET, POOL, 3, 500 + i);
  const y = await R.relaysForWindow(SECRET, POOL, 3, 501 + i);
  if (x.join() !== y.join()) changed++;
}
ok(changed >= 15, 'über 20 Fenster wechselt die Auswahl fast immer (' + changed + '/20)');

// --- Trennung verschiedener Kreise ---
const other = await R.relaysForWindow('anderes-geheimnis', POOL, 3, 1000);
ok(other.join() !== w1.join(), 'anderes Gruppen-Geheimnis ⇒ andere Auswahl');

// --- Reproduzierbarkeit ---
ok((await R.relaysForWindow(SECRET, POOL, 3, 1000)).join() === w1.join(), 'gleiche Eingabe ⇒ gleiches Ergebnis (reproduzierbar)');

// --- Überlappung ---
const cur = await R.currentRelays(SECRET, POOL, { count: 2, periodMs: P, now: T0 });
ok(cur.current.every((u) => cur.union.includes(u)) && cur.previous.every((u) => cur.union.includes(u)),
  'union enthält aktuelles UND voriges Fenster (Überlappung)');
ok(new Set(cur.union).size === cur.union.length, 'union ohne Doppelte');
ok(cur.msUntilNext > 0 && cur.msUntilNext <= P, 'Zeit bis zum nächsten Wechsel ist plausibel');

// --- Pool-Treue ---
ok(w1.length === 3 && w1.every((u) => POOL.includes(u)), 'nur Relais aus dem erlaubten Pool, richtige Anzahl');
ok(new Set(w1).size === 3, 'keine Doppelten in der Auswahl');
const tooMany = await R.relaysForWindow(SECRET, POOL, 99, 7);
ok(tooMany.length === POOL.length, 'mehr angefordert als vorhanden → höchstens der ganze Pool');

// --- Ansage (Reserve) ---
const ann = R.makeAnnouncement(1234, ['wss://nos.lol', 'wss://relay.damus.io'], T0);
ok(R.isAnnouncement(ann), 'Ansage wird als solche erkannt');
const parsed = R.parseAnnouncement(ann, POOL);
ok(parsed && parsed.windowIdx === 1234 && parsed.relays.length === 2, 'Ansage wird korrekt gelesen');
const evil = JSON.stringify({ kbrr: 1, w: 1, r: ['wss://boese.example/spion'], ts: T0 });
ok(R.parseAnnouncement(evil, POOL) === null, 'Ansage mit FREMDER Adresse wird abgelehnt (kein Umleiten)');
const mixed = JSON.stringify({ kbrr: 1, w: 1, r: ['wss://boese.example/spion', 'wss://nos.lol'], ts: T0 });
ok(R.parseAnnouncement(mixed, POOL)?.relays.join() === 'wss://nos.lol', 'aus gemischter Ansage bleibt nur das Erlaubte');
ok(R.parseAnnouncement('nur ein normaler Zettel', POOL) === null, 'normaler Text ist keine Ansage');
ok(R.parseAnnouncement('{kaputt', POOL) === null, 'kaputtes JSON → null (kein Absturz)');
ok(R.isAnnouncement('Frage: was kochen wir?') === false, 'normaler Zettel wird nicht als Ansage verwechselt');

// --- fail-soft ---
ok((await R.relaysForWindow(SECRET, [], 3, 1)).length === 0, 'leerer Pool → leere Auswahl (kein Wurf)');
ok((await R.relaysForWindow('', POOL, 2, 1)).join() === POOL.slice(0, 2).join(), 'ohne Geheimnis → unveränderte Reihenfolge');
const clamped = await R.currentRelays(SECRET, POOL, { count: 3, periodMs: 1000, now: T0 });
ok(clamped.periodMs >= 60000, 'zu kurze Periode wird auf mindestens 1 Minute angehoben');

console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
