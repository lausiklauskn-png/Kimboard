# Brief an die nächste Sitzung — Kimboard

**Stand: 2026-08-17, Ende der Sitzung „Recht & Moderation".**
`main` war beim Start `1072f59`. Gebaut wurde auf
`claude/kimboard-recht-moderation-tbbacm`.

Lies zuerst diesen Brief, dann `CLAUDE.md`, dann
[`docs/MODERATION_UND_RECHT.md`](MODERATION_UND_RECHT.md). Danach nur den
Code-Bereich, an dem du arbeitest — `index.html` ist groß, lies gezielt mit Grep.

> Der ältere `BRIEF_MODERATION_UND_RECHT.md` ist damit **abgearbeitet bis auf
> Strang A**. Was daraus offen blieb, steht unten unter „Was als Nächstes".

---

## Was gebaut ist

| Strang | Stand |
|---|---|
| **C — Melde-Weg** (Art. 16 DSA) | ✅ fertig |
| **B — Sperr-Liste** (App-Seite) | ✅ fertig |
| **Die Papiere** | ✅ fertig |
| **A — Server-Wächter** | ⏸ **wartet auf Schritt 0** (siehe unten) |

**Strang C.** ⚑ an jedem Zettel und jeder Antwort, neben dem ✕. Melde-Fenster mit
Gründen (Hassrede zuerst), Freitext, anonym möglich. Der Weg ist derselbe
erprobte Dienst, den der family-projekt.de-Marktplatz benutzt
(`zweck: "meldung"`) — Kimboards Herkunft `lausiklauskn-png.github.io` stand
dort **bereits** in `allowed_origins`, es war **keine** Server-Änderung nötig.
Fail-soft auf `mailto:`, und ohne jede Adresse eine ehrliche Ansage statt eines
Knopfes, der ins Nichts sendet. Der beanstandete **Inhalt reist nicht mit** —
nur die Kennungen. Kein Automatismus.

**Strang B.** `assets/config/sperrliste.js`, mit `defer` im `<head>`, damit sie
vor dem ersten Zettel dasteht. Zettel **und** Absender sperrbar (Klaus'
Entscheidung). Gesperrtes verschwindet **spurlos** — kein Platzhalter, kein
Grund am Brett (auch Klaus' Entscheidung: bei Hassrede ist die stehengelassene
Lücke samt Begründung schon die halbe Verbreitung). Dass die App filtert, steht
trotzdem offen im Fenster „👁 Ausgeblendet", mit Zahl. Optional eine
nachgeladene Liste, aber nur mit gültiger Signatur des konfigurierten
Schlüssels — geprüft mit derselben Funktion wie jeder Zettel.

**Die Papiere.** `docs/MODERATION_UND_RECHT.md` neu. Im Impressum standen zwei
Sätze, die nicht mehr stimmten — beide berichtigt, siehe unten.

---

## Die zwei echten Fehler, die die Gegenprobe gefunden hat

Das ist der Teil, den du kennen musst, weil er sich wiederholen wird.

**1. Eine behauptete Zahl statt einer gemessenen.** Der Melde-Weg schickte
`fp_elapsed: Math.max(1700, …)`. Der Dienst wirft alles weg, was schneller als
1,5 s ausgefüllt wurde — mit `Math.max` hätte der Client ihm 1700 ms gemeldet,
auch wenn 200 vergangen waren, und damit seinen Bot-Riegel von unserer Seite
ausgehebelt. Aufgefallen ist es nur, weil die Gegenprobe die Wartezeit ausbaute
und die Prüfung **trotzdem grün blieb**: die Zahl war ohnehin gelogen, also
konnte kein Wächter etwas merken.

**2. Der Service-Worker fror die Sperr-Liste ein.** `sw.js` ist cache-first für
alles Gleich-Ursprüngliche. Die nachgeladene Liste wäre **einmal** geholt und
dann bis zur nächsten Auslieferung aus dem Vorrat bedient worden. Klaus sperrt
etwas, und die installierten Kimboards sähen es nie. Eine Moderations-Liste, die
veraltet ausgeliefert wird, ist schlimmer als keine — sie sieht aus, als wirke
sie. Jetzt netz-zuerst, Cache nur offline.

Gefunden hat das **keine** Überlegung, sondern eine Probe, die sprunghaft rot
wurde und deren Fehler wanderten. Das sah zuerst wie Zufall aus. Es war keiner.

> **Die Regel daraus:** Eine Prüfung wird nicht sprunghaft, sie hat eine
> Ursache. Und: was du dem Gegenüber über dich selbst meldest, muss gemessen
> sein, nicht behauptet — sonst prüft niemand mehr etwas, auch du nicht.

---

## Schritt 0 — offen, und Strang A hängt daran

Aus der Sitzungs-Umgebung ist der Server **nicht** erreichbar (belegt erneut am
2026-08-17: `CONNECT tunnel failed, response 403`). Beide Namen lösen auf
denselben Rechner auf:

```
167.233.204.72   relay.family-projekt.de
167.233.204.72   relay.pwa-toolpoint.de
```

