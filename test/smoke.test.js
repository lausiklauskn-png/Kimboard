// Kimboard — Smoke-Test (Beweis).
//
// Drei Teile:
//   1) Drift-Guard: die byte-1:1-Kopien der SBKIM-Kern-Module (modules/*.js)
//      müssen ihren aufgezeichneten sha256 halten. Verändert jemand eine Kopie
//      versehentlich, wird der Test rot — „kopieren, nicht klonen" bleibt
//      nachprüfbar (kanonische Quelle: Sage-Protokol/src/modules/*, bzw.
//      pinnwand/modules/* für 03/24/noble/dm_crypto).
//   2) App-Schale-Vollständigkeit + korrekte Ladeordnung (Storage-Kern VOR der
//      eigenen Schublade, Widget 17 vor Membran 15 / Siegel 16).
//   3) Pinnwand-Funktion erhalten (Nostr-Tag + EVENT/REQ + Whitening) UND
//      Endknoten-Stack vorhanden.
//
// Ehrlichkeit: der echte Browser-Pfad (Live-Relais, IndexedDB, Service-Worker,
// Modell-Laden, Pinnwand, Handshake) bleibt „ungeprüft, wartet auf Klaus'
// Browser-Lauf".

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ZWEI ARTEN von Dateien liegen in modules/ — der Unterschied war bisher nicht
// sichtbar, und genau daran ist diese Prüfung 2026-08-01 rot geworden:
//
//   KOPIEN aus Sage („kopieren, nicht klonen"): Ändert sich hier etwas, ist das
//   ein FEHLER. Reift ein Modul, wird es in Sage gepflegt und neu kopiert.
//
//   KIMBOARD-EIGENE Module (echtheit.js, relay_rotation.js): Die gibt es in
//   Sage gar nicht, sie sind hier entstanden. Sie DÜRFEN wachsen — der
//   Fingerabdruck ist für sie kein Verbot, sondern ein Merkposten: Wer sie
//   ändert, trägt den neuen Wert bewusst nach (und merkt so, dass er ein
//   geteiltes Modul angefasst hat).
const EXPECTED_SHA256 = {
  "01_storage.js": "5a5a4bf64dfcc107da7ed70fb755d7db5cce7d80e963b3e2fbc2004537747820",
  "02_spore.js": "0cbf0664e2a79f1301c03e52f7ac0030d4b2961f03b97b38e8634827a52353c5",
  "03_embedding.js": "2e31baa09a2959c95efff8eecd224e8343e75695b4b293aa35209d8f96d1f3b5",
  "04_match.js": "721eecc3c0d6ea4c259259e6071215ec1cd16f1c43c87b42ce9e72e9a0b5e41c",
  "05_anastomose.js": "255ac79aeb3b0203e92f0cebd0a905e47c488b43efe18f41332a7d35520bbf23",
  "05b_nostr_relay.js": "37eee5b196b3efad57131edd1cc3c0ee23acb97b5ca40740d6a0771db4b4a421",
  "07_apoptose.js": "0acdd6ab2d95e131fa6953061cc0e95a2396e05fff091a7dc690b2668a4c035a",
  "15_membran.js": "829a5bc01976b59c5ce428125314b87b314b6212cd5a473634c2d22c02579397",
  "16_siegel.js": "d26a262f593a75c44d22377059d4d076e4455e9f6bcc68b0c2ea992cd3380d37",
  "20_schluessel_safe.js": "e7e25c9070e93f8267171d2b626109cfd90cb481c2781242f5f7dfc203f031f3",
  "21_spracheingabe.js": "020ca26ff52f2ed726f6344bd3ac55eb52e3472a7f97bdd41bdd0d54132777ba",
  "17_floating_widget.js": "e4ee076c1295910d0e83470ebda327e7419f29bc06f6718148369c8369e1a5ce",
  "23_rendezvous.js": "5aa8262638eeaf70f5e5563592a730f240a95ed80daf41a4df5d7d51824afb74",
  "23_rendezvous_ui.js": "66b2c6b95d27e35cb3b9697a5edc3250dfb50eb960375f9a68ab696ab05b82d2",
  "24_ocr_eingabe.js": "f638f1cf4aaaa22e91186249f91cb1d4ac630f44a374a3de08192ea144948faa",
  "noble-secp256k1.js": "8f3879ca422c4fdfe7ca0361688636fa7cc550a59bd94d512ed6ec79aa3d55d1",
  "pruefer-mail.js": "cdf3ca7881bfa68763a2c0be7436d35a65bea4dbd03f606e02eaec5c613632d7", // Prüfliste (Auslieferungsprüfer, über Sage assets/), Bau 04.J
  "dm_crypto.js": "e9c973f0459c5f03fa80b47d3cd4505ef6d4bd689e409569370a59db2586ba63",
  // — Kimboard-eigen (dürfen wachsen, Wert bewusst nachtragen) —
  "echtheit.js": "14c164b2585fea56d082b17ede24933838a45fd8ac55d05818b5e45ef8d7fac3",
  "relay_rotation.js": "ec6c11b6730c8a3ca5439b2cdfabc6aa9339b193db3c81b7f7d253e56ac92962",
};

