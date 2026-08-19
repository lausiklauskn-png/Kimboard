#!/usr/bin/env bash
# relais-wache.sh — die Relais-Wache. ZWEI GÄNGE in EINER Datei.
#
#   bash relais-wache.sh              → NACHSEHEN. Löscht nichts, ändert nichts.
#   SCHARF=ja bash relais-wache.sh    → ENTFERNEN. Sichert zuerst, dann löscht es.
#
# Der Nachsehen-Gang ist die Vorgabe, und das ist Absicht: ein versehentlicher
# Aufruf tut nichts. Zum Löschen muss man es ausdrücklich sagen.
#
# EINE Datei für beides, weil das Werkzeug per `ssh … 'bash -s' < datei`
# hinübergereicht wird. Zwei Dateien wären zwei Wege, die auseinanderlaufen —
# und der scharfe Gang MUSS genau das zählen, was der Nachsehen-Gang gezeigt hat.
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
#   bash relais-wache.sh                    # nachsehen, mit den Vorgaben unten
#   SCHARF=ja bash relais-wache.sh          # wirklich entfernen (sichert vorher)
#   DB=/pfad/nostr.db bash relais-wache.sh  # andere Datenbank
#   LISTE=/pfad/sperrliste.js …             # lokale Liste statt Netz
#   SICHERUNG=/pfad/abzug.db …              # wohin die Sicherung geht
#   STOPPEN=ja …                            # Relais während des Laufs anhalten
#
# Vom Tablet aus:  ssh root@<server> 'bash -s' < tools/relais-wache.sh
#                  ssh root@<server> 'SCHARF=ja bash -s' < tools/relais-wache.sh
#
# Er gehört auf den Server, auf dem das Relais läuft (Hetzner-Cloud-Server),
# nicht aufs Tablet. Er braucht `sqlite3` und `curl`.
#
# ── MUSS DAS RELAIS DAFÜR ANHALTEN? Gemessen, nicht vermutet ─────────────────
# Nein — deshalb ist `STOPPEN` freiwillig. Am 2026-08-18 gemessen: aus einer
# WAL-Datenbank lässt sich löschen, WÄHREND ein zweiter Verbinder weiterschreibt
# (`BEGIN IMMEDIATE` + `busy_timeout`); 55 gleichzeitige Einfügungen, kein Fehler
# auf beiden Seiten, `PRAGMA integrity_check` = ok.
# EHRLICHE GRENZE: gemessen wurde mit zwei Verbindern im selben Programm. Beim
# Relais sind es zwei Programme (Container und Server) über dieselbe Datei —
# SQLite sperrt dafür über dasselbe Verfahren, aber gemessen ist das hier nicht.
# Wem das zu dünn ist, nimmt `STOPPEN=ja`. Die Sicherung läuft in beiden Fällen.
set -u

DB="${DB:-/opt/relay/db/nostr.db}"
# ZWEI Listen, weil die App zwei liest — und was Kimboard verbirgt, muss der
# Server auch finden. Die eingebackene (`.js`) ist Teil der Auslieferung; die
# signierte (`.json`) ist das, was das Studio zwischen zwei Auslieferungen
# erzeugt. Läge hier nur die erste, bliebe genau das liegen, was Klaus zuletzt
# gesperrt hat — der Zettel wäre in jedem Kimboard unsichtbar und auf dem
# Server weiter da. (Befund 2026-08-18, beim ersten echten Eintrag.)
# ── EIN ZEICHEN, DAS EINEN UNTERSCHIED MACHT: `-` STATT `:-` ────────────────
# `${X:-vorgabe}` setzt die Vorgabe auch dann ein, wenn X auf LEER steht.
# `${X-vorgabe}`  setzt sie nur ein, wenn X GAR NICHT gesetzt ist.
#
# Hier muss es das zweite sein, damit `LISTE_JSON=''` die Quelle wirklich
# abschaltet. Mit dem Doppelpunkt tat es das NICHT — die Proben setzten sie auf
# leer, um sie stillzulegen, und holten in Wahrheit weiter die echte Liste aus
# dem Netz. Solange die Datei auf `main` noch nicht existierte, kam nichts
# zurück und alles war grün: grün, weil ein Abruf ins Leere lief, nicht weil die
# Abschaltung wirkte. (Aufgefallen 2026-08-19, als der erste echte Eintrag
# dastand.)
LISTE="${LISTE-https://raw.githubusercontent.com/lausiklauskn-png/Kimboard/main/assets/config/sperrliste.js}"
LISTE_JSON="${LISTE_JSON-https://raw.githubusercontent.com/lausiklauskn-png/Kimboard/main/sbkim/sperrliste.json}"
SCHARF="${SCHARF:-nein}"
STOPPEN="${STOPPEN:-nein}"
SICHERUNG="${SICHERUNG:-}"
CONTAINER="${CONTAINER:-relay}"

