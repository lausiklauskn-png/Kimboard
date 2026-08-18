#!/usr/bin/env node
/*
 * Smoke — die Relais-Wache im SCHARFEN Gang (`SCHARF=ja bash relais-wache.sh`).
 *
 * WOZU: Dieser Gang entfernt Ereignisse wirklich. Er ist damit der eine Griff im
 * ganzen Vorhaben, der sich nicht zurücknehmen lässt — und deshalb die Stelle,
 * an der ein „müsste stimmen" nicht reicht.
 *
 * Geprüft wird gegen ECHTE SQLite-Datenbanken, und der Wrapper öffnet
 * SCHREIBEND (siehe `_sqlite3-ersatz.mjs`). Nur so beweist die erste Prüfung
 * unten etwas: dass ohne `SCHARF=ja` nichts passiert.
 *
 *   1. OHNE `SCHARF=ja` PASSIERT NICHTS — auch wenn Treffer da sind und der
 *      Wrapper schreiben dürfte. Prüfsumme vorher = nachher.
 *   2. ES NIMMT GENAU DIE GENANNTEN. Nicht eine mehr. Jede nicht genannte
 *      Kennung ist danach noch da — einzeln nachgezählt, nicht nur als Summe.
 *   3. DIE ÜBERSCHNEIDUNG. Ein Ereignis, das ZUGLEICH über seine Kennung und
 *      über seinen Absender gesperrt ist, darf nur EINMAL zählen. Die erste
 *      Fassung addierte beide Zähler und lag damit zu hoch; im scharfen Gang
 *      hätte das die Schlussrechnung umgeworfen und einen richtigen Lauf als
 *      Fehlschlag gemeldet.
 *   4. DIE SICHERUNG IST PFLICHT. Sie entsteht, sie trägt den Stand VORHER,
 *      und wenn sie nicht entsteht, wird NICHT gelöscht.
 *   5. DIE ANHÄNGSEL GEHEN MIT. Die `tag`-Tabelle hängt an `event.id`; wer nur
 *      die Ereignisse nimmt, lässt Zeilen zurück, die auf nichts mehr zeigen.
 *   6. ES RECHNET NACH — und meldet einen Fehlschlag, wenn es nicht aufgeht.
 *   7. EINE LEERE LISTE LÖSCHT NICHTS. Das ist der Normalfall, kein Anlass.
 *
 * Aufruf: node tests/smoke_relais_scharf.mjs   ·   Exit 0 = grün.
 */
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HIER, '..');
const SKRIPT = join(ROOT, 'tools', 'relais-wache.sh');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const arbeit = mkdtempSync(join(tmpdir(), 'scharf-'));
const binDir = join(arbeit, 'bin');
execFileSync('mkdir', ['-p', binDir]);
writeFileSync(join(binDir, 'sqlite3'),
  '#!/bin/sh\nexec node ' + JSON.stringify(join(HIER, '_sqlite3-ersatz.mjs')) + ' "$@"\n');
chmodSync(join(binDir, 'sqlite3'), 0o755);

const hex = (n) => createHash('sha256').update(String(n)).digest('hex');

function baueDb(pfad, zeilen) {
  const db = new DatabaseSync(pfad);
  db.exec(`CREATE TABLE event (
    id INTEGER PRIMARY KEY, event_hash BLOB NOT NULL, created_at INTEGER,
    kind INTEGER, author BLOB NOT NULL, content TEXT)`);
  db.exec('CREATE TABLE tag (event_id INTEGER, name TEXT, value TEXT)');
  const ev = db.prepare('INSERT INTO event (id,event_hash,created_at,kind,author,content) VALUES (?,?,?,?,?,?)');
  const tg = db.prepare('INSERT INTO tag (event_id,name,value) VALUES (?,?,?)');
  zeilen.forEach((z, i) => {
    ev.run(i + 1, Buffer.from(z.id, 'hex'), 1700000000 + i, 1, Buffer.from(z.autor, 'hex'), z.text || '');
    tg.run(i + 1, 't', z.tag || 'sbkim-frage-antwort-test');
  });
  db.close();
}

const listeJs = (ereignisse, absender) => `(function () {
  'use strict';
  window.KB_SPERRLISTE = {
    fassung: 1, stand: '2026-08-18',
    ereignisse: {
${ereignisse.map((k) => `      '${k}': { grund: 'Probe', seit: '2026-08-18' },`).join('\n')}
    },
    absender: {
${absender.map((k) => `      '${k}': { grund: 'Probe', seit: '2026-08-18' },`).join('\n')}
    }
  };
})();`;

