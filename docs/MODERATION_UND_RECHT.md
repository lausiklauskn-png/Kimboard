# Hassrede, Löschen und Recht — was hier geht und was nicht

**Stand: 2026-08-17.** Nüchterne Einordnung, keine Rechtsberatung. Gleiche
Haltung wie [`Sage-Protokol/docs/URHEBERSCHAFT_UND_RECHTE.md`](https://github.com/lausiklauskn-png/Sage-Protokol/blob/main/docs/URHEBERSCHAFT_UND_RECHTE.md):
Fakten, Quellen mit Abrufdatum, und ein eigener Abschnitt über das, was
ehrlicherweise **nicht** geht.

Anlass war eine Frage von Klaus:

> *„Einhaltung von Gesetzen in Kimboard bezüglich Hassrede oder
> verurteilenswerter Aussagen im Board. Sie müssen endgültig vom Board genommen
> werden können, nicht vom Rechner, das geht glaube ich nicht. oder?"*

Die Vermutung stimmt zur Hälfte. Welche Hälfte, steht gleich hier.

---

## 1. Ein Zettel liegt nicht an einem Ort

Das ist der Kern, und ohne ihn ergibt nichts weiter Sinn. Ein Zettel auf dem
Brett liegt gleichzeitig

- auf **jedem Relais**, das ihn angenommen hat, und
- in **jedem Browser**, der ihn schon gelesen hat.

„Löschen" heißt deshalb je nach Ort etwas anderes:

| Ort | Was möglich ist | Wie endgültig |
|---|---|---|
| **Klaus' eigenes Relais** (`relay.family-projekt.de`) | wirklich aus dem Speicher entfernen | **endgültig**, dort |
| **Jedes Kimboard** | über die Sperr-Liste aus der Anzeige nehmen | wirksam sofort, aber der Zettel liegt weiter da |
| **Fremde Relais** (`nos.lol`, `damus.io`, `nostr.band` …) | bitten | **gar nicht** durchsetzbar |
| **Fremde Geräte**, die ihn schon gelesen haben | nichts | — |

Die dritte Zeile ist Klaus' Vermutung, und sie ist richtig.
[NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) (abgerufen
2026-08-17) sagt es selbst: Relais *sollen* eine Lösch-Meldung befolgen,
verpflichtet sind sie nicht. `relay.nostr.band` ist ausdrücklich ein **Archiv-
und Suchdienst**. Wer dort etwas hinschreibt, muss damit rechnen, dass es
bleibt.

Die erste Zeile ist die, die er nicht auf dem Schirm hatte: **er ist selbst
Relais-Betreiber.** Genau dort, wo ihn die Pflicht trifft, hat er auch die
Macht.

---

## 2. Warum „zurückziehen" gegen Hassrede nicht hilft

Kimboard kann seit Langem „bei allen löschen" — eine echte NIP-09-Meldung. Aber
**nur der Absender darf sie stellen**, und das ist richtig so: sonst könnte
jeder das Brett leerräumen.

Gegen **fremde** Hassrede ist NIP-09 damit überhaupt kein Werkzeug. Es ist für
„ich nehme meinen eigenen Zettel zurück" gebaut, nicht für „das gehört hier
nicht hin". Dafür gibt es seit dem 2026-08-17 zwei andere Wege — den Melde-Knopf
und die Sperr-Liste.

---

## 3. Was das Gesetz verlangt

Für alles, was auf Klaus' Server liegt, ist er **Hosting-Anbieter** im Sinne des
DSA. Daraus folgt:

- **Melde- und Abhilfeverfahren ist Pflicht**
  ([Art. 16 DSA](https://gesetz-digitale-dienste.de/dsa/artikel-16/), abgerufen
  2026-08-17): ein leicht zugänglicher Weg, über den jemand rechtswidrige
  Inhalte melden kann. Eingang bestätigen, zeitnah und begründet entscheiden,
  dem Melder das Ergebnis mitteilen, auf Rechtsbehelfe hinweisen.
- **Kein allgemeines Überwachungsgebot.** Er muss nicht suchen. Aber sobald er
  **weiß**, endet die Haftungsfreistellung — dann muss er handeln.
- **Kleinstunternehmen** sind von den *Transparenzberichten* befreit, nicht von
  der Sorgfaltspflicht.
- Was „Hassrede" konkret ist, steht nicht im DSA, sondern im Strafrecht:
  Volksverhetzung (§ 130 StGB), Verwenden von Kennzeichen verfassungswidriger
  Organisationen (§ 86a), Beleidigung (§ 185), Bedrohung (§ 241). Dieses Papier
  bewertet keinen Einzelfall — es beschreibt den Weg, auf dem gehandelt werden
  kann.

**Der Punkt, an dem beides zusammenkommt:** Die Pflicht trifft Klaus genau dort,
wo er auch handlungsfähig ist. Auf `nos.lol` ist er weder das eine noch das
andere.

---

## 4. Die drei Werkzeuge

### Melde-Knopf ⚑ (gebaut 2026-08-17)

An jedem Zettel und jeder Antwort, neben dem ✕. Öffnet ein kurzes Formular:
Grund wählen (Hassrede steht oben), optional ein Satz dazu, fertig. **Anonym
möglich** — wer etwas Gefährliches sieht, soll melden können, ohne sich
auszuweisen.

Die Meldung geht an denselben erprobten Dienst, den auch der
family-projekt.de-Marktplatz für seinen Melde-Knopf benutzt. Ohne diesen Dienst
fällt sie auf einen Mail-Vordruck zurück; ist gar nichts eingerichtet, sagt die
App das, statt still ins Nichts zu senden.

**Der beanstandete Text reist nicht mit.** Mitgeschickt werden nur die Kennung
des Zettels, die Kennung des Absenders und der Text des Melders. Den Inhalt holt
sich der Betreiber über die Kennung — ihn in die Meldung zu schreiben hieße, ihn
ein weiteres Mal zu verbreiten.

**Kein Automatismus.** Eine Meldung sperrt nichts von allein. Sie ist eine
Behauptung, kein Urteil, und ein automatischer Rauswurf wäre die einfachste
Angriffsfläche des ganzen Bretts: drei Meldungen, und jeder Zettel wäre weg.

### Sperr-Liste (gebaut 2026-08-17)

Eine Datei, zwei Wirkungen — ein Ort der Wahrheit statt zweier, die
auseinanderlaufen.

- **Die App** liest sie beim Start und zeigt Gesperrtes nicht mehr an. Das wirkt
  sofort und in **jedem** Kimboard, auch für Zettel, die auf fremden Relais
  liegen.
- **Ein Server-Wächter** soll dieselbe Liste lesen und entfernen, was auf Klaus'
  Relais liegt. *Dieser Teil ist noch nicht gebaut* — siehe § 6.

Gesperrt werden können einzelne Zettel und ganze Absender (Klaus 2026-08-17).
Ein gesperrter Zettel verschwindet **spurlos**: kein Platzhalter, kein Grund am
Brett. Bei Hassrede ist die stehengelassene Lücke samt Begründung schon die
halbe Verbreitung — sie lädt zum Nachfragen ein, was da wohl stand. Dass die App
überhaupt filtert, steht trotzdem offen im Fenster „👁 Ausgeblendet", mit Zahl.

Drei Eigenschaften, die keine Kür sind:

1. **Einbahnstraße.** Aus der Oberfläche geht es nur nach oben — sperren.
   Gelöst wird eine Sperre **nur in der Datei**. Ein Fehlgriff beim Sperren
   sperrt zu viel und fällt auf; ein Fehlgriff beim Lösen ist still. (Dieselbe
   Asymmetrie wie in
   [`PWA-Toolpoint/docs/RAUSWURF-REGEL.md`](https://github.com/lausiklauskn-png/PWA-Toolpoint/blob/main/docs/RAUSWURF-REGEL.md).)
2. **Fail-soft.** Ohne erreichbare Liste läuft die App voll weiter und zeigt
   eben alles. Wer sie nicht lädt, sieht keinen Fehler. Ein Forker kann sie
   abschalten oder durch die eigene ersetzen.
3. **Signiert, wenn nachgeladen.** Die eingebackene Liste ist Teil der App und
   so vertrauenswürdig wie diese. Eine **nachgeladene** Liste wird nur
   angenommen, wenn ihre Signatur zum konfigurierten Schlüssel passt — geprüft
   mit derselben Funktion, die auch jeden Zettel prüft. Ohne Prüfschlüssel wird
   gar nicht erst geladen: einer unsignierten Liste zu folgen hieße, jedem zu
   glauben, der die Datei austauschen kann.

### Ausblenden (gab es schon)

Das ✕ nimmt eine Nachricht **auf diesem Gerät** weg, der 🔇-Knopf einen ganzen
Absender. Wirkt nur lokal, niemand erfährt davon, jederzeit umkehrbar über
„👁 Ausgeblendet". Das ist die Selbsthilfe; die beiden Werkzeuge darüber sind
die Moderation.

---

## 5. Was hier ehrlicherweise **nicht** geht

Dieser Abschnitt ist der wichtigste. Ein Versprechen „endgültig gelöscht", das
nur für ein Relais gilt, wäre schlimmer als gar keins.

- **Ein Zettel, der auf einem fremden Relais liegt, bleibt dort.** Die
  Sperr-Liste macht ihn in Kimboard unsichtbar, nicht in der Welt. Ein anderer
  Nostr-Client zeigt ihn weiter. Erzwingen lässt sich dort nichts.
- **Was jemand schon gelesen, kopiert oder abfotografiert hat, ist draußen.**
  Das gilt bei WhatsApp genauso, es wird dort nur nicht dazugesagt.
- **Es gibt keine Vorabprüfung.** Niemand liest mit, bevor ein Zettel erscheint.
  Das ist gewollt (kein allgemeines Überwachungsgebot) und heißt zugleich: das
  Zeitfenster zwischen „steht da" und „ist gemeldet" bleibt offen.
- **Die Sperr-Liste wirkt nur, wo sie gelesen wird.** Ein Fork, der sie
  abschaltet, zeigt alles. Das ist der Preis dafür, dass Forken überhaupt
  erlaubt ist.
- **Der Absender bleibt ein Schlüssel, kein Mensch.** Wer wiederholt Hassrede
  schickt, kann sich in Sekunden eine neue Kennung erzeugen. Die Absender-Sperre
  erhöht den Aufwand, sie beendet nichts.
- **Ein Gerätename ist kein Beweis.** Jeder kann jeden Namen wählen; er steht
  deshalb immer zusammen mit der Kennung.

---

## 6. Was noch fehlt

- **Der Server-Wächter** (Strang A): ein kleiner Dienst auf Klaus' Server, der
  in festem Takt die Sperr-Liste liest und die genannten Ereignisse aus dem
  Relais-Speicher entfernt. Erst damit heißt „gesperrt" auf dem Heim-Relais
  auch **weg** statt nur unsichtbar. Voraussetzung ist zu wissen, welche
  Relais-Software dort läuft und wo ihr Speicher liegt — das war am 2026-08-17
  noch offen (der Egress-Proxy der Bau-Sitzungen erreicht beide Relais nicht,
  belegt: `CONNECT tunnel failed, response 403`).
- **Das Werkzeug zum Signieren** einer nachgeladenen Liste. Solange es fehlt,
  steht `pruefschluessel` in `assets/config/moderation.js` auf `null` und es
  wird nichts nachgeladen — sichtbar abgeschaltet statt still wirkungslos.
- **Ein Prüf-Auftrag an `family-project/impressum.html`, Punkt 5.** Dort steht
  „Netz-Inhalte sind Ende-zu-Ende verschlüsselt." Das trifft auf
  Direktnachrichten und Gruppen zu; das **offene Brett** läuft im Klartext über
  dasselbe Relais. Die Aussage ist damit möglicherweise zu weit gefasst — eigene
  Entscheidung, eigener PR, erst belegen, dann formulieren.

---

## 7. Wo es im Code steht

| Was | Fundstelle |
|---|---|
| Melde-Knopf, Melde-Fenster, Absende-Weg | `index.html`: `meldeKnopf`, `openMeldeDialog`, `sendeMeldung` |
| Melde- und Sperr-Konfiguration | `assets/config/moderation.js` |
| Die Sperr-Liste selbst | `assets/config/sperrliste.js` |
| Anwenden, Nachladen, Nachwischen | `index.html`: `istNetzGesperrt`, `ladeSperrQuelle`, `wischeGesperrte` |
| Netz-zuerst für die Liste | `sw.js` (sonst friert sie im Vorrat ein) |
| Zurückziehen (NIP-09) | `index.html`: `zurueckziehenFuerAlle`, `handleDeletion` |
| Lokal ausblenden / stummschalten | `index.html`: `hideQuestion`, `sperreAbsender`, `openAusgeblendet` |
| Heim-Relais | `index.html`: `HOME_RELAY`, `sendSockets()` vs. `liveSockets()` |
| Proben | `tests/smoke_melden.mjs`, `tests/smoke_sperrliste.mjs` |
| Gegenprobe | `tests/gegenprobe_moderation.sh` — 17 eingebaute Fehler, jeder muss die Proben umwerfen |