sagen() { printf '%s\n' "$*"; }
fehler() { printf '✖ %s\n' "$*" >&2; }

if [ "$SCHARF" = "ja" ]; then
  sagen "══ Relais-Wache · ENTFERNEN (sichert zuerst) ══"
else
  sagen "══ Relais-Wache · NACHSEHEN (löscht nichts) ══"
fi
sagen ""

# ── 1. Werkzeug und Datenbank vorhanden? ─────────────────────────────────────
for w in sqlite3 curl; do
  command -v "$w" >/dev/null || { fehler "$w fehlt. Nachinstallieren: apt-get install -y $w"; exit 2; }
done
[ -r "$DB" ] || { fehler "Datenbank nicht lesbar: $DB"; exit 2; }
sagen "Datenbank: $DB ($(du -h "$DB" | cut -f1))"

# ── 2. Die Sperr-Listen holen — BEIDE ────────────────────────────────────────
hole() {  # $1 = Datei oder Adresse; leise, ein Fehlschlag ist kein Abbruch
  [ -n "$1" ] || return 1
  if [ -r "$1" ]; then cat "$1"; else curl -sS -m 20 "$1" 2>/dev/null; fi
}

roh_js="$(hole "$LISTE")"
roh_json="$(hole "$LISTE_JSON")"

if [ -z "$roh_js" ] && [ -z "$roh_json" ]; then
  fehler "Keine der beiden Listen erreichbar:"
  fehler "  $LISTE"
  fehler "  $LISTE_JSON"
  exit 2
fi
[ -n "$roh_js" ]   && sagen "Liste:     $LISTE" || sagen "Liste:     — (nicht erreichbar: $LISTE)"
[ -n "$roh_json" ] && sagen "Signiert:  $LISTE_JSON" || sagen "Signiert:  — (nicht vorhanden)"

# Stand der Listen, damit man sieht, ob man die aktuelle liest. Beide
# Schreibweisen: `stand: '…'` (eingebacken) und `\"stand\":\"…\"` (signiert).
stand="$(printf '%s\n%s' "$roh_js" "$roh_json" \
  | sed -n -e "s/.*stand:[[:space:]]*'\([^']*\)'.*/\1/p" -e 's/.*stand[^:]*:[^0-9]*\([0-9-]\{10\}\).*/\1/p' \
  | sort -u | tr '\n' ' ')"
[ -n "$stand" ] && sagen "Stand:     $stand"
sagen ""