function lauf(dbPfad, listePfad, extra) {
  try {
    const aus = execFileSync('bash', [SKRIPT], {
      env: { ...process.env, PATH: binDir + ':' + process.env.PATH, DB: dbPfad, LISTE: listePfad, LISTE_JSON: '', ...(extra || {}) },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
    });
    return { code: 0, aus };
  } catch (e) {
    return { code: e.status ?? 1, aus: (e.stdout || '') + (e.stderr || '') };
  }
}
const summe = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

/* Wer liegt noch da? Einzeln nachgezählt — eine Gesamtzahl könnte stimmen,
   während die falschen entfernt wurden. */
function bestand(pfad) {
  const db = new DatabaseSync(pfad, { readOnly: true });
  const ids = db.prepare('SELECT event_hash h FROM event').all()
    .map((r) => Buffer.from(r.h).toString('hex'));
  const tags = db.prepare('SELECT COUNT(*) c FROM tag WHERE event_id NOT IN (SELECT id FROM event)').get().c;
  const tagZahl = db.prepare('SELECT COUNT(*) c FROM tag').get().c;
  db.close();
  return { ids, verwaist: tags, tags: tagZahl };
}

const A = hex('autor-a'), B = hex('autor-b'), C = hex('autor-c');
const e1 = hex('e1'), e2 = hex('e2'), e3 = hex('e3'), e4 = hex('e4'), e5 = hex('e5');
const ZEILEN = [
  { id: e1, autor: A, text: 'eins' },
  { id: e2, autor: A, text: 'anfrage', tag: 'sbkim-qry' },
  { id: e3, autor: B, text: 'drei' },
  { id: e4, autor: B, text: 'vier' },
  { id: e5, autor: C, text: 'fünf' }
];
let nr = 0;
function frisch() { const p = join(arbeit, 'db' + (++nr) + '.db'); baueDb(p, ZEILEN); return p; }
function liste(name, ev, ab) { const p = join(arbeit, name); writeFileSync(p, listeJs(ev, ab)); return p; }

