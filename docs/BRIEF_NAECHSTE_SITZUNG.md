# Brief an die nächste Sitzung — Kimboard / „Löschen"

**Stand: 2026-08-19, Ende der Sitzung „Relais-Wache + Pinnwand + erster echter
Lauf + Server-Pflege + Relais-Grenzen".**
`main` = `c22455b` (Kimboard) · `29afbf5` (Sage-Protokol).

Lies zuerst diesen Brief, dann `CLAUDE.md`, dann `docs/MODERATION_UND_RECHT.md`.
Danach nur den Code-Bereich, an dem du arbeitest — `index.html` ist groß, lies
gezielt mit Grep.

---

## Was steht

| Stück | Stand |
|---|---|
| Melde-Weg ⚑ (Art. 16 DSA) | ✅ |
| Sperr-Liste, eingebacken **und** signiert nachgeladen | ✅ · `pruefschluessel` gesetzt, **live** |
| Studio 🔧 (sperren · Liste signieren · Schlüssel sichern) | ✅ |
| **Erste echte Sperre** im Repo | ✅ `701a5834…` (Testsperrung) |
| **Nachsehen-Gang** `tools/relais-wache.sh` | ✅ 41 Proben |
| **Scharfer Gang** `SCHARF=ja` | ✅ 38 Proben · Gegenprobe 24/24 |
| **Pinnwand** liest dieselbe Liste (Sage-Protokol) | ✅ 30 Proben |
| Ein Lauf gegen die **echte** Datenbank auf dem Server | ✅ **2026-08-19 gelaufen** — 1 von 1624 → entfernt → 0 von 1623 |
| **Relais-Grenzen** `tools/relais-grenzen.sh` (Flut-Bremse · Zukunfts-Riegel) | ✅ 29 Proben · **am 2026-08-19 gesetzt** · Schreiben gegengeprüft |
| Server: Updates · Neustart · Rechte an `/opt/relay/db` · Sicherung weg | ✅ alles 2026-08-19 |
| Die anderen 20 Apps (Anzeige-Filter) | ⬜ Richtungsentscheid für Klaus |

