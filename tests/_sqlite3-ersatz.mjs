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
 * ER ÖFFNET BEWUSST SCHREIBEND. Nur so ist die wichtigste Prüfung überhaupt
 * eine: dass die Datenbank im Nachsehen-Gang unverändert bleibt. Ein Wrapper,
 * der Schreiben gar nicht erst zulässt, bewiese das Versprechen des Skripts
 * nicht — er ersetzte es durch sein eigenes.
 *
 * Nachgebildet wird nur, was das Skript benutzt: eine Abfrage als Argument,
 * Ausgabe pipe-getrennt ohne Kopfzeile — das Standardverhalten von `sqlite3`.
 * Mehrere Anweisungen hintereinander (Transaktion) gehen, weil der scharfe
 * Gang genau das schickt.
 */
import { DatabaseSync } from 'node:sqlite';

const [datei, abfrage] = process.argv.slice(2);
if (!datei || !abfrage) { process.exit(1); }

let db;
try { db = new DatabaseSync(datei); }
catch (e) { process.stderr.write(String(e.message) + '\n'); process.exit(1); }

/* Was Zeilen zurückgibt, geht über `prepare`; alles andere über `exec`.
   `PRAGMA busy_timeout=…` steht bewusst NICHT in dieser Liste — es setzt einen
   Wert, und seine Rückgabe würde die Ausgabe verschmutzen, die das Skript in
   Variablen einliest. */
const gibtZeilen = /^(select|pragma\s+table_info|pragma\s+integrity_check|pragma\s+journal_mode\s*$)/i;

try {
  for (const teil of abfrage.split(';')) {
    const s = teil.trim();
    if (!s) continue;
    if (!gibtZeilen.test(s)) { db.exec(s); continue; }
    for (const z of db.prepare(s).all()) {
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
