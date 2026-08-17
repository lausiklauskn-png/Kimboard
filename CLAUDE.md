# Kimboard — Sitzungs-Anker

**Kurz-Verfassung.** Ausführliches steht netzweit in **Sage-Protokol**; hier steht nur,
was eine Sitzung wissen muss, **bevor** sie hier etwas anfasst.

## Was dieses Repo ist

Die **semantische Pinnwand**: Fragen und Notizen an ein geborgtes „dummes Brett"
(Nostr) heften, geräteübergreifend, nach Bedeutung sortiert — als eigenständige PWA und
vollwertiger **SBKIM-Endknoten** (DB-Schublade `kimboard`), nach dem Kim-Bell-Muster.

## Pflicht vor jeder Arbeit — frisch von `origin/main`

Die Klone im Container können **Monate alt** sein. Eine Aussage über den Stand dieses
Repos ohne vorheriges `fetch` ist **kein Beweis**.

```bash
git fetch origin --quiet
git checkout -B <branch> origin/main
```

Beim Veröffentlichen mit ausdrücklicher Refspec pushen und **danach** prüfen, ob der
Branch gegenüber `main` überhaupt etwas trägt — ein leerer PR lässt sich mergen und
meldet Erfolg:

```bash
git push -u origin refs/heads/<branch>:refs/heads/<branch>
git diff --stat origin/main origin/<branch>     # leer = der PR wäre leer
```

## Prüfen

```bash
npm install --no-save playwright-core   # einmalig je Container
node tests/alle.mjs                     # ALLES — npm test + alle Browser-Suiten (~5 Min)
node tests/alle.mjs loeschen            # nur Suiten mit „loeschen" im Namen
npm test                                # NUR Drift-Guard + App-Schale (Millisekunden)
```

> ⚠️ **`npm test` ist nicht „die Prüfung".** Es läuft `node --test` und fasst die
> **26 Proben unter `tests/`** nicht an — darunter `smoke_loeschen.mjs`.
> **Nimm `node tests/alle.mjs`**, so steht es auch in der `README.md`.
>
> Diese Zeilen standen bis zum 2026-08-17 falsch hier: der Anker nannte nur
> `npm test` samt einer Zahl und sah dabei aus wie eine vollständige Auskunft.
> Genau die Falle, vor der Sages Tafel warnt — wer nur die Probe aufruft, die er
> kennt, merkt nie, dass die anderen nicht laufen. Beim ersten vollen Lauf war
> prompt eine Probe rot (`hilfe`), und zwar seit unbekannter Zeit.

**Warte auf die Bedingung, nie auf die Uhr.** `assets/hilfe.js` ist der letzte von
14 Einträgen der Nachlade-Kette in `index.html`, jedes Glied an
`requestIdleCallback` mit bis zu 500 ms Frist. `smoke_hilfe.mjs` wartete stur
1800 ms, verlor das Rennen und prüfte dadurch **gar nichts** — rot, aber aus dem
falschen Grund. Seit dem 2026-08-17 wartet sie auf `window.__hilfe`. Jedes
`waitForTimeout` mit einer runden Zahl ist ein Rennen, das irgendwann verloren
geht; verloren heißt hier nicht „falsch", sondern **stumm**.

**Und: `| tail` ist zum Lesen da, nicht zum Urteilen.** Der Läufer gibt bei Rot
korrekt `exit=1` zurück — hinter einer Pipe bekommst du den Rückgabewert von
`tail`.

## Was hier leicht kaputtgeht

- **Zwei Gerätenamen-Felder sind hier gewollt** (Klaus 2026-08-17, nachdem er sie
  gesehen hat): eines in der Seite unter „Meine Spore", eines oben im Verbinden-Panel.
  Beide tragen `data-sbkim-geraetename` und gleichen sich beim Tippen ab. **Nicht**
  eines davon „aufräumen".
- **`modules/23_rendezvous_ui.js`** ist byte-1:1 — app-eigener Code gehört in
  `assets/rendezvous-init.js`.
- **Das Brett kennt den `nick`-Tag:** gesendete Zettel tragen den Gerätenamen als
  additiven Nostr-Tag, die Absender-Anzeige ist **Kontakt-Name > `~nick` > Kennung** —
  und **immer mit Kennung**. Ein selbst gewählter Name ist ein Hinweis, kein
  Vertrauens-Beweis.