Der Weg über NIP-86 ist **belegt tot** — weder `nostr-rs-relay` (Klaus' Server)
noch `strfry` (`relay.damus.io`) meldet die 86. Es bleibt der Server-Gang, und
der steht jetzt in beiden Gängen.

---

## 1. ✅ ERLEDIGT — die Kette ist am echten Relais belegt (2026-08-19)

Klaus hat sie per Termux durchgespielt. Damit ist das Vorhaben „Löschen"
geschlossen:

| Lauf | Ergebnis |
|---|---|
| Nachsehen | `Betroffen sind 1 von 1624` · Schema selbst erkannt (`event_hash` BLOB) · **beide** Listen gelesen, der Eintrag kam aus der signierten |
| Entfernen | Sicherung `nostr.db.sicherung-20260819-042201.db` (1624 Ereignisse) · `vorher 1624 · betroffen 1 · nachher 1623 (erwartet 1623)` |
| Nachsehen | `Betroffen sind 0 von 1623` · `· 701a5834… nicht im Speicher` |

**Der dritte Lauf ist der Beweis:** was weg ist, findet das Werkzeug nicht mehr.
Das kann es nur sagen, weil es nach der **Kennung** greift statt nach dem
Brett-Tag — deshalb deckt es auch den Verkehr der anderen Apps ab.

**Die Sicherung liegt noch dort** (26 MB, neben der Datenbank). Klaus nimmt sie
weg, wenn er zufrieden ist. Das Werkzeug räumt sie nicht auf — das wäre der
eine Griff, der sich nicht zurücknehmen lässt.

**Was dieser Lauf ans Licht gebracht hat** — der wichtigste Fund des Tages:
`${LISTE_JSON:-vorgabe}` setzt die Vorgabe **auch bei leerem Wert** ein. Die
Proben setzten `LISTE_JSON=''`, um die zweite Quelle stillzulegen, und holten in
Wahrheit weiter die echte Liste von GitHub. Solange die Datei auf `main` nicht
existierte, kam nichts zurück und alles war grün: **grün, weil ein Abruf ins
Leere lief, nicht weil die Abschaltung wirkte.** Seit `-` statt `:-` heißt leer
wirklich aus, und drei Prüfungen halten fest, dass keine Probe mehr unbemerkt
ins Netz greift.

**So wird es aufgerufen** — ohne eine Datei aufs Tablet zu holen:

```bash
ssh root@167.233.204.72 'curl -sSL -o /tmp/wache.sh https://raw.githubusercontent.com/lausiklauskn-png/Kimboard/main/tools/relais-wache.sh && bash /tmp/wache.sh'
ssh root@167.233.204.72 'SCHARF=ja bash /tmp/wache.sh'
```

Der Umweg über `< tools/relais-wache.sh` scheitert in Termux, sobald man nicht
im Kimboard-Ordner steht — und das ist der Normalfall. Der Server holt sich das
Skript deshalb selbst; das Repo ist öffentlich.

---

## 2. Was der scharfe Gang tut — und was er bewusst nicht tut

Vier Riegel, in dieser Reihenfolge:

1. **Sicherung per `VACUUM INTO`**, nicht abschaltbar. Trägt der Abzug nicht
   dieselbe Stückzahl, wird **nichts** entfernt.
2. **Entfernen in einer Transaktion**, Anhängsel (`tag`) zuerst.
3. **Nachrechnen:** vorher − betroffen = nachher · keine genannte Kennung
   geblieben · kein verwaistes Anhängsel. Sonst Rückgabewert 4 samt Befehl zum
   Zurückspielen.
4. **Die Sicherung bleibt liegen.** Das Werkzeug räumt sie nicht weg.

**Das Relais muss nicht anhalten** — gemessen (55 gleichzeitige Einfügungen,
kein Fehler, `integrity_check` ok). `STOPPEN=ja` bleibt freiwillig.

**Nicht gebaut, mit Absicht: ein Takt.** Der Gang läuft auf Zuruf. Ein Dienst,
der ungefragt löscht, braucht mehr Vertrauen als einer, den man aufruft — und
weil die Sperr-Liste **nur nach oben** geht, ist der Zuruf-Betrieb kein
Provisorium.

---

## 3. Die drei Fallen dieser Sitzung — sie kommen wieder

**Ein „ungültig" braucht denselben Argwohn wie ein „gültig".** Beim Prüfen der
signierten Liste meldete `schnorr.verify` **false**. Die Signatur war in
Ordnung — das Krypto-Modul erkennt seine Umgebung über `self`, das es in Node
nicht gibt, also warf jede Hash-Berechnung, und `verify` macht daraus
stillschweigend ein `false`. **Ein Urteil, das in Wahrheit „konnte gar nicht
rechnen" hieß.** Wer in Node prüft, setzt `globalThis.self` **vor** dem Import
und beweist mit einer Gegenprobe, dass der Prüfweg lebt.

**Der Umschlag ist nicht die Liste.** Der erste JSON-Leser der Relais-Wache nahm
„alles nach dem Wort `absender`" und fing damit die `id` des Ereignisses als
gesperrten **Absender** mit ein. Bei alphabetisch sortierten Feldern — was die
meisten JSON-Werkzeuge ausgeben — wäre es **Klaus' eigener Schlüssel** gewesen,
und ein scharfer Lauf hätte alles entfernt, was er je geschrieben hat. Abhilfe:
nur Kennungen greifen, hinter denen ein **Doppelpunkt** steht. Das trennt
Schlüssel von Werten, in beiden Schreibweisen.

**Eine Nachrechnung lässt sich nicht beweisen, solange nichts falsch ist.** Die
Gegenprobe baute sie aus, und alles blieb grün. Seitdem machen zwei Prüfungen
das Werkzeug an einer **gepatchten Kopie** absichtlich falsch und bestehen
darauf, dass es das bemerkt.

**`${X:-vorgabe}` greift auch bei LEEREM X.** Für „leer heißt aus" braucht es
`${X-vorgabe}` mit EINEM Bindestrich. Eine Probe, die still ins Netz greift,
misst irgendwann etwas anderes als das, was sie zu messen glaubt — und bleibt
so lange grün, wie der Abruf ins Leere läuft.

Dazu zweimal dieselbe alte Bekannte: **`indexOf` gibt −1 zurück, und −1 ist
kleiner als alles.** Eine Reihenfolge-Prüfung ohne vorherige Existenz-Prüfung
gibt recht, ohne etwas gemessen zu haben.

---

## 4. Was offen ist

**a) Die anderen 20 Apps zeigen ungefiltert an.** Gemessen: 21 Apps schreiben
aufs Relais. Drei Sorten freier Nutzertext landen dort — Gerätename (steht in
jeder Raum-Liste im ganzen Netz), Mycel-Frage, Antwort.