Klaus hat **einen** kopierfertigen Befehl bekommen (er gehört auf den
**Hetzner-Server**, nicht aufs Tablet). Die Antwort lag bei Sitzungsende noch
nicht vor. Falls du sie hast, steht sie oben in Klaus' Nachricht; falls nicht,
frag danach, **bevor** du Strang A anfässt:

```
ssh root@167.233.204.72 'echo "== 1 CONTAINER =="; docker ps -a --format "{{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}"; echo; echo "== 2 SPEICHER =="; for c in $(docker ps -q); do docker inspect -f "{{.Name}}{{range .Mounts}} [{{.Source}} -> {{.Destination}}]{{end}}" $c; done; echo; echo "== 3 DATEIEN =="; ls -la /opt/relay/; find /opt/relay -maxdepth 4 \( -name "*.db" -o -name "*.toml" \) -printf "%p  %s B  %TY-%Tm-%Td\n" 2>/dev/null; echo; echo "== 4 STECKBRIEF family =="; curl -s -m 8 -H "Accept: application/nostr+json" https://relay.family-projekt.de/; echo; echo; echo "== 5 STECKBRIEF toolpoint =="; curl -s -m 8 -H "Accept: application/nostr+json" https://relay.pwa-toolpoint.de/; echo; echo; echo "== 6 CADDY =="; grep -nE "relay|reverse_proxy" /opt/relay/Caddyfile'
```

Abschnitt 4 und 5 sind der Kern: die Relais-Software beantwortet dort selbst,
wie sie heißt, welche Fassung sie hat und **welche NIPs sie kann**. Steht `9` in
der Liste, befolgt sie Lösch-Meldungen. Sind beide Antworten gleich, ist es
**ein** Relais mit zwei Namen.

**Ein Eingriff in den Relais-Speicher ist schwer umkehrbar.** Ergibt Schritt 0
etwas anderes als erwartet (`nostr-rs-relay`, SQLite, log-frei), **frag Klaus**,
bevor du baust. Das ist echtes Zweifeln im Sinne des Freibriefs.

---

## Was als Nächstes ansteht

1. **Strang A — der Server-Wächter.** Ein kleiner Dienst auf dem Hetzner-Server,
   der in festem Takt `sbkim/sperrliste.json` aus dem Repo liest und die
   genannten Ereignisse aus dem Relais-Speicher entfernt. Muster: der
   2-Minuten-Cron aus dem Skill `auto-deploy-einrichten` — der Server zieht sich,
   was im Repo steht; nur die Nutzlast ist neu. Kein zweites Bedienfeld, kein
   zweiter Ort der Wahrheit. **Setzt Schritt 0 voraus.**
2. **Das Werkzeug zum Signieren der nachgeladenen Liste.** Solange es fehlt,
   steht `pruefschluessel` in `assets/config/moderation.js` auf `null` und es
   wird **nichts** nachgeladen — sichtbar abgeschaltet statt still wirkungslos.
   Offene Frage an Klaus, die ich bewusst nicht geraten habe: **welcher
   Schlüssel signiert?** Seine Kimboard-Identität, oder ein eigener nur dafür?
   Eine Identität, die sowohl Zettel schreibt als auch Sperren unterschreibt,
   vermischt zwei Rollen.
3. **Prüf-Auftrag an `family-project/impressum.html`, Punkt 5.** Dort steht
   „Netz-Inhalte sind Ende-zu-Ende verschlüsselt." Das trifft auf
   Direktnachrichten (`modules/dm_crypto.js`) und Gruppen zu; das **offene
   Brett** läuft im Klartext über dasselbe Relais. Die Aussage ist damit
   möglicherweise zu weit gefasst. **Erst belegen, dann formulieren** — eigene
   Entscheidung, eigener PR, anderes Repo.
4. **Aus dem alten Brief noch offen:** der Zwei-Geräte-Lauf mit einer Gruppe
   (nur Klaus), die Platzhalter-Stunde und die acht Sekunden für „Rückgängig"
   (beide geraten, nicht gemessen), und die Frage, ob `relay.nostr.band` — ein
   Archiv- und **Suchdienst** — in den Voreinstellungs-Fünf stehen sollte.

---

## Prüfen

```bash
npm install --no-save playwright-core     # einmalig je Container
node tests/alle.mjs                       # ALLES — 27 Prüfungen (~8 Min)
node tests/alle.mjs sperr                 # nur die Sperr-Liste
bash tests/gegenprobe_moderation.sh       # 17 eingebaute Fehler, jeder MUSS fangen
```

Zuletzt gemessen: **alle 27 grün**, Gegenprobe **17 von 17 gefangen**.

**`npm test` ist nicht „die Prüfung"** — es fasst die Proben unter `tests/`
nicht an. Und **`| tail` ist zum Lesen da, nicht zum Urteilen**: über grün
entscheidet nur der eigene Rückgabewert.

**Warte auf die Bedingung, nie auf die Uhr.** Die neuen Proben tun das
durchgehend (`waitForFunction` statt `waitForTimeout`). Zwei Stellen, an denen
das hier konkret zählte: die Nachlade-Kette (`window.__kb`) und der
Service-Worker (`navigator.serviceWorker.controller`) — ohne die zweite hätte
der SW-Abschnitt gar nicht den Fall geprüft, den er meint, und wäre **stumm**
statt falsch gewesen.

