/*
 * sperrliste.js — die netzweite Sperr-Liste, eingebacken.
 *
 * WOZU: Eine Lösch-Meldung (NIP-09) darf nur der Absender selbst schicken —
 * gegen FREMDE Hassrede ist sie deshalb kein Werkzeug. Diese Liste ist es:
 * Was hier steht, zeigt jedes Kimboard nicht mehr an, egal auf welchem Relais
 * der Zettel liegt.
 *
 * DIE EHRLICHE GRENZE, und sie ist wichtig: Der Zettel liegt danach immer noch
 * da. Ein anderer Nostr-Client zeigt ihn weiter. Diese Liste macht ihn in
 * Kimboard unsichtbar, nicht in der Welt. Wirklich WEG ist er nur dort, wo ein
 * Betreiber ihn aus dem Speicher nimmt — auf Klaus' eigenem Relais.
 * Volle Einordnung: docs/MODERATION_UND_RECHT.md.
 *
 * ── WIE MAN ETWAS EINTRÄGT ────────────────────────────────────────────────
 * Nicht von Hand abtippen. In der App: die Nachricht mit ✕ ausblenden, dann
 * „👁 Ausgeblendet" öffnen und dort „📋 Zeile für die Sperr-Liste kopieren".
 * Die kopierte Zeile kommt zwischen die geschweiften Klammern unten.
 *
 * ── WIE MAN ETWAS WIEDER LÖST ─────────────────────────────────────────────
 * NUR hier in der Datei, indem man die Zeile entfernt. Das ist Absicht: Aus
 * der Oberfläche geht es nur in eine Richtung — sperren. Ein Fehlgriff beim
 * Sperren sperrt zu viel und fällt sofort auf. Ein Fehlgriff beim Lösen ist
 * still. (Dieselbe Asymmetrie wie in PWA-Toolpoint, docs/RAUSWURF-REGEL.md.)
 * `tests/smoke_sperrliste.mjs` misst nach, dass die App das wirklich einhält.
 *
 * Kein PII: Ereignis- und Schlüssel-Kennungen sind Hex-Zahlen, der Grund ist
 * eine kurze sachliche Angabe. Der beanstandete TEXT gehört hier NICHT hinein
 * — er wäre sonst genau das, was man aus der Welt haben wollte.
 */
(function () {
  'use strict';

  window.KB_SPERRLISTE = {
    fassung: 1,
    stand: '2026-08-17',

    /* Einzelne Zettel — Ereignis-Kennung (64 Hex) → Grund.
     * Beispiel:
     *   'a1b2…': { grund: 'Volksverhetzung', seit: '2026-08-17' }, */
    ereignisse: {},

    /* Ganze Absender — öffentlicher Schlüssel (64 Hex) → Grund.
     * Wirkt auf ALLES von diesem Absender, auch auf Harmloses. Deshalb sparsam
     * und nur bei Wiederholung. */
    absender: {}
  };
})();