- **Fürs Löschen ist nichts nachzuziehen.** `relais-wache.sh` greift nach der
  Kennung und deckt damit alle Apps ab, Mycel-Anfragen (`sbkim-qry`)
  eingeschlossen. Das ist gemessen, nicht angenommen.
- **Fürs Anzeigen** wäre der saubere Ort `discover()` in Sages Modul 23, drei
  Zeilen neben dem vorhandenen Mengenschutz — einmal pflegen, byte-1:1 in 21
  Apps neu kopieren. **Das ist ein Richtungsentscheid für Klaus**, nicht für
  eine Sitzung: woher kommt die Liste, was gilt bei Ausfall, was kostet es die
  Offline-Tauglichkeit, und es ändert den Kanon in 21 Apps.
- Zur Größe der Lücke gehört die Wahrheit: nichts wird per `innerHTML`
  eingesetzt (geprüft) — es ist eine **Moderations**lücke, keine
  Sicherheitslücke.

**b) ✅ erledigt — `family-project/impressum.html`, Punkt 5.** Dort stand
„Netz-Inhalte sind Ende-zu-Ende verschlüsselt." Belegt: family-project hat gar
kein Verschlüsselungs-Modul, Visitenkarte und Mycel-Fragen gehen im Klartext.
Die Aussage stand an **acht** Stellen, eine davon als Überschrift auf
`netzwerk.html` — alle korrigiert (PR #284).

**c) ✅ erledigt — Server-Updates und Neustart.** 10 Pakete eingespielt, neu
gestartet, beide Container kamen von allein zurück (`unless-stopped`), 1623
Zettel unverändert. Zurückgehalten hat Ubuntu nur `grub-pc-bin` und
`grub2-common` wegen „phasing" — das ist der Bootloader, nichts wird erzwungen
(bleibt als Punkt 2 in der Stichtag-Liste stehen).

---

## 5. Relais-Grenzen — der billigere Hebel, gesetzt am 2026-08-19

Aus der Frage unter „Was offen ist" wurde beim Nachsehen ein Befund:
`/opt/relay/config.toml` hatte **weder** `[authorization]` **noch** `[limits]`.
Kein Schlüssel-Filter, keine Rate, keine Größenbeschränkung. Im Klartext: wer
`wss://relay.family-projekt.de` kannte, konnte beliebig viel hineinschreiben —
und die Adresse steht im öffentlichen Quelltext von 21 Apps. Die einzige Grenze
war die Festplatte.

`tools/relais-grenzen.sh` setzt deshalb **eine Stelle statt 21 Apps**:

| Wert | Warum genau der |
|---|---|
| `messages_per_sec = 5` | server-weit, über eine Minute gemittelt = 300/Minute. Das ganze Netz erzeugt eine Handvoll, ein Fluter Tausende. Die Vorlage von nostr-rs-relay nennt genau diese Zeile „highly recommended if your relay is public". |
| `subscriptions_per_min = 30` | Die Vorlage empfiehlt 10; hier 30, weil Klaus mehrere Apps in mehreren Tabs offen hat und das nicht in eigene Bremsspuren laufen soll. |
| `reject_future_seconds = 1800` | gegen Zettel, die sich mit falschem Datum oben festsetzen. **Vorher gemessen:** von 1623 Ereignissen lag **kein einziges** in der Zukunft, das neueste 167 467 Sekunden dahinter, Server-Uhr per NTP synchron. |

