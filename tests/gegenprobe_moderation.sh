#!/usr/bin/env bash
# Gegenprobe zu den Wächtern für Melde-Weg und Sperr-Liste (2026-08-17).
#
# WOZU: Ein Wächter ohne Gegenprobe ist nur ein grüner Haken. Diese Datei baut
# jeden Fehler, den die Wächter fangen SOLLEN, wirklich ein — und sieht nach, ob
# die Prüfung dann auch wirklich umfällt. Fällt sie nicht um, hat sie nichts
# bewacht, und das erfährt man hier statt später.
#
# Jeder Eingriff wird danach zurückgenommen (Sicherungskopien in einem eigenen
# Ordner unter /tmp). Bricht der Lauf mittendrin ab, stellt das `trap` den
# Ursprungszustand wieder her — die Arbeitskopie bleibt in keinem Fall kaputt.
#
# Aufruf: bash tests/gegenprobe_moderation.sh   ·   Exit 0 = jeder Fehler wurde
# gefangen. Braucht `npm install --no-save playwright-core` wie die Proben selbst.
set -u
cd "$(dirname "$0")/.."

SICHER="$(mktemp -d)"
DATEIEN=(index.html sw.js assets/hilfe.js assets/config/moderation.js assets/config/sperrliste.js)
for d in "${DATEIEN[@]}"; do mkdir -p "$SICHER/$(dirname "$d")"; cp "$d" "$SICHER/$d"; done
zurueck() { for d in "${DATEIEN[@]}"; do cp "$SICHER/$d" "$d"; done; }
trap 'zurueck; rm -rf "$SICHER"' EXIT INT TERM

gruen=0; rot=0

# probe <beschreibung> <prüfdatei> <sed-/python-befehl…>
# Baut den Fehler ein, lässt die Probe laufen, erwartet Exit≠0, macht rückgängig.
probe() {
  local was="$1" datei="$2"; shift 2
  "$@" || { echo "  ✗ $was — der Eingriff selbst ist fehlgeschlagen"; rot=$((rot+1)); zurueck; return; }
  # WICHTIG: KEIN `| tail` hier. Über grün entscheidet nur der eigene
  # Rückgabewert der Prüfung — hinter einer Pipe bekäme man den von `tail`.
  # Genau diese Verwechslung hat am 2026-08-17 ein Rot verdeckt.
  if node "tests/$datei" >/dev/null 2>&1; then
    echo "  ✗ $was — die Probe blieb GRÜN, sie bewacht das nicht"
    rot=$((rot+1))
  else
    echo "  ✓ $was"
    gruen=$((gruen+1))
  fi
  zurueck
}

# Kleine Hilfe: eine Zeichenkette in einer Datei ersetzen (fehlschlagen, wenn
# sie gar nicht vorkommt — sonst prüfte die Gegenprobe einen Eingriff, den es
# nicht gab, und sähe dabei aus wie bestanden).
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

echo "── Gegenprobe: Sperr-Liste ──"

probe "gesperrter Zettel wird nicht angezeigt" smoke_sperrliste.mjs \
  ersetze index.html \
  '  if (istNetzGesperrt(ev)) return;' \
  '  if (false && istNetzGesperrt(ev)) return;'

probe "die Liste steht VOR dem ersten Zettel da (defer im <head>)" smoke_sperrliste.mjs \
  ersetze index.html \
  '<script defer src="./assets/config/sperrliste.js"></script>' \
  '<!-- nachgeladen statt defer: -->'

probe "Signatur einer nachgeladenen Liste wird geprüft" smoke_sperrliste.mjs \
  ersetze index.html \
  '  if (!(await isAuthentic(roh))) return { geladen: false, grund: '"'"'Signatur stimmt nicht'"'"' };' \
  '  /* Prüfung ausgebaut */'

probe "eine Liste von FREMDEM Schlüssel wird abgewiesen" smoke_sperrliste.mjs \
  ersetze index.html \
  '  if (String(roh.pubkey || '"'"''"'"').toLowerCase() !== schluessel) {' \
  '  if (false) {'

probe "Einbahnstraße: die herausgegebene Liste ist eine KOPIE" smoke_sperrliste.mjs \
  ersetze index.html \
  '    ereignisse: [...sperrEreignisse.keys()],' \
  '    ereignisse: Object.assign([...sperrEreignisse.keys()], { length: 0, push: () => sperrEreignisse.clear() }),'

