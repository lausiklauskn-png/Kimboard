# Brief an die nächste Sitzung — Kimboard: Hassrede vom Brett nehmen

**Stand: 2026-08-17.** `main` = `45b3442`. Dieser Brief ist der **neueste**; der
ältere `BRIEF_NAECHSTE_SITZUNG.md` gilt weiter für alles, was dort noch offen
steht (Zwei-Geräte-Lauf mit einer Gruppe).

Lies zuerst diesen Brief, dann `README.md`, dann `BRIEF_NAECHSTE_SITZUNG.md`.
Danach nur den Code-Bereich, an dem du arbeitest — `index.html` ist groß, lies
gezielt mit Grep.

---

## Die Frage, um die es geht

Klaus, wörtlich am 2026-08-17:

> *„Einhaltung von Gesetzen in Kimboard bezüglich Hassrede oder verurteilenswerter
> Aussagen im Board. Sie müssen endgültig vom Board genommen werden können, nicht
> vom Rechner, das geht glaube ich nicht. oder?"*

Seine Vermutung stimmt zur Hälfte. Die andere Hälfte ist die gute Nachricht, und
sie ist der Grund, warum diese Sitzung überhaupt etwas bauen kann.

---

## Drei Reichweiten — und nur eine davon heißt wirklich „weg"

Ein Zettel liegt nicht an einem Ort. Er liegt auf jedem Relais, das ihn
angenommen hat, und in jedem Browser, der ihn schon gelesen hat. „Löschen"
bedeutet deshalb je nach Ort etwas anderes:

| Ort | Was möglich ist | Wie endgültig |
|---|---|---|
| **Klaus' eigenes Relais** | wirklich entfernen | **endgültig**, dort |
| **Jedes Kimboard** | aus der Anzeige nehmen | wirksam, aber der Zettel liegt weiter da |
| **Fremde Relais** (`nos.lol`, `damus.io`, `nostr.band`) | bitten | **gar nicht** durchsetzbar |

Die dritte Zeile ist Klaus' Vermutung, und sie ist richtig. [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md)
sagt es selbst: Relais *sollen* eine Lösch-Meldung befolgen, verpflichtet sind
sie nicht. `relay.nostr.band` ist sogar ausdrücklich ein **Archiv- und
Suchdienst**. Wer dort etwas hinschreibt, muss damit rechnen, dass es bleibt.

Die erste Zeile ist die, die er nicht auf dem Schirm hatte: **er ist selbst
Relais-Betreiber.**

---

## Was schon gebaut ist (nachgesehen, nicht vermutet)

| Was | Fundstelle | Stand |
|---|---|---|
| „Bei allen löschen" als echte NIP-09-Meldung (kind 5) | `index.html` Z. 1487 ff., 1616, 2380 | fertig, bewacht von `tests/smoke_loeschen.mjs` |
| Fremde Zettel lokal ausblenden, mit „Rückgängig" und Fenster „👁 Ausgeblendet" | `hideQuestion`, `merkeAusblendung`, `openAusgeblendet` | fertig |
| Heim-Relais: **schmal senden, breit lesen** | `HOME_RELAY` Z. 679, `sendSockets()` vs. `liveSockets()` | fertig, **Voreinstellung** |
| Ehrliche Ansage in der App selbst | Z. 2615, 2676 | fertig |

Die Begründung für das Heim-Relais steht im Code und trifft genau diesen Brief:

> *„GESCHRIEBEN wird nur auf das Heim-Relais — dort ist ein Betreiber, der bekannt
> ist, der über Zugang entscheidet und **der wirklich löschen kann**."*

Das halbe Fundament liegt also schon. Was fehlt, ist das Werkzeug am anderen Ende
dieses Satzes.

---

## Was fehlt — und warum das Vorhandene nicht reicht

**Eine Lösch-Bitte darf nur der Absender stellen.** Das steht so im Code und ist
richtig, sonst könnte jeder das Brett leerräumen. Gegen **fremde** Hassrede ist
NIP-09 damit überhaupt kein Werkzeug. Es ist für „ich nehme meinen eigenen Zettel
zurück" gebaut, nicht für „das gehört hier nicht hin".

