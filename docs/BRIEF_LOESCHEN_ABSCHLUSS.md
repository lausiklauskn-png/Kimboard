# Brief an die nächste Sitzung — „Löschen" zu Ende bringen

**Stand: 2026-08-18, Ende der Sitzung „Nachsehen-Gang".**
`main` war beim Start `ef09768`.

Lies zuerst diesen Brief, dann `CLAUDE.md`, dann
`docs/MODERATION_UND_RECHT.md` § 6. Danach nur den Code-Bereich, an dem du
arbeitest.

---

## Wo das Vorhaben steht

| Stück | Stand |
|---|---|
| Melde-Weg ⚑ (Art. 16 DSA) | ✅ gebaut |
| Sperr-Liste (nimmt aus der **Anzeige**) | ✅ gebaut |
| Studio 🔧 (sperren, Liste signieren, Schlüssel sichern) | ✅ gebaut |
| Antwort auf „welche Relais-Software?" | ✅ gemessen: `nostr-rs-relay` 0.10.0, **kein NIP-86** |
| **Nachsehen-Gang** `tools/relais-wache.sh` | ✅ gebaut, 27 Proben + 11 Gegenproben |
| **Scharfer Gang** — wirklich aus dem Speicher nehmen | ⬜ **fehlt** |
| Erste echte Sperr-Liste + `pruefschluessel` | ⬜ fehlt |
| Die 20 Geschwister-Apps | ⬜ **Befund unten — Richtungsentscheid für Klaus** |

Der Weg über NIP-86 ist **belegt tot**: weder `nostr-rs-relay` (Klaus' Server,
per SSH gemessen) noch `strfry` (`relay.damus.io`, per Selbstauskunft gemessen)
meldet die 86. Es bleibt der kleine Dienst auf dem Server — und dessen
harmlose Hälfte steht jetzt.

---

## 1. Der scharfe Gang — was er braucht

`tools/relais-wache.sh` zählt heute richtig und fasst nichts an. Der zweite
Gang macht daraus ein Entfernen. **Er ist bewusst nicht mitgebaut worden**, und
die Gründe sind nicht Vorsicht um der Vorsicht willen:

1. **Eine Sicherung vor jedem Lauf, die nicht abschaltbar ist.** Am 2026-08-18
   hat Klaus 32 Testzettel von Hand entfernt; die Sicherung davor war der
   Grund, warum das ruhig ablaufen konnte.
2. **Der Nachweis, dass er nur die genannten Kennungen trifft.** Konkret als
   Probe: Zählung vorher − Treffer = Zählung nachher, und *jede* nicht genannte
   Kennung ist danach noch da. Das ist die Prüfung, die den Unterschied macht;
   alles andere ist Beiwerk.
3. **Verwaiste `tag`-Zeilen mit aufräumen.** Die Tabelle hängt an `event_id`.
   Beim Handlauf am 18. war das ein eigener Schritt.
4. **`docker stop relay` oder nicht?** SQLite läuft im WAL-Modus, der Dienst
   schreibt nebenher. Beim Handlauf war Anhalten der sichere Weg — für einen
   getakteten Dienst wäre es eine Unterbrechung alle paar Minuten. Das ist eine
   echte Abwägung, kein Selbstläufer: **erst messen**, ob ein Löschen im
   laufenden Betrieb sauber durchgeht (`PRAGMA busy_timeout`, eine Transaktion),
   dann entscheiden.
5. **Ein Takt.** Cron alle paar Minuten, oder auf Zuruf. Ein Dienst, der
   ungefragt löscht, braucht mehr Vertrauen als einer, den man aufruft — und
   Kimboards Sperr-Liste geht **nur nach oben**, was die Sache entschärft: was
   einmal weg ist, bleibt weg, auch wenn die Liste sich irrt.

**Reihenfolge:** erst 2. (die Probe), dann der Code. Nicht andersherum — sonst
hat man ein Werkzeug, dem man beim Löschen zusehen muss, statt eines, dem man
zusehen konnte.

