# Brief an die nächste Sitzung — Kimboard / Moderation

**Stand: 2026-08-19, Ende der Sitzung „Status-Prüfung · Warten auf die
Bedingung".**
`main` = `4654d2f` (Kimboard, unverändert) · `5188fe6` (Sage-Protokol, neu).

Lies zuerst diesen Brief, dann `CLAUDE.md`, dann `docs/MODERATION_UND_RECHT.md`.
Danach nur den Code-Bereich, an dem du arbeitest — `index.html` ist groß, lies
gezielt mit Grep.

> **Das Wichtigste vorweg: es drängt weiterhin nichts.** Das Vorhaben „Löschen"
> ist geschlossen und am echten Relais belegt. Die zwei offenen Punkte sind
> dieselben wie im letzten Brief; einer erledigt sich von allein, der andere
> wartet bewusst. **An Kimboard war nichts zu tun** — alle 31 Prüfungen grün.

---

## Was diese Sitzung getan hat (und warum überhaupt etwas)

Der Auftrag war Nachprüfen, nicht Bauen. Die Arbeit kam **aus dem Nachprüfen
selbst** — beide Male, weil ein Lauf etwas sagte, das man leicht überliest.

**1. Zwei Sage-Proben liefen gar nicht.** `run_alle.mjs` meldete
`78 grün, 0 rot, **2 nicht lauffähig**` — `pinnwand/_smoke_melden` und
`_smoke_mikrofon` fehlte `playwright-core`. Ausgerechnet der Melde-Weg der
Pinnwand vom Vortag war damit **ungeprüft, nicht grün**. Wer nur auf „0 rot"
sieht, hält das für einen sauberen Lauf.

**2. Danach fiel `smoke_bau05_nostr.mjs` um** — genau 5 rote Prüfungen. Einzeln
war sie **25 von 25 Mal grün**, auch unter CPU-Last und neben laufendem
Chromium; drei weitere volle Läufe: grün. **Reproduzieren ließ es sich nicht.**

Trotzdem behoben, denn die Ursache stand im Code: fünf feste `sleep(50)`,
während der Empfänger echte Ed25519-Krypto rechnet. Und beim Aufschreiben kam
der eigentliche Fund heraus — siehe unten.

**Gemergt:** Sage PR #893 (nur Proben + Doku, kein Modul-Code, keine byte-Kopie).

---

## Was steht

| Stück | Stand |
|---|---|
| Melde-Weg ⚑ in **Kimboard** (Art. 16 DSA) | ✅ |
| Melde-Weg ⚑ in der **Pinnwand** | ✅ · und jetzt auch wirklich **geprüft** |
| Sperr-Liste, eingebacken **und** signiert nachgeladen | ✅ live |
| **Pinnwand liest dieselbe Liste** | ✅ ein Ort der Wahrheit |
| Studio 🔧 (sperren · signieren · Schlüssel sichern) | ✅ |
| **Nachsehen-Gang** / **scharfer Gang** `relais-wache.sh` | ✅ |
| **Ein Lauf gegen die echte Datenbank** | ✅ 1 von 1624 → entfernt → 0 von 1623 |
| **Relais-Grenzen** `relais-grenzen.sh` | ✅ gesetzt und gegengeprüft |
| Anzeige-Filter in den anderen 20 Apps | ⬜ Richtungsentscheid, bewusst vertagt |

---

## Was offen ist

**Genau zwei Punkte, unverändert. Keiner davon eilt.**

**1. `grub-pc-bin` + `grub2-common` auf dem Server.** Von Ubuntu wegen
„phasing" zurückgehalten. Sie kommen von allein. Grub ist der Bootloader —
**nichts erzwingen**, nur gelegentlich nachsehen.

**2. Der Anzeige-Filter für die anderen 20 Apps.** Der saubere Ort wäre
`discover()` in Sages Modul 23, drei Zeilen neben dem vorhandenen Mengenschutz
— einmal pflegen, byte-1:1 in 21 Apps neu kopieren.

