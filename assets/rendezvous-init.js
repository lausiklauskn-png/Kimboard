/*
 * Kimboard — Rendezvous-Init (Modul 23, „🌐 Mit dem Netz verbinden").
 *
 * Kimboard ist die semantische Pinnwand als eigenständiger SBKIM-Endknoten.
 * Dieses Skript verdrahtet die saubere Netz-Anmeldung (Skill
 * `saubere-netz-anmeldung`) — dasselbe Muster wie Kim-Bell:
 *   - Modus A (SbkimRendezvous.ensureIdentity): sanft, automatisch beim Mount,
 *     idempotent, NICHT zerstörend, KEINE Netz-Aktion — sichert die eigene
 *     Schublade `sbkim_kimboard` + eine stabile Identität.
 *   - Modus B (Knopf „🧹 Aufräumen & neu anmelden" im Panel): reinigt NUR die
 *     eigene Origin (geteilter Alt-Topf `sbkim`, Service-Worker, Caches), dann
 *     frische Identität + Spore + Anmelden + Reload-Hinweis.
 *
 * Der Knopf reicht einen app-eigenen Identitäts-Erzeuger durch: beim ersten
 * „Verbinden" wird (falls noch keine lebende Identität da ist) eine Spore
 * erzeugt — Modul 03 Embedding (~30 MB einmalig, CDN) + Modul 02
 * generateOwnSpore mit der Domänen-Beschreibung.
 *
 * VERFASSUNGSTREU: nutzer-ausgelöst, init mountet nur den Knopf + fährt Modus A
 * (lokal). Kein Auto-Connect ins Netz, kein Dauer-Piepser. Fail-soft.
 *
 * ⤷ VORLAGE: wer dieses Tool 1:1 in seine App kopiert, ändert die CFG-Werte
 *   (nodeName / domain / endpoint / Beschreibung / Stichworte) + den DB_SUFFIX.
 */
