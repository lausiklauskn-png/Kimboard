#!/usr/bin/env node
/*
 * Smoke — die Relais-Wache im NACHSEHEN-Gang (tools/relais-wache.sh).
 *
 * WOZU: Das Skript soll später einmal Ereignisse aus dem Relais-Speicher
 * entfernen. Bevor es das darf, muss es beweisen, dass es RICHTIG ZÄHLT — und
 * dass es im Nachsehen-Gang wirklich nichts anfasst.
 *
 * Geprüft wird gegen eine ECHTE SQLite-Datenbank mit nostr-rs-relay-Schema,
 * nicht gegen eine Nachbildung. `sqlite3` fehlt in dieser Umgebung; Node bringt
 * seit 22.5 ein eigenes mit, das `_sqlite3-ersatz.mjs` unter dem erwarteten
 * Namen in den PATH stellt. Gemessen wird damit das echte Skript.
 *
 *   1. ES ÄNDERT NICHTS. Prüfsumme der Datenbank vorher und nachher — das ist
 *      die wichtigste Prüfung, denn genau das ist das Versprechen des Gangs.
 *   2. ES ZÄHLT RICHTIG. Zettel-Kennungen und Absender-Kennungen getrennt,
 *      Absender trifft ALLE seine Ereignisse.
 *   3. ES GREIFT NACH DER KENNUNG, NICHT NACH DEM BRETT-TAG. Eine gesperrte
 *      Mycel-Anfrage (`sbkim-qry`) muss genauso gefunden werden wie ein Zettel
 *      — sonst rutscht sie durch, und das war der Befund vom 2026-08-18.
 *   4. BEISPIELE AUS KOMMENTAREN ZÄHLEN NICHT. In der Liste steht 'a1b2…' als
 *      Muster; wer das mitfängt, sperrt Zeichenfolgen statt Ereignisse.
 *   5. EINE LEERE LISTE IST KEIN FEHLER. Sie ist der Normalfall, solange
 *      niemand etwas gesperrt hat.
 *   5b. BEIDE SCHEMA-ZUSCHNITTE. Kennungen als BLOB (heutiges nostr-rs-relay)
 *      UND als Hex-Zeichenkette. Nur am zweiten ist überhaupt messbar, ob das
 *      Skript Groß- und Kleinschreibung angleicht: bei BLOB tut SQLite das
 *      selbst, und die Prüfung wäre auch ohne jede Normalisierung grün.
 *   6. LIEBER ABBRECHEN ALS FALSCH ZÄHLEN. Fehlt die Datenbank oder passt das
 *      Schema nicht, muss es das sagen — eine Null, die „falsch gesucht" heißt
 *      und wie „nichts betroffen" aussieht, wäre schlimmer als ein Abbruch.
 *
 * Aufruf: node tests/smoke_relais_wache.mjs   ·   Exit 0 = grün.
 */
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HIER, '..');
const SKRIPT = join(ROOT, 'tools', 'relais-wache.sh');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const arbeit = mkdtempSync(join(tmpdir(), 'wache-'));

/* `sqlite3` in den PATH legen — als Aufruf unseres Node-Ersatzes. */
const binDir = join(arbeit, 'bin');
execFileSync('mkdir', ['-p', binDir]);
writeFileSync(join(binDir, 'sqlite3'),
  '#!/bin/sh\nexec node ' + JSON.stringify(join(HIER, '_sqlite3-ersatz.mjs')) + ' "$@"\n');
chmodSync(join(binDir, 'sqlite3'), 0o755);

const hex = (n) => createHash('sha256').update(String(n)).digest('hex');

