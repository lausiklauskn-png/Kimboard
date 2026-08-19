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

# Beide Proben zusammen — ein eingebauter Fehler darf irgendeine von beiden
# umwerfen. Wer nur eine aufriefe, hielte die andere für unbewacht.
proben_gruen() {
  # KEIN `| tail` — über grün entscheidet nur der eigene Rückgabewert.
  node tests/smoke_relais_wache.mjs >/dev/null 2>&1 || return 1
  node tests/smoke_relais_scharf.mjs >/dev/null 2>&1 || return 1
  return 0
}

probe() {
  local was="$1"; shift
  "$@" || { echo "  ✗ $was — der Eingriff selbst ist fehlgeschlagen"; rot=$((rot+1)); zurueck; return; }
  if proben_gruen; then
    echo "  ✗ $was — die Proben blieben GRÜN, das ist unbewacht"
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
  'sagen "══ Ergebnis ══"' \
  'sqlite3 "$DB" "DELETE FROM event WHERE 1=1;" >/dev/null 2>&1
sagen "══ Ergebnis ══"'

# Die Weiche selbst: wenn SCHARF ausgehebelt wird, löscht der Nachsehen-Gang.
probe "die Weiche verlangt wirklich SCHARF=ja" \
  ersetze tools/relais-wache.sh \
  'if [ "$SCHARF" != "ja" ]; then' \
  'if [ "$SCHARF" = "niemals-xyz" ]; then'

# Zettel und Absender dürfen nicht in einen Topf: ein versehentlich als
# Absender gelesener Wert nähme weit mehr weg als erwartet.
probe "Zettel- und Absender-Kennungen bleiben getrennt" \
  ersetze tools/relais-wache.sh \
  'ereignisse="$(abschnitt ereignisse)"' \
  'ereignisse="$(printf "%s" "$roh" | grep -oE "'"'"'[0-9a-fA-F]{64}'"'"'" | tr -d "'"'"'" | tr A-F a-f | sort -u)"'

# Ein auskommentierter Eintrag ist keine Sperre. Er traegt einen Doppelpunkt
# wie ein echter — nur der Abschnitts-Schnitt haelt ihn draussen.
probe "auskommentierte Eintraege zaehlen nicht mit" \
  ersetze tools/relais-wache.sh \
  '      teil="${flach#*ereignisse}"' \
  '      teil="$flach"'

# Nur am TEXT-Schema messbar: bei BLOB liest SQLite `x'ABCD'` selbst
# schreibweise-unabhängig. Genau daran war die Probe beim ersten Bau blind.
probe "GROSS geschriebene Kennungen werden normalisiert" \
  ersetze tools/relais-wache.sh \
  "    | tr 'A-F' 'a-f'" \
  "    | cat"

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

# Die zweite Quelle. Ohne sie bliebe genau das liegen, was Klaus zuletzt im
# Studio gesperrt hat — in Kimboard unsichtbar, auf dem Server weiter da.
probe "die signierte Liste wird ueberhaupt gelesen" \
  ersetze tools/relais-wache.sh \
  'roh_json="$(hole "$LISTE_JSON")"' \
  'roh_json=""'

probe "beide Listen werden VEREINIGT, nicht ersetzt" \
  ersetze tools/relais-wache.sh \
  '  { kennungen "$roh_js" "$1"; kennungen "$roh_json" "$1"; } | sort -u' \
  '  { kennungen "$roh_js" "$1"; } | sort -u'

# `:-` statt `-`: dann schaltet LISTE_JSON='' die Quelle NICHT ab, und die
# Proben greifen still ins Netz. Genau so waren sie zeitweise grün — nicht weil
# die Abschaltung wirkte, sondern weil der Abruf ins Leere lief.
probe "leer schaltet die zweite Quelle wirklich ab" \
  ersetze tools/relais-wache.sh \
  'LISTE_JSON="${LISTE_JSON-https' \
  'LISTE_JSON="${LISTE_JSON:-https'

# DER GEFÄHRLICHE. Ohne den Doppelpunkt-Anker liest das Werkzeug den Umschlag
# des signierten Ereignisses mit — bei alphabetisch sortierten Feldern wäre das
# Klaus' EIGENER Schlüssel als gesperrter Absender.
probe "der UMSCHLAG wird nicht als Sperre gelesen" \
  ersetze tools/relais-wache.sh \
  '    | grep -oE "[0-9a-fA-F]{64}\\\\?[\"'"'"'][[:space:]]*:" \' \
  '    | grep -oE "[\"'"'"'][0-9a-fA-F]{64}[\"'"'"']" \'

