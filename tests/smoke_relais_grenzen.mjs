#!/usr/bin/env node
/*
 * Smoke — `tools/relais-grenzen.sh` (Flut-Bremse + Zukunfts-Riegel).
 *
 * WOZU: Das Skript schreibt in die Konfig eines laufenden Relais und startet
 * es neu. Zwei Fehler wären dabei teuer, und beide sind leicht zu machen:
 *
 *   1. ZWEIMAL LAUFEN. Ein zweiter `[limits]`-Abschnitt ist kaputtes TOML —
 *      das Relais käme nicht mehr hoch. Ein Werkzeug, das man nicht zweimal
 *      aufrufen darf, ohne dass etwas kaputtgeht, ist ein schlechtes Werkzeug.
 *   2. KAPUTTES TOML SCHREIBEN. Deshalb wird das Ergebnis hier wirklich
 *      geparst, nicht nur nach Zeichenketten durchsucht.
 *
 * Und die dritte Prüfung ist die, um die Klaus ausdrücklich gebeten hat:
 *   3. „VORGEBAUT, NICHT AKTIV" muss wörtlich stimmen. Der Block für ein
 *      geschlossenes Netz steht in der Datei — aber der TOML-Leser darf ihn
 *      NICHT sehen. Stünde er aktiv drin, wäre das Relais ab sofort für alle
 *      Fremden dicht, und niemand hätte es gewollt.
 *
 * Gemessen wird gegen eine echte Kopie der Konfig, mit `NEUSTART=nein` — kein
 * Docker, kein Netz.
 *
 * Aufruf: node tests/smoke_relais_grenzen.mjs   ·   Exit 0 = grün.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const SKRIPT = join(HIER, '..', 'tools', 'relais-grenzen.sh');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const arbeit = mkdtempSync(join(tmpdir(), 'grenzen-'));

/* Die Konfig, wie sie am 2026-08-19 auf dem Server stand — ohne jede Grenze. */
const ORIGINAL = `[info]
name = "Toolpoint-Relay"
description = "Dummes, neutrales, log-freies SBKIM-Rendezvous."
[database]
data_directory = "/usr/src/app/db"
[network]
address = "0.0.0.0"
port = 8080
`;

let nr = 0;
function frischeKonfig() {
  const p = join(arbeit, 'config' + (++nr) + '.toml');
  writeFileSync(p, ORIGINAL);
  return p;
}
function lauf(konf, extra) {
  try {
    return { code: 0, aus: execFileSync('bash', [SKRIPT], {
      env: { ...process.env, CONF: konf, NEUSTART: 'nein', DB: join(arbeit, 'gibtesnicht.db') },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...(extra || {}) }) };
  } catch (e) { return { code: e.status ?? 1, aus: (e.stdout || '') + (e.stderr || '') }; }
}
const summe = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

/* TOML wirklich lesen, nicht nach Wörtern suchen. Python bringt es mit. */
function tomlLesen(pfad) {
  const js = execFileSync('python3', ['-c',
    'import tomllib,sys,json; print(json.dumps(tomllib.load(open(sys.argv[1],"rb"))))', pfad],
    { encoding: 'utf8' });
  return JSON.parse(js);
}