(function () {
  "use strict";

  var DB_SUFFIX = "kimboard";  // == assets/storage-init.js

  var CFG = {
    nodeName: "Kimboard",
    domain: "Pinnwand/Notizen/Merken",
    endpoint: "https://lausiklauskn-png.github.io/Kimboard/",
    nodeType: "hybrid",
    domainDescription: "Kimboard — semantische Pinnwand: Fragen und Notizen an ein geborgtes „dummes Brett“ (Nostr) heften, geräteübergreifend und nach Bedeutung sortiert. Merken, Notizen, Frage-Antwort — server-los direkt im Browser, ohne Server und ohne Konto.",
    domainKeywords: ["Pinnwand", "Notizen", "Merken", "Frage-Antwort", "Nostr", "Bedeutungs-Sortierung", "SBKIM", "Mycel"],
  };

  // Gerätename (frei wählbarer Anzeige-Name, lokal): NUR an die Anzeige/Anmeldung
  // hängen — NICHT an generateOwnSpore (Identität/Spore bleibt kanonisch, kein
  // Re-Sign). Sicherheit: nur Hinweis, die Kennung im Raum bleibt daneben.
  function geraetename() { try { return (localStorage.getItem("sbkim_geraetename") || "").trim().slice(0, 40); } catch (_e) { return ""; } }
  function displayNodeName() { var g = geraetename(); return g ? (CFG.nodeName + " · " + g) : CFG.nodeName; }

  function createIdentity() {
    if (!window.SbkimEmbedding || !window.SbkimSpore) {
      return Promise.reject(new Error("Module 02/03 (Spore/Embedding) nicht geladen."));
    }
    // Sichtbarer Fortschritt DIREKT im Panel (Tablet hat keine Konsole) +
    // Phasen-Logs für Eruda. Die einmalige Identitäts-Erzeugung lädt ein
    // ~30-MB-Sprach-Modell — das dauert am Tablet, sieht sonst aus wie „hängt".
    function step(msg) {
      console.info("[Kimboard] " + msg);
      try {
        var out = document.getElementById("sbkim-rdv-out");
        if (out) out.textContent += "\n  … " + msg;
      } catch (_e) {}
    }
    step("Sprach-Modell wird geladen (einmalig, ~30 MB — kann am Tablet 1–2 Minuten dauern)…");
    // PFLICHT (Klaus 2026-07-08): beim ~30-MB-Modell-Laden IMMER eine Prozent-
    // Anzeige — sonst denkt man, es hängt, und schließt zu, bevor es fertig ist.
    // Live-Balken aus dem sbkim:embedding-progress-Event, in EINER Zeile (kein Spam).
    function ensureProgressEl() {
      var out = document.getElementById("sbkim-rdv-out");
      if (!out || !out.parentNode) return null;
      var el = document.getElementById("kbd-model-progress");
      if (!el) {
        el = document.createElement("div");
        el.id = "kbd-model-progress";
        el.style.cssText = "margin:6px 0 0;font:.74rem/1.4 var(--mono,monospace);color:#6ee7d3;white-space:pre-wrap";
        out.parentNode.insertBefore(el, out.nextSibling);
      }
      return el;
    }
    var onProg = function (ev) {
      var d = ev && ev.detail; if (!d) return;
      var el = ensureProgressEl(); if (!el) return;
      if (typeof d.progress === "number" && isFinite(d.progress)) {
        var pct = Math.max(0, Math.min(100, Math.round(d.progress)));
        var filled = Math.round(pct / 5);
        var bar = "█".repeat(filled) + "░".repeat(20 - filled);
        var file = d.file ? String(d.file).split("/").pop() : "Modell";
        el.textContent = "Modell laedt  " + bar + "  " + pct + " %   (" + file + ", ~30 MB einmalig)";
      } else if (d.status === "done" || d.status === "ready") {
        el.textContent = "Modell geladen ✓";
      }
    };
    function stopProg() { try { window.removeEventListener("sbkim:embedding-progress", onProg); } catch (_e) {} }
    try { window.addEventListener("sbkim:embedding-progress", onProg); } catch (_e) {}
    return window.SbkimEmbedding.init()
      .then(function () {
        step("Modell geladen, berechne Bedeutungs-Vektor…");
        return window.SbkimEmbedding.embedPassage(CFG.domainDescription + ". " + CFG.domainKeywords.join(", "));
      })
      .then(function (vec) {
        step("erzeuge deine Identität + Visitenkarte (Spore)…");
        return window.SbkimSpore.generateOwnSpore({
          domain: CFG.domain,
          endpoint: CFG.endpoint,
          nodeType: CFG.nodeType,
          nodeName: CFG.nodeName,
          domainDescription: CFG.domainDescription,
          domainKeywords: CFG.domainKeywords,
          domainVector: Array.from(vec),
        });
      })
      .then(function (spore) {
        stopProg();
        step("Identität fertig — melde dich jetzt im Raum an…");
        return spore;
      })
      .catch(function (e) {
        stopProg();
        step("✗ Identitäts-Erzeugung fehlgeschlagen: " + (e && e.message ? e.message : e));
        throw e;
      });
  }

  function mount() {
    // Modul 23 mit eigener Schublade + Identitäts-Erzeuger konfigurieren,
    // dann Modus A (sanft, lokal, idempotent) fahren.
    if (window.SbkimRendezvous && typeof window.SbkimRendezvous.init === "function") {
      try {
        window.SbkimRendezvous.init({
          nodeName: displayNodeName(),
          dbSuffix: DB_SUFFIX,
          createIdentity: createIdentity,
          ensureIdentity: true,   // Modus A
        });
      } catch (e) {
        console.warn("[Kimboard] Rendezvous-Modul-Init (Modus A) übersprungen:", e);
      }
    }
    if (!window.SbkimRendezvousUI) {
      console.warn("[Kimboard] SbkimRendezvousUI nicht geladen — modules/23_rendezvous_ui.js fehlt?");
      return;
    }
    try {
      window.SbkimRendezvousUI.init({
        nodeName: displayNodeName(),
        dbSuffix: DB_SUFFIX,
        corner: "bl",
        createIdentity: createIdentity,
      });
      // Gerätename-Kopplung: beim Namenswechsel Anzeige-Namen neu setzen (fail-soft).
      try {
        window.addEventListener("sbkim:geraetename-changed", function () {
          try { if (window.SbkimRendezvous && window.SbkimRendezvous.configure) window.SbkimRendezvous.configure({ nodeName: displayNodeName() }); } catch (_e) {}
        });
      } catch (_e) {}
      console.info("[Kimboard] Rendezvous-UI gemountet (🌐 Mit dem Netz verbinden, Modus A aktiv).");
    } catch (e) {
      console.warn("[Kimboard] Rendezvous-UI übersprungen:", e);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