test("Drift-Guard: jede Modul-Kopie hält ihren aufgezeichneten sha256", () => {
  const onDisk = readdirSync(join(ROOT, "modules")).filter((f) => f.endsWith(".js")).sort();
  assert.deepEqual(onDisk, Object.keys(EXPECTED_SHA256).sort(),
    "modules/ enthält genau die erwarteten Kopien (keine fehlt, keine zusätzlich)");
  for (const f of onDisk) {
    const sum = createHash("sha256").update(readFileSync(join(ROOT, "modules", f))).digest("hex");
    assert.equal(sum, EXPECTED_SHA256[f], `Modul-Kopie unverändert: ${f}`);
  }
});

test("App-Schale ist vollständig (self-contained PWA)", () => {
  for (const f of ["index.html", "manifest.json", "sw.js", "impressum.html", "sicherheit.html",
                   "icon-192.png", "icon-512.png",
                   "assets/storage-init.js", "assets/rendezvous-init.js", "assets/nostr-listen-init.js",
                   "assets/schutz-init.js", "assets/siegel-inhalt.js",
                   "assets/sbkim-andock-wizard.js"]) {
    assert.ok(readFileSync(join(ROOT, f)).length > 0, `${f} vorhanden + nicht leer`);
  }
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.match(html.slice(0, 200).toLowerCase(), /<!doctype html/, "index.html ist HTML");
  // Ladeordnung: Storage-Kern VOR der eigenen Schublade (Modus A).
  assert.ok(html.indexOf('"./modules/01_storage.js"') < html.indexOf('"./assets/storage-init.js"'),
    "Storage-Kern wird vor storage-init (dbSuffix) geladen");
  // Status-Widget (17) vor Membran (15) + Siegel (16).
  assert.ok(html.indexOf('"./modules/17_floating_widget.js"') < html.indexOf('"./modules/15_membran.js"'),
    "Status-Widget (17) wird vor Membran (15) geladen");
  assert.ok(html.indexOf('"./modules/17_floating_widget.js"') < html.indexOf('"./modules/16_siegel.js"'),
    "Status-Widget (17) wird vor Siegel (16) geladen");
  const storageInit = readFileSync(join(ROOT, "assets/storage-init.js"), "utf8");
  assert.match(storageInit, /DB_SUFFIX\s*=\s*"kimboard"/, "Kimboard nutzt eine eigene Schublade (dbSuffix kimboard)");
});