/* Eine Datenbank im Zuschnitt von nostr-rs-relay: Kennung und Absender als
   BLOB, dazu die Tag-Tabelle. Der Zuschnitt ist der Grund, warum das Skript
   sein Schema selbst erfragt statt es anzunehmen.

   `art: 'text'` baut dieselbe Tabelle mit Hex-ZEICHENKETTEN. Ältere Fassungen
   legen es so ab, und die beiden Zuschnitte verhalten sich NICHT gleich:
   SQLite liest `x'ABCD'` unabhängig von Groß- und Kleinschreibung, ein
   Zeichenketten-Vergleich dagegen ist streng. Wer nur gegen BLOB prüft, misst
   deshalb die halbe Wahrheit — und die Groß/klein-Behandlung des Skripts
   überhaupt nicht (Befund der Gegenprobe, 2026-08-18). */
function baueDb(pfad, zeilen, art) {
  const text = art === 'text';
  const db = new DatabaseSync(pfad);
  db.exec(`CREATE TABLE event (
    id INTEGER PRIMARY KEY, event_hash ${text ? 'TEXT' : 'BLOB'} NOT NULL, created_at INTEGER,
    kind INTEGER, author ${text ? 'TEXT' : 'BLOB'} NOT NULL, content TEXT)`);
  db.exec('CREATE TABLE tag (event_id INTEGER, name TEXT, value TEXT)');
  const ev = db.prepare('INSERT INTO event (id,event_hash,created_at,kind,author,content) VALUES (?,?,?,?,?,?)');
  const tg = db.prepare('INSERT INTO tag (event_id,name,value) VALUES (?,?,?)');
  const wert = (h) => (text ? h : Buffer.from(h, 'hex'));
  zeilen.forEach((z, i) => {
    ev.run(i + 1, wert(z.id), 1700000000 + i, 1, wert(z.autor), z.text || '');
    tg.run(i + 1, 't', z.tag || 'sbkim-frage-antwort-test');
  });
  db.close();
}

const listeJs = (ereignisse, absender) => `(function () {
  'use strict';
  window.KB_SPERRLISTE = {
    fassung: 1,
    stand: '2026-08-18',
    /* Beispiel, das NICHT zählen darf:
     *   'a1b2…': { grund: 'Volksverhetzung', seit: '2026-08-17' }, */
    ereignisse: {
${ereignisse.map((k) => `      '${k}': { grund: 'Probe', seit: '2026-08-18' },`).join('\n')}
    },
    absender: {
${absender.map((k) => `      '${k}': { grund: 'Probe', seit: '2026-08-18' },`).join('\n')}
    }
  };
})();`;

function lauf(dbPfad, listePfad) {
  try {
    const aus = execFileSync('bash', [SKRIPT], {
      env: { ...process.env, PATH: binDir + ':' + process.env.PATH, DB: dbPfad, LISTE: listePfad },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
    });
    return { code: 0, aus };
  } catch (e) {
    return { code: e.status ?? 1, aus: (e.stdout || '') + (e.stderr || '') };
  }
}
const summe = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