console.log('== Relais-Grenzen ==');
try {
  /* ═══ 1. Der normale Lauf ═══ */
  {
    const k = frischeKonfig();
    const r = lauf(k);
    ok(r.code === 0, 'sauberer Abschluss');
    ok(/Sicherung: /.test(r.aus), 'eine Sicherung wird angelegt');

    const sich = readdirSync(arbeit).filter((f) => f.startsWith('config1.toml.bak-'));
    ok(sich.length === 1, '…und sie liegt wirklich da');
    ok(readFileSync(join(arbeit, sich[0]), 'utf8') === ORIGINAL,
      '…und trägt den Stand VOR dem Lauf');

    const t = tomlLesen(k);
    ok(!!t.limits, 'die Konfig ist LESBARES TOML und hat [limits]');
    ok(t.limits.messages_per_sec === 5, '…messages_per_sec = 5');
    ok(t.limits.subscriptions_per_min === 30, '…subscriptions_per_min = 30');
    ok(t.options && t.options.reject_future_seconds === 1800,
      '…und [options] reject_future_seconds = 1800');

    /* Nichts von dem, was vorher dastand, darf verlorengehen. */
    ok(t.info && t.info.name === 'Toolpoint-Relay', 'der alte [info]-Block ist unverändert da');
    ok(t.network && t.network.port === 8080, '…und [network] ebenso');
    ok(t.database && t.database.data_directory === '/usr/src/app/db', '…und [database] auch');
  }

  /* ═══ 2. VORGEBAUT, NICHT AKTIV ═══
     Genau das, was Klaus wollte: der Block für ein geschlossenes Netz steht in
     der Datei, aber er WIRKT nicht. Stünde er aktiv drin, wäre das öffentliche
     Relais ab sofort für Fremde dicht. */
  {
    const k = frischeKonfig();
    lauf(k);
    const roh = readFileSync(k, 'utf8');
    const t = tomlLesen(k);

    ok(/pubkey_whitelist/.test(roh), 'der Block für ein geschlossenes Netz steht in der Datei');
    ok(/nip42_auth/.test(roh), '…einschließlich nip42_auth (Liste allein reicht nicht)');
    ok(!t.authorization,
      'ER IST ABER NICHT AKTIV — der TOML-Leser sieht keine [authorization]');
    ok(/ZWEITES Relais|EIGENES Relais/.test(roh),
      '…und daneben steht, dass er an ein eigenes Relais gehört, nicht hierher');
  }

  /* ═══ 3. Zweimal laufen darf NICHTS kaputtmachen ═══
     Der Fehler, der ein Werkzeug wertlos macht: ein zweiter [limits]-Abschnitt
     ist kaputtes TOML, und das Relais käme nicht mehr hoch. */
  {
    const k = frischeKonfig();
    lauf(k);
    const nachErstem = summe(k);

    const r2 = lauf(k);
    ok(r2.code === 0, 'der zweite Lauf endet sauber (kein Fehler)');
    ok(/bereits einen \[limits\]/.test(r2.aus), '…und sagt, dass schon etwas dasteht');
    ok(/fasse nichts an/.test(r2.aus), '…und dass er nichts anfasst');
    ok(summe(k) === nachErstem, 'DIE KONFIG IST UNVERÄNDERT (Prüfsumme gleich)');

    const roh = readFileSync(k, 'utf8');
    ok((roh.match(/^\[limits\]/gm) || []).length === 1,
      '…es gibt GENAU EINEN [limits]-Abschnitt, nicht zwei');
    ok(!!tomlLesen(k).limits, '…und die Datei ist weiterhin lesbares TOML');
  }

  /* ═══ 4. Falscher Pfad → gar nichts tun ═══
     Hier stand zuerst ein Schreibschutz-Test (Konfig auf 0444). Er schlug fehl,
     und das war lehrreich: das Skript läuft auf dem Server als `root`, und
     `root` darf immer schreiben — der Riegel kann dort NIE greifen. Eine Probe,
     die einen Fall misst, den es in der echten Umgebung nicht gibt, bewacht
     nichts. Geprüft wird jetzt der Fall, der wirklich vorkommt: falscher Pfad. */
  {
    const fehltNoch = join(arbeit, 'gibtesnicht', 'config.toml');
    const r = lauf(fehltNoch);
    ok(r.code === 2, 'fehlende Konfig: eigener Rückgabewert 2');
    ok(/nicht gefunden/.test(r.aus), '…mit klarer Ansage');
    ok(!/Sicherung: /.test(r.aus), '…es wird nicht einmal eine Sicherung angelegt');
  }

  /* ═══ 5. NEUSTART=nein sagt ehrlich, dass es noch nicht wirkt ═══ */
  {
    const k = frischeKonfig();
    const r = lauf(k);
    ok(/wirkt aber erst nach/.test(r.aus),
      'ohne Neustart sagt es, dass die Änderung noch nicht wirkt');
    ok(/docker restart/.test(r.aus), '…und nennt den Befehl dafür');
  }

  /* ═══ 6. Was NICHT gesetzt wird, steht auch nicht drin ═══
     limit_scrapers und max_event_bytes wurden bewusst weggelassen. Stünden sie
     als aktive Zeile da, wäre die Begründung im Kopf des Skripts eine Lüge. */
  {
    const k = frischeKonfig();
    lauf(k);
    const t = tomlLesen(k);
    ok(t.limits.limit_scrapers === undefined,
      'limit_scrapers ist NICHT gesetzt (nicht alle 21 Apps geprüft)');
    ok(t.limits.max_event_bytes === undefined,
      'max_event_bytes ist NICHT gesetzt (würde Bilder abschneiden)');
    ok(t.limits.pubkey_whitelist === undefined && !t.authorization,
      'und keine Schlüssel-Liste — das Relais bleibt der öffentliche Treffpunkt');
  }
} catch (e) {
  fail++; console.error(e);
} finally {
  try { rmSync(arbeit, { recursive: true, force: true }); } catch { /* */ }
}

console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
