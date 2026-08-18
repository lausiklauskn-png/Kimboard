#!/usr/bin/env node
/*
 * _sqlite3-ersatz.mjs — ein `sqlite3`-Kommandozeilen-Ersatz für die Prüfung.
 *
 * WOZU: `tools/relais-wache.sh` ruft `sqlite3` auf. Auf dem Server ist das da,
 * in der Prüf-Umgebung nicht (und nachinstallieren geht dort nicht). Node
 * bringt seit 22.5 ein eigenes SQLite mit — dieser Wrapper stellt es unter dem
 * Namen bereit, den das Skript erwartet.
 *
 * WARUM NICHT EINFACH DAS SKRIPT NACHBAUEN: Dann prüfte die Probe eine
 * Nachbildung statt des Werkzeugs, das später wirklich läuft. Gemessen wird so
 * das echte Skript — mit seiner echten Schema-Erkennung, seinem echten Zählen
 * und seinem echten Umgang mit BLOB- und Text-Kennungen.
 *
 * Nachgebildet wird nur, was das Skript benutzt: eine Abfrage als Argument,
 * Ausgabe pipe-getrennt ohne Kopfzeile — das Standardverhalten von `sqlite3`.
 */
import { DatabaseSync } from 'node:sqlite';

const [datei, abfrage] = process.argv.slice(2);
if (!datei || !abfrage) { process.exit(1); }

let db;
try { db = new DatabaseSync(datei, { readOnly: true }); }
catch (e) { process.stderr.write(String(e.message) + '\n'); process.exit(1); }

try {
  for (const teil of abfrage.split(';')) {
    const s = teil.trim();
    if (!s) continue;
    const zeilen = db.prepare(s).all();
    for (const z of zeilen) {
      process.stdout.write(Object.values(z).map((v) => {
        if (v === null) return '';
        /* `sqlite3` gibt BLOBs als rohe Bytes aus. Die Prüfung braucht das
           nicht — hier zählt nur, dass Spaltenzahl und Trennzeichen stimmen. */
        if (v instanceof Uint8Array) return Buffer.from(v).toString('hex');
        return String(v);
      }).join('|') + '\n');
    }
  }
} catch (e) {
  process.stderr.write(String(e.message) + '\n');
  process.exit(1);
}