console.log('== Relais-Wache (Nachsehen) ==');
try {
  /* Vier Ereignisse: zwei vom selben Absender, eines davon eine MYCEL-ANFRAGE
     unter anderem Tag — genau der Fall, der bei einer Tag-Suche durchrutscht. */
  const A = hex('autor-a'), B = hex('autor-b');
  const e1 = hex('e1'), e2 = hex('e2'), e3 = hex('e3'), e4 = hex('e4');
  const db1 = join(arbeit, 'voll.db');
  baueDb(db1, [
    { id: e1, autor: A, text: 'zettel eins' },
    { id: e2, autor: A, text: 'anfrage', tag: 'sbkim-qry' },
    { id: e3, autor: B, text: 'zettel drei' },
    { id: e4, autor: B, text: 'zettel vier' }
  ]);

  /* ═══ 1. Leere Liste ist kein Fehler ═══ */
  {
    const l = join(arbeit, 'leer.js');
    writeFileSync(l, listeJs([], []));
    const r = lauf(db1, l);
    ok(r.code === 0, 'leere Liste: sauberer Abschluss (Rückgabewert 0)');
    ok(/Sperr-Liste ist leer/.test(r.aus), '…und sagt, dass sie leer ist');
    ok(/kein Fehler/.test(r.aus), '…ausdrücklich als Normalfall, nicht als Störung');
  }

  /* ═══ 2. Zählt richtig — und ändert nichts ═══ */
  {
    const vorher = summe(db1);
    const l = join(arbeit, 'zwei.js');
    writeFileSync(l, listeJs([e1, e3], []));
    const r = lauf(db1, l);
    ok(r.code === 0, 'mit zwei Zettel-Kennungen: sauberer Abschluss');
    ok(/Betroffen sind 2 von 4/.test(r.aus), '…zählt genau 2 von 4');
    ok(/über Zettel-Kennungen:   2/.test(r.aus), '…beide über Zettel-Kennungen');
    ok(/über Absender-Kennungen: 0/.test(r.aus), '…keine über Absender');
    ok(summe(db1) === vorher, 'DIE DATENBANK IST UNVERÄNDERT (Prüfsumme gleich)');
    ok(/NICHTS gelöscht/.test(r.aus), '…und das Skript sagt es auch');
  }

  /* ═══ 3. Nach der KENNUNG, nicht nach dem Brett-Tag ═══
     e2 ist eine Mycel-Anfrage (`sbkim-qry`). Wer nach dem Kimboard-Tag
     greift, findet sie nicht — genau der Befund vom 2026-08-18. */
  {
    const l = join(arbeit, 'qry.js');
    writeFileSync(l, listeJs([e2], []));
    const r = lauf(db1, l);
    ok(/Betroffen sind 1 von 4/.test(r.aus),
      'eine gesperrte MYCEL-ANFRAGE wird gefunden (Kennung schlägt Tag)');
  }

  /* ═══ 4. Absender trifft alles von ihm ═══ */
  {
    const l = join(arbeit, 'autor.js');
    writeFileSync(l, listeJs([], [A]));
    const r = lauf(db1, l);
    ok(/über Absender-Kennungen: 2/.test(r.aus), 'ein gesperrter Absender trifft BEIDE seiner Ereignisse');
    ok(/über Zettel-Kennungen:   0/.test(r.aus), '…und wird nicht als Zettel mitgezählt');
    ok(/trifft ALLES von ihnen/.test(r.aus), '…die Ausgabe warnt vor der Reichweite');
  }

  /* ═══ 5. Beispiele aus Kommentaren zählen nicht ═══ */
  {
    const l = join(arbeit, 'kommentar.js');
    writeFileSync(l, listeJs([], []).replace(
      "stand: '2026-08-18',",
      "stand: '2026-08-18',\n    /* '" + e1 + "' steht NUR im Kommentar */"));
    const r = lauf(db1, l);
    ok(/Sperr-Liste ist leer/.test(r.aus),
      'eine Kennung, die nur im Kommentar steht, zählt nicht');
  }

  /* ═══ 6. Der zweite Schema-Zuschnitt: Kennungen als Zeichenkette ═══
     Hier trennt sich, was bei BLOB zusammenfällt. SQLite liest `x'ABCD'`
     unabhängig von der Schreibweise — eine Zeichenkette vergleicht es streng.
     Beim ersten Bau war Prüfung 6 deshalb blind: sie maß gegen BLOB und wäre
     auch dann grün geblieben, wenn das Skript gar nicht normalisierte. */
  {
    const db2 = join(arbeit, 'text.db');
    baueDb(db2, [
      { id: e1, autor: A, text: 'zettel eins' },
      { id: e2, autor: A, text: 'anfrage', tag: 'sbkim-qry' },
      { id: e3, autor: B, text: 'zettel drei' },
      { id: e4, autor: B, text: 'zettel vier' }
    ], 'text');

    const l = join(arbeit, 'text-klein.js');
    writeFileSync(l, listeJs([e1], []));
    const r = lauf(db2, l);
    ok(/Kennung in Spalte 'event_hash' \(TEXT\)/.test(r.aus),
      'ein Text-Schema wird als solches erkannt');
    ok(/Betroffen sind 1 von 4/.test(r.aus), '…und richtig abgefragt (nicht als x\'…\')');

    const lg = join(arbeit, 'text-gross.js');
    writeFileSync(lg, listeJs([e1.toUpperCase()], []));
    const rg = lauf(db2, lg);
    ok(/Betroffen sind 1 von 4/.test(rg.aus),
      'GROSS geschriebene Kennungen werden normalisiert (nur hier messbar)');

    const vorher = summe(db2);
    ok(summe(db2) === vorher && /NICHTS gelöscht/.test(rg.aus),
      '…auch am Text-Schema wird nichts angefasst');
  }

  /* ═══ 6b. Und am BLOB-Schema ebenso ═══ */
  {
    const l = join(arbeit, 'gross.js');
    writeFileSync(l, listeJs([e1.toUpperCase()], []));
    const r = lauf(db1, l);
    ok(/Betroffen sind 1 von 4/.test(r.aus), 'GROSS geschriebene Kennungen auch am BLOB-Schema');
  }

  /* ═══ 7. Lieber abbrechen als falsch zählen ═══ */
  {
    const l = join(arbeit, 'zwei.js');
    const r = lauf(join(arbeit, 'gibtesnicht.db'), l);
    ok(r.code === 2, 'fehlende Datenbank: Abbruch mit eigenem Rückgabewert');
    ok(/nicht lesbar/.test(r.aus), '…mit klarer Ansage');
    ok(!/Betroffen sind \d+ von/.test(r.aus), '…und OHNE eine Zahl, die wie ein Ergebnis aussieht');

    const fremd = join(arbeit, 'fremd.db');
    const d = new DatabaseSync(fremd); d.exec('CREATE TABLE etwas (a TEXT)'); d.close();
    const r2 = lauf(fremd, l);
    ok(r2.code === 2, 'fremdes Schema: Abbruch statt einer Null');
    ok(/nicht gefunden/.test(r2.aus), '…mit der Angabe, was fehlt');
  }

  /* ═══ 8. Der Nachsehen-Gang ist die VORGABE ═══
     Bis zum 2026-08-18 stand hier eine Textsuche: „im Skript steht kein DELETE".
     Sie war richtig, solange es nur einen Gang gab — und wurde in dem Moment
     wertlos, in dem der scharfe dazukam: sie hätte umfallen müssen, obwohl
     nichts kaputt war. Ersetzt durch die Zusicherung, die wirklich zählt und
     die auch dann noch gilt: OHNE `SCHARF=ja` bleibt die Datenbank unberührt,
     gemessen an der Prüfsumme, mit einem Wrapper, der schreiben DÜRFTE.
     (Die volle Messung liegt in `smoke_relais_scharf.mjs`; hier steht der Teil,
     der zum Nachsehen-Gang selbst gehört.) */
  {
    const db = join(arbeit, 'vorgabe.db');
    baueDb(db, [
      { id: e1, autor: A, text: 'eins' },
      { id: e3, autor: B, text: 'drei' }
    ]);
    const l = join(arbeit, 'vorgabe.js');
    writeFileSync(l, listeJs([e1], [B]));
    const vorher = summe(db);
    const r = lauf(db, l);   // KEIN SCHARF gesetzt — die Vorgabe
    ok(r.code === 0, 'ohne Angabe läuft der Nachsehen-Gang');
    ok(summe(db) === vorher, 'OHNE `SCHARF=ja` BLEIBT DIE DATENBANK UNBERÜHRT');
    ok(/NICHTS gelöscht/.test(r.aus), '…und das Skript sagt es');
    ok(/SCHARF=ja/.test(r.aus), '…und nennt den Weg, es wirklich zu tun');

    const quelle = readFileSync(SKRIPT, 'utf8');
    ok(/SCHARF/.test(quelle) && /!= "ja"/.test(quelle),
      '…die Weiche im Skript verlangt ausdrücklich „ja"');
  }
} catch (e) {
  fail++; console.error(e);
} finally {
  try { rmSync(arbeit, { recursive: true, force: true }); } catch { /* */ }
}

console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