**Das ist ein Richtungsentscheid für Klaus, nicht für eine Sitzung:** woher
kommt die Liste, was gilt bei Ausfall, was kostet es die Offline-Tauglichkeit —
und es ändert den Kanon in 21 Apps. Die Begründung fürs Vertagen trägt weiter:
**heute gäbe es dort nichts zu filtern.** Wieder aufnehmen, sobald zum ersten
Mal jemand Fremdes etwas hinschreibt.

---

## Was NICHT offen ist, obwohl es so aussehen könnte

Jedes davon ist **gemessen**, nicht angenommen:

- **Fürs Löschen ist in den 20 Apps nichts nachzuziehen.** `relais-wache.sh`
  greift nach der **Kennung** statt nach dem Brett-Tag und deckt den Verkehr
  aller Apps ab, Mycel-Anfragen (`sbkim-qry`) eingeschlossen.
- **Die Pinnwand ist parallel** — Sperr-Liste und Melde-Weg beide da.
  Gesperrt wird weiter **in Kimboard**.
- **Die Relais-Grenzen brauchen keine App-Änderung.**
- **NIP-86 ist belegt tot** — weder `nostr-rs-relay` noch `strfry` meldet die 86.
- **Die Lücke in den 20 Apps ist eine Moderations-, keine Sicherheitslücke.**

---

## Die neue Falle — sie ist die Ergänzung zu einer, die schon hier stand

`CLAUDE.md` sagte bisher: *„Warte auf die Bedingung, nie auf die Uhr … verloren
heißt nicht falsch, sondern stumm."* Das stimmt — deckt aber nur die **eine**
Richtung ab.

| Sorte | Wartet darauf, dass … | Zu kurze Frist ergibt |
|---|---|---|
| **A** | etwas **kommt** | falsches **ROT** — laut, aber irreführend |
| **B** | etwas **ausbleibt** | falsches **GRÜN** — still |

Sorte A gehört auf die Bedingung. **Sorte B braucht eine verstreichende Frist**
— dort macht eine kurze Zahl die Probe nicht flatterhaft, sondern
**nachsichtig**. In Sage stand für „nach einem Replay darf KEINE zweite Antwort
kommen" eine Frist von 50 ms: käme sie nach 60 ms, hätte die Probe grün
gemeldet und **der kaputte Replay-Schutz wäre niemandem aufgefallen**.

Belegt an einer gepatchten Wegwerf-Kopie:
`Sage-Protokol/tests/gegenprobe_bau05_warten.mjs` (8 Fälle, beide Proben).

**Wer eine Wartezeit sieht, fragt zuerst: worauf wartet sie?**

## Die Fallen von zuvor — sie kommen wieder

**Nicht reproduzierbar ist kein Freispruch.** 25 von 25 grün einzeln, einmal rot
im vollen Lauf — die Ursache stand trotzdem im Code. Wer so etwas als „Flake"
abtut, verliert den Wächter: nicht weil die Probe falsch liegt, sondern weil man
sich abgewöhnt, ihr zu glauben.

**„Nicht lauffähig" ist kein Nebensatz.** Es heißt weder ja noch nein — nur,
dass **gar nichts** gemessen wurde. Sage: `npm install`, Kimboard:
`npm install --no-save playwright-core`.

**Was man nicht messen kann, schreibt man fest** (die behauptete statt gemessene
Ausfüllzeit im Melde-Weg).

**Gerechnete Maße sind keine gemessenen** (zwei 24 px breite Knöpfe, die in
Wahrheit 32 px maßen und sich überlappten).

**Ein „ungültig" braucht denselben Argwohn wie ein „gültig"** (`schnorr.verify`
meldete `false`, weil `globalThis.self` in Node fehlte).

**Der Umschlag ist nicht die Liste** (ein naiver JSON-Leser hätte Klaus' eigenen
Schlüssel als gesperrten Absender gelesen).

