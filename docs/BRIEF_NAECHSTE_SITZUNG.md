# Brief an die nächste Sitzung — Kimboard / „Löschen"

**Stand: 2026-08-18, Ende der Sitzung „Relais-Wache + Pinnwand".**
`main` = `3dd1e9a` (Kimboard) · `29afbf5` (Sage-Protokol).

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
| **Scharfer Gang** `SCHARF=ja` | ✅ 38 Proben · Gegenprobe 23/23 |
| **Pinnwand** liest dieselbe Liste (Sage-Protokol) | ✅ 30 Proben |
| Ein Lauf gegen die **echte** Datenbank auf dem Server | ⬜ **das fehlt als Erstes** |
| Die anderen 20 Apps (Anzeige-Filter) | ⬜ Richtungsentscheid für Klaus |

Der Weg über NIP-86 ist **belegt tot** — weder `nostr-rs-relay` (Klaus' Server)
noch `strfry` (`relay.damus.io`) meldet die 86. Es bleibt der Server-Gang, und
der steht jetzt in beiden Gängen.

---

## 1. Der nächste Schritt — drei Befehle, ungefährlich

Das Werkzeug ist **nie gegen `/opt/relay/db/nostr.db` gelaufen**. Es misst gegen
echte SQLite-Datenbanken im richtigen Zuschnitt (BLOB **und** Text), aber die
echte hat es noch nie gesehen. Der erste Aufruf **liest nur**:

```bash
# alle drei vom Tablet aus, in Termux:
ssh root@167.233.204.72 'bash -s' < tools/relais-wache.sh
# erwartet: „Betroffen sind 1 von ~1623"

ssh root@167.233.204.72 'SCHARF=ja bash -s' < tools/relais-wache.sh
# sichert zuerst, entfernt dann, rechnet nach

ssh root@167.233.204.72 'bash -s' < tools/relais-wache.sh
# erwartet: „Betroffen sind 0 von ~1622"
```

**Der dritte Aufruf ist der eigentliche Beweis:** was weg ist, findet der
Nachsehen-Gang nicht mehr. Erst danach ist die Kette von der Oberfläche bis in
den Speicher belegt statt geglaubt.

Meldet der erste Aufruf **0 statt 1**, ist das ein Befund und kein Grund
weiterzumachen: dann liest das Werkzeug die Liste nicht, die es lesen soll.

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

## Wie geprüft wird

```bash
# Kimboard
npm install --no-save playwright-core   # einmalig je Container
node tests/alle.mjs                     # ALLES (~5 Min) — 30 Prüfungen
bash tests/gegenprobe_wache.sh          # 23 eingebaute Fehler, Sekunden
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