---

## 2. Erst eine echte Liste, dann alles andere

`assets/config/sperrliste.js` ist **leer**, und `pruefschluessel` steht auf
`null`. Beides ist ehrlich (sichtbar abgeschaltet statt still wirkungslos), aber
solange es so ist, hat der scharfe Gang nichts zu tun und niemand hat den
Rundlauf je an echten Daten gesehen.

**Kleiner, lohnender Schritt:** Klaus sperrt im Studio einen belanglosen
eigenen Testzettel, checkt die erzeugte Liste ein, trägt seine Kennung als
`pruefschluessel` ein — und dann läuft der Nachsehen-Gang **einmal auf dem
Server** und sagt „1 von 1623". Das ist der Beweis, dass die Kette von der
Oberfläche bis in den Speicher trägt. Er kostet Minuten und ersetzt viel Raten.

---

## 3. Der netzweite Befund — nachgesehen, nicht vermutet

Klaus' Frage: *„gleichzeitig prüfen, ob Pinnwand und andere PWAs oder Werkzeuge,
die über das Relay schreiben, nachgezogen werden müssen."*

Gemessen am 2026-08-18 über alle 22 Klone im Behälter:

**21 Apps schreiben aufs Relais.** Alle bis auf `mycel-karte` und
`Kuechenzettel` fahren Modul 23 mit `announce` / `askNode` / `enableAnswering`,
und **alle** nennen `relay.family-projekt.de` — also Klaus' eigenen Server, mit
seiner Melde- und Abhilfepflicht.

Drei Sorten freier Text von Nutzern landen dort:

| Was | Woher | Wo es angezeigt wird |
|---|---|---|
| **Gerätename** | Feld im Verbinden-Panel, frei, 40 Zeichen | in *jeder* anderen App unter „Wer ist im Raum?" (`nodeName` = `"Kimboard · <Name>"`) |
| **Mycel-Frage** | Fragefeld, frei | beim antwortenden Knoten |
| **Antwort** | Auszüge aus dem eigenen Bestand | beim fragenden Knoten |

**Und jetzt die zwei Hälften der Antwort — sie fallen verschieden aus.**

### Fürs Löschen: nichts nachzuziehen ✅

`relais-wache.sh` greift nach der **Kennung**, nicht nach dem Brett-Kennzeichen.
Genau deshalb deckt er die Ereignisse **aller 21 Apps** mit ab — Präsenz-Karten
und Mycel-Anfragen inbegriffen (`tests/smoke_relais_wache.mjs` misst den
`sbkim-qry`-Fall ausdrücklich). Der scharfe Gang erbt das. **Hier ist nichts
nachzubauen, und das war der Grund für diese Bauart.**

### Fürs Anzeigen: eine echte Lücke ⬜

**Nur Kimboard liest eine Sperr-Liste.** Die anderen 20 zeigen Relais-Inhalte
ungefiltert. Ein Gerätename mit Hassrede stünde in jeder Raum-Liste im ganzen
Netz; ein gesperrter Zettel ist in Kimboard weg und beim Nachbarn noch da.

Zu Ehren der Wahrheit gehört dazu, wie **groß** die Lücke wirklich ist: kein
Text wird per `innerHTML` eingesetzt (alles `textContent`, geprüft) — es ist
also keine Sicherheitslücke, sondern eine Moderationslücke. Und die Raum-Liste
sieht nur, wer aktiv „Wer ist im Raum?" drückt.

