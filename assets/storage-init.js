/*
 * Kimboard — Storage-Init (Identitäts-Hygiene, Modus A / eigene Schublade).
 *
 * Öffnet die EIGENE Schublade dieser App: `sbkim_kimboard` statt der geteilten
 * Default-DB `sbkim`. Muss als ERSTER Storage-Aufruf laufen — darum wird dieses
 * klassische <script> direkt NACH `modules/01_storage.js` und VOR allen
 * identitäts-nutzenden Skripten (Spore, Anastomose, Rendezvous, Lauschen)
 * geladen. Läuft synchron beim Parsen.
 *
 * Warum nötig (der Browser als schwarzes Loch): alle SBKIM-PWAs liegen unter
 * EINER Origin `lausiklauskn-png.github.io`; IndexedDB/Service-Worker/Caches
 * hängen an der Origin, nicht am Pfad. Ohne eigenen dbSuffix teilen sich alle
 * Apps eine DB `sbkim` und damit EINE Identität → mehrere Apps zeigten dieselbe
 * nodeId. Bekannte Suffixe: Mixarium `mixarium` · Rezeptbuch `rezeptbuch` ·
 * BookLedgerPro `bookledgerpro` · SB-KIMTool-Point `toolpoint` · Kim-Bell
 * `kimbell` · Kimboard `kimboard` · Kimboard `kimboard`.
 *
 * Fail-soft: ohne Browser/IndexedDB oder ohne Modul 01 passiert schlicht nichts.
 *
 * ⤷ VORLAGE: wer dieses Tool 1:1 in seine App kopiert, ändert NUR den einen
 *   Wert DB_SUFFIX unten auf ein für seine App EINDEUTIGES Kürzel.
 */
(function () {
  "use strict";
  var DB_SUFFIX = "kimboard";
  try {
    if (window.SbkimStorage && typeof window.SbkimStorage.init === "function") {
      Promise.resolve(window.SbkimStorage.init({ dbSuffix: DB_SUFFIX })).then(
        function () {
          if (console && console.info) {
            console.info("[Kimboard] Storage-Schublade: sbkim_" + DB_SUFFIX + " (eigene Identität).");
          }
        },
        function (e) { if (console && console.warn) console.warn("[Kimboard] Storage-Init übersprungen:", e); }
      );
    }
  } catch (e) {
    if (console && console.warn) console.warn("[Kimboard] Storage-Init fail-soft:", e);
  }
})();
