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
npm test    # node --test
```
Zuletzt gemessen: **6 bestanden, 0 fehlgeschlagen**.

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