**Es gibt keinen Melde-Weg.** Geprüft: weder `index.html` noch `impressum.html`
enthalten einen Melde-Knopf, eine Melde-Adresse oder ein Verfahren. Der
Marktplatz von family-projekt.de hat längst einen („*Jeder Eintrag im Marktplatz
hat einen Melde-Knopf*"). Kimboard, wo Fremde tatsächlich Text hinschreiben, hat
keinen.

---

## Die rechtliche Kante

Nüchtern eingeordnet, keine Rechtsberatung — dieselbe Haltung wie in
[`Sage-Protokol/docs/URHEBERSCHAFT_UND_RECHTE.md`](https://github.com/lausiklauskn-png/Sage-Protokol/blob/main/docs/URHEBERSCHAFT_UND_RECHTE.md).

Für alles, was auf Klaus' Server liegt, ist er **Hosting-Anbieter**. Daraus folgt:

- **Melde- und Abhilfeverfahren ist Pflicht** ([Art. 16 DSA](https://gesetz-digitale-dienste.de/dsa/artikel-16/)):
  ein Weg, über den jemand rechtswidrige Inhalte melden kann. Eingang bestätigen,
  zeitnah und begründet entscheiden, dem Melder das Ergebnis mitteilen und ihn auf
  Rechtsbehelfe hinweisen.
- **Kein allgemeines Überwachungsgebot.** Er muss nicht suchen. Aber sobald er
  **weiß**, endet die Haftungsfreistellung des DDG — dann muss er handeln.
- **Kleinstunternehmen sind nur von den Transparenzberichten befreit**, nicht von
  der Sorgfaltspflicht.
- Was „Hassrede" konkret heißt, steht nicht im DSA, sondern im Strafrecht
  (Volksverhetzung, Verwenden von Kennzeichen verfassungswidriger Organisationen,
  Beleidigung, Bedrohung). Der Brief bewertet das nicht — er baut den Weg, auf dem
  gehandelt werden kann.

**Der Punkt, an dem die zwei Hälften zusammenkommen:** Die Pflicht trifft ihn
genau dort, wo er auch die Macht hat. Auf dem eigenen Relais ist er verantwortlich
*und* handlungsfähig. Auf `nos.lol` ist er weder das eine noch das andere.

---

## Schritt 0 — erst nachsehen, dann bauen

**Bevor eine Zeile Code entsteht:** herausfinden, was auf dem Server wirklich
läuft. Das ist aus der Sitzungs-Umgebung **nicht** prüfbar, der Egress-Proxy
blockt beide Relais (`CONNECT tunnel failed, response 403`, belegt am 2026-08-17).
Bekannt ist nur:

- `relay.family-projekt.de` **und** `relay.pwa-toolpoint.de` lösen beide auf
  **denselben** Server auf: `167.233.204.72` (Hetzner).
- In `family-project/docs/PULS.md` steht `nostr-rs-relay`, log-frei, live seit
  2026-06-25.
- In `PWA-Toolpoint/assets/config/netz.js` steht ausdrücklich *„solange es noch
  nicht läuft, kostet es nichts"* — ob dort wirklich ein **zweites** Relais
  antwortet oder nur ein zweiter Name auf dasselbe zeigt, ist **offen**.

Offene Fragen für Schritt 0:

1. Welche Relais-Software läuft, in welcher Fassung?
2. Wo liegt ihr Speicher (SQLite-Datei? welcher Pfad? im Container?)?
3. Laufen **zwei** Relais oder zeigen zwei Namen auf eines?
4. Befolgt sie NIP-09 überhaupt, und gibt es einen Verwaltungs-Weg?

**Wie gefragt wird:** ein einzelner, kopierfertiger Befehl der Form
`ssh root@167.233.204.72 '<befehl>'`, Muster wie im Skill `auto-deploy-einrichten`.
**Nicht** auf dem Tablet ausführen lassen — das ist die dritte Maschine, dort
läuft Termux und kein Server. Wer einen Befehl gibt, sagt dazu, wohin er gehört.

---

## Strang A — auf dem eigenen Brett wirklich entfernen

**Ziel:** Klaus markiert einen Zettel, und er ist von *seinem* Relais weg. Nicht
ausgeblendet, weg.

**Weg:** ein kleiner Wächter auf dem Server, der in festem Takt die Sperr-Liste
aus Strang B liest und die genannten Ereignisse aus dem Relais-Speicher entfernt.
Kein neues Bedienfeld auf dem Server, kein zweiter Ort der Wahrheit — er folgt
derselben Datei, die auch die App liest.

Das ist genau das Muster, das der 2-Minuten-Cron aus `auto-deploy-einrichten`
schon fährt: der Server zieht sich, was im Repo steht. Nur der Nutzlast-Teil ist
neu.

**Ehrliche Grenze, die in die App gehört:** wirkt nur auf Klaus' Relais. Wer
bewusst auf ein fremdes schreibt, bleibt außer Reichweite. Weil Kimboard
standardmäßig nur nach Hause sendet, ist das der Normalfall und nicht die
Ausnahme — aber es ist kein Versprechen.

---

## Strang B — die Sperr-Liste: eine Datei, zwei Wirkungen

**Der Kern des ganzen Entwurfs.** Dieselbe Liste wird an zwei Stellen gelesen:

- **Die App** liest sie beim Start und zeigt gesperrte Zettel nicht mehr an. Das
  wirkt sofort und in **jedem** Kimboard, auch für Zettel, die auf fremden Relais
  liegen.
- **Der Server-Wächter** (Strang A) liest dieselbe Liste und entfernt, was auf
  Klaus' Relais liegt, wirklich.

Ein Ort der Wahrheit statt zweier, die auseinanderlaufen.

**Nicht neu erfinden.** Das Muster existiert netzweit in
`PWA-Toolpoint/assets/config/wache-hand.json`, samt seiner Begründung in
`PWA-Toolpoint/docs/RAUSWURF-REGEL.md`. Übernimm daraus:

1. **Rangfolge statt Sonderfall-Liste:** `gruen 0 < (nichts) 1 < gelb 2 < rot 3`.
2. **Sperren aus der Oberfläche, lösen nur in der Datei.** Ein Fehlgriff beim
   Sperren sperrt zu viel und fällt auf. Ein Fehlgriff beim Lösen ist still. Diese
   Asymmetrie ist Absicht.
3. **Eingebacken, nicht nachgeladen.** Ein Band, das erst nach dem Laden
   erscheint, schiebt die ganze Liste — bei Toolpoint gemessen: CLS 0,136.
4. **Rot heißt nicht unsichtbar.** Dort bleibt der Eintrag stehen, der Grund steht
   dabei, nur der Link geht aus. Ob das hier passt, entscheidet Klaus: bei
   Hassrede ist „stehen lassen mit Begründung" womöglich falsch. **Frag ihn.**

**Fremdnutzer-Brille, Pflicht:** Klaus' Sperr-Liste ist **seine** Liste. Ein
Forker muss sie abschalten oder durch die eigene ersetzen können. Und die App muss
ohne erreichbare Liste voll weiterlaufen — fail-soft, kein toter Knopf, kein
Absturz. Wer die Liste nicht lädt, sieht eben alles; er sieht keinen Fehler.

**Ehrliche Grenze, die in die App gehört:** der Zettel liegt physisch weiter auf
fremden Relais. Ein anderer Nostr-Client zeigt ihn. Die Sperr-Liste macht ihn in
Kimboard unsichtbar, nicht in der Welt.

---

## Strang C — der Melde-Weg (Art. 16 DSA)

**Ziel:** jeder Zettel bekommt einen Melde-Knopf, und eine Meldung löst ein
Verfahren aus, das den gesetzlichen Anforderungen genügt.

Zu bauen:

- **Melde-Knopf** an jedem Zettel und jeder Antwort, neben dem vorhandenen ✕.
  Erklär-Blase nicht vergessen — `assets/hilfe.js` erzwingt für jeden sichtbaren
  Knopf einen Eintrag, `smoke_hilfe` fällt sonst um. (Diese Prüfung **wirkt
  wieder**, seit sie am 2026-08-17 repariert wurde; vorher hättest du dich auf
  einen stummen Wächter verlassen.)
- **Kurzes Formular:** was ist zu melden, warum, optional eine Rückmeldeadresse.
  Ohne Adresse geht es trotzdem, dann entfällt nur die Rückmeldung.
- **Weg zur Meldung.** Der Marktplatz nutzt bereits eine eigene API auf Klaus'
  Webhosting plus Mail an `info@family-projekt.de`. Prüfen, ob derselbe Weg hier
  taugt, oder ob ein schlichter `mailto:` reicht. **Achtung Marktplatz-Brille:**
  ein Forker hat weder Klaus' API noch seine Adresse. Die Zieladresse gehört in
  die Konfiguration, nicht in den Code.
- **Was die App dem Melder sagen muss:** Eingang bestätigt, Entscheidung kommt,
  wo er sich beschweren kann, wenn ihm die Entscheidung nicht passt.
- **Kein Automatismus.** Eine Meldung sperrt nichts von allein. Sie landet bei
  Klaus, und er entscheidet. Das ist gewollt, denn eine Meldung ist eine
  Behauptung, kein Urteil — und ein automatischer Rauswurf wäre die einfachste
  Angriffsfläche des ganzen Bretts.

---

## Die Papiere, die dazugehören

1. **`docs/MODERATION_UND_RECHT.md`** (neu) — die nüchterne Einordnung: was hier
   möglich ist, was nicht, was das Gesetz verlangt. Ton und Aufbau wie
   `Sage-Protokol/docs/URHEBERSCHAFT_UND_RECHTE.md`: Fakten, Quellen mit
   Abrufdatum, und ein eigener Abschnitt „was hier ehrlicherweise **nicht** geht".
2. **`impressum.html` + `sicherheit.html`** — im alten Brief steht als Punkt 3,
   ob sie den heutigen Zustand (Heim-Relais als Voreinstellung) korrekt
   beschreiben, sei **ungeprüft**. Jetzt prüfen. Insbesondere: dass Klaus
   Relais-Betreiber ist, gehört in die Datenschutzerklärung.
3. **Ein Prüf-Auftrag an `family-project/impressum.html`, Punkt 5.** Dort steht
   *„Netz-Inhalte sind Ende-zu-Ende verschlüsselt."* Das stimmt für
   Direktnachrichten (`modules/dm_crypto.js`) und für Gruppen (AES-GCM,
   `index.html` Z. 745). Das **offene Brett** läuft im Klartext über dasselbe
   Relais. Die Aussage ist damit möglicherweise zu weit gefasst.
   **Erst belegen, dann formulieren** — und nicht nebenbei ändern, das ist eine
   eigene Entscheidung mit eigenem PR.

---

## Prüfen — und die Falle dabei

```bash
npm install --no-save playwright-core   # einmalig je Container
node tests/alle.mjs                     # ALLES: npm test + alle Browser-Suiten (~5 Min)
node tests/alle.mjs loeschen            # nur Suiten mit „loeschen" im Namen
npm test                                # NUR Drift-Guard + App-Schale (Millisekunden)
```

> ⚠️ **`npm test` ist nicht „die Prüfung".** Es läuft `node --test` und fasst die
> 26 Proben unter `tests/` **nicht** an — darunter ausgerechnet
> `smoke_loeschen.mjs`. Nimm `tests/alle.mjs`.
>
> Das ist keine Theorie: die `CLAUDE.md` dieses Repos nannte bis zum 2026-08-17
> nur `npm test` samt einer Zahl („6 bestanden"). Der Anker zeigte auf den
> kleinen Läufer und sah dabei aus wie eine vollständige Auskunft. Berichtigt am
> selben Tag.
>
> Und beim ersten vollen Lauf danach fiel gleich auf, warum das zählt: **`hilfe`
> war rot** — seit wann, weiß niemand. Nicht die App war kaputt, die **Probe**
> war es. Repariert am 2026-08-17, siehe den nächsten Kasten.

### Der tote Wächter, der dabei auffiel — und die Regel daraus

`smoke_hilfe.mjs` starb beim Start an `Cannot read properties of undefined
(reading 'texte')` und prüfte damit **gar nichts**. Ursache: `assets/hilfe.js` ist
der **letzte** von 14 Einträgen der Nachlade-Kette in `index.html`, und jedes Glied
hängt an `requestIdleCallback` mit bis zu 500 ms Frist. Die Probe wartete stur
1800 ms und griff dann zu. Sie verlor das Rennen — an zwei Stellen, die zweite
direkt nach `p.reload()`.

Behoben, indem beide festen Wartezeiten durch `p.waitForFunction(() =>
window.__hilfe && window.__hilfe.texte)` ersetzt wurden. Danach: **22 Prüfungen
grün** statt keiner. Gegenprobe gefahren — ein entfernter Erklärtext (`tb-zoom`)
wirft die Probe um (exit 1), zurückgesetzt ist sie wieder grün (exit 0).

> **Die Regel für alles, was du hier baust:** *Eine Uhr misst nicht, ob etwas
> fertig ist.* Warte auf die **Bedingung**, nie auf eine geschätzte Dauer. Jedes
> `waitForTimeout` mit einer runden Zahl ist ein Rennen, das du irgendwann
> verlierst — und wenn du es verlierst, ist die Probe nicht falsch, sie ist
> **stumm**. Das trifft die neuen Wächter für Sperr-Liste und Melde-Weg
> unmittelbar: beide hängen an nachgeladenen Dateien.

Und die zweite Hälfte: der Läufer gibt bei Rot korrekt `exit=1` zurück. Verdeckt
hatte es ein `| tail` in der Kommandozeile — der Rückgabewert war dann der von
`tail`, nicht der der Prüfung. **`| tail` ist zum Lesen da, nicht zum Urteilen.**

**Neue Wächter, die diese Sitzung braucht** — jeder mit **Gegenprobe**, sonst ist
er nur ein grüner Haken:

| Was bewacht wird | Der eingebaute Fehler, der ihn umwerfen MUSS |
|---|---|
| Gesperrter Zettel wird nicht angezeigt | Sperr-Liste ignorieren |
| Ohne erreichbare Liste läuft die App voll weiter | Laden fehlschlagen lassen |
| Aus der Oberfläche geht es nur nach oben (sperren, nicht lösen) | „rot → grün" aus der App versuchen |
| Melde-Knopf hat eine Erklär-Blase | Eintrag in `hilfe.js` löschen |
| Der Melde-Weg schickt wirklich etwas | Zieladresse leeren |

Und die zwei Regeln, die hier schon teuer bezahlt wurden: **an der Darstellung
messen, nie am Attribut** (bei `position: fixed` ist `offsetParent` immer `null`),
und **immer eine Gegenprobe** — den kaputten Zustand wieder einsetzen und
nachsehen, ob die Prüfung wirklich umfällt.

`tests/_werkzeug.mjs` bietet `starteRelais(port)` und `testSeite(root, relais)`.
Damit lässt sich **messen, wo Daten wirklich landen**, statt eine Absicht im Code
zu behaupten. Für Strang A und B ist das das richtige Werkzeug.

---

## Reihenfolge

1. **Schritt 0** — nachsehen, was auf dem Server läuft. Ohne das ist Strang A
   geraten.
2. **Strang C** (Melde-Weg) zuerst bauen. Er ist der kleinste, er ist die
   gesetzliche Pflicht, und er funktioniert unabhängig vom Server.
3. **Strang B** (Sperr-Liste, App-Seite). Wirkt sofort und netzweit.
4. **Strang A** (Server-Wächter). Setzt Schritt 0 und Strang B voraus.
5. **Die Papiere** parallel, aber vor dem Merge.

**Frag Klaus vor Strang A**, wenn Schritt 0 etwas anderes ergibt als erwartet.
Ein Eingriff in den Relais-Speicher ist schwer umkehrbar — das ist echtes
Zweifeln im Sinne des Freibriefs.

---

## Arbeitsweise (Klaus)

- **Antworten auf Deutsch**, ruhig und präzise. Klaus ist kein Programmierer,
  lernt aber gern. **Einzelschritte** mit klarem Erfolgsmerkmal. Keine
  Terminal-Befehle für ihn, Bedienung über benannte Knöpfe in der Seite — die
  einzige Ausnahme ist der einmalige Server-Schritt aus Schritt 0, und der ist
  ein einziger kopierfertiger `ssh`-Einzeiler.
- **Selbst-Merge-Freibrief gilt** (netzweit, Klaus 2026-06-28): eigene PRs
  selbstständig mergen, sobald getestet, abgegrenzt und nicht architektonisch
  zweifelhaft. Draft-PR → ready → squash. Bei echtem Zweifel erst fragen.
- **Branch immer frisch von `origin/main`**, Push mit ausdrücklicher Refspec,
  danach `git diff --stat origin/main origin/<branch>` — ein leerer PR lässt sich
  mergen und meldet Erfolg.
- **`CACHE_VERSION` in `sw.js` erhöhen**, sobald eine Schalen-Datei sich ändert.
  Sonst sieht Klaus am Tablet die alte Fassung.
- **Ehrlichkeit vor Fertig-Meldung.** Headless grün ist nicht am Tablet grün. Und
  was die App nicht halten kann, wird **im Text der App** benannt, nicht im
  Kleingedruckten. Bei diesem Thema gilt das doppelt: ein Versprechen „endgültig
  gelöscht", das nur für ein Relais gilt, wäre schlimmer als gar keins.

---

## Kurz-Karte: wo was liegt

| Thema | Fundstelle |
|---|---|
| Heim-Relais | `index.html`: `HOME_RELAY` (Z. 679), `heim`, `sendSockets`, `heimStatus` |
| Senden/Lesen-Trennung | `sendSockets()` vs. `liveSockets()` |
| Zurückziehen (NIP-09) | `zurueckziehenFuerAlle`, `handleDeletion`, `machPlatzhalter` |
| Ausblenden | `hideQuestion`, `merkeAusblendung`/`zeigeWieder`, `openAusgeblendet` |
| Relais-Liste | `RELAY_POOL` (Z. 653 ff.), `modules/relay_rotation.js` |
| Verschlüsselung | `modules/dm_crypto.js` (DM), `index.html` Z. 745 (Gruppen, AES-GCM) |
| Echtheit des Absenders | `modules/echtheit.js` |
| Erklär-Blasen | `assets/hilfe.js` — jeder sichtbare Knopf **muss** einen Eintrag haben |
| Vorbild Sperr-Liste | `PWA-Toolpoint/assets/config/wache-hand.json` + `docs/RAUSWURF-REGEL.md` |

---

## Abschluss-Befehl für die nächste Sitzung

Diese Kette reißt nie ab. Am Ende der Sitzung:

1. `docs/BRIEF_NAECHSTE_SITZUNG.md` bzw. einen neuen Brief fortschreiben — Stand,
   was gebaut, was offen, was als Nächstes.
2. Den vollständigen Brief **als Codeblock in die Chat-Antwort** ausgeben. Klaus'
   Tab ist der Einstiegspunkt, nicht der Dateibrowser.
3. Einen „Nächste Schritte"-Block mit 2–4 priorisierten Punkten, je ein Satz
   Begründung.
4. Ehrlich vermerken, was **nur Klaus am Tablet** prüfen kann.
