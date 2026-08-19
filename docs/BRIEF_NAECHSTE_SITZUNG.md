# Brief an die nächste Sitzung — Kimboard / „Löschen"

**Stand: 2026-08-19, Ende der Sitzung „Relais-Wache + Pinnwand + erster echter Lauf".**
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

**b) `family-project/impressum.html`, Punkt 5.** Dort steht „Netz-Inhalte sind
Ende-zu-Ende verschlüsselt." Das trifft auf Direktnachrichten und Gruppen zu;
das **offene Brett** und die **Mycel-Fragen** laufen im Klartext über dasselbe
Relais. Eigener PR, erst belegen, dann formulieren.

**c) Der Server meldet „System restart required"** und 10 Updates (Stand
2026-08-18). Gehört Klaus gesagt, wenn ohnehin jemand per SSH dort ist.

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
| 1 | Die **26-MB-Sicherung** löschen: `/opt/relay/db/nostr.db.sicherung-20260819-042201.db` | Server | Klaus soll erst zufrieden sein. Das Werkzeug räumt sie mit Absicht nicht weg. |
| 2 | **`grub-pc-bin` + `grub2-common`** nachziehen | Server | Am 2026-08-19 von Ubuntu wegen „phasing" zurückgehalten. Kommen von allein — hier steht nur, dass jemand nachsehen soll, ob sie durch sind. Grub ist der Bootloader; nichts erzwingen. |
| 3 | **`/opt/relay/db` steht auf `0777`** | Server | Kein akutes Loch (nur `root` meldet sich an). ABER: erst **messen**, unter welcher Kennung der Container schreibt (`docker inspect relay -f '{{.Config.User}}'`), sonst nimmt man dem Relais das Schreibrecht. Eigener Tag, nicht neben einem Neustart. |
| 4 | **`family-project/impressum.html`, Punkt 5** | family-project | Dort steht „Netz-Inhalte sind Ende-zu-Ende verschlüsselt". Das trifft auf Direktnachrichten und Gruppen zu; das **offene Brett** und die **Mycel-Fragen** laufen im Klartext über dasselbe Relais. Erst belegen, dann formulieren, eigener PR. |
| 5 | **Anzeige-Filter für die anderen 20 Apps** | Sage, Modul 23 | Bewusst vertagt (Klaus 2026-08-19). Heute gäbe es nichts zu filtern — auf dem Relais liegen nur Klaus' eigene Testfragen. Wieder aufnehmen, sobald zum ersten Mal jemand anderes etwas hinschreibt. Vorher lohnt eine andere Frage mehr: **nimmt das Relais überhaupt Zettel von Fremden an?** (`/opt/relay/config.toml`) |

---

## Wie geprüft wird

```bash
# Kimboard
npm install --no-save playwright-core   # einmalig je Container
node tests/alle.mjs                     # ALLES (~5 Min) — 30 Prüfungen
bash tests/gegenprobe_wache.sh          # 24 eingebaute Fehler, Sekunden
bash tests/gegenprobe_moderation.sh     # 40 eingebaute Fehler

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
