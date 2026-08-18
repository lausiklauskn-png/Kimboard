#!/usr/bin/env bash
# relais-wache.sh — NACHSEHEN-GANG. Zeigt, was eine Sperre auf dem Relais
# treffen WÜRDE. Löscht nichts, ändert nichts, schreibt nichts.
#
# ── WOZU ──────────────────────────────────────────────────────────────────────
# Kimboards Sperr-Liste nimmt gesperrte Zettel aus der ANZEIGE — in jedem
# Kimboard, sofort. Auf dem Relais bleiben sie liegen. Dieses Skript ist der
# erste, ungefährliche Teil des Werkzeugs, das daraus ein „wirklich weg" machen
# soll (docs/MODERATION_UND_RECHT.md § 6, „Weg B"): Es liest dieselbe Liste, die
# auch die App liest, und sagt genau, welche Ereignisse im Speicher davon
# betroffen wären.
#
# Erst wenn diese Auskunft stimmt, ergibt ein Löschen überhaupt Sinn. Ein
# Werkzeug, das löscht, bevor man ihm beim Zählen zusehen konnte, ist keins.
#
# ── ZWEI DINGE, DIE ES BEWUSST ANDERS MACHT ALS DIE APP ───────────────────────
#
# 1. ES GREIFT NACH DER KENNUNG, NICHT NACH DEM BRETT-KENNZEICHEN. Die App
#    filtert, was KIMBOARD anzeigt. Auf dem Relais liegen aber auch Fragen ans
#    Mycel (Tag "sbkim-qry", am 2026-08-18 gemessen: 178 Stück) — im Klartext,
#    genau wie Zettel. Wer nach dem Kimboard-Tag greift, lässt sie liegen.
#    Deshalb hier: jede Kennung aus der Liste, unabhängig vom Tag.
#
# 2. ES FINDET DAS SCHEMA SELBST. Wie nostr-rs-relay Kennungen ablegt (Text
#    oder Blob, welche Spalte), ist eine Frage der Fassung. Statt es zu raten,
#    fragt das Skript die Datenbank und sagt, was es gefunden hat. Passt nichts,
#    bricht es ab — statt eine Null zu melden, die wie „nichts betroffen"
#    aussieht und in Wahrheit „falsch gesucht" heißt.
#
# ── AUFRUF ────────────────────────────────────────────────────────────────────
#   bash relais-wache.sh                    # mit den Vorgaben unten
#   DB=/pfad/nostr.db bash relais-wache.sh  # andere Datenbank
#   LISTE=/pfad/sperrliste.js bash relais-wache.sh   # lokale Liste statt Netz
#
# Er gehört auf den Server, auf dem das Relais läuft (Hetzner-Cloud-Server),
# nicht aufs Tablet. Er braucht `sqlite3` und `curl`.
set -u

DB="${DB:-/opt/relay/db/nostr.db}"
LISTE="${LISTE:-https://raw.githubusercontent.com/lausiklauskn-png/Kimboard/main/assets/config/sperrliste.js}"

sagen() { printf '%s\n' "$*"; }
fehler() { printf '✖ %s\n' "$*" >&2; }

sagen "══ Relais-Wache · NACHSEHEN (löscht nichts) ══"
sagen ""

# ── 1. Werkzeug und Datenbank vorhanden? ─────────────────────────────────────
for w in sqlite3 curl; do
  command -v "$w" >/dev/null || { fehler "$w fehlt. Nachinstallieren: apt-get install -y $w"; exit 2; }
done
[ -r "$DB" ] || { fehler "Datenbank nicht lesbar: $DB"; exit 2; }
sagen "Datenbank: $DB ($(du -h "$DB" | cut -f1))"

# ── 2. Die Sperr-Liste holen ─────────────────────────────────────────────────
roh=""
if [ -r "$LISTE" ]; then
  roh="$(cat "$LISTE")"
  sagen "Liste:     $LISTE (lokal)"
else
  roh="$(curl -sS -m 20 "$LISTE" 2>/dev/null)"
  [ -n "$roh" ] || { fehler "Liste nicht erreichbar: $LISTE"; exit 2; }
  sagen "Liste:     $LISTE"
fi

# Stand der Liste, falls angegeben — damit man sieht, ob man die aktuelle liest.
stand="$(printf '%s' "$roh" | sed -n "s/.*stand:[[:space:]]*'\([^']*\)'.*/\1/p" | head -1)"
[ -n "$stand" ] && sagen "Stand:     $stand"
sagen ""

# ── 3. Kennungen herausziehen — GETRENNT nach Wirkung ────────────────────────
# `ereignisse` trifft EINEN Zettel, `absender` trifft ALLES von einem Schlüssel.
# Die beiden dürfen nicht in einen Topf: ein versehentlich als Absender
# eingetragener Wert nähme weit mehr weg, als jemand erwartet.
#
# Gelesen wird abschnittsweise zwischen `ereignisse:` und `absender:`. Die
# Beispiele in den Kommentaren stören nicht: sie sind bewusst gekürzt
# ('a1b2…') und damit keine 64 Hex-Zeichen.
abschnitt() {  # $1 = Feldname
  printf '%s' "$roh" \
    | sed -n "/${1}:[[:space:]]*{/,/^[[:space:]]*}/p" \
    | grep -oE "'[0-9a-fA-F]{64}'" \
    | tr -d "'" \
    | tr 'A-F' 'a-f' \
    | sort -u
}