console.log('== Relais-Wache (SCHARF) ==');
try {
  /* ═══ 1. Ohne SCHARF=ja passiert nichts — obwohl Treffer da sind ═══
     Das ist die Prüfung, die den Nachsehen-Gang trägt. Sie ist nur etwas wert,
     weil der Wrapper schreiben DÜRFTE (siehe _sqlite3-ersatz.mjs). */
  {
    const db = frisch();
    const l = liste('a.js', [e1, e3], [C]);
    const vorher = summe(db);
    const r = lauf(db, l);
    ok(r.code === 0, 'ohne SCHARF: sauberer Abschluss');
    ok(summe(db) === vorher, 'OHNE SCHARF WIRD NICHTS GEÄNDERT (Prüfsumme gleich)');
    ok(/Betroffen sind 3 von 5/.test(r.aus), '…die Auskunft nennt trotzdem die Zahl');
    ok(/SCHARF=ja/.test(r.aus), '…und sagt, wie man es wirklich täte');
  }

  /* ═══ 2. Mit SCHARF=ja: genau die genannten, keine mehr ═══ */
  {
    const db = frisch();
    const l = liste('b.js', [e1, e3], []);
    const r = lauf(db, l, { SCHARF: 'ja' });
    const b = bestand(db);
    ok(r.code === 0, 'mit SCHARF: sauberer Abschluss');
    ok(!b.ids.includes(e1) && !b.ids.includes(e3), 'die zwei genannten sind WEG');
    ok(b.ids.includes(e2) && b.ids.includes(e4) && b.ids.includes(e5),
      'ALLE NICHT GENANNTEN LIEGEN NOCH DA (einzeln nachgezählt)');
    ok(b.ids.length === 3, '…und zwar genau drei');
    ok(/3 liegen noch hier|2 Ereignisse entfernt/.test(r.aus), '…die Ausgabe stimmt damit überein');
    ok(/Nachgerechnet/.test(r.aus), '…und sie sagt, dass sie nachgerechnet hat');
  }

  /* ═══ 3. Ein Absender nimmt ALLES von ihm mit ═══ */
  {
    const db = frisch();
    const l = liste('c.js', [], [A]);
    lauf(db, l, { SCHARF: 'ja' });
    const b = bestand(db);
    ok(!b.ids.includes(e1) && !b.ids.includes(e2), 'ein gesperrter Absender: beide seiner Ereignisse weg');
    ok(b.ids.length === 3, '…und nur seine');
  }

  /* ═══ 4. DIE ÜBERSCHNEIDUNG ═══
     e1 ist über die Kennung gesperrt UND sein Absender A ist gesperrt. Betroffen
     sind e1 und e2 — ZWEI, nicht drei. Wer die Zähler addiert (1 + 2), rechnet
     drei und wirft damit die Schlussrechnung um. Genau daran war die erste
     Fassung falsch, und keine Probe sah es. */
  {
    const db = frisch();
    const l = liste('d.js', [e1], [A]);
    const r = lauf(db, l, { SCHARF: 'ja' });
    ok(/Betroffen sind 2 von 5/.test(r.aus),
      'ÜBERSCHNEIDUNG: e1 zählt EINMAL, nicht zweimal');
    ok(/überschneiden sich/.test(r.aus), '…und die Ausgabe benennt es');
    ok(r.code === 0, '…die Schlussrechnung geht auf (sonst Rückgabewert 4)');
    const b = bestand(db);
    ok(b.ids.length === 3 && !b.ids.includes(e1) && !b.ids.includes(e2),
      '…und entfernt wurden wirklich beide');
  }

  /* ═══ 5. Die Sicherung ═══ */
  {
    const db = frisch();
    const sich = join(arbeit, 'sicherung.db');
    const l = liste('e.js', [e1], []);
    const r = lauf(db, l, { SCHARF: 'ja', SICHERUNG: sich });
    ok(existsSync(sich), 'die Sicherung ist wirklich da');
    const alt = new DatabaseSync(sich, { readOnly: true });
    ok(alt.prepare('SELECT COUNT(*) c FROM event').get().c === 5,
      '…und trägt den Stand VOR dem Lauf (5, nicht 4)');
    ok(alt.prepare("SELECT COUNT(*) c FROM event WHERE event_hash = x'" + e1 + "'").get().c === 1,
      '…einschließlich des entfernten Ereignisses');
    alt.close();
    ok(/Sicherung bleibt liegen/.test(r.aus), '…und sie wird nicht weggeräumt');
  }

  /* ═══ 6. Keine Sicherung ⇒ kein Löschen ═══
     Ein nicht beschreibbarer Ort für die Sicherung. Das Werkzeug muss das als
     Abbruchgrund nehmen — nicht als Kleinigkeit, über die man hinweggeht. */
  {
    const db = frisch();
    const vorher = summe(db);
    const l = liste('f.js', [e1], []);
    const r = lauf(db, l, { SCHARF: 'ja', SICHERUNG: '/gibtes/nicht/sicherung.db' });
    ok(r.code === 3, 'Sicherung unmöglich: eigener Rückgabewert 3');
    ok(summe(db) === vorher, 'OHNE SICHERUNG WIRD NICHT GELÖSCHT (Prüfsumme gleich)');
    ok(/NICHTS entfernt/.test(r.aus), '…und es sagt das ausdrücklich');
  }

  /* ═══ 7. Die Anhängsel gehen mit ═══ */
  {
    const db = frisch();
    const l = liste('g.js', [e1, e3], []);
    lauf(db, l, { SCHARF: 'ja' });
    const b = bestand(db);
    ok(b.verwaist === 0, 'keine verwaisten Anhängsel zurückgeblieben');
    ok(b.tags === 3, '…und die Anhängsel der übrigen sind noch da (3)');
  }

  /* ═══ 8. Leere Liste löscht nichts ═══ */
  {
    const db = frisch();
    const vorher = summe(db);
    const l = liste('h.js', [], []);
    const r = lauf(db, l, { SCHARF: 'ja' });
    ok(r.code === 0, 'leere Liste mit SCHARF: kein Fehler');
    ok(summe(db) === vorher, '…und nichts angefasst');
    ok(/Sperr-Liste ist leer/.test(r.aus), '…mit klarer Ansage');
  }

  /* ═══ 9. Genannt, aber nicht hier ⇒ nichts zu tun ═══ */
  {
    const db = frisch();
    const vorher = summe(db);
    const l = liste('i.js', [hex('gibtesnicht')], []);
    const r = lauf(db, l, { SCHARF: 'ja' });
    ok(r.code === 0, 'Kennung nicht im Speicher: kein Fehler');
    ok(summe(db) === vorher, '…und nichts angefasst');
    ok(/Nichts zu entfernen/.test(r.aus), '…mit klarer Ansage');
  }

  /* ═══ 10. ES MERKT, WENN ES SELBST DANEBENLIEGT ═══
     Eine Nachrechnung lässt sich nicht beweisen, solange nichts falsch ist:
     nimmt man sie heraus, bleibt bei heilem Werkzeug alles grün. Sie zeigt sich
     nur, wenn man das Werkzeug absichtlich falsch macht und darauf besteht, dass
     es das bemerkt. Genau das tun die zwei Prüfungen hier — an einer PATCHTEN
     Kopie, das Original bleibt unberührt.

     (Aufgefallen ist das der Gegenprobe: sie baute die Nachrechnung aus, und
     alle Proben blieben grün. Nicht weil die Nachrechnung wertlos wäre, sondern
     weil keine Probe je verlangt hatte, dass sie anschlägt.) */
  {
    const kopie = join(arbeit, 'verbogen.sh');
    const quelle = readFileSync(SKRIPT, 'utf8');

    /* (a) Die Erwartung wird verbogen — die Zahlen passen dann nicht mehr
           zusammen, und das Werkzeug MUSS das melden statt Erfolg zu sagen. */
    writeFileSync(kopie, quelle.replace(
      'erwartet=$((gesamt - summe))', 'erwartet=$((gesamt - summe + 7))'));
    const db = frisch();
    const l = liste('k.js', [e1], []);
    let r;
    try {
      r = { code: 0, aus: execFileSync('bash', [kopie], {
        env: { ...process.env, PATH: binDir + ':' + process.env.PATH, DB: db, LISTE: l, SCHARF: 'ja' },
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (e) { r = { code: e.status ?? 1, aus: (e.stdout || '') + (e.stderr || '') }; }
    ok(r.code === 4, 'es MELDET einen Fehlschlag, wenn die Rechnung nicht aufgeht');
    ok(/Rechnung geht NICHT auf/.test(r.aus), '…mit klarer Ansage');
    ok(/Zurückholen/.test(r.aus), '…und sagt, wie man die Sicherung zurückspielt');

    /* (b) Das Entfernen läuft ins Leere, die Gesamtzahl wird passend gebogen.
           Die erste Prüfung greift damit NICHT mehr — es muss die zweite sein,
           die bemerkt, dass eine genannte Kennung noch daliegt. */
    writeFileSync(kopie, quelle
      .replace('DELETE FROM event WHERE $wo;', 'DELETE FROM event WHERE 0=1;')
      .replace('erwartet=$((gesamt - summe))', 'erwartet="$nachher"'));
    const db2 = frisch();
    let r2;
    try {
      r2 = { code: 0, aus: execFileSync('bash', [kopie], {
        env: { ...process.env, PATH: binDir + ':' + process.env.PATH, DB: db2, LISTE: l, SCHARF: 'ja' },
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (e) { r2 = { code: e.status ?? 1, aus: (e.stdout || '') + (e.stderr || '') }; }
    ok(r2.code === 4, 'es MERKT, wenn eine genannte Kennung liegen geblieben ist');
    ok(/liegen noch da/.test(r2.aus), '…und benennt, wie viele');
  }

  /* ═══ 11. Ein fehlender Container hält den Lauf auf ═══
     `STOPPEN=ja` mit einem Namen, den es nicht gibt. Lieber gar nicht löschen
     als bei einem Zustand löschen, den man für einen anderen hielt. */
  {
    const db = frisch();
    const vorher = summe(db);
    const l = liste('j.js', [e1], []);
    const r = lauf(db, l, { SCHARF: 'ja', STOPPEN: 'ja', CONTAINER: 'gibtesnicht-xyz' });
    ok(r.code === 3, 'Anhalten misslungen: Rückgabewert 3');
    ok(summe(db) === vorher, '…und NICHTS gelöscht');
  }
} catch (e) {
  fail++; console.error(e);
} finally {
  try { rmSync(arbeit, { recursive: true, force: true }); } catch { /* */ }
}

console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