echo
echo "── und jetzt der scharfe Gang ──"

# Die Überschneidung. Der Fehler, der die erste Fassung hatte und den keine
# Probe sah: beide Zähler addiert statt einmal gezählt.
probe "die Ueberschneidung zaehlt nur EINMAL" \
  ersetze tools/relais-wache.sh \
  'summe="$(sqlite3 "$DB" "SELECT COUNT(*) FROM event WHERE $wo;" 2>/dev/null || echo 0)"' \
  'summe=$((treffer_ev + treffer_ab))'

# Er darf NUR die genannten nehmen. Ein zu weit gefasstes WHERE ist der
# schlimmste denkbare Fehlgriff in diesem Werkzeug.
probe "er nimmt NUR die genannten (WHERE nicht aufgeweitet)" \
  ersetze tools/relais-wache.sh \
  'DELETE FROM event WHERE $wo;' \
  'DELETE FROM event WHERE 1=1;'

# Ohne GEPRÜFTE Sicherung wird nicht gelöscht — ausnahmslos.
#
# Bewusst EIN Eingriff über den ganzen Block, nicht zwei über die einzelnen
# Riegel. Der Grund ist ehrlich benannt: die beiden Riegel decken einander ab
# (fällt die Sicherung aus, schlägt auch die Stückzahl-Prüfung an, weil sie
# eine fehlende Datei nicht zählen kann). Ein Eingriff in nur einen von beiden
# beweist deshalb gar nichts — die Probe bliebe grün, und zwar zu Recht.
# Was hier bewacht wird, ist die Zusicherung, nicht die Zeile.
probe "ohne gepruefte Sicherung wird NICHT geloescht" \
  ersetze tools/relais-wache.sh \
  'if ! sqlite3 "$DB" "VACUUM INTO '"'"'$SICHERUNG'"'"';" 2>/dev/null; then
  fehler "Sicherung fehlgeschlagen. Es wurde NICHTS entfernt."
  exit 3
fi
gesichert="$(sqlite3 "$SICHERUNG" "SELECT COUNT(*) FROM event;" 2>/dev/null || echo -1)"
if [ "$gesichert" != "$gesamt" ]; then
  fehler "Die Sicherung trägt $gesichert statt $gesamt Ereignisse. Es wurde NICHTS entfernt."
  exit 3
fi' \
  'sqlite3 "$DB" "VACUUM INTO '"'"'$SICHERUNG'"'"';" >/dev/null 2>&1
gesichert=egal'

# Die Anhängsel. Sie zeigen sonst auf nichts mehr.
probe "verwaiste Anhaengsel bleiben nicht zurueck" \
  ersetze tools/relais-wache.sh \
  'DELETE FROM tag WHERE event_id IN (SELECT id FROM event WHERE $wo);' \
  '-- Anhaengsel bleiben liegen'

# Nachrechnen ist der Unterschied zwischen Beweis und Behauptung.
probe "es rechnet wirklich nach (Gesamtzahl)" \
  ersetze tools/relais-wache.sh \
  '[ "$nachher" = "$erwartet" ] || { fehler "Die Rechnung geht NICHT auf: $nachher statt $erwartet."; fehlgriff=1; }' \
  ': # Nachrechnen ausgebaut'

probe "es prueft, dass keine genannte Kennung liegen blieb" \
  ersetze tools/relais-wache.sh \
  '[ "$rest" = 0 ] || { fehler "$rest der genannten Kennungen liegen noch da."; fehlgriff=1; }' \
  ': # Prüfung ausgebaut'

# Ein misslungenes Anhalten darf nicht in ein Löschen münden.
probe "misslungenes Anhalten haelt den Lauf auf" \
  ersetze tools/relais-wache.sh \
  '    fehler "'"'"'$CONTAINER'"'"' ließ sich nicht anhalten. Es wurde NICHTS entfernt."
    exit 3' \
  '    sagen "(weiter ohne Anhalten)"'

# Die Sicherung darf das Werkzeug nicht selbst wegräumen.
probe "die Sicherung wird nicht weggeraeumt" \
  ersetze tools/relais-wache.sh \
  'sagen "Die Sicherung bleibt liegen: $SICHERUNG"' \
  'rm -f "$SICHERUNG"; sagen "Sicherung entfernt."'

echo
echo "══════════════════════════════════════════"
echo "Gegenprobe: $gruen gefangen, $rot NICHT gefangen"
[ "$rot" = 0 ] || echo "Ein nicht gefangener Fehler heißt: dieser Wächter bewacht nichts."
exit $([ "$rot" = 0 ] && echo 0 || echo 1)
