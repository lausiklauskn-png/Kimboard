#!/usr/bin/env bash
# relais-grenzen.sh — setzt Flut-Bremse und Zukunfts-Riegel in die Relais-Konfig.
#
# ── WOZU ──────────────────────────────────────────────────────────────────────
# Am 2026-08-19 gemessen: `/opt/relay/config.toml` hatte WEDER einen Abschnitt
# für Berechtigung NOCH einen für Grenzen. Kein Schlüssel-Filter, keine
# Nachrichten-Rate, keine Größenbeschränkung. Im Klartext: jeder, der
# `wss://relay.family-projekt.de` kennt, konnte beliebig viel hineinschreiben —
# und die Adresse steht im öffentlichen Quelltext von 21 Apps. Die einzige
# Grenze war die Festplatte.
#
# Das ist der billigere Hebel als ein Anzeige-Filter in 21 Apps: eine Stelle,
# zwei Wirkungen.
#
# ── WAS ER SETZT, UND WARUM GENAU DAS ────────────────────────────────────────
#
#   messages_per_sec = 5        Server-weit, über eine Minute gemittelt — also
#                               300 Ereignisse je Minute. Klaus' ganzes Netz
#                               erzeugt eine Handvoll; ein Fluter erzeugt
#                               Tausende. Die Vorlage von nostr-rs-relay nennt
#                               genau diese Zeile "highly recommended if your
#                               relay is public".
#
#   subscriptions_per_min = 30  Deckelt, wie oft ein Client Abfragen aufmacht.
#                               Die Vorlage empfiehlt 10; hier 30, weil Klaus
#                               mehrere Apps in mehreren Tabs offen hat und das
#                               nicht in eigene Bremsspuren laufen soll.
#
#   reject_future_seconds       Gegen Zettel, die sich mit falschem Datum oben
#     = 1800                    festsetzen. VOR dem Setzen gemessen: von 1623
#                               Ereignissen lag KEIN EINZIGES in der Zukunft,
#                               der neueste 167467 Sekunden dahinter, und die
#                               Server-Uhr läuft per NTP synchron.
#
# Nostr-Zeitstempel sind Unix-Sekunden seit 1970 in UTC — eine ZAHL, keine
# Uhrzeit mit Zone. Eine Zeitzone kann daran nichts verstellen; nur eine
# wirklich falsch gehende Geräte-Uhr könnte es, und die gab es hier nie.
#
# ── WAS ER BEWUSST NICHT SETZT ───────────────────────────────────────────────
#
#   pubkey_whitelist    Würde Fremden das Andocken ganz verbieten und damit
#                       genau das kaputtmachen, wofür dieses Relais da ist.
#                       Für ein geschlossenes Betriebsnetz gehört das an ein
#                       ZWEITES Relais — der vorgebaute Block unten sagt, wie.
#
#   limit_scrapers      Weist ungenaue Abfragen ab (nur Art, nur Absender).
#                       Die Modul-23-Abfragen tragen alle einen Tag-Filter und
#                       wären sicher — aber es wurde NICHT jede Abfrage in 21
#                       Apps geprüft. Eine reine `authors:`-Abfrage würde
#                       abgewiesen. Ohne diese Prüfung nicht anfassen.
#
#   max_event_bytes     Steht schon auf 128 KB. Kleiner zu setzen könnte Bilder
#                       auf der Pinnwand abschneiden.
#
# ── AUFRUF ────────────────────────────────────────────────────────────────────
#   ssh root@<server> 'curl -sSL -o /tmp/g.sh https://raw.githubusercontent.com/lausiklauskn-png/Kimboard/main/tools/relais-grenzen.sh && bash /tmp/g.sh'
#
# Er ist WIEDERHOLBAR: läuft er zweimal, merkt er das und tut nichts. Ein
# zweiter `[limits]`-Abschnitt wäre kaputtes TOML, und das Relais startete
# nicht mehr — genau der Fehler, den ein Werkzeug nicht bauen darf.
#
# Er sichert vorher, prüft nachher, und nimmt sich bei einem Fehlschlag selbst
# zurück.
set -u

