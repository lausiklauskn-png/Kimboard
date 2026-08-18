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
DATEIEN=(index.html sw.js assets/hilfe.js assets/config/moderation.js assets/config/sperrliste.js assets/studio.js)
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
echo "── Gegenprobe: Betreiber-Studio ──"

# Der Zugang. Wäre das Werkzeug immer geladen, trüge jeder Besucher es mit —
# und die Prüfung, die das behauptet, muss das auch merken.
probe "studio.js wird NICHT beim normalen Laden geholt" smoke_studio.mjs \
  ersetze index.html \
  "    s.src = './assets/studio.js?v=3';" \
  "    s.src = './assets/studio.js?v=3';\n  }\n  { var vorab = document.createElement('script'); vorab.src = './assets/studio.js?v=3'; document.head.appendChild(vorab);"

probe "ein Wischen bricht den langen Druck ab" smoke_studio.mjs \
  ersetze index.html \
  "    if (uhr && (Math.abs(ev.clientX - sx) > 10 || Math.abs(ev.clientY - sy) > 10)) stop();" \
  "    /* Abbruch beim Wischen ausgebaut */"

probe "ein kurzer Tipp öffnet nichts (die 1,5 s sind echt)" smoke_studio.mjs \
  ersetze index.html \
  "uhr = setTimeout(function () { uhr = null; oeffnen(); }, 1500);" \
  "uhr = setTimeout(function () { uhr = null; oeffnen(); }, 30);"

# Der Ausweis. Fiele er weg, stünde das Werkzeug jedem offen — wirkungslos zwar,
# aber es sähe aus, als gehörte das Brett ihm.
probe "ohne passenden Schlüssel gibt es kein Studio" smoke_studio.mjs \
  ersetze assets/studio.js \
  "    if (!erwartet || String(meine).toLowerCase() !== erwartet) {" \
  "    if (false) {"

probe "ohne Betreiber wird die eigene Kennung zum Eintragen gezeigt" smoke_studio.mjs \
  ersetze assets/studio.js \
  "      if (HEX64.test(String(meine || ''))) {" \
  "      if (false) {"

# Die Einbahnstraße — die Regel, die das Studio durchsetzen soll und an die es
# sich deshalb selbst halten muss.
probe "auch das Studio kann eine Netz-Sperre nicht lösen" smoke_studio.mjs \
  ersetze index.html \
  "  sperreJetzt: (liste) => { const n = sperrEintraegeAus(liste, 'studio'); if (n) wischeGesperrte(); return n; }" \
  "  sperreJetzt: (liste) => { const n = sperrEintraegeAus(liste, 'studio'); if (n) wischeGesperrte(); return n; },\n  entsperreNetz: (id) => sperrEreignisse.delete(String(id).toLowerCase())"

# Der Schlüssel. Er darf die Brücke nicht überqueren.
probe "der private Schlüssel bleibt drinnen" smoke_studio.mjs \
  ersetze index.html \
  "  relaisListe: () => activeRelays.slice()," \
  "  _priv: priv, relaisListe: () => activeRelays.slice(),"

# Der Rundlauf. Eine Datei ohne Signatur sieht genauso aus wie eine mit — bis
# jemand versucht, sie zu lesen.
probe "die erzeugte Liste ist wirklich signiert" smoke_studio.mjs \
  ersetze assets/studio.js \
  "    var blob = new Blob([JSON.stringify(ereignis, null, 2)], { type: 'application/json' });" \
  "    ereignis = { pubkey: ereignis.pubkey, content: ereignis.content };\n    var blob = new Blob([JSON.stringify(ereignis, null, 2)], { type: 'application/json' });"

probe "der beanstandete TEXT landet nicht in der Datei" smoke_studio.mjs \
  ersetze assets/studio.js \
  "    liste.ereignisse[String(ev.id).toLowerCase()] = { grund: grund, seit: heute() };" \
  "    liste.ereignisse[String(ev.id).toLowerCase()] = { grund: grund, seit: heute(), text: String(ev.content) };"