test("Pinnwand-Funktion erhalten + Endknoten-Stack vorhanden", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  // Pinnwand-Engine ist mitgekommen (geteiltes Frage-Antwort-Brett).
  assert.match(html, /sbkim-frage-antwort-test/, "Nostr-Frage-Antwort-Tag erhalten");
  assert.match(html, /'EVENT'/, "Nostr EVENT erhalten");
  assert.match(html, /'REQ'/, "Nostr REQ erhalten");
  assert.match(html, /function whiten\(/, "Whitening (Inhalt statt Hülle) erhalten");
  // Multi-Query (A5b): Frage-Varianten + bester Cosinus, kein Filter.
  assert.match(html, /function expandQuery/, "Multi-Query A5b: expandQuery erhalten");
  assert.match(html, /function bestRelevance/, "Multi-Query A5b: bestRelevance erhalten");
  assert.match(html, /view\.qVecs/, "Multi-Query A5b: qVecs-Varianten verdrahtet");
  // Endknoten-Stack ist verdrahtet.
  for (const m of ["02_spore.js", "05_anastomose.js", "23_rendezvous.js", "16_siegel.js"]) {
    assert.match(html, new RegExp(m.replace(".", "\\.")), `Endknoten-Modul eingebunden: ${m}`);
  }
  assert.match(html, /assets\/rendezvous-init\.js/, "Rendezvous-Init (🌐 Mit dem Netz verbinden) eingebunden");
  assert.match(html, /assets\/siegel-inhalt\.js/, "Siegel-Andock-Werkzeug eingebunden");
  /* ⚠ Seit A18 (2026-09-14) sind es ZWEI Dateien: die Identitaet dieses Knotens
     und der netzweit byte-gleiche Kanon. Wer nur die erste prueft, merkt
     nicht, dass das Werkzeug selbst fehlt — der Knopf waere dann weg. */
  assert.match(html, /assets\/sbkim-andock-wizard\.js/, "Kanon-Wizard eingebunden");
});

test("Gerätename verdrahtet (Anzeige-Name im Raum + nick-Tag am Brett)", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.match(html, /id="geraetename"/, "Gerätename-Eingabefeld vorhanden");
  assert.match(html, /LS_GERAETENAME\s*=\s*'sbkim_geraetename'/, "localStorage-Schlüssel gesetzt");
  assert.match(html, /tags\.push\(\['nick', _nick\]\)/, "nick-Tag beim Senden gesetzt");
  assert.match(html, /function authorLabel\(ev\)/, "authorLabel (Kontakt > nick > Kennung) vorhanden");
  assert.match(html, /who\.textContent = authorLabel\(ev\)/, "Absender-Anzeige nutzt authorLabel");
  assert.match(html, /sbkim:geraetename-changed/, "Kopplungs-Event gefeuert");
  const rdv = readFileSync(join(ROOT, "assets/rendezvous-init.js"), "utf8");
  assert.match(rdv, /function displayNodeName\(\)/, "displayNodeName im Rendezvous-Glue");
  assert.match(rdv, /nodeName: displayNodeName\(\)/, "Anmeldung nutzt displayNodeName");
  // Sicherheit: die SIGNIERTE Spore behält den kanonischen Namen (kein Re-Sign).
  assert.match(rdv, /nodeName: CFG\.nodeName/, "generateOwnSpore behält CFG.nodeName (kein Spore-Re-Sign)");
  assert.match(rdv, /sbkim:geraetename-changed/, "Rendezvous-Glue hört auf Namenswechsel");
});

test("SW-APP_SHELL nennt genau die vorhandenen Dateien", () => {
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const shell = sw.match(/var APP_SHELL = \[([\s\S]*?)\];/);
  assert.ok(shell, "APP_SHELL-Liste gefunden");
  for (const m of shell[1].matchAll(/"\.\/([^"]*)"/g)) {
    if (m[1] === "") continue; // "./" = Verzeichnis
    assert.ok(readFileSync(join(ROOT, m[1])).length >= 0, `APP_SHELL-Datei existiert: ${m[1]}`);
  }
});

test("Modul 23 (Rendezvous-Kopie) lädt + zeigt die Hygiene-Oberfläche", async () => {
  globalThis.window = globalThis;
  await import("../modules/23_rendezvous.js");
  const R = globalThis.SbkimRendezvous;
  for (const fn of ["init", "ensureIdentity", "cleanupSharedOrigin", "repairAndReconnect",
                    "connectAndAnnounce", "discover", "handshakeCard"]) {
    assert.equal(typeof R[fn], "function", `Rendezvous.${fn}`);
  }
});
