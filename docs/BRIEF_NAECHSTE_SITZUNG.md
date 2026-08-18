# Brief an die nächste Sitzung — Kimboard

**Stand: 2026-08-18, Ende der Sitzung „Studio — Strang A".**
`main` war beim Start `51d68e3`.

Lies zuerst diesen Brief, dann `CLAUDE.md`, dann `docs/MODERATION_UND_RECHT.md`.
Danach nur den Code-Bereich, an dem du arbeitest — `index.html` ist groß, lies
gezielt mit Grep.

## Was in dieser Sitzung entstanden ist

Klaus, wörtlich: *„Ich möchte von meinem Gerät KIMboard beim längerem Klick auf
Copyright © die Funktion eines Studios wie in PWA Toolpoint, dass ich die
Kontrolle inkl. endgültigem Löschen auf dem Kimboard habe."*

Das hat die Richtung von Strang A gedreht — **weg** vom stummen Server-Wächter,
der eine Datei im Takt liest, **hin** zu einem Bedienfeld in Klaus' Hand. Und
genau diese Drehung hat nebenbei die Blockade gelöst, an der die Sache seit dem
17. hing (dazu unten mehr).

| Teil | Stand |
|---|---|
| **Studio** (`assets/studio.js`) mit drei Bereichen | ✅ gebaut |
| **Zugang**: langer Druck ~1,5 s aufs © | ✅ gebaut |
| **Sperren** aus dem Studio + signierte Liste erzeugen | ✅ gebaut, Rundlauf bewiesen |
| **Endgültig entfernen** per NIP-86 | ✅ gebaut — **wirkt aber nur, wenn das Relais es kann** |
| Probe `tests/smoke_studio.mjs` | ✅ 64 Prüfungen |
| Gegenprobe erweitert | ✅ 29 Fehler, alle gefangen |

## Schritt 0 ist beantwortet — von der App, nicht von einer Sitzung

Monatelang stand die Frage offen, welche Relais-Software auf Klaus' Server
läuft. Aus einer Bau-Sitzung ist sie **nicht** zu beantworten, und das ist jetzt
belegt statt vermutet: der Egress-Proxy weist beide Namen als
Organisations-Sperre aus (`connect_rejected`, „gateway answered 403 to CONNECT",
Status-Endpunkt am 2026-08-18). Der README dazu sagt ausdrücklich: nicht
umgehen, sondern melden.

Aus **Klaus' Browser** ist die Leitung offen. Also fragt die App: das Studio
ruft jedes verbundene Relais per NIP-11 ab und zeigt Software, Fassung und ob
NIP-86 dabei ist. Das ist keine Notlösung — die Auskunft ist dort ohnehin
aktueller als in jedem Protokoll, das eine Sitzung einmal abgeschrieben hätte.

**Was Klaus dort sehen wird, ist absehbar und wird enttäuschen:**
`nostr-rs-relay` (laut `family-project/docs/PULS.md` die dort laufende Software)
kann **kein** NIP-86. Der Knopf „🗑 Endgültig vom Relais" wird also sagen, dass
es nicht geht — und **nichts schicken**, statt einen Auftrag ins Leere zu senden
und Erfolg zu melden. Das ist die ehrliche Fassung, aber es ist noch nicht das,
was Klaus wollte.

## Was als Nächstes ansteht

1. **Klaus' Sichttest abwarten und die Relais-Auskunft ablesen.** Erst danach
   ist die Entscheidung unter 2. eine Entscheidung und keine Vermutung. Was er
   sieht, gehört in `docs/MODERATION_UND_RECHT.md` § 6.
2. **Dann die Weiche für „wirklich weg":** entweder das Heim-Relais auf eine
   Software mit NIP-86 umstellen (`strfry`), oder der ursprünglich geplante
   kleine Dienst auf dem Server, der die Sperr-Liste im Takt liest (Muster:
   2-Minuten-Cron aus dem Skill `auto-deploy-einrichten`). **Das ist ein
   Richtungsentscheid — Klaus fragen, nicht wählen.** Ein Software-Wechsel am
   laufenden Relais ist schwer umkehrbar.
