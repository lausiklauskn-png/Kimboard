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

### Das Studio 🔧 (gebaut 2026-08-18)

**Langer Druck (~1,5 s) auf das © in der Fußzeile.** Das ist der Griff, mit dem
der Betreiber von seinem eigenen Gerät aus zufassen kann — ohne Server-Konsole.
Vorher wird `assets/studio.js` gar nicht geholt; ein Besucher lädt es nie.

Drinnen liegen drei Bereiche:

- **📡 Deine Relais.** Jedes verbundene Relais wird nach [NIP-11](https://github.com/nostr-protocol/nips/blob/master/11.md)
  gefragt und sagt selbst, welche Software es fährt, in welcher Fassung, und ob
  es Verwaltungs-Aufträge annimmt.
- **📋 Was auf dem Brett liegt.** Jeder Zettel mit zwei Knöpfen: netzweit
  sperren, oder endgültig vom eigenen Relais nehmen.
- **📜 Sperr-Liste.** Der aktuelle Stand und der Knopf, der die Liste als
  **signierte** Datei ausgibt (`sbkim/sperrliste.json`).

**Worauf der Schutz beruht — und worauf nicht.** Nicht auf dem langen Druck und
nicht auf dem Schlüssel-Vergleich: `betreiberSchluessel` steht öffentlich in
`assets/config/moderation.js`, jeder kann die Datei lesen und das Fenster
aufmachen. Was er dort nicht kann, ist etwas bewirken. Jede Handlung ist ein
**signiertes Ereignis**, und signieren kann nur, wer den privaten Schlüssel hat
— der liegt in genau einem Browser und verlässt ihn nie. Die Autorität sitzt
beim Relais und beim Schlüssel, nicht in der Oberfläche.

**Ein Gerät ist ein Schlüssel.** `betreiberSchluessel` nimmt deshalb einen Wert
oder eine **Liste**: DeX-Chrome und Tablet-Chrome sind zwei getrennte Browser mit
zwei getrennten Schlüsseln. Wer dasselbe Brett von beiden verwalten will, trägt
beide Kennungen ein. Der Preis ist ehrlich zu benennen — jede zusätzliche Kennung
ist ein weiterer Schlüssel, dessen Verlust denselben Zugang eröffnet. Die
Alternative (eine Identität per Sicherungs-Datei aufs zweite Gerät holen) ist
sauberer, aber unbequemer; beides ist vertretbar. Wer nicht in der Liste steht,
bekommt seine eigene Kennung zum Nachtragen angezeigt.

**Die Einbahnstraße gilt auch hier.** Das Studio kann sperren, nie lösen. Ein
Betreiber-Werkzeug, das die Regel umginge, wäre ein Loch in genau der Regel, die
es durchsetzen soll. Gelöst wird in der Datei.

**Damit ist Schritt 0 beantwortet — von der App, nicht von einer Sitzung.**
Monatelang stand die Frage offen, welche Software auf Klaus' Server läuft; aus
einer Bau-Sitzung ist sie nicht zu beantworten, weil der Egress-Proxy beide
Relais-Namen sperrt (`connect_rejected`, 403 — belegt am 2026-08-17 und erneut
am 2026-08-18). Aus Klaus' Browser ist die Leitung offen. Also fragt die App.
Das ist keine Notlösung: die Auskunft ist dort ohnehin aktueller als in jedem
Protokoll, das eine Sitzung einmal abgeschrieben hätte.

### Der Schlüssel — sichern und zurückholen (gebaut 2026-08-18)

Vierter Bereich im Studio — und zusätzlich an einem **sichtbaren Knopf neben
„Meine Spore"**, den jeder Nutzer sieht.

Das ist der Kern und keine Nebensache: der Schlüssel geht **jeden** an, der
Kimboard benutzt. Er entsteht beim ersten Öffnen von selbst, ohne Anmeldung, und
niemand merkt es. Wer später seine Browserdaten löscht, verliert Kontakte und
die Möglichkeit, eigene Zettel zurückzuziehen — genau wie der Betreiber. Läge die
Sicherung nur hinter dem langen Druck aufs ©, wäre sie für alle außer Klaus
unerreichbar; das wäre ein Werkzeug, das nur der kennt, der es gebaut hat.

Der sichtbare Weg zeigt **nur** den Schlüssel-Bereich — keine Sperr-Knöpfe, keine
Relais-Verwaltung, keine Sperr-Liste. Ein fremder Nutzer soll hier seinen
Schlüssel sichern, nicht versehentlich vor Betreiber-Werkzeugen sitzen.

Im Studio steht der Bereich in **beiden** Fenster-Varianten: wer seinen Schlüssel
verloren hat, ist am eigenen Brett ein Fremder — läge der Zurückholen-Knopf nur
im Betreiber-Fenster, wäre er genau dann unerreichbar, wenn man ihn braucht.

**Warum es das braucht.** Der private Schlüssel liegt als Klartext in
`localStorage` (`sbkim_nostr_test_priv`). Das ist bei Nostr-Clients üblich und
für sich vertretbar — er verlässt das Gerät nie. Weh tut nicht der Diebstahl,
sondern der **Verlust**: „Browserdaten löschen" wirft ihn weg, und danach ist
man jemand anderes. Kontakte erkennen einen nicht mehr, eigene Zettel lassen
sich nicht mehr zurückziehen, und seit der Betreiber-Schlüssel in
`moderation.js` steht, geht auch das Studio nicht mehr auf — repariert würde das
nur durch einen neuen Commit.

**Wie.** Eine mit Passwort verschlüsselte Datei (PBKDF2-SHA256, 600.000 Runden,
AES-GCM-256 — wie netzweit üblich, kein eigener Krypto-Einfall). Die Kennung
steht im Klartext darin, damit man beim Zurückholen sieht, welche Identität in
der Datei liegt; sie ist öffentlich. Beim Zurückholen wird **nach** dem
Entschlüsseln geprüft, ob der Schlüssel wirklich zu dieser Kennung gehört —
sonst schriebe ein Zufallstreffer Unsinn in den Speicher.

**Was gesichert wird — und was nicht.** Die Seite zeigt oben „Meine Kennung"
(bis zum 2026-08-18 hieß es „Meine Spore", und das war irreführend). Dort steht
der **Pinnwand-Schlüssel** aus `localStorage`, mit dem Zettel unterschrieben
werden — **genau den** rettet die Sicherung.

Die **SBKIM-Spore** fürs Mycel (Modul 02) ist eine **andere** Identität: sie
liegt in der IndexedDB-Schublade `kimboard` und entsteht erst beim ersten
Netz-Verbinden — in einem frischen Browser gibt es sie gar nicht. **Sie ist von
dieser Sicherung nicht erfasst.** Beides „Spore" zu nennen verdeckte genau das;
darum heißt es jetzt, was es ist, und die Erklär-Blase benennt den Unterschied.

**Der Schlüssel verlässt den Modul-Bereich nicht.** Die Brücke bekommt zwei
Funktionen, die mit ihm arbeiten, nie ihn selbst. Wer sie aufruft, bekommt eine
verschlüsselte Datei zurück, nichts Lesbares.

**Die ehrliche Kehrseite:** ohne das Passwort ist die Datei auch für den
Besitzer wertlos. Es gibt keine Hintertür, und es soll auch keine geben. Passwort
und Datei gehören getrennt abgelegt.

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

- **Endgültiges Entfernen hängt an der Relais-Software.** Das Studio bringt den
  Weg mit ([NIP-86](https://github.com/nostr-protocol/nips/blob/master/86.md):
  signierter Auftrag per HTTPS, ausgewiesen durch den Betreiber-Schlüssel), aber
  nur ein Relais, das ihn versteht, führt ihn aus. `nostr-rs-relay` — was laut
  `family-project/docs/PULS.md` dort läuft — kann NIP-86 **nicht**; `strfry`
  kann es. Was wirklich läuft, sagt jetzt das Studio selbst.
  **Solange kein Relais mitspielt, sagt der Knopf das ehrlich und schickt
  nichts** — statt einen Auftrag ins Leere zu senden und Erfolg zu melden.
  Der Weg dahin ist dann eine Entscheidung, keine Frage mehr: entweder ein
  Wechsel der Relais-Software, oder der ursprünglich geplante kleine Dienst auf
  dem Server, der die Sperr-Liste im Takt liest.
### ✅ BEANTWORTET am 2026-08-18 — was auf dem Server wirklich läuft

Klaus hat nachgesehen (Termux → `ssh root@167.233.204.72`). Damit ist Schritt 0
geschlossen, nach zwei Tagen. Gemessen, nicht vermutet:

| Frage | Antwort |
|---|---|
| Welche Software? | **`scsibug/nostr-rs-relay:latest`**, Fassung **0.10.0**, läuft seit drei Wochen |
| Kann sie NIP-86? | **Nein.** `supported_nips` = 1, 2, 9, 11, 12, 15, 16, 20, 22, 33, 40 — die 86 fehlt |
| Ein Relais oder zwei? | **Eines.** Beide Namen zeigen im Caddy auf denselben Container: `relay.family-projekt.de` **und** `relay.pwa-toolpoint.de` → `reverse_proxy relay:8080` |
| Wo liegt der Speicher? | **`/opt/relay/db/nostr.db`** (im Container `/usr/src/app/db`) — SQLite im WAL-Modus, am 2026-08-18 rund **26 MB** |

Zwei Dinge, die dabei nebenbei herauskamen und für später zählen:

- **NIP-09 ist dabei.** Das Relais **befolgt** Lösch-Meldungen — aber nur die des
  Absenders. Gegen fremde Hassrede hilft das weiterhin nicht (siehe § 2); für
  „ich nehme meinen eigenen Zettel zurück" wirkt es wirklich.
- **`restricted_writes: false`** — jeder darf auf dieses Relais schreiben, nicht
  nur Klaus' Leute. Das ist eine bewusste Wahl („dummes, neutrales, log-freies
  Rendezvous"), aber sie gehört zur Lagebeurteilung: das offene Brett ist offen,
  und die Melde- und Abhilfepflicht trifft genau deshalb zu.

**Was daraus folgt.** Der Knopf „🗑 Endgültig vom Relais" im Studio wird auf
absehbare Zeit sagen, dass es nicht geht — und das ist richtig so, denn es geht
über NIP-86 wirklich nicht. Die Weiche unten ist damit keine Vermutung mehr,
sondern eine Entscheidung zwischen zwei bekannten Wegen. **Neu ist, dass Weg 2
jetzt konkret baubar ist:** der Pfad zur Datenbank ist bekannt.

Zum zweiten Weg noch eine Warnung, die vor dem Bauen zu klären ist: an einer
SQLite-Datei zu schreiben, **während** das Relais sie benutzt, will sorgfältig
gemacht werden (WAL-Modus hilft, ersetzt aber keine Vorsicht). Ein Dienst, der
das tut, braucht eine Sicherung vorher und muss belegen, dass er nur die
genannten Ereignisse trifft — nicht mehr. Das ist eine eigene Bau-Sitzung wert,
keine Nebenbei-Änderung.

### Was WIRKLICH auf dem Relais liegt — und die Lücke, die dabei auffiel

Gemessen am 2026-08-18 (1.655 Ereignisse, 25.06.–17.08.):

| Kennzeichen | Anzahl | Was es ist |
|---|---:|---|
| `sbkim-rdv` | 558 | Anmeldungen im gemeinsamen Netz-Raum (Modul 23) |
| `sbkim-anastomosis` + `-reply` | 885 | Handshakes zwischen Knoten (Modul 05) |
| `sbkim-qry` / `-query` / `-query-reply` | 178 | **Cross-Knoten-Fragen und Antworten** |
| `sbkim-frage-antwort-test` | 32 | die Kimboard-Zettel |

**Das Verhältnis ist die eigentliche Nachricht: Kimboard macht 2 % aus.** Die
übrigen 98 % sind das Mycel bei der Arbeit — und davon altert das meiste sehr
schnell (ein Handshake von vor sechs Wochen nützt niemandem mehr, eine
Anmelde-Karte auch nicht). Wer je über Speicher-Aufräumen nachdenkt, findet
dort den Hebel, nicht bei den Zetteln.

#### ⚠ Die Lücke: eine Frage ans Mycel wird genauso gespeichert

Klaus' Frage am 2026-08-18: *„Es gibt noch woanders Fragen — im Rezeptbuch wird
nach einem Rezept gefragt … jemand kann ja auch Hassrede in eine Suchfunktion
schreiben."*

**Er hat recht, und die 178 Ereignisse oben sind der Beleg.** Zwei Suchen sind
aber sauber zu trennen:

- **Suche im eigenen Bestand** (Rezeptbuch durchsucht sein eigenes Buch) — läuft
  **komplett im Browser**. Kein Relais, keine Speicherung, kein Mitleser.
- **Frage ans Mycel** (Modul 23 `askNode`) — geht als gewöhnliches
  Nostr-Ereignis mit Tag `sbkim-qry` hinaus, **Inhalt im Klartext**
  (`content: JSON.stringify({…})`, keine Verschlüsselung), und **bleibt auf dem
  Relais liegen** — genau wie ein Brett-Zettel.

Wer also Hassrede in ein Mycel-Suchfeld tippt, hinterlässt sie auf dem Server.
Zwei Umstände mildern das, lösen es aber nicht auf: es wird **nirgends
angezeigt** (die Empfänger-App verarbeitet es maschinell, es gibt kein
Publikum), und es ist deshalb als Verbreitungsweg wenig attraktiv. Gespeichert
und abrufbar ist es trotzdem, und es liegt auf Klaus' Server — die
Abhilfepflicht (§ 3) unterscheidet nicht nach Kennzeichen.

**Die Sperr-Liste erfasst das heute NICHT.** Sie filtert, was Kimboard
**anzeigt**; eine `sbkim-qry`-Anfrage wird nie angezeigt und rutscht damit
durch.

**Konsequenz für den geplanten Dienst (Weg B):** Er darf nicht nach dem
Kimboard-Kennzeichen greifen, sondern muss **jedes Ereignis entfernen, dessen
Kennung in der Sperr-Liste steht** — unabhängig vom Tag. Dann deckt er Zettel
und Anfragen gleichermaßen ab. Von Anfang an mitgedacht kostet das nichts;
nachträglich wäre es ein zweiter Bau.

#### Die 32 Testzettel sind weg (2026-08-18)

Klaus wollte sie loswerden — es waren Testfragen ohne Wert. Vorgehen, das sich
als Muster taugt:

1. **Sicherung zuerst:** `cp /opt/relay/db/nostr.db /root/nostr-sicherung-<datum>.db`
2. **Trockenlauf:** zählen, was die Abfrage treffen würde (Ergebnis: 32 von 1.655)
3. **Relais anhalten**, löschen, verwaiste Etiketten mit aufräumen, `VACUUM`
4. **Starten und nachzählen:** 1.623 übrig, `sbkim-frage-antwort-test`
   vollständig verschwunden, alle anderen Kennzeichen unverändert

Die Auszeit betrug Sekunden. **Kein Knoten musste sich neu anmelden** — genau
das war der Grund, gezielt zu löschen statt die Datenbank zu leeren.

### Die eine offene Frage — und die zwei Wege, sie zu beantworten

Klaus am 2026-08-18: *„Was benötigst Du jetzt noch, damit wir sehen können, ob wir
auf dem Relais family-projekt.de Daten endgültig löschen können?"*

Es fehlt **eine einzige Auskunft**: kann `relay.family-projekt.de` Verwaltungs-
Aufträge annehmen (NIP-86)?

**Weg 1 — im Studio nachsehen (10 Sekunden, nichts zu installieren).**
Langer Druck aufs © → Bereich „📡 Deine Relais". Dort steht Software, Fassung
und ob Verwaltung möglich ist. Drei mögliche Ausgänge:

| Was dort steht | Was es heißt |
|---|---|
| `strfry` · ✔ Verwaltung möglich | fertig — der 🗑-Knopf wirkt sofort |
| `nostr-rs-relay` · ✖ keine Verwaltung | erwartbar; dann Weiche unten |
| „keine Auskunft (CORS oder offline)" | die App kommt nicht heran → Weg 2 |

Der dritte Ausgang ist kein Fehler der App: viele Relais geben ihre
Selbstauskunft nicht an fremde Seiten heraus (fehlender CORS-Kopf). Dann sagt
das Studio ehrlich „keine Auskunft", statt etwas zu behaupten.

**Weg 2 — einmal auf dem Server nachsehen.** Nur nötig, wenn Weg 1 nichts
sagt. Der Befehl gehört auf den **Hetzner-Cloud-Server**, nicht aufs Tablet
(dort läuft Termux, kein Server). Er **liest nur** und ändert nichts:

```bash
ssh root@167.233.204.72 'echo "== Container =="; docker ps --format "{{.Names}} | {{.Image}} | {{.Status}}"; echo; echo "== Selbstauskunft des Relais =="; for p in 8080 7000 7777 8008; do echo "-- Port $p"; curl -sS -m 4 -H "Accept: application/nostr+json" http://127.0.0.1:$p/ | head -c 600; echo; done; echo; echo "== Speicher =="; docker exec relay sh -c "find / -xdev \( -name "*.db" -o -name "*.sqlite*" \) 2>/dev/null | head -20" 2>/dev/null || echo "(Container heisst nicht relay — siehe Liste oben)"'
```

Was die Antwort trägt: die **Software samt Fassung**, ob **ein oder zwei**
Relais laufen (zwei Namen können auf dasselbe zeigen), und **wo der Speicher
liegt**.

**Danach steht die Weiche**, und sie ist ein Richtungsentscheid für Klaus, kein
Selbstläufer:

- ~~**Relais-Software wechseln** (`strfry` kann NIP-86).~~ **WIDERLEGT am
  2026-08-18.** Die Annahme stammte aus der Erinnerung einer Sitzung und wurde
  geprüft, statt geglaubt: `relay.damus.io` läuft auf strfry und meldet
  `supported_nips` = 1, 2, 4, 9, 11, 28, 40, 45, 70, 77 — **keine 86**. Ob die
  Software es grundsätzlich könnte, ist damit offen; für Kimboard macht das
  keinen Unterschied, denn die App prüft genau diese Liste. Ein Wechsel brächte
  also den ganzen Aufwand und keinen Schritt nach vorn. **Weg A ist damit vom
  Tisch.**
- **Kleiner Dienst auf dem Server**, der die Sperr-Liste in festem Takt liest
  und die genannten Ereignisse aus dem Speicher nimmt (Muster: der
  2-Minuten-Cron aus dem Skill `auto-deploy-einrichten`). Preis: ein Teil mehr,
  der laufen muss — dafür bleibt die Relais-Software unangetastet.

**Was in beiden Fällen schon steht:** der Melde-Weg (Art. 16 DSA), die
Sperr-Liste, und das Studio, das beides bedient. Was fehlt, ist allein die
letzte Meile — aus „in jedem Kimboard unsichtbar" ein „aus dem Speicher
entfernt" zu machen, und zwar dort, wo Klaus tatsächlich Betreiber ist.

### Der Nachsehen-Gang (gebaut 2026-08-18) — `tools/relais-wache.sh`

Weg B ist damit angefangen, und zwar an dem Ende, an dem nichts kaputtgehen
kann. Das Skript liest **dieselbe Sperr-Liste, die auch die App liest**, sieht
in `/opt/relay/db/nostr.db` nach und sagt genau, welche Ereignisse ein Löschlauf
treffen **würde**. Es löscht nichts, ändert nichts, schreibt nichts.

```bash
ssh root@167.233.204.72 'bash -s' < tools/relais-wache.sh    # vom Tablet aus
```

**Warum zuerst dieser Gang und nicht gleich der scharfe.** Ein Werkzeug, das
löscht, bevor man ihm beim Zählen zusehen konnte, ist keins. Und es gab hier
wirklich etwas zu sehen: das Skript macht **zwei Dinge bewusst anders als die
App**.

1. **Es greift nach der Kennung, nicht nach dem Brett-Kennzeichen.** Die App
   filtert, was *Kimboard* anzeigt. Auf dem Relais liegen aber auch Fragen ans
   Mycel (Tag `sbkim-qry`, am 2026-08-18 gemessen: 178 Stück) — im Klartext,
   genau wie Zettel. Wer nach dem Kimboard-Tag greift, lässt sie liegen.
2. **Es findet das Schema selbst.** Wie `nostr-rs-relay` Kennungen ablegt (BLOB
   oder Text, welche Spalte), hängt an der Fassung. Passt nichts, **bricht es
   ab** — statt eine Null zu melden, die wie „nichts betroffen" aussieht und in
   Wahrheit „falsch gesucht" heißt.

**Was die Gegenprobe daran gefunden hat.** `tests/smoke_relais_wache.mjs` war
beim ersten Lauf grün — 23 von 23. `tests/gegenprobe_wache.sh` baut elf Fehler
ein, und **einer davon blieb ungefangen**: die Prüfung „GROSS geschriebene
Kennungen werden normalisiert" wäre auch dann grün geblieben, wenn das Skript
gar nicht normalisierte. Grund: SQLite liest `x'ABCD'` **selbst**
schreibweise-unabhängig, und die Probe kannte nur BLOB-Datenbanken. Der ganze
**Text-Zweig** des Skripts war damit überhaupt nicht gemessen. Seitdem prüft sie
gegen beide Zuschnitte — **27 statt 23**, und die Zahl ist jetzt echt.

### Der scharfe Gang (gebaut 2026-08-18) — `SCHARF=ja`

Derselbe Aufruf, ein Wort mehr. **Eine Datei für beide Gänge**, weil das
Werkzeug per `ssh … 'bash -s' < datei` hinübergereicht wird — zwei Dateien wären
zwei Wege, die auseinanderlaufen, und der scharfe Gang muss genau das entfernen,
was der Nachsehen-Gang gezeigt hat.

```bash
ssh root@167.233.204.72 'bash -s'            < tools/relais-wache.sh   # nachsehen
ssh root@167.233.204.72 'SCHARF=ja bash -s'  < tools/relais-wache.sh   # entfernen
```

**Der Nachsehen-Gang ist die Vorgabe.** Ein versehentlicher Aufruf tut nichts.

Was er tut, in dieser Reihenfolge — und jeder Schritt ist ein Riegel:

1. **Sicherung, nicht abschaltbar.** `VACUUM INTO` zieht einen in sich
   stimmigen Abzug aus der **laufenden** Datenbank. Ein `cp` täte das nicht: im
   WAL-Modus liegt der neueste Stand teils in der Nebendatei, und ein halber
   Abzug ist schlimmer als gar keiner — er sieht aus wie eine Sicherung. Trägt
   der Abzug nicht dieselbe Stückzahl wie das Original, wird **nichts** entfernt.
2. **Entfernen in einer Transaktion**, Anhängsel (`tag`) zuerst, dann die
   Ereignisse. Getrennt liefe man Gefahr, dass eines von beidem ausfällt.
3. **Nachrechnen.** Vorher − betroffen = nachher · keine genannte Kennung ist
   geblieben · kein verwaistes Anhängsel. Geht eines nicht auf, meldet es einen
   Fehlschlag (Rückgabewert 4) und nennt den Befehl zum Zurückspielen.
4. **Die Sicherung bleibt liegen.** Das Werkzeug räumt sie nicht weg — das wäre
   der eine Griff, der sich nicht zurücknehmen lässt.

**Muss das Relais dafür anhalten? Gemessen, nicht vermutet: nein.** Aus einer
WAL-Datenbank lässt sich löschen, während ein zweiter Verbinder weiterschreibt
(`BEGIN IMMEDIATE` + `busy_timeout`) — 55 gleichzeitige Einfügungen, kein Fehler
auf beiden Seiten, `PRAGMA integrity_check` = ok. **Ehrliche Grenze:** gemessen
wurde mit zwei Verbindern im selben Programm; beim Relais sind es zwei Programme
über dieselbe Datei. SQLite sperrt dafür über dasselbe Verfahren, aber gemessen
ist das hier nicht. Wem das zu dünn ist, nimmt `STOPPEN=ja`; die Sicherung läuft
in beiden Fällen.

**Der Fehler, den das Aufschreiben gefunden hat.** Der Nachsehen-Gang meldete
`treffer_ev + treffer_ab` — und zählte damit ein Ereignis **doppelt**, das
zugleich über seine eigene Kennung und über seinen Absender gesperrt ist. Beim
Nachsehen war das nur eine zu hohe Zahl. Im scharfen Gang wäre es schlimmer
gewesen: die Schlussrechnung wäre nicht aufgegangen, und das Werkzeug hätte
einen **richtigen** Lauf als Fehlschlag gemeldet. Die erste Probe hatte die
Überschneidung nie gebaut und war deshalb grün. Heute zählt eine einzige
Abfrage über beide Sorten, und die Überschneidung ist ein eigener Prüfpunkt.

**Und der Befund, der die Proben selbst betrifft:** die Gegenprobe baute die
Nachrechnung aus — und alles blieb grün. Nicht weil sie wertlos wäre, sondern
weil **eine Nachrechnung sich nicht beweisen lässt, solange nichts falsch ist**.
Seitdem gibt es zwei Prüfungen, die das Werkzeug an einer gepatchten Kopie
absichtlich falsch machen und darauf bestehen, dass es das **bemerkt**.

### ✅ Am 2026-08-19 am ECHTEN Relais gelaufen (Klaus, per Termux)

Die Kette ist damit belegt statt geglaubt — vom Studio bis in den Speicher:

| Lauf | Ergebnis |
|---|---|
| Nachsehen | `Betroffen sind 1 von 1624` · Schema selbst erkannt (`event_hash` BLOB) · **beide** Listen gelesen, der Eintrag kam aus der signierten |
| Entfernen | Sicherung `nostr.db.sicherung-20260819-042201.db` mit 1624 Ereignissen · `vorher 1624 · betroffen 1 · nachher 1623 (erwartet 1623)` |
| Nachsehen | `Betroffen sind 0 von 1623` · `· 701a5834… nicht im Speicher` |

**Der dritte Lauf ist der eigentliche Beweis.** Was weg ist, findet das Werkzeug
nicht mehr — das kann es nur sagen, weil es nach der **Kennung** greift und
nicht nach dem Brett-Tag.

Aufgerufen wurde es, ohne eine Datei aufs Tablet zu holen: der Server holt sich
das Skript selbst.

```bash
ssh root@167.233.204.72 'curl -sSL -o /tmp/wache.sh https://raw.githubusercontent.com/lausiklauskn-png/Kimboard/main/tools/relais-wache.sh && bash /tmp/wache.sh'
ssh root@167.233.204.72 'SCHARF=ja bash /tmp/wache.sh'
```

**Und der Lauf hat einen Fehler ans Licht gebracht, den keine Probe sah.** Im
Lösch-Schritt stand eine nackte `15000` — die Rückgabe von `PRAGMA
busy_timeout`. Beim Wegräumen fiel der eigentliche auf: die Vorgabe-Adressen
standen als `${LISTE_JSON:-…}` da. **`:-` setzt die Vorgabe auch bei LEEREM
Wert ein.** Die Proben setzten `LISTE_JSON=''`, um die zweite Quelle
stillzulegen — und holten in Wahrheit weiter die echte Liste von GitHub.
Solange die Datei auf `main` nicht existierte, kam nichts zurück und alles war
grün: **grün, weil ein Abruf ins Leere lief, nicht weil die Abschaltung
wirkte.** Seit `-` statt `:-` schaltet leer wirklich ab; zwei Prüfungen halten
fest, dass keine GitHub-Adresse mehr in der Ausgabe auftaucht.

**Was weiterhin fehlt:** ein **Takt**. Heute läuft der Gang auf Zuruf. Ein
Dienst, der ungefragt löscht, braucht mehr Vertrauen als einer, den man aufruft
— und weil Kimboards Sperr-Liste **nur nach oben** geht, ist der Zuruf-Betrieb
kein Provisorium, sondern eine vertretbare Dauerlösung.

- **Die erzeugte Liste muss von Hand ins Repo.** Das Studio signiert sie und
  legt sie als Datei hin; einchecken muss Klaus. Ein Weg, der sie direkt
  veröffentlicht, bräuchte einen Server mit Token (wie im
  family-projekt.de-Studio) — den hat Kimboard bewusst nicht.
- ~~**Das Werkzeug zum Signieren** einer nachgeladenen Liste.~~ **Gebaut
  2026-08-18** (Studio, Bereich „Sperr-Liste"). Die offene Frage „welcher
  Schlüssel signiert?" hat sich damit von selbst beantwortet: **die
  Kimboard-Identität des Betreibers** — dieselbe, mit der er auch Zettel
  schreibt. Ein eigener Schlüssel nur für Sperr-Listen hätte einen zweiten Ort
  gebraucht, an dem etwas verloren gehen kann, ohne etwas zu gewinnen.
  `pruefschluessel` steht weiterhin auf `null`, bis Klaus seine Kennung einträgt
  — sichtbar abgeschaltet statt still wirkungslos.
- ~~**Ein Prüf-Auftrag an `family-project/impressum.html`, Punkt 5.**~~
  ✅ **erledigt 2026-08-19** (family-project PR #284). Dort stand „Netz-Inhalte
  sind Ende-zu-Ende verschlüsselt." Belegt: family-project hat gar kein
  Verschlüsselungs-Modul — Visitenkarte und Mycel-Fragen gehen im Klartext über
  dasselbe Relais. Die Aussage stand an **acht** Stellen, eine davon als
  Überschrift auf `netzwerk.html` („Netz-Inhalte kann selbst der Betreiber nicht
  lesen"). Alle acht korrigiert; die Überschrift heißt jetzt „Kein Konto, kein
  Profil, kein Vermittler" — das stimmt und sagt dasselbe Gute, ohne etwas zu
  behaupten, was nicht gemessen ist.

---

## 6b. Die Grenzen am Relais — gesetzt 2026-08-19

Beim Nachsehen wurde aus einer Frage ein Befund: `/opt/relay/config.toml` hatte
**weder** einen `[authorization]`- **noch** einen `[limits]`-Abschnitt. Kein
Schlüssel-Filter, keine Rate, keine Größenbeschränkung. Im Klartext: wer
`wss://relay.family-projekt.de` kannte, konnte beliebig viel hineinschreiben —
und die Adresse steht im öffentlichen Quelltext von 21 Apps. Die einzige Grenze
war die Festplatte.

Das ist der billigere Hebel als ein Anzeige-Filter in 21 Apps: **eine Stelle,
zwei Wirkungen.** `tools/relais-grenzen.sh` setzt

| Wert | Warum genau der |
|---|---|
| `messages_per_sec = 5` | server-weit, über eine Minute gemittelt = 300 je Minute. Das ganze Netz erzeugt eine Handvoll, ein Fluter Tausende. Die Vorlage von nostr-rs-relay nennt genau diese Zeile „highly recommended if your relay is public". |
| `subscriptions_per_min = 30` | Die Vorlage empfiehlt 10; hier 30, weil mehrere Apps in mehreren Tabs offen sind und das nicht in eigene Bremsspuren laufen soll. |
| `reject_future_seconds = 1800` | gegen Zettel, die sich mit falschem Datum dauerhaft oben festsetzen. **Vorher gemessen:** von 1623 Ereignissen lag **kein einziges** in der Zukunft, das neueste 167 467 Sekunden dahinter, Server-Uhr per NTP synchron. |

**Zeitzonen können daran nichts verstellen.** Nostr-Zeitstempel sind
Unix-Sekunden seit 1970 in UTC — eine **Zahl ohne Zone**. Eine Zeitzone
erscheint erst beim Anzeigen. Nur eine wirklich falsch gehende Geräte-Uhr könnte
den Riegel auslösen, und die gab es hier nie.

**Bewusst nicht gesetzt**, und das steht auch im Skript, damit es niemand
„nachholt":

- `limit_scrapers` weist ungenaue Abfragen ab (nur Art, nur Absender). Die
  Modul-23-Abfragen tragen alle einen Tag-Filter und wären sicher — aber es
  wurde **nicht** jede Abfrage in 21 Apps geprüft. Ohne diese Prüfung nicht
  anfassen.
- `max_event_bytes` steht schon auf 128 KB. Kleiner schnitte Bilder auf der
  Pinnwand ab.
- `pubkey_whitelist` verböte Fremden das Andocken und machte genau das kaputt,
  wofür dieses Relais da ist.

### Vorgebaut, aber nicht aktiv — für ein geschlossenes Netz

Klaus hat gefragt, ob sich die Schlüssel-Liste **vorbauen** lässt, ohne sie zu
aktivieren. Ja — und genau so steht sie jetzt in der Konfig: ein vollständiger,
**auskommentierter** `[authorization]`-Block mit Liste, `nip42_auth` und
`nip42_dms`, daneben die Begründung, dass er an ein **zweites, eigenes** Relais
gehört (gleiche Software, eigene Konfig, eigene Adresse — oder gleich auf der
Maschine des Kunden), nicht hierher.

`tests/smoke_relais_grenzen.mjs` prüft beides **gegeneinander**: der Block steht
in der Datei, und der TOML-Leser sieht ihn nicht. Stünde er aktiv drin, wäre das
öffentliche Relais ab sofort für alle Fremden dicht, und niemand hätte es
gewollt.

Und eine Falle steht gleich mit dabei: **die Liste allein hält Fremde vom
Schreiben ab, nicht vom Lesen.** Wer „kein Fremder kommt rein" will, braucht
beide Zeilen — die Liste **und** `nip42_auth`. Erst die zweite verlangt einen
Nachweis, bevor jemand mitlesen darf.

### Was das Werkzeug richtig macht

- **Wiederholbar.** Läuft es zweimal, merkt es das und fasst nichts an. Ein
  zweiter `[limits]`-Abschnitt wäre kaputtes TOML, und das Relais käme nicht mehr
  hoch. Ein Werkzeug, das man nicht zweimal aufrufen darf, ist ein schlechtes.
- **Sichert vorher, prüft nachher.** Nach dem Neustart wird die öffentliche
  Adresse abgefragt; antwortet sie nicht, setzt sich das Skript selbst zurück.
- **Die Probe liest echtes TOML** (`tomllib`), statt nach Zeichenketten zu
  suchen. Eine Zeichenketten-Suche fände „`[limits]` steht drin" auch dann, wenn
  die Datei daneben unlesbar wäre.

**Lauf am 2026-08-19:** Sicherung `config.toml.bak-20260819-155344`, angehängt,
neu gestartet, Relais antwortet, 1623 Zettel unverändert.

**Die Gegenprobe war der eigentliche Punkt.** Das Skript sagt selbst: *„NOCH
NICHT BEWIESEN: dass Schreiben weiterhin geht. Eine Grenze, die man nicht
gegengeprüft hat, ist auch nur eine Behauptung."* Klaus hat danach in Kimboard
einen Zettel geschrieben — er **erscheint** auf dem Brett, 17:58:04, `via
relay.family-projekt.de`. Beides ist damit belegt: die Grenze steht, und sie
bremst den normalen Betrieb nicht.

**Eine Lehre aus dem Bau, die bleibt.** Die erste Probe prüfte, ob das Skript bei
schreibgeschützter Konfig abbricht. Sie schlug fehl — zu Recht: das Skript läuft
auf dem Server als `root`, und `root` darf immer schreiben. Der Riegel kann dort
**nie** greifen. Eine Probe, die einen Fall misst, den es in der echten Umgebung
nicht gibt, bewacht nichts. Geprüft wird jetzt der Fall, der wirklich vorkommt:
falscher Pfad.

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
| Studio (Betreiber-Werkzeug) | `assets/studio.js` |
| Schlüssel sichern / zurückholen | `index.html`: `sichereSchluessel`, `stelleSchluesselWiederHer` · `assets/studio.js`: `bereichSchluessel` |
| Studio-Zugang (langer Druck aufs ©) | `index.html`, letzter `<script>`-Block vor `</body>` |
| Brücke aus dem Modul-Scope | `index.html`: `signiere`, `__kb.zettel/relaisListe/sperreJetzt` |
| Proben | `tests/smoke_melden.mjs`, `tests/smoke_sperrliste.mjs`, `tests/smoke_studio.mjs` |
| Gegenprobe | `tests/gegenprobe_moderation.sh` — 40 eingebaute Fehler, jeder muss die Proben umwerfen |
| Nachsehen-Gang auf dem Relais | `tools/relais-wache.sh` — löscht nichts, zeigt nur, was ein Löschlauf träfe |
| Probe dazu | `tests/smoke_relais_wache.mjs` (echte SQLite-DB, beide Schema-Zuschnitte) · `tests/_sqlite3-ersatz.mjs` |
| Scharfer Gang (`SCHARF=ja`) | dieselbe Datei — Sicherung, Transaktion, Nachrechnen |
| Probe dazu | `tests/smoke_relais_scharf.mjs` (38 Prüfungen, darunter zwei an einer absichtlich verbogenen Kopie) |
| Gegenprobe dazu | `tests/gegenprobe_wache.sh` — 20 eingebaute Fehler; beim ersten Lauf blieben fünf ungefangen |
| Grenzen am Relais (Flut-Bremse, Zukunfts-Riegel) | `tools/relais-grenzen.sh` — wiederholbar, sichert, prüft, nimmt sich zurück |
| Probe dazu | `tests/smoke_relais_grenzen.mjs` (29 Prüfungen; liest das Ergebnis als echtes TOML) |