**Zur Zeitzonen-Frage, die Klaus gestellt hat:** Nostr-Zeitstempel sind
Unix-Sekunden in UTC — eine **Zahl ohne Zone**. Eine Zeitzone kann daran nichts
verstellen; nur eine wirklich falsch gehende Geräte-Uhr könnte es, und die gab
es hier nie.

**Bewusst NICHT gesetzt** — und das steht auch im Skript, damit es niemand
„nachholt": `limit_scrapers` (die Modul-23-Abfragen tragen alle einen Tag-Filter
und wären sicher, aber es wurde **nicht** jede Abfrage in 21 Apps geprüft),
`max_event_bytes` (steht schon auf 128 KB; kleiner schnitte Bilder auf der
Pinnwand ab) und `pubkey_whitelist` (verbäte Fremden das Andocken und machte
genau das kaputt, wofür dieses Relais da ist).

**Klaus' zweite Frage — Schlüssel-Liste vorbauen, ohne sie zu aktivieren?** Ja,
und genau so steht sie jetzt in der Konfig: ein vollständiger, **auskommentierter**
`[authorization]`-Block mit Liste, `nip42_auth` und `nip42_dms`, daneben die
Begründung, dass er an ein **zweites, eigenes** Relais gehört und nicht hierher.
`smoke_relais_grenzen.mjs` prüft beides gegeneinander: der Block **steht in der
Datei**, und der TOML-Leser **sieht ihn nicht**. Stünde er aktiv drin, wäre das
öffentliche Relais ab sofort für alle Fremden dicht.
Wichtig dabei: die Liste allein hält Fremde vom **Schreiben** ab, nicht vom
**Lesen** — „kein Fremder kommt rein" braucht zusätzlich `nip42_auth`.

**Das Skript ist wiederholbar.** Läuft es zweimal, merkt es das und fasst nichts
an: ein zweiter `[limits]`-Abschnitt wäre kaputtes TOML und das Relais käme nicht
mehr hoch. Es sichert vorher, prüft nachher gegen die öffentliche Adresse und
nimmt sich bei einem Fehlschlag selbst zurück. Die Probe liest das Ergebnis als
**echtes TOML** (`tomllib`), nicht als Zeichenkette.

**Lauf am 2026-08-19:** Sicherung `config.toml.bak-20260819-155344`, angehängt,
neu gestartet, Relais antwortet, 1623 Zettel unverändert.

**Gegenprobe — und das war der Punkt.** Das Skript sagt selbst: *„NOCH NICHT
BEWIESEN: dass Schreiben weiterhin geht. Eine Grenze, die man nicht
gegengeprüft hat, ist auch nur eine Behauptung."* Klaus hat danach in Kimboard
einen Zettel „Test 19.08." geschrieben — er **erscheint** auf dem Brett,
17:58:04, `via relay.family-projekt.de`. Damit ist beides belegt: die Grenze
steht, und sie bremst den normalen Betrieb nicht.

**Und eine Lehre aus dem Bau:** die erste Probe prüfte, ob das Skript bei
schreibgeschützter Konfig abbricht. Sie schlug fehl — zu Recht: das Skript läuft
auf dem Server als `root`, und `root` darf immer schreiben. Der Riegel kann dort
**nie** greifen. Eine Probe, die einen Fall misst, den es in der echten Umgebung
nicht gibt, bewacht nichts. Geprüft wird jetzt der Fall, der wirklich vorkommt:
falscher Pfad.

---

## ⏰ Kleinigkeiten mit Stichtag — bitte ab **2026-09-02** ansprechen

Klaus am 2026-08-19: *„merke dir das, was noch ist, erinnere mich nach
gegebener Zeit — nach zwei oder drei Sitzungen."*

**Sitzungen lassen sich nicht zählen** — eine neue Sitzung weiß nicht, die
wievielte sie ist. Das Datum kennt sie. Deshalb steht hier ein Stichtag statt
einer Anzahl.

