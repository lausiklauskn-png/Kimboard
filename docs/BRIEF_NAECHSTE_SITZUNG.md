# Brief an die nächste Sitzung — Kimboard

**Stand: 2026-08-01, Ende der Bau-Sitzung. `main` = `CACHE_VERSION` v50.**

Lies diesen Brief zuerst, dann `README.md`. Danach nur den Code-Bereich, an dem
du arbeitest — `index.html` ist groß, lies gezielt mit Grep.

---

## Wo wir stehen

Der Plan „Pinnwand: Kontakte wie bei WhatsApp" ist **vollständig abgearbeitet**.
Dazu kamen an einem Tag mehrere Befunde aus Klaus' Sichttests am Tablet und ein
Datenschutz-Einwand, der die Architektur verändert hat.

Gebaut und gemergt (PR #72 – #81):

| Was | Kern |
|---|---|
| Kontakte | „➕ Kontakt" am Zettel, „➖ Kontakt" zum Entfernen, Profil beim Tippen auf den Namen, Kontakt senden |
| Löschen | „nur bei mir" / „bei allen" (NIP-09), Sammelweg „🗑 Meine zurückziehen" |
| Zurückgezogen | vergänglicher Hinweis „🚫 Diese Nachricht wurde zurückgezogen" (1 Stunde, danach spurlos) |
| Ausblenden | „↩ Rückgängig" (8 s), Fenster „👁 Ausgeblendet", ✕ an jeder einzelnen Antwort |
| Gruppen | benannte Mitgliederliste, Einladung mit **automatischem Schlüsseltausch** beim Annehmen |
| Nachholen | „🕓 Älteres nachholen" — liest den Vorrat der zuletzt benutzten Relais |
| **Heim-Relais** | **schmal senden, breit lesen** — geschrieben wird nur auf `relay.family-projekt.de` |

**Klaus' Sichttest am Tablet ist grün** („Sieht perfekt aus"). Offen ist nur der
**Zwei-Geräte-Lauf mit einer Gruppe** — siehe unten.

---

## Die Architektur-Entscheidung, die du kennen musst

**Heim-Relais (2026-08-01).** Vorher ging *jeder* Zettel an *alle* verbundenen
Relais — auch verschlüsselte, jede Gruppen-Kopie, sogar die Rückzieh-Bitten. Bei
fünf voreingestellten Relais landeten die Daten bei vier fremden Betreibern.

Jetzt gilt die Asymmetrie:

- **`sendSockets()`** liefert die Leitungen zum **Senden** (nur Heim-Relais).
- **`liveSockets()`** bleibt für alles andere: Verbindungszahl, **Abonnieren**,
  Lesen.

> ⚠️ **Beim Weiterbauen:** Jede neue Sendestelle nimmt `sendSockets()` und stellt
> vorher `if (!heimBereit()) return;` davor. Jede neue *Lese*-Stelle nimmt
> `liveSockets()`. Wer das vertauscht, verengt entweder das Lesen (dann fehlen
> Zettel) oder streut wieder an fremde Betreiber. Beides fangen
> `smoke_heim_relais.mjs` und `smoke_nachholen.mjs`.

**Ausnahme:** `zurueckziehenFuerAlle` bricht bewusst **nicht** ab, wenn nichts
rausgeht — die Bitte an die anderen kann scheitern, das Wegnehmen bei mir nicht.

---

## Prüfen — und die Falle dabei

```bash
node tests/alle.mjs           # ALLES: npm test + alle 22 Browser-Suiten (~5 Min)
node tests/alle.mjs kontakt   # nur Suiten mit „kontakt" im Namen
npm test                      # nur Drift-Guard + App-Schale (Millisekunden)
```

Voraussetzung einmalig: `npm install --no-save playwright-core`.

> ⚠️ **Die Falle, in die ich getappt bin:** Es gibt **zwei** Sorten Prüfungen.
> Ich habe einen Tag lang nur die Browser-Suiten laufen lassen und dabei nicht
> gemerkt, dass `npm test` (Drift-Guard) rot war. Darum gibt es jetzt
> `tests/alle.mjs` — **nimm den**, nicht die Einzelläufe.

### Zwei Regeln fürs Prüfen, teuer bezahlt

1. **An der Darstellung messen, nie am Attribut.** Ein Element mit
   Inline-`display:flex` bleibt sichtbar, auch wenn `hidden` gesetzt ist. Also
   `offsetParent`, `checkVisibility()` oder `getComputedStyle`. — Und: bei
   `position: fixed` ist `offsetParent` **immer** `null`; dort die Kennung an den
   inneren Kasten hängen (Muster: `#loesch-dialog`, `#ausgeblendet-fenster`).
2. **Immer eine Gegenprobe.** Alten, kaputten Zustand wieder einsetzen und
   nachsehen, ob die Prüfung wirklich umfällt. Dreimal hat das an einem Tag eine
   wirkungslose Prüfung entlarvt — zuletzt eine Größen-Prüfung, die gar nichts
   messen konnte, weil `button { padding }` die deklarierte Größe überschrieb.

### Werkzeug

`tests/_werkzeug.mjs` bietet `starteRelais(port)` (echtes Mini-Relais mit Vorrat,
protokolliert was ankommt) und `testSeite(root, relais)` (dieselbe `index.html`
mit Test-Adressen statt der echten). Damit lässt sich **messen, wo Daten wirklich
landen** — statt eine Absicht im Code zu behaupten. Benutz das, statt einen
vierten WebSocket-Server zu schreiben.

**Zum Drift-Guard:** In `modules/` liegen zweierlei Dateien — byte-1:1-**Kopien**
aus Sage (die sich **nicht** ändern dürfen) und **Kimboard-eigene** Module
(`echtheit.js`, `relay_rotation.js` — die gibt es in Sage gar nicht). Für die
eigenen ist der Fingerabdruck kein Verbot, sondern ein Merkposten: Wer sie
ändert, trägt den neuen Wert in `test/smoke.test.js` bewusst nach.

---

## Was als Nächstes anstehen könnte

Nichts davon ist beauftragt — es ist die ehrliche Liste dessen, was offen oder
absehbar ist. **Frag Klaus, bevor du eines davon baust.**

### 1. Zwei-Geräte-Lauf mit einer Gruppe (offen, nur Klaus)

Gruppe anlegen → einladen → der andere nimmt an → beide schreiben und antworten.
Der gemeinsame Faden (`gm`-Marke) ist headless bewiesen, aber der echte Lauf über
zwei Geräte und ein echtes Relais steht aus. **Wenn dabei etwas hakt, ist das der
wahrscheinlichste Ort:** Antworten anderer Mitglieder, die im falschen Strang
landen.

### 2. Heim-Relais: die Gegenseite

Die Einstellung schützt **den eigenen Absende-Weg**. Schreibt ein Kontakt aus
einer anders eingestellten App, landet die Unterhaltung trotzdem überall. Denkbar:
ein sichtbarer Hinweis am Kontakt („schreibt an fremde Relais"), sobald man das
erkennen kann. Ungelöst — und ehrlicherweise vielleicht nicht lösbar.

### 3. Betreiber-Pflichten für das eigene Relais

Liegen die Daten auf Klaus' Server, ist er die verantwortliche Stelle:
Datenschutzerklärung, Löschverlangen, Zugangsregeln. `impressum.html` und
`sicherheit.html` existieren — ob sie den neuen Zustand (Heim-Relais als
Voreinstellung) korrekt beschreiben, ist **ungeprüft**.

### 4. Die Platzhalter-Stunde

Der „zurückgezogen"-Hinweis steht eine Stunde. Das ist **geraten, nicht gemessen**
(`PLATZHALTER_DAUER` in `index.html`). Wenn Klaus im Alltag sagt „zu kurz" oder
„zu lang" — eine Zeile.

### 5. Die acht Sekunden für „Rückgängig"

Ebenfalls geraten. Klaus hat es am Tablet gesehen und nicht beanstandet; falls
doch, steht der Wert in `toastRueckgaengig`.

### 6. Relais-Pool

`RELAY_POOL` enthält neun Adressen, darunter `relay.nostr.band` — ein Archiv- und
**Suchdienst**. Zum *Lesen* ist er nützlich, aber es lohnt die Frage, ob er in den
Voreinstellungs-Fünf stehen sollte.

---

## Arbeitsweise (Klaus)

- **Antworten auf Deutsch**, ruhig und präzise. Klaus ist kein Programmierer,
  lernt aber gern. **Einzelschritte** mit klarem Erfolgsmerkmal, keine
  Terminal-Befehle für ihn — Bedienung über benannte Knöpfe in der Seite.
- **Selbst-Merge-Freibrief gilt** (netzweit, Klaus 2026-06-28): eigene PRs
  selbstständig mergen, sobald getestet, abgegrenzt und nicht architektonisch
  zweifelhaft. Draft-PR → ready → squash. Bei echtem Zweifel erst fragen.
- **`CACHE_VERSION` in `sw.js` bei jeder Schalen-Änderung erhöhen**, sonst sieht
  Klaus am Tablet die alte Version. Er lädt danach hart neu.
- **Ehrlichkeit vor Fertig-Meldung.** Was headless grün ist, ist nicht am Tablet
  grün. Sitzungen schließen mit „Sichttest am Tablet steht aus", solange Klaus
  nicht geschaut hat. Und was die App nicht halten kann (Löschen auf fremden
  Relais, Vollständigkeit beim Nachholen), wird **im Text der App** benannt —
  nicht im Kleingedruckten.

---

## Kurz-Karte: wo was liegt

| Thema | Fundstelle in `index.html` |
|---|---|
| Heim-Relais | `HOME_RELAY`, `heim`, `sendSockets`, `heimBereit`, `heimStatus` |
| Senden/Lesen-Trennung | `sendSockets()` vs. `liveSockets()` |
| Gruppen | `dmGroups`, `sendeAnGruppe`, `gmOf`/`threadOf`/`gmIndex`, `openGruppen` |
| Zurückziehen | `zurueckziehenFuerAlle`, `handleDeletion`, `machPlatzhalter`, `raeumePlatzhalter` |
| Ausblenden | `hidden`, `hideQuestion`, `merkeAusblendung`/`zeigeWieder`, `openAusgeblendet` |
| Kontakte | `dmContacts`, `pinContact`, `entferneKontakt`, `makeContactAction` |
| Nachholen | `holeAelteres`/`holeAelteresMit`, `nachholRelais` |
| Rotation | `modules/relay_rotation.js` (+ `relaysForRecentWindows`) |
| Erklär-Blasen | `assets/hilfe.js` — jeder sichtbare Knopf **muss** einen Eintrag haben (`smoke_hilfe` erzwingt es) |