# ── 3. Kennungen herausziehen — GETRENNT nach Wirkung ────────────────────────
# `ereignisse` trifft EINEN Zettel, `absender` trifft ALLES von einem Schlüssel.
# Die beiden dürfen nicht in einen Topf: ein versehentlich als Absender
# eingetragener Wert nähme weit mehr weg, als jemand erwartet.
#
# ZWEI SCHREIBWEISEN, EIN VERFAHREN. Die eingebackene Liste ist JavaScript über
# viele Zeilen (`ereignisse: { 'abc…': {…} }`), die signierte ist JSON in EINER
# Zeile mit maskierten Anführungszeichen (`\"ereignisse\":{\"abc…\":{…}}`). Ein
# zeilenweises `sed` fand deshalb in der zweiten gar nichts — und hätte eine
# Null gemeldet, die wie „nichts gesperrt" aussieht.
#
# ── DIE GEFÄHRLICHE STELLE, und sie hat beim Bauen wirklich zugeschnappt ─────
# Eine gesperrte Kennung steht in BEIDEN Schreibweisen als SCHLÜSSEL da, also
# mit einem Doppelpunkt dahinter:   'abc…': { grund: … }   bzw.  \"abc…\":{…}
# Der Umschlag des signierten Ereignisses trägt daneben aber noch `pubkey`,
# `id` und `sig` — und die sind WERTE:   \"pubkey\": \"7dee…\",
#
# Der erste Entwurf las „alles nach dem Wort absender" und fing damit die `id`
# des Ereignisses als gesperrten ABSENDER mit ein. In dieser Datei blieb das
# folgenlos. Läge `pubkey` weiter hinten — und die meisten JSON-Werkzeuge
# sortieren die Felder alphabetisch, dann steht `pubkey` NACH `content` —, dann
# wäre es KLAUS' EIGENER SCHLÜSSEL gewesen, und ein scharfer Lauf hätte alles
# entfernt, was er je geschrieben hat.
#
# Deshalb greift der Ausdruck unten nur nach Kennungen, hinter denen ein
# DOPPELPUNKT steht. Das trennt Schlüssel von Werten und gilt in beiden
# Schreibweisen — unabhängig davon, in welcher Reihenfolge die Felder stehen.
#
# Zusätzlich wird abschnittsweise geschnitten (`#` und `%%` treffen jeweils das
# ERSTE Vorkommen). Die Beispiele in den Kommentaren stehen VOR `ereignisse`
# und fallen heraus; gekürzt sind sie ohnehin ('a1b2…' ist keine 64 Zeichen).
kennungen() {  # $1 = roher Text, $2 = Feldname
  local flach="${1//$'\n'/ }" teil
  case "$2" in
    ereignisse)
      [ "${flach#*ereignisse}" = "$flach" ] && return 0   # Feld gar nicht da
      teil="${flach#*ereignisse}"
      teil="${teil%%absender*}"
      ;;
    absender)
      [ "${flach#*absender}" = "$flach" ] && return 0
      teil="${flach#*absender}"
      ;;
  esac
  # 64 Hex · evtl. ein Maskierungs-Zeichen · Anführungszeichen · Doppelpunkt
  printf '%s' "$teil" \
    | grep -oE "[0-9a-fA-F]{64}\\\\?[\"'][[:space:]]*:" \
    | grep -oE "^[0-9a-fA-F]{64}" \
    | tr 'A-F' 'a-f'
}

