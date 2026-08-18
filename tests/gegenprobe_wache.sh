#!/usr/bin/env bash
# Gegenprobe zur Relais-Wache (tools/relais-wache.sh).
#
# WOZU: `smoke_relais_wache.mjs` war beim ERSTEN Lauf grün — 23 von 23. Das ist
# der Moment, in dem man am genauesten hinsehen muss, nicht der, in dem man
# aufhört. Diese Datei baut jeden Fehler wirklich ein, den die Probe fangen
# soll, und sieht nach, ob sie dann auch umfällt.
#
# Sie läuft in Sekunden (kein Browser im Spiel) und gehört deshalb bei jeder
# Änderung am Skript mit aufgerufen.
#
# Aufruf: bash tests/gegenprobe_wache.sh   ·   Exit 0 = jeder Fehler gefangen.
set -u
cd "$(dirname "$0")/.."

SICHER="$(mktemp -d)"
cp tools/relais-wache.sh "$SICHER/"
zurueck() { cp "$SICHER/relais-wache.sh" tools/relais-wache.sh; }
trap 'zurueck; rm -rf "$SICHER"' EXIT INT TERM

gruen=0; rot=0

ersetze() {
  python3 - "$1" "$2" "$3" <<'PY'
import sys
datei, alt, neu = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(datei, encoding='utf-8').read()
if alt not in s:
    sys.stderr.write('Muster nicht gefunden: ' + alt[:70] + '\n')
    sys.exit(1)
open(datei, 'w', encoding='utf-8').write(s.replace(alt, neu, 1))
PY
}

probe() {
  local was="$1"; shift
  "$@" || { echo "  ✗ $was — der Eingriff selbst ist fehlgeschlagen"; rot=$((rot+1)); zurueck; return; }
  # KEIN `| tail` — über grün entscheidet nur der eigene Rückgabewert.
  if node tests/smoke_relais_wache.mjs >/dev/null 2>&1; then
    echo "  ✗ $was — die Probe blieb GRÜN, sie bewacht das nicht"
    rot=$((rot+1))
  else
    echo "  ✓ $was"
    gruen=$((gruen+1))
  fi
  zurueck
}

echo "── Gegenprobe: Relais-Wache ──"

# Das Kernversprechen des Nachsehen-Gangs. Fiele es, wäre alles andere egal.
probe "der Nachsehen-Gang loescht wirklich nichts" \
  ersetze tools/relais-wache.sh \
  'sagen "Ein Löschlauf würde $summe von $gesamt Ereignissen entfernen."' \
  'sqlite3 "$DB" "DELETE FROM event WHERE 1=0;" >/dev/null 2>&1
sagen "Ein Löschlauf würde $summe von $gesamt Ereignissen entfernen."'

# Zettel und Absender dürfen nicht in einen Topf: ein versehentlich als
# Absender gelesener Wert nähme weit mehr weg als erwartet.
probe "Zettel- und Absender-Kennungen bleiben getrennt" \
  ersetze tools/relais-wache.sh \
  'ereignisse="$(abschnitt ereignisse)"' \
  'ereignisse="$(printf "%s" "$roh" | grep -oE "'"'"'[0-9a-fA-F]{64}'"'"'" | tr -d "'"'"'" | tr A-F a-f | sort -u)"'

# Ein Beispiel im Kommentar ist keine Sperre.
probe "Kommentar-Beispiele zaehlen nicht mit" \
  ersetze tools/relais-wache.sh \
  '    | sed -n "/${1}:[[:space:]]*{/,/^[[:space:]]*}/p" \' \
  '    | cat \'

# Nur am TEXT-Schema messbar: bei BLOB liest SQLite `x'ABCD'` selbst
# schreibweise-unabhängig. Genau daran war die Probe beim ersten Bau blind.
probe "GROSS geschriebene Kennungen werden normalisiert" \
  ersetze tools/relais-wache.sh \
  "    | tr 'A-F' 'a-f' \\" \
  "    | cat \\"

# Lieber abbrechen als eine Null melden, die „falsch gesucht" heisst.
probe "eine fehlende Datenbank bricht ab" \
  ersetze tools/relais-wache.sh \
  '[ -r "$DB" ] || { fehler "Datenbank nicht lesbar: $DB"; exit 2; }' \
  ': # Prüfung ausgebaut'

probe "ein fremdes Schema bricht ab" \
  ersetze tools/relais-wache.sh \
  '[ -n "$spalten" ] || { fehler "Tabelle '"'"'event'"'"' nicht gefunden — ist das eine nostr-rs-relay-Datenbank?"; exit 2; }' \
  ': # Prüfung ausgebaut'

# Die Zahl selbst. Sie ist der ganze Zweck des Gangs.
probe "die Zaehlung stimmt (Zettel)" \
  ersetze tools/relais-wache.sh \
  '    treffer_ev=$((treffer_ev + n))' \
  '    treffer_ev=$((treffer_ev + n + 1))'

probe "die Zaehlung stimmt (Absender)" \
  ersetze tools/relais-wache.sh \
  '    treffer_ab=$((treffer_ab + n))' \
  '    treffer_ab=0'

# BLOB oder Text — wer das verwechselt, findet nichts und meldet eine Null.
probe "BLOB-Kennungen werden richtig abgefragt" \
  ersetze tools/relais-wache.sh \
  'alsWert() { case "$typ_id" in *BLOB*|*blob*) printf "x'"'"'%s'"'"'" "$1";; *) printf "'"'"'%s'"'"'" "$1";; esac; }' \
  'alsWert() { printf "'"'"'%s'"'"'" "$1"; }'

# Die Gegenrichtung: immer x'…' bricht das Text-Schema. Fiel bis zum
# 2026-08-18 durch, weil die Probe nur BLOB-Datenbanken kannte.
probe "Text-Kennungen werden richtig abgefragt" \
  ersetze tools/relais-wache.sh \
  'alsWert() { case "$typ_id" in *BLOB*|*blob*) printf "x'"'"'%s'"'"'" "$1";; *) printf "'"'"'%s'"'"'" "$1";; esac; }' \
  'alsWert() { printf "x'"'"'%s'"'"'" "$1"; }'

# Die leere Liste muss als Normalfall erkennbar bleiben.
probe "die leere Liste wird als solche benannt" \
  ersetze tools/relais-wache.sh \
  '  sagen "Die Sperr-Liste ist leer — es gäbe nichts zu entfernen."' \
  '  sagen "Nichts gefunden."'

echo
echo "══════════════════════════════════════════"
echo "Gegenprobe: $gruen gefangen, $rot NICHT gefangen"
[ "$rot" = 0 ] || echo "Ein nicht gefangener Fehler heißt: dieser Wächter bewacht nichts."
exit $([ "$rot" = 0 ] && echo 0 || echo 1)