3. **`betreiberSchluessel` eintragen.** Ohne ihn gibt es kein Studio. Klaus
   bekommt die fertige Zeile im Studio selbst zum Kopieren (langer Druck aufs ©
   → „📋 Zeile kopieren"). Achtung, das ist eine echte Grenze: die Kennung hängt
   am **Browser**, nicht an der Person. Auf dem zweiten Gerät ist sie eine
   andere, und dort geht das Studio dann nicht auf. Ob das reicht oder ob
   mehrere Kennungen zugelassen werden sollen, weiß erst Klaus, wenn er es
   benutzt hat.
4. **Aus dem alten Brief unverändert offen:** Prüf-Auftrag an
   `family-project/impressum.html` Punkt 5 („Netz-Inhalte sind Ende-zu-Ende
   verschlüsselt" — trifft auf DMs und Gruppen zu, das **offene Brett** läuft im
   Klartext; erst belegen, dann formulieren, eigener PR). Dazu der
   Zwei-Geräte-Lauf mit einer Gruppe, die geratene Platzhalter-Stunde, die acht
   Sekunden für „Rückgängig", und ob `relay.nostr.band` — ein Archiv- und
   Suchdienst — in den Voreinstellungs-Fünf stehen sollte.

## Was das Studio bewusst NICHT kann

- **Es veröffentlicht die Sperr-Liste nicht selbst.** Es signiert sie und legt
  sie als Datei hin; einchecken muss Klaus. Ein direkter Weg bräuchte einen
  Server mit Token (wie im family-projekt.de-Studio) — den hat Kimboard bewusst
  nicht.
- **Es kann nichts lösen.** Sperren geht aus der Oberfläche, gelöst wird nur in
  der Datei. Ein Betreiber-Werkzeug, das diese Regel umginge, wäre ein Loch in
  genau der Regel, die es durchsetzen soll.
- **Der lange Druck ist kein Schutz**, und der Schlüssel-Vergleich auch nicht:
  `betreiberSchluessel` steht öffentlich in `moderation.js`. Wer das Fenster
  aufmacht, kann trotzdem nichts bewirken — jede Handlung ist ein signiertes
  Ereignis, und signieren kann nur, wer den privaten Schlüssel hat.

## Prüfen

```bash
npm install --no-save playwright-core     # einmalig je Container
node tests/alle.mjs                       # ALLES — 28 Prüfungen
bash tests/gegenprobe_moderation.sh       # 29 eingebaute Fehler, jeder MUSS fangen
```

Zuletzt: **alle 28 grün** (Rückgabewert 0, ohne Pipe gemessen), Gegenprobe
**29 von 29**.

### Was die Gegenprobe diesmal gefunden hat — vier blinde Prüfungen

Alle vier in der **Probe**, keine im Code. Sie sind es wert, gelesen zu werden,
weil sie sich alle gleich anfühlen: grün, und trotzdem nichts gemessen.

1. **Die Fußzeile lag außerhalb des Sichtfelds.** Die Maus traf sie nie, und
   „ein kurzer Tipp öffnet nichts" war deshalb grün, ohne etwas zu berühren.
   → `scrollIntoViewIfNeeded()`, und eine eigene Prüfung, dass sie wirklich im
   Bild liegt.
2. **Eine per `route` gefälschte Antwort ohne Freigabe-Kopf.** Der Browser
   verwarf sie, das Studio meldete völlig korrekt „keine Auskunft" — gemessen
   wurde die eigene Nachlässigkeit. Gefälschte Antworten brauchen dieselben
   CORS-Köpfe wie echte, und der POST auch eine Antwort auf die Vorab-Frage
   (OPTIONS).
3. **Gewartet auf ein Wort, das schon dastand.** „Verwaltung" steht in der
   Erklärzeile über der Liste — die Bedingung feuerte sofort, und gelesen wurde
   „wird abgefragt …". → Auf etwas warten, das es **nur nach** der Abfrage gibt.
4. **Nach dem Schlüssel in der falschen Form gesucht.** `priv` ist ein
   Byte-Feld (`fromHex(privHex)`), kein Hex-Text; `JSON.stringify` macht daraus
   `{"0":18,…}`. Die Suche ging daran vorbei. → In beiden Formen suchen.

Dazu eine Prüfung, die sich **gar nicht** mit der Maus messen ließ: zieht man
über Text, beginnt Chrome eine Textauswahl und schickt von sich aus
`pointercancel` — der Druck bricht dann auch ohne unseren Handler ab. Auf Klaus'
Tablet ist aber genau dieser Handler der wirksame Weg (dort scrollt der Finger).
Deshalb misst `smoke_studio.mjs` ihn mit echten Pointer-Ereignissen, und
**direkt daneben steht die Gegenprobe dazu**: ohne Wischen muss derselbe Weg
öffnen — sonst wäre die Prüfung grün, weil die künstlichen Ereignisse überhaupt
nichts auslösen.

## Was nur Klaus prüfen kann

Alles headless grün, am Tablet ungeprüft:

- Ob der lange Druck aufs © **mit dem Finger** gut trifft, ohne beim Scrollen
  von allein aufzugehen.
- Was die Relais-Auskunft **wirklich** sagt (siehe oben — das ist der eigentlich
  interessante Punkt).
- Ob das Studio-Fenster auf schmalem Schirm lesbar ist. Es ist ein 640-px-Kasten
  mit `max-height:86vh` und eigenem Rollbalken; auf dem Handy dürfte die
  Zettel-Liste eng werden.
- Ob „📋 Zeile kopieren" auf dem Tablet in die Zwischenablage kommt
  (`navigator.clipboard` braucht eine sichere Herkunft — auf GitHub Pages
  gegeben).

`CACHE_VERSION` = `kimboard-v59`, nach dem Merge Hard-Reload.

## Kurz-Karte

| Thema | Fundstelle |
|---|---|
| Studio | `assets/studio.js` |
| Zugang (langer Druck aufs ©) | `index.html`, letzter `<script>`-Block vor `</body>` |
| Brücke aus dem Modul-Scope | `index.html`: `signiere`, `__kb.zettel/relaisListe/sperreJetzt` |
| Betreiber-Ausweis | `assets/config/moderation.js`: `betreiberSchluessel` |
| Melden | `index.html`: `meldeKnopf`, `openMeldeDialog`, `sendeMeldung` |
| Die Sperr-Liste | `assets/config/sperrliste.js` |
| Anwenden · Nachladen · Nachwischen | `index.html`: `istNetzGesperrt`, `ladeSperrQuelle`, `wischeGesperrte` |
| Netz-zuerst für die Liste | `sw.js` (sonst friert sie ein) |
| Einordnung + Rechtslage | `docs/MODERATION_UND_RECHT.md` |
| Proben · Gegenprobe | `tests/smoke_studio.mjs`, `tests/smoke_melden.mjs`, `tests/smoke_sperrliste.mjs`, `tests/gegenprobe_moderation.sh` |

## Abschluss-Befehl

1. Diesen Brief fortschreiben. 2. Vollständig als Codeblock in die Chat-Antwort.
3. „Nächste Schritte"-Block mit 2–4 Punkten. 4. Ehrlich vermerken, was nur Klaus
am Tablet prüfen kann.