ereignisse="$(abschnitt ereignisse)"
absender="$(abschnitt absender)"
n_ev=$(printf '%s' "$ereignisse" | grep -c . || true)
n_ab=$(printf '%s' "$absender" | grep -c . || true)

sagen "In der Liste: $n_ev Zettel-Kennungen, $n_ab Absender-Kennungen"

if [ "$n_ev" = 0 ] && [ "$n_ab" = 0 ]; then
  sagen ""
  sagen "Die Sperr-Liste ist leer — es gäbe nichts zu entfernen."
  sagen "Das ist kein Fehler: solange niemand etwas gesperrt hat, ist sie leer."
  exit 0
fi
sagen ""

# ── 4. Das Schema herausfinden, statt es zu raten ────────────────────────────
spalten="$(sqlite3 "$DB" "PRAGMA table_info(event);" 2>/dev/null | cut -d'|' -f2,3)"
[ -n "$spalten" ] || { fehler "Tabelle 'event' nicht gefunden — ist das eine nostr-rs-relay-Datenbank?"; exit 2; }

spalte_von() {  # $1 = Liste möglicher Namen
  for k in $1; do
    printf '%s\n' "$spalten" | cut -d'|' -f1 | grep -qx "$k" && { printf '%s' "$k"; return 0; }
  done
  return 1
}
sp_id="$(spalte_von "event_hash id_hex event_id")" || {
  fehler "Keine Spalte für die Ereignis-Kennung gefunden. Gefunden wurde:"; printf '%s\n' "$spalten" >&2; exit 2; }
sp_autor="$(spalte_von "author pubkey")" || {
  fehler "Keine Spalte für den Absender gefunden. Gefunden wurde:"; printf '%s\n' "$spalten" >&2; exit 2; }

typ_id="$(printf '%s\n' "$spalten" | grep "^${sp_id}|" | cut -d'|' -f2)"
sagen "Schema:    Kennung in Spalte '$sp_id' ($typ_id), Absender in '$sp_autor'"

# Kennungen liegen je nach Fassung als BLOB oder als Text vor. Beide Schreibweisen
# werden geprüft — welche trifft, sagt das Skript gleich selbst.
alsWert() { case "$typ_id" in *BLOB*|*blob*) printf "x'%s'" "$1";; *) printf "'%s'" "$1";; esac; }

gesamt="$(sqlite3 "$DB" "SELECT COUNT(*) FROM event;")"
sagen "Im Speicher: $gesamt Ereignisse"
sagen ""

# ── 5. Nachsehen — und NUR das ───────────────────────────────────────────────
treffer_ev=0
if [ "$n_ev" -gt 0 ]; then
  sagen "── Gesperrte Zettel ──"
  while IFS= read -r k; do
    [ -n "$k" ] || continue
    n="$(sqlite3 "$DB" "SELECT COUNT(*) FROM event WHERE $sp_id = $(alsWert "$k");" 2>/dev/null || echo 0)"
    treffer_ev=$((treffer_ev + n))
    if [ "$n" -gt 0 ]; then
      sagen "  ✔ ${k:0:16}…  liegt im Speicher"
    else
      sagen "  · ${k:0:16}…  nicht im Speicher (schon weg, oder nie hier)"
    fi
  done <<EOF
$ereignisse
EOF
  sagen ""
fi

treffer_ab=0
if [ "$n_ab" -gt 0 ]; then
  sagen "── Gesperrte Absender (trifft ALLES von ihnen) ──"
  while IFS= read -r k; do
    [ -n "$k" ] || continue
    n="$(sqlite3 "$DB" "SELECT COUNT(*) FROM event WHERE $sp_autor = $(alsWert "$k");" 2>/dev/null || echo 0)"
    treffer_ab=$((treffer_ab + n))
    sagen "  $([ "$n" -gt 0 ] && echo '✔' || echo '·') ${k:0:16}…  $n Ereignis(se)"
  done <<EOF
$absender
EOF
  sagen ""
fi

# ── 6. Ergebnis ──────────────────────────────────────────────────────────────
summe=$((treffer_ev + treffer_ab))
sagen "══ Ergebnis ══"
sagen "Ein Löschlauf würde $summe von $gesamt Ereignissen entfernen."
sagen "  · über Zettel-Kennungen:   $treffer_ev"
sagen "  · über Absender-Kennungen: $treffer_ab"
sagen ""
sagen "Es wurde NICHTS gelöscht und NICHTS geändert — das ist der Nachsehen-Gang."
sagen "Der scharfe Gang ist bewusst noch nicht gebaut: er braucht eine Sicherung"
sagen "vor jedem Lauf und den Nachweis, dass er nur diese Kennungen trifft."

# Rückgabewert 0 = die Auskunft steht. Er sagt NICHT, ob etwas gefunden wurde —
# „nichts betroffen" ist ein gültiges Ergebnis, kein Fehler.
exit 0
