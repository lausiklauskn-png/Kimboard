# Kimboard — semantische Pinnwand (SBKIM-Endknoten)

**Fragen und Notizen an ein geborgtes „dummes Brett" heften — nach Bedeutung
sortiert — und als eigenständiger SBKIM-Knoten.**

Kimboard ist die SBKIM-Pinnwand (aus `Sage-Protokol/pinnwand/`) als eigenständige,
installierbare **PWA** und vollwertiger **SBKIM-Endknoten** — nach dem bewiesenen
Kim-Bell-Muster. Server-los, geräteübergreifend über ein geborgtes Nostr-Brett;
der private Schlüssel bleibt lokal.

Live: <https://lausiklauskn-png.github.io/Kimboard/>

## Was Kimboard kann

- **Semantische Pinnwand.** Eine Frage aufs geborgte, dumme Brett (Nostr) legen;
  Antworten kommen geräteübergreifend zurück und werden nach Bedeutung sortiert.
  Optional privates, verschlüsseltes Brett; KI-Richter (opt-in, BYOK).
- **Eigener SBKIM-Knoten.** Eigene, im Browser signierte Identität + Spore
  (Ed25519), Status-Lampen-Leiste + Selbst-Siegel (Bronze/Gold), „🌐 Mit dem Netz
  verbinden" (Modul 23 Rendezvous), server-loser Handshake mit anderen Knoten.

## Saubere Netz-Anmeldung (der Browser als schwarzes Loch)

Alle SBKIM-PWAs liegen unter **einer** Origin (`lausiklauskn-png.github.io`).
IndexedDB, Service-Worker und Caches hängen an der Origin, nicht am Pfad. Kimboard
löst das (Skill `saubere-netz-anmeldung`):

- **Modus A — sanft, automatisch, beim Laden, idempotent, NICHT zerstörend:**
  öffnet die eigene Schublade `sbkim_kimboard` und sichert eine stabile Identität.
- **Modus B — Nutzer-Knopf „🧹 Aufräumen & neu anmelden":** reinigt **nur die
  eigene Origin** (löscht den geteilten Alt-Topf `sbkim`, meldet Service-Worker ab,
  leert Caches — die eigene Schublade bleibt), erzeugt dann eine frische Identität +
  Spore und meldet im Netz an. Danach **hart neu laden** (Strg+Shift+R).

## Aufbau (self-contained)

| Pfad | Zweck |
|---|---|
| `index.html` | Pinnwand-App + voller Endknoten-Stack |
| `manifest.json` · `sw.js` | installierbare, offline-fähige PWA-Schale |
| `icon-192.png` · `icon-512.png` · `impressum.html` · `sicherheit.html` | PWA-Grundausstattung (Impressum = Platzhalter, keine PII) |
| `assets/storage-init.js` | Modus A / eigene Schublade `sbkim_kimboard` |
| `assets/rendezvous-init.js` | Modus A fahren + 🌐-Knopf mounten (nodeName Kimboard) |
| `assets/nostr-listen-init.js` | Empfangsmodus: lauscht, damit man erreichbar ist |
| `assets/schutz-init.js` | Status-Widget (17) → Membran (15) → Siegel (16) + Apoptose (07) |
| `assets/siegel-inhalt.js` | Andock-Werkzeug im Siegel (🔑 Identität & Spore · ✍ Semantik · 🛡 Schutz) |
| `modules/*.js` | **byte-1:1-Kopien** der SBKIM-Kern-Module (Drift-Guard im Test) |
| `sbkim/spore.json` | öffentliche Visitenkarte (nach Klaus' Browser-Lauf; kein Schlüssel) |

Kanonische Quelle der `modules/*.js`: `Sage-Protokol/src/modules/*` (bzw.
`pinnwand/modules/*` für 03/24/noble). Der Smoke-Test prüft die sha256-Gleichheit.

## Anmelden (Schritt 3, im Browser)

1. Seite öffnen → Siegel-Modal → **🔑 Eigene Identität & Spore erzeugen** →
   Identität erzeugen → Spore signieren + herunterladen.
2. Die heruntergeladene `spore.json` nach `sbkim/spore.json` committen (öffentlich,
   **kein** privater Schlüssel).
3. **🌐 Mit dem Netz verbinden** → im Raum anmelden; ein Gegenknoten (z.B. Sage)
   kann dann andocken (server-loser Handshake).

## Test

```bash
npm test   # node --test: Drift-Guard (sha256) + App-Schale + Pinnwand-Erhalt + Modul 23
```

Der **Browser-Sichttest** (echtes IndexedDB, Service-Worker, Live-Relais,
Modell-Laden, Pinnwand, Handshake) bleibt „ungeprüft, wartet auf Klaus'
Browser-Lauf".