abschnitt() {  # $1 = Feldname — über BEIDE Listen, zusammengeführt
  { kennungen "$roh_js" "$1"; kennungen "$roh_json" "$1"; } | sort -u
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

# Die EINE Bedingung, die beide Sorten zusammenfasst. Sie ist der Grund, warum
# die Zahl unten stimmt: ein Ereignis, das ZUGLEICH über seine Kennung und über
# seinen Absender gesperrt ist, taucht darin genau EINMAL auf.
bedingung() {
  local teil="" k
  if [ "$n_ev" -gt 0 ]; then
    local liste=""
    while IFS= read -r k; do
      [ -n "$k" ] || continue
      liste="$liste${liste:+,}$(alsWert "$k")"
    done <<EOF
$ereignisse
EOF
    [ -n "$liste" ] && teil="$sp_id IN ($liste)"
  fi
  if [ "$n_ab" -gt 0 ]; then
    local liste2=""
    while IFS= read -r k; do
      [ -n "$k" ] || continue
      liste2="$liste2${liste2:+,}$(alsWert "$k")"
    done <<EOF
$absender
EOF
    [ -n "$liste2" ] && teil="$teil${teil:+ OR }$sp_autor IN ($liste2)"
  fi
  # Kann nicht leer werden: ohne Kennungen ist das Skript oben schon ausgestiegen.
  printf '%s' "${teil:-0=1}"
}

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

# ── 6. Die EINE Zahl, auf die es ankommt ─────────────────────────────────────
# NICHT treffer_ev + treffer_ab. Ein Ereignis kann ZUGLEICH über seine eigene
# Kennung UND über seinen Absender gesperrt sein — die Summe zählte es dann
# doppelt. Beim Nachsehen wäre das nur eine zu hohe Zahl; beim scharfen Gang
# wäre es schlimmer: die Schlussrechnung „vorher − betroffen = nachher" ginge
# nicht auf, und das Werkzeug meldete einen Fehlschlag, obwohl es richtig
# gelöscht hat.
#
# Gefunden am 2026-08-18 beim Aufschreiben des scharfen Gangs. Die erste Probe
# hatte die Überschneidung nie gebaut und war deshalb grün.
wo="$(bedingung)"
summe="$(sqlite3 "$DB" "SELECT COUNT(*) FROM event WHERE $wo;" 2>/dev/null || echo 0)"

sagen "══ Ergebnis ══"
sagen "Betroffen sind $summe von $gesamt Ereignissen."
sagen "  · über Zettel-Kennungen:   $treffer_ev"
sagen "  · über Absender-Kennungen: $treffer_ab"
[ $((treffer_ev + treffer_ab)) -ne "$summe" ] && \
  sagen "  (die beiden überschneiden sich — $summe ist die Zahl, die zählt)"
sagen ""

# ── 7. Hier trennen sich die Gänge ───────────────────────────────────────────
if [ "$SCHARF" != "ja" ]; then
  sagen "Es wurde NICHTS gelöscht und NICHTS geändert — das ist der Nachsehen-Gang."
  sagen "Zum wirklichen Entfernen:  SCHARF=ja bash relais-wache.sh"
  # Rückgabewert 0 = die Auskunft steht. Er sagt NICHT, ob etwas gefunden wurde —
  # „nichts betroffen" ist ein gültiges Ergebnis, kein Fehler.
  exit 0
fi

if [ "$summe" = 0 ]; then
  sagen "Nichts zu entfernen — die genannten Kennungen liegen nicht (mehr) hier."
  exit 0
fi

# ── 8. SICHERUNG. Nicht abschaltbar. ─────────────────────────────────────────
# `VACUUM INTO` zieht einen in sich stimmigen Abzug aus der LAUFENDEN Datenbank
# (am 2026-08-18 gemessen). Ein `cp` täte das nicht: im WAL-Modus liegt der
# neueste Stand teils in der Nebendatei, und ein halber Abzug ist schlimmer als
# gar keiner — er sieht aus wie eine Sicherung.
[ -n "$SICHERUNG" ] || SICHERUNG="${DB}.sicherung-$(date +%Y%m%d-%H%M%S).db"
sagen "── Sicherung ──"
sagen "Ziel: $SICHERUNG"
rm -f "$SICHERUNG" 2>/dev/null
if ! sqlite3 "$DB" "VACUUM INTO '$SICHERUNG';" 2>/dev/null; then
  fehler "Sicherung fehlgeschlagen. Es wurde NICHTS entfernt."
  exit 3
fi
gesichert="$(sqlite3 "$SICHERUNG" "SELECT COUNT(*) FROM event;" 2>/dev/null || echo -1)"
if [ "$gesichert" != "$gesamt" ]; then
  fehler "Die Sicherung trägt $gesichert statt $gesamt Ereignisse. Es wurde NICHTS entfernt."
  exit 3
fi
sagen "  ✔ $gesichert Ereignisse gesichert — der Stand VOR dem Lauf."
sagen ""

# ── 9. Anhalten? Freiwillig (Begründung im Kopf). ────────────────────────────
angehalten=nein
if [ "$STOPPEN" = "ja" ]; then
  if docker stop "$CONTAINER" >/dev/null 2>&1; then
    angehalten=ja; sagen "Relais '$CONTAINER' angehalten."
  else
    fehler "'$CONTAINER' ließ sich nicht anhalten. Es wurde NICHTS entfernt."
    exit 3
  fi
fi
wieder_an() {
  [ "$angehalten" = ja ] || return 0
  docker start "$CONTAINER" >/dev/null 2>&1 && sagen "Relais '$CONTAINER' wieder gestartet." \
    || fehler "Relais '$CONTAINER' ließ sich NICHT wieder starten — von Hand: docker start $CONTAINER"
}

# ── 10. Entfernen — in EINER Transaktion, mitsamt den Anhängseln ─────────────
# Die `tag`-Tabelle hängt an `event.id`. Wer nur die Ereignisse nimmt, lässt
# Zeilen zurück, die auf nichts mehr zeigen. Deshalb zuerst die Anhängsel,
# dann die Ereignisse — in derselben Transaktion, sonst fällt eines von beidem
# aus, wenn etwas dazwischenkommt.
sagen "── Entfernen ──"
if ! sqlite3 "$DB" "PRAGMA busy_timeout=15000;
BEGIN IMMEDIATE;
DELETE FROM tag WHERE event_id IN (SELECT id FROM event WHERE $wo);
DELETE FROM event WHERE $wo;
COMMIT;" >/dev/null 2>&1; then
  # `>/dev/null`, weil `PRAGMA busy_timeout=…` seinen gesetzten Wert ZURÜCKGIBT.
  # Beim ersten scharfen Lauf am Server stand deshalb eine nackte „15000"
  # mitten im Lösch-Schritt — harmlos, aber eine unerklärte Zahl an genau der
  # Stelle, an der man jede Zahl liest und deutet. Über Erfolg entscheidet hier
  # ohnehin nur der Rückgabewert, nicht die Ausgabe.
  fehler "Entfernen fehlgeschlagen. Die Transaktion ist zurückgerollt — der Stand"
  fehler "ist unverändert. Die Sicherung liegt trotzdem: $SICHERUNG"
  wieder_an
  exit 4
fi

# ── 11. Nachrechnen. Ohne das ist es kein Beweis, sondern eine Behauptung. ───
nachher="$(sqlite3 "$DB" "SELECT COUNT(*) FROM event;" 2>/dev/null || echo -1)"
rest="$(sqlite3 "$DB" "SELECT COUNT(*) FROM event WHERE $wo;" 2>/dev/null || echo -1)"
verwaist="$(sqlite3 "$DB" "SELECT COUNT(*) FROM tag WHERE event_id NOT IN (SELECT id FROM event);" 2>/dev/null || echo -1)"
erwartet=$((gesamt - summe))

sagen "  vorher:    $gesamt"
sagen "  betroffen: $summe"
sagen "  nachher:   $nachher   (erwartet $erwartet)"
sagen ""

fehlgriff=0
[ "$nachher" = "$erwartet" ] || { fehler "Die Rechnung geht NICHT auf: $nachher statt $erwartet."; fehlgriff=1; }
[ "$rest" = 0 ] || { fehler "$rest der genannten Kennungen liegen noch da."; fehlgriff=1; }
[ "$verwaist" = 0 ] || { fehler "$verwaist verwaiste Anhängsel geblieben."; fehlgriff=1; }

wieder_an

if [ "$fehlgriff" != 0 ]; then
  fehler "Zurückholen: docker stop $CONTAINER && cp '$SICHERUNG' '$DB' && docker start $CONTAINER"
  exit 4
fi

sagen "══ Erledigt ══"
sagen "$summe Ereignisse entfernt, $nachher liegen noch hier."
sagen "Nachgerechnet: die Zahl stimmt, keine der genannten Kennungen ist geblieben,"
sagen "kein verwaistes Anhängsel zurückgeblieben."
sagen ""
sagen "Die Sicherung bleibt liegen: $SICHERUNG"
sagen "Sie trägt den Stand VOR dem Lauf. Wer sie nicht mehr braucht, nimmt sie von"
sagen "Hand weg — dieses Werkzeug räumt sie nicht auf, denn das wäre der eine Griff,"
sagen "der sich nicht zurücknehmen lässt."
exit 0