### Zwei Dinge, die dir sonst Zeit kosten

- **`page.route` fängt keine Abrufe ab, die aus einem Service-Worker kommen.**
  Deshalb laufen die geleiteten Fälle in `smoke_sperrliste.mjs` mit
  `serviceWorkers: 'block'`; sein Verhalten prüft ein eigener Abschnitt mit
  wachem SW und einer echten Datei, die sich zwischen zwei Abrufen ändert.
- **`assets/hilfe.js` erzwingt einen Eintrag nur für Elemente mit `id`.** Knöpfe
  mit reiner Klasse (`.q-melden`) fängt die Vollständigkeits-Prüfung nicht —
  dort braucht es einen eigenen Wächter, und den gibt es jetzt.

---

## Was nur Klaus prüfen kann

Alles Folgende ist **headless grün, am Tablet ungeprüft**:

- Ob ⚑ und ✕ am Handy nebeneinander gut treffbar sind. Gemessen ist es (frei
  treffbar, gleich groß, in einer Spalte, Kopftext läuft nicht darunter durch) —
  ob es sich gut *anfühlt*, ist etwas anderes.
- Ob eine echte Meldung wirklich in `info@family-projekt.de` ankommt. Headless
  ist nur bewiesen, dass der richtige Aufruf mit dem richtigen Inhalt rausgeht.
- Wie sich das Melde-Fenster auf einem schmalen Schirm liest.

Nach dem Merge: **Hard-Reload** (Strg+Shift+R bzw. der ⟳-Knopf), sonst liefert
der Service-Worker die alte Fassung. `CACHE_VERSION` steht auf `kimboard-v58`.

---

## Arbeitsweise (Klaus)

- **Antworten auf Deutsch**, ruhig und präzise. Klaus ist kein Programmierer,
  lernt aber gern. **Einzelschritte** mit klarem Erfolgsmerkmal. Keine
  Terminal-Befehle für ihn — die einzige Ausnahme ist der `ssh`-Einzeiler oben,
  und der ist genau einer.
- **Selbst-Merge-Freibrief gilt** (netzweit, Klaus 2026-06-28): eigene PRs
  selbstständig mergen, sobald getestet, abgegrenzt und nicht architektonisch
  zweifelhaft. Bei echtem Zweifel erst fragen.
- **Branch frisch von `origin/main`**, Push mit ausdrücklicher Refspec, danach
  `git diff --stat origin/main origin/<branch>` — ein leerer PR lässt sich
  mergen und meldet Erfolg.
- **`CACHE_VERSION` erhöhen**, sobald eine Schalen-Datei sich ändert.
- **Ehrlichkeit vor Fertig-Meldung.** Bei diesem Thema doppelt: ein Versprechen
  „endgültig gelöscht", das nur für ein Relais gilt, wäre schlimmer als gar
  keins.

---

## Kurz-Karte: wo was liegt

| Thema | Fundstelle |
|---|---|
| Melde-Knopf, Fenster, Absende-Weg | `index.html`: `meldeKnopf`, `openMeldeDialog`, `sendeMeldung` |
| Melde-/Sperr-Konfiguration (Forker ändern hier) | `assets/config/moderation.js` |
| Die Sperr-Liste selbst | `assets/config/sperrliste.js` |
| Anwenden · Nachladen · Nachwischen | `index.html`: `istNetzGesperrt`, `ladeSperrQuelle`, `wischeGesperrte` |
| Netz-zuerst für die Liste | `sw.js` (sonst friert sie ein) |
| Heim-Relais · Senden/Lesen-Trennung | `index.html`: `HOME_RELAY`, `sendSockets()` vs. `liveSockets()` |
| Zurückziehen (NIP-09) | `index.html`: `zurueckziehenFuerAlle`, `handleDeletion` |
| Ausblenden · Stummschalten | `index.html`: `hideQuestion`, `sperreAbsender`, `openAusgeblendet` |
| Erklär-Blasen | `assets/hilfe.js` — Klassen-Knöpfe fängt die Prüfung NICHT |
| Einordnung + Rechtslage | `docs/MODERATION_UND_RECHT.md` |
| Proben · Gegenprobe | `tests/smoke_melden.mjs`, `tests/smoke_sperrliste.mjs`, `tests/gegenprobe_moderation.sh` |

---

## Abschluss-Befehl für die nächste Sitzung

Diese Kette reißt nie ab. Am Ende der Sitzung:

1. Diesen Brief fortschreiben — Stand, was gebaut, was offen, was als Nächstes.
2. Den vollständigen Brief **als Codeblock in die Chat-Antwort** ausgeben.
   Klaus' Tab ist der Einstiegspunkt, nicht der Dateibrowser.
3. Einen „Nächste Schritte"-Block mit 2–4 priorisierten Punkten, je ein Satz
   Begründung.
4. Ehrlich vermerken, was **nur Klaus am Tablet** prüfen kann.