CONF="${CONF:-/opt/relay/config.toml}"
CONTAINER="${CONTAINER:-relay}"
DB="${DB:-/opt/relay/db/nostr.db}"
PRUEF_URL="${PRUEF_URL:-https://relay.family-projekt.de/}"
NEUSTART="${NEUSTART:-ja}"

sagen() { printf '%s\n' "$*"; }
fehler() { printf '✖ %s\n' "$*" >&2; }

sagen "══ Relais-Grenzen setzen ══"
sagen ""

# Der Fall, der wirklich vorkommt: falscher Pfad. Ein Schreibschutz-Riegel wäre
# hier Zierde — dieses Skript läuft als `root`, und `root` darf immer schreiben,
# egal welche Rechte an der Datei stehen. (Aufgefallen, weil die Probe dafür
# fehlschlug: sie prüfte etwas, das in der echten Umgebung nie eintritt.)
[ -f "$CONF" ] || { fehler "Konfig nicht gefunden: $CONF"; exit 2; }
[ -w "$CONF" ] || { fehler "Konfig nicht beschreibbar: $CONF"; exit 2; }

# ── 1. Schon gesetzt? Dann nichts tun. ───────────────────────────────────────
# Ein zweiter [limits]-Abschnitt ist kaputtes TOML. Lieber gar nichts als das.
if grep -qE '^\[limits\]' "$CONF"; then
  sagen "Es gibt bereits einen [limits]-Abschnitt in $CONF."
  sagen "Ich fasse nichts an — ein zweiter wäre kaputtes TOML und das Relais"
  sagen "startete nicht mehr. Wer die Werte ändern will, ändert sie dort."
  sagen ""
  grep -nE '^\[(limits|options|authorization)\]' -A 6 "$CONF"
  exit 0
fi

# ── 2. Sichern ───────────────────────────────────────────────────────────────
SICHERUNG="${CONF}.bak-$(date +%Y%m%d-%H%M%S)"
cp "$CONF" "$SICHERUNG" || { fehler "Sicherung fehlgeschlagen. Es wurde NICHTS geändert."; exit 3; }
sagen "Sicherung: $SICHERUNG"

vorher="$(sqlite3 "$DB" 'SELECT COUNT(*) FROM event;' 2>/dev/null || echo '?')"
sagen "Zettel vorher: $vorher"
sagen ""

# ── 3. Anhängen ──────────────────────────────────────────────────────────────
cat >> "$CONF" <<'TOML'

# ─────────────────────────────────────────────────────────────────────────────
# Ergänzt 2026-08-19. Bis dahin hatte dieses Relais WEDER Berechtigungs- NOCH
# Grenz-Einstellungen: jeder, der die Adresse kannte, konnte unbegrenzt
# schreiben, und die einzige Grenze war die Festplatte.
# ─────────────────────────────────────────────────────────────────────────────

[options]
# Zettel mit einem Zeitstempel weiter als 30 Minuten in der Zukunft werden
# abgewiesen — sonst setzt sich jemand mit falschem Datum dauerhaft oben fest.
# VOR dem Setzen gemessen: von 1623 Ereignissen lag KEIN EINZIGES in der
# Zukunft, und die Server-Uhr läuft per NTP synchron. Nostr-Zeitstempel sind
# Unix-Sekunden in UTC, also eine Zahl ohne Zeitzone — daran kann eine
# Zeitzone nichts verstellen, nur eine wirklich falsch gehende Geräte-Uhr.
reject_future_seconds = 1800

[limits]
# Flut-Bremse, server-weit und über eine Minute gemittelt (300 je Minute).
# Das ganze Netz erzeugt eine Handvoll; ein Fluter erzeugt Tausende.
messages_per_sec = 5
# Wie oft ein Client Abfragen aufmachen darf. Die Vorlage empfiehlt 10; hier
# 30, weil mehrere Apps in mehreren Tabs offen sind.
subscriptions_per_min = 30