**Was eine Sitzung damit tut:** ist heute **der 2026-09-02 oder später** und
steht hier noch etwas offen, dann sprich Klaus **von dir aus** darauf an — kurz,
in einem Absatz, ohne Drängen. Er hat ausdrücklich darum gebeten. Ist ein Punkt
erledigt, streiche ihn hier und lass die Liste schrumpfen. Ist sie leer, kommt
der ganze Abschnitt weg.

**Nichts davon eilt.** Keiner dieser Punkte gefährdet etwas; sie sind nur zu
schade zum Vergessen.

| # | Was | Wo | Warum es liegen blieb |
|---|---|---|---|
| ~~1~~ | ~~Die **26-MB-Sicherung** löschen~~ | Server | ✅ **erledigt 2026-08-19**. `nostr.db.sicherung-20260819-042201.db` ist weg, 32 G frei. Klaus war zufrieden — der dritte Lauf hatte belegt, dass der Zettel wirklich fort ist. |
| 2 | **`grub-pc-bin` + `grub2-common`** nachziehen | Server | Am 2026-08-19 von Ubuntu wegen „phasing" zurückgehalten. Kommen von allein — hier steht nur, dass jemand nachsehen soll, ob sie durch sind. Grub ist der Bootloader; nichts erzwingen. |
| ~~3~~ | ~~`/opt/relay/db` steht auf `0777`~~ | Server | ✅ **erledigt 2026-08-19**. Erst gemessen, dann angefasst — und gut so: der Ordner gehörte `root`, die Datenbank aber der Kennung 1000, unter der der Container läuft. `chmod 755` allein hätte dem Relais das Schreibrecht genommen. Richtig war `chown 1000:1000` **und** `chmod 755`; danach Schreibprobe im Container, Relais lebt, 1623 Zettel unverändert. |
| ~~4~~ | ~~`family-project/impressum.html`, Punkt 5~~ | — | ✅ **erledigt 2026-08-19** (family-project PR #284). Belegt: family-project hat gar kein Verschlüsselungs-Modul; Visitenkarte und Mycel-Fragen gehen im Klartext. Die Aussage stand an **acht** Stellen, darunter als Überschrift auf `netzwerk.html` — alle korrigiert. |
| 5 | **Anzeige-Filter für die anderen 20 Apps** | Sage, Modul 23 | Bewusst vertagt (Klaus 2026-08-19) — heute gäbe es nichts zu filtern, auf dem Relais liegen nur Klaus' eigene Testfragen. **Die Vorfrage ist beantwortet:** das Relais nahm Zettel von jedem an — `config.toml` hatte weder `[authorization]` noch `[limits]`, die einzige Grenze war die Festplatte. Der billigere Hebel ist deshalb **gesetzt** (siehe § Relais-Grenzen): eine Stelle statt 21 Apps. Der Anzeige-Filter bleibt offen für den Tag, an dem zum ersten Mal jemand Fremdes schreibt. |

---

## Wie geprüft wird

```bash
# Kimboard
npm install --no-save playwright-core   # einmalig je Container
node tests/alle.mjs                     # ALLES (~5 Min) — 30 Prüfungen
bash tests/gegenprobe_wache.sh          # 24 eingebaute Fehler, Sekunden
bash tests/gegenprobe_moderation.sh     # 40 eingebaute Fehler
node tests/smoke_relais_grenzen.mjs     # 29 Prüfungen, ohne Docker und ohne Netz

# Sage-Protokol
npm install && node tests/run_alle.mjs  # 78 Proben
```

**`npm test` allein ist nicht „die Prüfung"** — es fasst die Proben unter
`tests/` nicht an. Und **`| tail` ist zum Lesen da, nicht zum Urteilen**:
hinter einer Pipe bekommst du den Rückgabewert von `tail`.

---

## Abschluss-Befehl

Am Ende: `CLAUDE.md` und `docs/MODERATION_UND_RECHT.md` fortschreiben, einen
neuen Brief nach diesem Muster anlegen und **vollständig als Codeblock im Chat**
ausgeben — Klaus liest zuerst den Chat, nicht den Dateibrowser. Dazu 2–4
priorisierte nächste Schritte, jeder mit einem Satz Begründung.
