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
 */
"use strict";

var CACHE_VERSION = "kimboard-v13";

var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./impressum.html",
  "./sicherheit.html",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/storage-init.js",
  "./assets/nostr-listen-init.js",
  "./assets/rendezvous-init.js",
  "./assets/schutz-init.js",
  "./assets/siegel-inhalt.js",
  "./modules/noble-secp256k1.js",
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
  "./modules/23_rendezvous.js",
  "./modules/23_rendezvous_ui.js",
  "./modules/24_ocr_eingabe.js",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return Promise.all(APP_SHELL.map(function (url) {
        return cache.add(url).catch(function (err) {
          console.warn("[kimboard-sw] Precache übersprungen:", url, err);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
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
        return caches.match(req).then(function (c) { return c || caches.match("./index.html"); });
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