# ─────────────────────────────────────────────────────────────────────────────
# VORGEBAUT, ABER NICHT AKTIV — ein geschlossenes Betriebs- oder Firmennetz
# ─────────────────────────────────────────────────────────────────────────────
#
# NICHT hier scharf schalten. Dieses Relais ist der ÖFFENTLICHE Treffpunkt;
# seine Aufgabe ist, dass Fremde andocken können. Ein geschlossenes Netz
# braucht ein EIGENES Relais: dieselbe Software, eigene Konfig, eigene
# Adresse — ein zweiter Container, ein weiterer Caddy-Block, eine Unteradresse.
# Oder gleich auf der Maschine des Kunden.
#
# Und dort reicht die Schlüssel-Liste ALLEIN NICHT. Sie hält Fremde vom
# SCHREIBEN ab, nicht vom LESEN. Wer "kein Fremder kommt rein" will, braucht
# beide Zeilen: die Liste UND nip42_auth. Erst die zweite verlangt einen
# Nachweis, BEVOR jemand mitlesen darf.
#
# [authorization]
# # Nur diese Schlüssel dürfen schreiben. Ohne die Zeile: jeder.
# pubkey_whitelist = [
#   "…64 Hex-Zeichen…",
# ]
# # Der Client muss beweisen, dass er den Schlüssel hat — vor dem Lesen.
# nip42_auth = true
# # Direktnachrichten nur an den ausgewiesenen Empfänger ausliefern.
# nip42_dms = true
TOML

sagen "── Angehängt ──"
sagen "  [options] reject_future_seconds = 1800"
sagen "  [limits]  messages_per_sec = 5, subscriptions_per_min = 30"
sagen "  (dazu ein auskommentierter Block für ein geschlossenes Netz)"
sagen ""

# ── 4. Neustart und Nachprüfen ───────────────────────────────────────────────
# Ohne diesen Teil wäre der Lauf eine Behauptung: eine kaputte Konfig merkt man
# erst daran, dass das Relais nicht mehr hochkommt.
zurueck() {
  fehler "Nehme die Änderung zurück."
  cp "$SICHERUNG" "$CONF"
  docker restart "$CONTAINER" >/dev/null 2>&1
  sleep 4
  fehler "Zurückgesetzt auf: $SICHERUNG"
}

if [ "$NEUSTART" != "ja" ]; then
  sagen "NEUSTART=nein — die Konfig ist geschrieben, wirkt aber erst nach"
  sagen "  docker restart $CONTAINER"
  exit 0
fi

sagen "── Neustart ──"
if ! docker restart "$CONTAINER" >/dev/null 2>&1; then
  zurueck; exit 4
fi
sleep 5

antwort="$(curl -sS -m 10 -H 'Accept: application/nostr+json' "$PRUEF_URL" 2>/dev/null)"
if ! printf '%s' "$antwort" | grep -q '"name"'; then
  fehler "Das Relais antwortet nicht mehr — die Konfig ist vermutlich kaputt."
  zurueck
  exit 4
fi

nachher="$(sqlite3 "$DB" 'SELECT COUNT(*) FROM event;' 2>/dev/null || echo '?')"

sagen "  ✔ Relais antwortet wieder"
sagen "  Zettel nachher: $nachher (vorher $vorher)"
if [ "$vorher" != "$nachher" ]; then
  sagen "  (Abweichung ist normal, wenn in der Zwischenzeit jemand geschrieben hat.)"
fi
sagen ""
sagen "══ Erledigt ══"
sagen "Die Sicherung bleibt liegen: $SICHERUNG"
sagen ""
sagen "NOCH NICHT BEWIESEN: dass Schreiben weiterhin geht. Eine Grenze, die man"
sagen "nicht gegengeprüft hat, ist auch nur eine Behauptung — schreib einen"
sagen "Testzettel in Kimboard und sieh nach, ob er erscheint."
exit 0