# NIP-86. Ein Knopf, der etwas verspricht, was das Relais nicht kann, ist
# schlimmer als gar keiner.
probe "ein Relais ohne NIP-86 wird als solches erkannt" smoke_studio.mjs \
  ersetze assets/studio.js \
  "        kannVerwaltung: nips.indexOf(86) >= 0" \
  "        kannVerwaltung: true"

probe "die Software des Relais wird wirklich genannt" smoke_studio.mjs \
  ersetze assets/studio.js \
  "            r.software ? ('Software: ' + r.software.replace(/^.*\\//, '')) : 'Software: unbekannt'," \
  "            'Software: unbekannt',"

# Die Schlüssel-Sicherung. Sie ist der einzige Weg zurück — was hier still
# kaputtgeht, merkt man erst, wenn der Schlüssel schon weg ist.
probe "der Schlüssel steht nicht lesbar in der Sicherungs-Datei" smoke_studio.mjs \
  ersetze index.html \
  "    salz: alsB64(salz), iv: alsB64(iv), geheim: alsB64(geheim)," \
  "    salz: alsB64(salz), iv: alsB64(iv), geheim: alsB64(geheim), klartext: privHex,"

probe "ein falsches Passwort lässt den Speicher unberührt" smoke_studio.mjs \
  ersetze index.html \
  "  } catch (e) { throw new Error('Falsches Passwort — oder die Datei ist beschädigt.'); }" \
  "  } catch (e) { localStorage.setItem(LS_KEY, 'x'.repeat(64)); throw new Error('Falsches Passwort — oder die Datei ist beschädigt.'); }"

probe "Schlüssel und Kennung müssen zusammenpassen" smoke_studio.mjs \
  ersetze index.html \
  "  if (datei.kennung && dazu !== String(datei.kennung).toLowerCase()) {" \
  "  if (false) {"

probe "ein zu kurzes Passwort wird abgewiesen" smoke_studio.mjs \
  ersetze index.html \
  "  if (typeof passwort !== 'string' || passwort.length < 8) {" \
  "  if (false) {"

probe "die Sicherung nutzt 600.000 Runden" smoke_studio.mjs \
  ersetze index.html \
  "const SCHLUESSEL_RUNDEN = 600000;" \
  "const SCHLUESSEL_RUNDEN = 1000;"

probe "der Zurückholen-Weg steht auch Fremden offen" smoke_studio.mjs \
  ersetze assets/studio.js \
  "    bereichSchluessel(box);
  }" \
  "  }"

probe "der Schlüssel-Knopf steht sichtbar in der Seite" smoke_studio.mjs \
  ersetze index.html \
  '                style="margin-left:8px;padding:2px 8px;font-size:.82rem;"' \
  '                style="margin-left:8px;padding:2px 8px;font-size:.82rem;display:none;"'

probe "das Schlüssel-Fenster zeigt Fremden KEINE Sperr-Knöpfe" smoke_studio.mjs \
  ersetze assets/studio.js \
  "    box.appendChild(hin);
    bereichSchluessel(box);
  }

  window.KBStudio = {" \
  "    box.appendChild(hin);
    bereichSchluessel(box);
    bereichZettel(box);
  }

  window.KBStudio = {"

probe "ein unbrauchbarer Betreiber-Schlüssel fällt auf" smoke_studio.mjs \
  ersetze assets/config/moderation.js \
  "    betreiberSchluessel: '7dee8dd9088022e0a9be3667ad6ed3551a68c263ce557f34907485075d2fd6a0'," \
  "    betreiberSchluessel: '7DEE8DD9088022E0A9BE3667AD6ED3551A68C263CE557F34907485075D2FD6A',"

probe "studio.js bleibt aus dem Offline-Vorrat heraus" smoke_studio.mjs \
  ersetze sw.js \
  '  "./assets/config/sperrliste.js",' \
  '  "./assets/config/sperrliste.js",\n  "./assets/studio.js",'

echo
echo "══════════════════════════════════════════"
echo "Gegenprobe: $gruen gefangen, $rot NICHT gefangen"
[ "$rot" = 0 ] || echo "Ein nicht gefangener Fehler heißt: dieser Wächter bewacht nichts."
exit $([ "$rot" = 0 ] && echo 0 || echo 1)
