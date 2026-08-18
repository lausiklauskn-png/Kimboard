/*
 * Kimboard — Service-Worker (Standalone-PWA).
 *
 * Macht die Seite installierbar (Chrome verlangt einen fetch-Handler) und cacht
 * die App-Schale (dieser Ordner), damit die Pinnwand offline startet.
 *
 * Strategie:
 *   - Eigene App-Schale (same-origin, in diesem Scope): CACHE-FIRST, dann Netz.
 *   - Navigationen offline: Fallback auf ./index.html.
 *   - Alles andere (Nostr-Relays via WebSocket, CDN-Embedding-Modell,
 *     WebLLM-Bibliothek/Gewichte, KI-API): DURCHREICHEN, nicht cachen — gehört
 *     nicht in den SW-Cache (WebSockets fängt der SW ohnehin nicht ab; Modelle
 *     sind zu groß; Schlüssel/Antworten haben im Cache nichts verloren).
 *
 * Bei einer Änderung der App-Schale CACHE_VERSION erhöhen (Cache-Bust).
 *
 * ── Was beim ERSTEN Besuch über die Leitung geht (Messung 2026-08-02) ──────
 * Gemessen mit einem Server, der sich wie GitHub Pages verhält (Cache-Control
 * max-age + ETag) — das ist wichtig, siehe unten. Erster Besuch, leeres Profil:
 *
 *   vorher  1897 KiB      nachher  1196 KiB      gespart 701 KiB (37 %)
 *
 * Die drei Posten:
 *
 * 1. DIE SYMBOLE (551 KiB). Der Vorrat holte icon-192 (77) UND icon-512 (474),
 *    obwohl die Seite selbst keines von beiden zeigt — sie zeigt seit heute
 *    icon-128 (37 KiB) für Tab-Symbol und Logo zugleich. Beide großen Dateien
 *    stehen deshalb ABSICHTLICH nicht mehr in der Liste: sie gehören ins
 *    Manifest, und dort holt das Betriebssystem sie beim Installieren — da ist
 *    man ohnehin online. Wird eines doch angefragt, legt der fetch-Handler
 *    unten es ganz normal ab.
 *
 * 2. DAS DOKUMENT (202 KiB). Es kam DREIMAL: als Navigation auf "/", plus "./"
 *    und "./index.html" im Vorrat. Für den Cache sind das drei Adressen,
 *    obwohl es dieselbe Datei ist — der Browser kann da nichts zusammenlegen.
 *    Jetzt steht keine der beiden Schreibweisen mehr im Vorrat; der
 *    navigate-Zweig unten legt die Seite unter ihrer eigenen Adresse ab und
 *    sucht beim Rückfall der Reihe nach "./index.html" UND "./".
 *
 * 3. DIE MODULE — hier NICHTS. Und das ist die ehrliche Korrektur einer
 *    falschen Annahme: mit einem Server OHNE Cache-Kopfzeilen (python
 *    http.server) kam beim ersten Besuch jede Datei doppelt, zusammen 3529 KiB.
 *    Daraus schien zu folgen, der Vorrat müsse warten, bis die Seite fertig
 *    geladen hat. Gegen einen Pages-ähnlichen Server gemessen, war der
 *    Unterschied dann exakt NULL (1196 KiB so wie so): der Browser-Cache legt
 *    die gleichzeitigen Anfragen für dieselbe Adresse von selbst zusammen. Die
 *    gebaute Verzögerung wurde deshalb wieder ausgebaut — sie hätte Technik
 *    hinzugefügt, die nichts einbringt. Die 3529 KiB waren ein Artefakt des
 *    Prüf-Servers, nicht das Verhalten der echten Seite.
 *
 * Merksatz für die nächste Messung: einen Prüf-Server ohne Cache-Kopfzeilen
 * zu benutzen, misst nicht die Seite, sondern den Prüf-Server.
 */
"use strict";

var CACHE_VERSION = "kimboard-v62";