**Der saubere Weg — eine Stelle, nicht zwanzig.** In
`Sage-Protokol/src/modules/23_rendezvous.js`, in `discover()`, steht bereits ein
Mengenschutz („Stufe 2b"), der Ereignisse still verwirft. Ein Sperr-Filter
gehört **genau dorthin**, drei Zeilen daneben:

```js
function onEvent(ev) {
  if (!ev || typeof ev.content !== "string") return;
  if (gesperrt(ev.id, ev.pubkey)) return;      // ← hier
```

Dann: **einmal in Sage pflegen, byte-1:1 in 21 Apps neu kopieren.** Die
Drift-Guards erzwingen das ohnehin — wer es in einer Kopie „schnell" macht,
wirft dort die Probe um, zu Recht.

**Was daran ein Richtungsentscheid für Klaus ist** (deshalb hier und nicht
gebaut):

- **Woher kommt die Liste?** Kimboards Liste liegt auf Kimboards Pages. Sollen
  20 Apps eine fremde App fragen? Oder gehört die Liste an eine neutrale Stelle
  (`family-projekt.de`, wo auch das Relais steht)?
- **Was, wenn sie nicht erreichbar ist?** Filtern-oder-nicht ist hier keine
  Kleinigkeit: eine Liste, die still ausfällt, sieht aus wie eine, die wirkt.
- **Kostet es die Offline-Tauglichkeit?** Alle Apps sind offline-first. Eine
  Pflicht-Abfrage beim Start wäre ein Rückschritt.
- **Es ändert den Kanon.** Modul 23 steckt in 21 Apps; eine Änderung dort ist
  die schwerste Sorte Änderung, die dieses Netz kennt.

**Vorschlag für die Reihenfolge**, falls Klaus zustimmt: erst der scharfe Gang
(dann ist wenigstens *weg* wirklich weg, netzweit, an einer Stelle) — **danach**
der Anzeige-Filter. Denn ein entferntes Ereignis braucht keinen Filter mehr,
umgekehrt gilt das nicht.

---

## 4. Kleinkram, der liegen bleibt

- **`family-project/impressum.html`, Punkt 5.** Dort steht „Netz-Inhalte sind
  Ende-zu-Ende verschlüsselt." Das trifft auf Direktnachrichten und Gruppen zu;
  das **offene Brett** und die **Mycel-Fragen** laufen im Klartext über dasselbe
  Relais. Eigener PR, erst belegen, dann formulieren.
- **Der Server meldet „System restart required"** und 10 Updates (Stand
  2026-08-18). Gehört Klaus gesagt, wenn ohnehin jemand per SSH dort ist.

---

## Wie geprüft wird

```bash
npm install --no-save playwright-core   # einmalig je Container
node tests/alle.mjs                     # ALLES (~5 Min) — 29 Prüfungen
bash tests/gegenprobe_wache.sh          # 11 eingebaute Fehler, in Sekunden
bash tests/gegenprobe_moderation.sh     # 40 eingebaute Fehler
```

**`npm test` allein ist nicht „die Prüfung"** — es fasst die Proben unter
`tests/` nicht an. Und `| tail` ist zum Lesen da, nicht zum Urteilen: hinter
einer Pipe bekommst du den Rückgabewert von `tail`.

**Und die Lehre dieser Sitzung, weil sie sich wiederholen wird:**
`smoke_relais_wache.mjs` war beim **ersten** Lauf grün, 23 von 23 — und eine
dieser 23 maß nichts. SQLite liest `x'ABCD'` von sich aus
schreibweise-unabhängig, die Probe kannte nur BLOB-Datenbanken, und damit war
die Groß/klein-Behandlung des Skripts gar nicht geprüft (der ganze Text-Zweig
ebenso wenig). Gefunden hat das die Gegenprobe, nicht die Probe.
**Eine Prüfung, die dir recht gibt, ist der Ort, an dem du am genauesten
hinsehen musst.**

---

## Abschluss-Befehl für die nächste Sitzung

Am Ende: `CLAUDE.md` und `docs/MODERATION_UND_RECHT.md` fortschreiben, einen
neuen Brief nach diesem Muster anlegen und **vollständig als Codeblock im Chat**
ausgeben — Klaus liest zuerst den Chat, nicht den Dateibrowser. Dazu 2–4
priorisierte nächste Schritte, jeder mit einem Satz Begründung.