**`${X:-vorgabe}` greift auch bei LEEREM X.** Für „leer heißt aus" braucht es
`${X-vorgabe}` mit EINEM Bindestrich.

**`indexOf` gibt −1 zurück, und −1 ist kleiner als alles.**

**Eine Gegenprobe verändert den Arbeitsbaum — währenddessen wird nicht
committet.** *Umgehbar:* diese Sitzung hat ihre Gegenprobe an einer
**Wegwerf-Kopie** arbeiten lassen (`_wegwerf_*.mjs`, im `finally` gelöscht, vom
Läufer nicht eingesammelt). Dann greift die Falle gar nicht erst. Wo das geht,
ist es die bessere Bauart.

**Und ein `git status` vor dem `git add -A` ist billiger als jede Reparatur.**
Diese Sitzung hat zusätzlich `pgrep` gefragt, ob eine Gegenprobe läuft — der
Treffer war der eigene Bash-Aufruf. **Auch eine Warnung will nachgesehen
werden**, nicht nur ein Grün.

---

## ⏰ Kleinigkeiten mit Stichtag — ab **2026-09-02** von selbst ansprechen

Klaus am 2026-08-19: *„erinnere mich nach gegebener Zeit — nach zwei oder drei
Sitzungen."* **Sitzungen lassen sich nicht zählen**, das Datum schon.

**Was eine Sitzung damit tut:** ist heute der **2026-09-02 oder später** und
steht hier noch etwas, dann sprich Klaus **von dir aus** darauf an — kurz, ohne
Drängen. Ist ein Punkt erledigt, streiche ihn. Ist die Liste leer, kommt der
Abschnitt weg.

*Am 2026-08-19 war der Stichtag noch nicht erreicht — deshalb ungefragt nichts
angesprochen.*

| # | Was | Stand |
|---|---|---|
| ~~1~~ | ~~26-MB-Sicherung löschen~~ | ✅ weg, 32 G frei |
| **2** | **`grub-pc-bin` + `grub2-common`** | ⬜ wegen „phasing" zurückgehalten — kommt von allein, nichts erzwingen |
| ~~3~~ | ~~`/opt/relay/db` steht auf `0777`~~ | ✅ `chown 1000:1000` **und** `chmod 755` |
| ~~4~~ | ~~E2E-Aussage in `family-project`~~ | ✅ acht Stellen korrigiert (PR #284) |
| ~~5~~ | ~~Vorfrage: nimmt das Relais Fremde an?~~ | ✅ ja, ungebremst. Grenzen gesetzt |

---

## Wie geprüft wird

```bash
# Kimboard
npm install --no-save playwright-core   # einmalig je Container
node tests/alle.mjs                     # ALLES (~5 Min) — 31 Prüfungen
bash tests/gegenprobe_wache.sh          # 24 eingebaute Fehler
bash tests/gegenprobe_moderation.sh     # eingebaute Fehler, mit Browser

# Sage-Protokol
npm install                             # fake-indexeddb
npm install --no-save playwright-core   # sonst 2 Pinnwand-Proben NICHT lauffähig
node tests/run_alle.mjs                 # 80 Proben
node tests/gegenprobe_bau05_warten.mjs  # 8 Fälle, Wegwerf-Kopie
bash tests/gegenprobe_pinnwand_melden.sh
```

**Zuletzt gemessen (2026-08-19):** Kimboard **31/31 grün** · Sage **80 grün, 0
rot, 0 nicht lauffähig** · Gegenprobe **8 wie erwartet**.

**`npm test` allein ist nicht „die Prüfung"** — es fasst die Proben unter
`tests/` nicht an. **`| tail` ist zum Lesen da, nicht zum Urteilen.** Und **lies
die Zeile „nicht lauffähig" mit** — sie sagt, was gar nicht gemessen wurde.

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
erfinden. Ein leerer Brief ist ein gutes Ergebnis — aber *nachsehen* gehört
trotzdem dazu, und wenn das Nachsehen etwas findet, ist das keine erfundene
Arbeit.