// Die App-Schale. Absichtlich NICHT enthalten: "./" und "./index.html"
// (dieselbe Datei wie die Navigation, nur unter anderer Adresse) sowie
// icon-192/icon-512 (holt das Betriebssystem beim Installieren). Siehe Kopf.
var APP_SHELL = [
  "./impressum.html",
  "./sicherheit.html",
  "./manifest.json",
  "./icon-128.png",
  "./assets/config/moderation.js",
  "./assets/config/sperrliste.js",
  "./assets/storage-init.js",
  "./assets/nostr-listen-init.js",
  "./assets/rendezvous-init.js",
  "./assets/schutz-init.js",
  "./assets/siegel-inhalt.js",
  "./assets/hilfe.js",
  "./modules/noble-secp256k1.js",
  "./modules/dm_crypto.js",
  "./modules/echtheit.js",
  "./modules/relay_rotation.js",
  "./modules/01_storage.js",
  "./modules/02_spore.js",
  "./modules/03_embedding.js",
  "./modules/04_match.js",
  "./modules/05_anastomose.js",
  "./modules/05b_nostr_relay.js",
  "./modules/07_apoptose.js",
  "./modules/15_membran.js",
  "./modules/16_siegel.js",
  "./modules/17_floating_widget.js",
  "./modules/20_schluessel_safe.js",
  "./modules/21_spracheingabe.js",
  "./modules/23_rendezvous.js",
  "./modules/23_rendezvous_ui.js",
  "./modules/24_ocr_eingabe.js",
];

// Einlagern, ohne dass ein einzelner Fehlschlag den Rest mitreißt.
function einlagern(liste) {
  return caches.open(CACHE_VERSION).then(function (cache) {
    return Promise.all(liste.map(function (url) {
      return cache.add(url).catch(function (err) {
        console.warn("[kimboard-sw] Vorrat übersprungen:", url, err);
      });
    }));
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(einlagern(APP_SHELL).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (_e) { return; }

  // Fremd-Origin (Relays, CDN-Modell, WebLLM, KI-API): durchreichen, nicht cachen.
  if (url.origin !== self.location.origin) return;

  // Navigationen (die Seite selbst): NETZ ZUERST → immer der frische Stand,
  // offline Fallback auf den Cache. Verhindert, dass eine alte App-Schale
  // hängenbleibt (Bauphasen-Lehre 2026-06-24).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // Offline: erst die angefragte Adresse, dann die beiden Schreibweisen
        // derselben Datei. "/" und "/index.html" sind für den Cache zwei
        // Adressen — gespeichert ist immer nur die, über die man gekommen ist.
        return caches.match(req)
          .then(function (c) { return c || caches.match("./index.html"); })
          .then(function (c) { return c || caches.match("./"); });
      })
    );
    return;
  }

  /* Die nachgeladene SPERR-LISTE: NETZ ZUERST, Cache nur als Rückfall.
   *
   * Warum sie eine Ausnahme braucht: Unten gilt cache-first. Die Liste würde
   * damit EINMAL geholt und danach für immer aus dem Vorrat bedient — bis die
   * CACHE_VERSION wechselt, also bis zur nächsten Auslieferung. Genau das
   * hebelt ihren Zweck aus: Klaus sperrt etwas, und die installierten
   * Kimboards bekommen es nie zu sehen. Eine Moderations-Liste, die veraltet
   * ausgeliefert wird, ist schlimmer als keine, weil sie so aussieht, als
   * wirke sie.
   *
   * Offline gilt weiter der letzte bekannte Stand — besser die Liste von
   * gestern als gar keine.
   *
   * Gefunden nicht durch Nachdenken, sondern durch eine Probe, die sprunghaft
   * rot wurde: der Service-Worker beantwortete den Abruf, sobald er wach war.
   * Bewacht von tests/smoke_sperrliste.mjs (echter Lauf mit wachem
   * Service-Worker und einer Datei, die sich zwischendurch ändert).
   *
   * DIE REGEL: eine .json-Datei, in deren Namen „sperrliste" vorkommt. Bewusst
   * so und nicht auf den vollen Dateinamen genagelt — der erste Versuch prüfte
   * wörtlich auf „sperrliste.json" und griff schon bei der eigenen Probendatei
   * nicht mehr. Was an einem Namen hängt, den man leicht anders schreibt, ist
   * kein Schutz. Die Endung .json grenzt zugleich die eingebackene
   * assets/config/sperrliste.js aus: die gehört zur App-Schale, hängt an der
   * CACHE_VERSION und darf cache-first bleiben.
   *
   * ACHTUNG für Forker: `quelle` in assets/config/moderation.js muss zu dieser
   * Regel passen. Heißt eure Datei anders, friert sie still ein — deshalb
   * vergleicht tests/smoke_sperrliste.mjs beide Stellen miteinander. */
  if (/sperrliste[^/]*\.json$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var frisch = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, frisch); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (c) {
          return c || new Response("", { status: 504, statusText: "Offline" });
        });
      })
    );
    return;
  }

  // Übrige App-Schale (Skripte/Icons/Manifest): CACHE-FIRST, dann Netz.
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        if (req.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504, statusText: "Offline" });
      });
    })
  );
});