# Die riskante Hälfte von fail-soft ist NICHT der Abruf (der hängt an einem
# `.catch`), sondern die Auswertung der eingebackenen Liste: sie läuft synchron
# beim Start. Wirft sie, stirbt das App-Modul und Kimboard zeigt eine weiße
# Seite. Der erste Versuch hier traf die abgesicherte Hälfte und wurde deshalb
# nicht gefangen — genau dafür gibt es die Gegenprobe.
probe "kaputte Liste wirft die App nicht um (fail-soft)" smoke_sperrliste.mjs \
  ersetze index.html \
  "  if (!liste || typeof liste !== 'object') return 0;" \
  '  /* Typ-Prüfung ausgebaut */'

probe "unsinnige Kennungen werden verworfen" smoke_sperrliste.mjs \
  ersetze index.html \
  '      if (!/^[0-9a-f]{64}$/i.test(kennung)) continue;' \
  '      /* Kennungs-Prüfung ausgebaut */'

# Der Service-Worker ist cache-first. Ohne Ausnahme für die Liste würde sie
# einmal geholt und danach für immer aus dem Vorrat bedient — die App zeigte den
# Stand der letzten Auslieferung und sähe dabei aus, als wirke die Sperre.
probe "der Service-Worker friert die Liste nicht ein" smoke_sperrliste.mjs \
  ersetze sw.js \
  '  if (/sperrliste[^/]*\.json$/i.test(url.pathname)) {' \
  '  if (false) {'

# Und die Regel muss zu dem passen, was konfiguriert ist. Zwei Stellen, die
# auseinanderlaufen können, ohne dass irgendwo ein Fehler erscheint.
probe "Regel und konfigurierte Quelle passen zusammen" smoke_sperrliste.mjs \
  ersetze sw.js \
  '  if (/sperrliste[^/]*\.json$/i.test(url.pathname)) {' \
  '  if (/ganz-anders-benannt\.json$/i.test(url.pathname)) {'

echo "── Gegenprobe: Melde-Weg ──"

probe "der Melde-Knopf ist überhaupt da" smoke_melden.mjs \
  ersetze index.html \
  "  card.appendChild(meldeKnopf(ev, 'q-melden'));" \
  '  /* Knopf ausgebaut */'

probe "…auch an jeder Antwort" smoke_melden.mjs \
  ersetze index.html \
  "  li.appendChild(meldeKnopf(ev, 'q-melden a-melden'));" \
  '  /* Knopf ausgebaut */'

probe "die Zieladresse wird wirklich benutzt" smoke_melden.mjs \
  ersetze assets/config/moderation.js \
  "    meldeEndpunkt: 'https://www.family-projekt.de/formular/einreichung.php'," \
  "    meldeEndpunkt: ''," \

probe "der beanstandete Inhalt reist NICHT mit" smoke_melden.mjs \
  ersetze index.html \
  "          nachricht: 'Absender-Kennung: ' + (ev.pubkey || 'unbekannt') + '\\n\\n'" \
  "          nachricht: (ev.content || '') + ' | Absender-Kennung: ' + (ev.pubkey || 'unbekannt') + '\\n\\n'"

probe "der Bot-Riegel des Dienstes wird abgewartet" smoke_melden.mjs \
  ersetze index.html \
  '    if (offen < 1700) await new Promise((r) => setTimeout(r, 1700 - offen));' \
  '    /* Wartezeit ausgebaut */'

probe "ein Fehlschlag wird als Fehlschlag gemeldet" smoke_melden.mjs \
  ersetze index.html \
  "      return { weg: 'fehler', grund: (j && j.error) || ('HTTP ' + antwort.status) };" \
  "      return { weg: 'dienst' };"

probe "die Rückmeldung nennt den Beschwerdeweg (Art. 16)" smoke_melden.mjs \
  ersetze index.html \
  "        link(k.beschwerdeWeg, 'Impressum')," \
  "        ''," \

probe "der ⚑ hat eine Erklär-Blase" smoke_melden.mjs \
  ersetze assets/hilfe.js \
  "    '.q-melden': [" \
  "    '.q-melden-AUSGEBAUT': ["

echo
echo "══════════════════════════════════════════"
echo "Gegenprobe: $gruen gefangen, $rot NICHT gefangen"
[ "$rot" = 0 ] || echo "Ein nicht gefangener Fehler heißt: dieser Wächter bewacht nichts."
exit $([ "$rot" = 0 ] && echo 0 || echo 1)