- **Cache-Bump:** `CACHE_VERSION` in `sw.js` (`kimboard-vNN`).
- **Klaus ist selbst Relais-Betreiber.** Gesendet wird standardmäßig nur aufs
  Heim-Relais (`HOME_RELAY = wss://relay.family-projekt.de`, „schmal senden, breit
  lesen"). Was dort liegt, liegt auf **seinem** Server — samt Melde- und
  Abhilfepflicht. Auf fremden Relais kann man dagegen nur **bitten**, nie
  durchsetzen. Wer daran baut, liest zuerst
  [`docs/MODERATION_UND_RECHT.md`](docs/MODERATION_UND_RECHT.md).

- **Die Sperr-Liste kennt nur eine Richtung.** `assets/config/sperrliste.js` wird mit
  `defer` im `<head>` geladen — sie muss dastehen, **bevor** der erste Zettel
  gezeichnet wird, sonst blitzt Gesperrtes kurz auf. Aus der Oberfläche geht es nur
  nach **oben** (sperren); gelöst wird eine Sperre **nur in der Datei**. Ein Fehlgriff
  beim Sperren fällt auf, einer beim Lösen wäre still. Auch der Test-Haken
  `__kb.sperrliste()` gibt nur **Kopien** heraus.

- **Die nachgeladene Liste darf der Service-Worker nicht einfrieren.** `sw.js` ist
  cache-first für alles Gleich-Ursprüngliche; für `*sperrliste*.json` gilt deshalb
  eine eigene Netz-zuerst-Regel. Ohne sie würde die Liste einmal geholt und bis zur
  nächsten Auslieferung aus dem Vorrat bedient — eine Moderations-Liste, die veraltet
  ausgeliefert wird, ist schlimmer als keine, weil sie aussieht, als wirke sie. Wer
  `quelle` in `assets/config/moderation.js` umbenennt, zieht die Regel mit;
  `smoke_sperrliste` vergleicht beide Stellen.

- **`assets/hilfe.js` erzwingt einen Eintrag nur für Elemente mit `id`.** Knöpfe, die
  über eine **Klasse** angesprochen werden (`.q-del`, `.q-melden`, `.kb-mute`), fängt
  die Vollständigkeits-Prüfung **nicht** — dort braucht es einen eigenen Wächter.

- **Gegenprobe:** `bash tests/gegenprobe_moderation.sh` baut 17 Fehler ein, jeder muss
  eine Probe umwerfen. Sie hat schon zwei echte Fehler gefunden, die keine Probe sah:
  eine **behauptete** statt gemessene Ausfüllzeit im Melde-Weg (hätte den Bot-Riegel
  des Dienstes ausgehebelt) und die eingefrorene Sperr-Liste oben.

## Selbst-Merge-Freibrief (Klaus 2026-06-28, netzweit für ALLE Repos)

Die Sitzung merget ihre **eigenen** PRs selbstständig nach `main`, sobald sie getestet,
abgegrenzt und nicht architektonisch zweifelhaft sind — **ohne** auf ein „X mergen" zu
warten (Draft-PR → ready → squash). **Nicht** bei echtem Zweifel (Richtungsentscheid,
schwer umkehrbar, mehrere gleich gute Wege) oder wenn Klaus vorher draufschauen will.
Klaus' Browser-Sichttest läuft **nach** dem Merge auf der Live-Seite — nicht darauf
warten, sondern mergen und ihn dann sehen lassen.

Jede selbst getroffene Entscheidung wird **dokumentiert** — Commit-Nachricht, PR-Text.
Selbstständig heißt nicht unsichtbar.

## Netzweite Regeln liegen in Sage

Verbindlich für alle Knoten: **[`Sage-Protokol/docs/INTERFACES.md`](https://github.com/lausiklauskn-png/Sage-Protokol/blob/main/docs/INTERFACES.md)**
— Andock-Konventionen §11, Briefkasten-Pflege §11.6, Gerätename §11.7.

**🏷️ Gerätename gehört ins Verbinden-Panel (§11.7):** wer ein Panel „Mit dem Netz
verbinden" hat, hat auch das Gerätenamen-Feld **darin**. Das Feld hängt der
**app-eigene Glue** hinein (`assets/rendezvous-init.js`) — **niemals** in eine byte-kopierte
Panel-Datei schreiben. Jedes Feld trägt `data-sbkim-geraetename`; der Name geht **nur**
an Anzeige und Anmeldung, **nie** an `generateOwnSpore` (kein Spore-Re-Sign).

## Ton

Klaus ist **kein Programmierer** (lernt gern): Antworten auf **Deutsch**, ruhig und
präzise, **Einzelschritte** mit klarem Erfolgsmerkmal. **Keine Terminal-Kommandos für
Klaus** — Bedien-Flüsse laufen über benannte Knöpfe in der Seite. Nach jedem Pull
Hard-Reload, Service-Worker und HTTP-Cache sind hartnäckig.

## Kein PII, keine Geheimnisse

Keine echten personenbezogenen Fremddaten in Commits, kein privater Schlüssel, kein
Passwort, kein Token im Repo. Klaus' eigenes Impressum/Copyright ist gewollt.
