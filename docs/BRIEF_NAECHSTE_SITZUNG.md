# Brief an die nächste Sitzung — Kimboard / Moderation

**Stand: 2026-08-19, Ende der Sitzung „Relais-Wache · Relais-Grenzen ·
Server-Pflege · Melde-Weg der Pinnwand".**
`main` = `2257d18` (Kimboard) · `fa85267` (Sage-Protokol).

Lies zuerst diesen Brief, dann `CLAUDE.md`, dann `docs/MODERATION_UND_RECHT.md`.
Danach nur den Code-Bereich, an dem du arbeitest — `index.html` ist groß, lies
gezielt mit Grep.

> **Das Wichtigste vorweg: es drängt nichts.** Das Vorhaben „Löschen" ist
> geschlossen und am echten Relais belegt. Was unten unter „Was offen ist"
> steht, sind zwei Punkte, von denen einer sich von allein erledigt und der
> andere bewusst wartet. Wer diesen Brief liest und nichts Dringendes findet,
> hat ihn richtig gelesen.

---

## Was steht

| Stück | Stand |
|---|---|
| Melde-Weg ⚑ in **Kimboard** (Art. 16 DSA) | ✅ |
| Melde-Weg ⚑ in der **Pinnwand** | ✅ 2026-08-19 (Sage PR #892) |
| Sperr-Liste, eingebacken **und** signiert nachgeladen | ✅ · `pruefschluessel` gesetzt, live |
| **Pinnwand liest dieselbe Liste** | ✅ — ein Ort der Wahrheit, nicht zwei |
| Studio 🔧 (sperren · Liste signieren · Schlüssel sichern) | ✅ |
| **Nachsehen-Gang** `tools/relais-wache.sh` | ✅ |
| **Scharfer Gang** `SCHARF=ja` | ✅ |
| **Ein Lauf gegen die echte Datenbank** | ✅ 1 von 1624 → entfernt → 0 von 1623 |
| **Relais-Grenzen** `tools/relais-grenzen.sh` | ✅ gesetzt **und gegengeprüft** |
| Server: Updates · Neustart · Rechte · Sicherung weg | ✅ |
| Anzeige-Filter in den anderen 20 Apps | ⬜ Richtungsentscheid, bewusst vertagt |

---

## Was offen ist

**Genau zwei Punkte. Keiner davon eilt.**

**1. `grub-pc-bin` + `grub2-common` auf dem Server.** Am 2026-08-19 hat Ubuntu
sie wegen „phasing" zurückgehalten. Sie kommen von allein. Grub ist der
Bootloader — **nichts erzwingen**, nur gelegentlich nachsehen, ob sie durch
sind.

**2. Der Anzeige-Filter für die anderen 20 Apps.** Gemessen: 21 Apps schreiben
aufs Relais, drei Sorten freier Nutzertext landen dort (Gerätename, Mycel-Frage,
Antwort). Der saubere Ort wäre `discover()` in Sages Modul 23, drei Zeilen neben
dem vorhandenen Mengenschutz — einmal pflegen, byte-1:1 in 21 Apps neu kopieren.

**Das ist ein Richtungsentscheid für Klaus, nicht für eine Sitzung:** woher
kommt die Liste, was gilt bei Ausfall, was kostet es die Offline-Tauglichkeit —
und es ändert den Kanon in 21 Apps. Klaus hat ihn am 2026-08-19 **bewusst
vertagt**, und die Begründung trägt weiter: **heute gäbe es dort nichts zu
filtern.** Auf dem Relais liegen nur seine eigenen Testfragen. Wieder aufnehmen,
sobald zum ersten Mal jemand Fremdes etwas hinschreibt.

**Die Vorfrage dazu ist inzwischen beantwortet** — sie lautete: nimmt das Relais
überhaupt Zettel von Fremden an? Ja, und zwar völlig ungebremst: `config.toml`
hatte weder `[authorization]` noch `[limits]`. Der billigere Hebel ist deshalb
**gesetzt** (siehe unten): eine Stelle statt 21 Apps.

---

## Was NICHT offen ist, obwohl es so aussehen könnte

Damit die nächste Sitzung nicht doppelt arbeitet — jedes dieser Dinge ist
**gemessen**, nicht angenommen:

- **Fürs Löschen ist in den 20 Apps nichts nachzuziehen.** `relais-wache.sh`
  greift nach der **Kennung** statt nach dem Brett-Tag und deckt damit den
  Verkehr aller Apps ab, Mycel-Anfragen (`sbkim-qry`) eingeschlossen.
- **Die Pinnwand ist parallel.** Sperr-Liste und Melde-Weg sind dort seit dem
  2026-08-19 beide da. Gesperrt wird weiter **in Kimboard**.
- **Die Relais-Grenzen brauchen keine App-Änderung.** Nachgemessen: die
  Pinnwand öffnet **eine** Abfrage je Verbindung, Rückverbindung mit
  verdoppelter Wartezeit (2 s → 20 s, gedeckelt) — höchstens 5 in der ersten
  Minute gegen erlaubte 30.
- **NIP-86 ist belegt tot.** Weder `nostr-rs-relay` (Klaus' Server) noch
  `strfry` (`relay.damus.io`) meldet die 86. Es bleibt der Server-Gang.
- **Die Lücke in den 20 Apps ist eine Moderations-, keine Sicherheitslücke.**
  Nichts wird per `innerHTML` eingesetzt (geprüft).

---

## Die Relais-Grenzen — was gesetzt ist und was bewusst nicht

`tools/relais-grenzen.sh`, gelaufen am 2026-08-19:

| Wert | Warum genau der |
|---|---|
| `messages_per_sec = 5` | server-weit, über eine Minute gemittelt = 300/Minute. Das ganze Netz erzeugt eine Handvoll, ein Fluter Tausende. |
| `subscriptions_per_min = 30` | Die Vorlage empfiehlt 10; hier 30, weil mehrere Apps in mehreren Tabs offen sind. |
| `reject_future_seconds = 1800` | **Vorher gemessen:** von 1623 Ereignissen lag **kein einziges** in der Zukunft, Server-Uhr per NTP synchron. |

**Nostr-Zeitstempel sind Unix-Sekunden in UTC — eine Zahl ohne Zone.** Eine
Zeitzone kann daran nichts verstellen; nur eine wirklich falsch gehende
Geräte-Uhr könnte es.

**Bewusst nicht gesetzt:** `limit_scrapers` (die Modul-23-Abfragen tragen alle
einen Tag-Filter und wären sicher — aber es wurde **nicht** jede Abfrage in 21
Apps geprüft), `max_event_bytes` (steht schon auf 128 KB, kleiner schnitte
Bilder ab), `pubkey_whitelist` (verböte Fremden das Andocken und machte kaputt,
wofür dieses Relais da ist).

**Vorgebaut, aber nicht aktiv:** ein vollständiger, **auskommentierter**
`[authorization]`-Block für ein geschlossenes Betriebsnetz steht in der Konfig,
mit dem Hinweis, dass er an ein **zweites, eigenes** Relais gehört. Die Probe
prüft beides gegeneinander: er steht in der Datei, und der TOML-Leser sieht ihn
nicht. Merke: **die Schlüssel-Liste allein hält Fremde vom Schreiben ab, nicht
vom Lesen** — dafür braucht es zusätzlich `nip42_auth`.

**Gegengeprüft:** das Skript verlangt es selbst („eine Grenze, die man nicht
gegengeprüft hat, ist auch nur eine Behauptung"). Klaus hat danach einen Zettel
geschrieben — er erscheint, 17:58:04, `via relay.family-projekt.de`.

---

## Die Fallen — sie kommen wieder

Alle aus dieser und der letzten Sitzung, jede einmal wirklich zugeschnappt.

**Was man nicht messen kann, schreibt man fest.** Der Fehler
`Math.max(1700, …)` bei der Ausfüllzeit (er hebelt den Bot-Riegel des
Melde-Dienstes aus) lässt sich **nicht messen**, solange die Wartezeit dasteht:
echte und behauptete Zahl sind dann gleich. Gefährlich ist die **Kombination** —
nimmt später jemand die Wartezeit heraus, meldet die App eine Zahl, die sie nie
gemessen hat. Dagegen hilft nur ein Quelltext-Wächter.

**Gerechnete Maße sind keine gemessenen.** Zwei Knöpfe nebeneinander: `.q-del`
sagt kein `box-sizing`, eine allgemeine `button`-Regel legt Innenabstand dazu —
beide werden **32 px** breit statt der geschriebenen 24. Sie überlappten sich um
2 px, und ein Teil des Löschen-Kreuzes war nicht mehr zu treffen. Kein
Nachrechnen hat das gefunden; erst das Ausmessen im echten Chromium.

**Ein „ungültig" braucht denselben Argwohn wie ein „gültig".**
`schnorr.verify` meldete `false`, während die Signatur in Ordnung war: das
Krypto-Modul erkennt seine Umgebung über `self`, das es in Node nicht gibt, also
warf jede Hash-Berechnung — und `verify` macht daraus stillschweigend ein
`false`. Wer in Node prüft, setzt `globalThis.self` **vor** dem Import und
beweist mit einer Gegenprobe, dass der Prüfweg lebt.

**Der Umschlag ist nicht die Liste.** Ein JSON-Leser, der „alles nach dem Wort
`absender`" nimmt, fängt die `id` des Ereignisses als gesperrten **Absender**
mit ein. Bei alphabetisch sortierten Feldern wäre das **Klaus' eigener
Schlüssel** gewesen, und ein scharfer Lauf hätte alles entfernt, was er je
geschrieben hat. Abhilfe: nur Kennungen greifen, hinter denen ein
**Doppelpunkt** steht.

**`${X:-vorgabe}` greift auch bei LEEREM X.** Für „leer heißt aus" braucht es
`${X-vorgabe}` mit EINEM Bindestrich. Eine Probe, die still ins Netz greift,
bleibt so lange grün, wie der Abruf ins Leere läuft.

**`indexOf` gibt −1 zurück, und −1 ist kleiner als alles.** Eine
Reihenfolge-Prüfung ohne vorherige Existenz-Prüfung gibt recht, ohne etwas
gemessen zu haben.

**Eine Nachrechnung lässt sich nicht beweisen, solange nichts falsch ist.**
Deshalb machen zwei Prüfungen das Werkzeug an einer **gepatchten Kopie**
absichtlich falsch und bestehen darauf, dass es das bemerkt.

**Eine Gegenprobe verändert den Arbeitsbaum — währenddessen wird nicht
committet.** Am 2026-08-19 lief `gegenprobe_moderation.sh` im Hintergrund,
während der Brief committet wurde. Sie baut ihre Fehler in die **echten**
Dateien ein und nimmt sie danach wieder heraus; `git add -A` griff genau
dazwischen. Im Commit landete damit eine verbogene Betreiber-Kennung
(Großbuchstaben, ein Zeichen zu kurz) — **das hätte Klaus auf dem Tablet aus
seinem eigenen Studio ausgesperrt.** Gesehen habe ich es nur, weil ich nach dem
Pushen die Datei-Liste des Zweigs angesehen habe; im Commit selbst sah es aus
wie eine gewöhnliche Änderung.

Zwei Regeln daraus: **während eine Gegenprobe läuft, wird nichts committet**,
und ein `git status` **vor** dem `git add -A` ist billiger als jede Reparatur.
Und wer eine Gegenprobe abbricht, muss wissen: der `trap`, der aufräumt, feuert
dann **nicht** — hier blieben vier Dateien im Umbau-Zustand liegen und mussten
einzeln aus `origin/main` zurückgeholt werden.

**Und die Gegenprobe kann selbst falsch liegen.** Beim Melde-Weg der Pinnwand
blieb ein eingebauter Fehler ungefangen — der Eingriff hatte schlicht nichts
kaputtgemacht (`if (offen < 300)` wartete weiterhin `1700 - offen` ms). Wer das
nicht nachrechnet, hält einen gesunden Wächter für blind.

---

## ⏰ Kleinigkeiten mit Stichtag — ab **2026-09-02** von selbst ansprechen

Klaus am 2026-08-19: *„erinnere mich nach gegebener Zeit — nach zwei oder drei
Sitzungen."* **Sitzungen lassen sich nicht zählen**, das Datum schon.

**Was eine Sitzung damit tut:** ist heute der **2026-09-02 oder später** und
steht hier noch etwas, dann sprich Klaus **von dir aus** darauf an — kurz, ohne
Drängen. Ist ein Punkt erledigt, streiche ihn. Ist die Liste leer, kommt der
Abschnitt weg.

| # | Was | Stand |
|---|---|---|
| ~~1~~ | ~~26-MB-Sicherung löschen~~ | ✅ weg, 32 G frei |
| **2** | **`grub-pc-bin` + `grub2-common`** | ⬜ von Ubuntu wegen „phasing" zurückgehalten — kommt von allein, nichts erzwingen |
| ~~3~~ | ~~`/opt/relay/db` steht auf `0777`~~ | ✅ erst gemessen, dann angefasst: `chmod 755` **allein** hätte dem Relais das Schreibrecht genommen (Ordner `root`, Datenbank Kennung 1000). Richtig war `chown 1000:1000` **und** `chmod 755` |
| ~~4~~ | ~~E2E-Aussage in `family-project`~~ | ✅ an acht Stellen korrigiert (PR #284) |
| ~~5~~ | ~~Vorfrage: nimmt das Relais Fremde an?~~ | ✅ beantwortet — ja, ungebremst. Grenzen gesetzt. Der **Anzeige-Filter** bleibt offen (siehe „Was offen ist") |

---

## Wie geprüft wird

```bash
# Kimboard
npm install --no-save playwright-core   # einmalig je Container
node tests/alle.mjs                     # ALLES (~5 Min) — 31 Prüfungen
node tests/smoke_relais_grenzen.mjs     # 29, ohne Docker und ohne Netz
bash tests/gegenprobe_wache.sh          # 24 eingebaute Fehler
bash tests/gegenprobe_moderation.sh     # eingebaute Fehler, mit Browser

# Sage-Protokol
npm install && node tests/run_alle.mjs           # 80 Proben
bash tests/gegenprobe_pinnwand_melden.sh         # 26 eingebaute Fehler
```

**`npm test` allein ist nicht „die Prüfung"** — es fasst die Proben unter
`tests/` nicht an. Und **`| tail` ist zum Lesen da, nicht zum Urteilen**:
hinter einer Pipe bekommst du den Rückgabewert von `tail`.

**Der Server-Gang** (holt sich das Skript selbst, nichts aufs Tablet):

```bash
ssh root@167.233.204.72 'curl -sSL -o /tmp/wache.sh https://raw.githubusercontent.com/lausiklauskn-png/Kimboard/main/tools/relais-wache.sh && bash /tmp/wache.sh'
ssh root@167.233.204.72 'SCHARF=ja bash /tmp/wache.sh'
```

---

## Abschluss-Befehl

Am Ende: `CLAUDE.md` und `docs/MODERATION_UND_RECHT.md` fortschreiben, einen
neuen Brief nach diesem Muster anlegen und **vollständig als Codeblock im Chat**
ausgeben — Klaus liest zuerst den Chat, nicht den Dateibrowser. Dazu 2–4
priorisierte nächste Schritte, jeder mit einem Satz Begründung.

**Und wenn nichts Dringendes offen ist: das ehrlich sagen**, statt Arbeit zu
erfinden. Ein leerer Brief ist ein gutes Ergebnis.
