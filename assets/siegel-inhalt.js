/*
 * Siegel-Inhalt — DIE IDENTITÄT DIESES KNOTENS, und sonst nichts.
 *
 * ⚠ HIER STEHT KEIN KANON. Der Andock-Wizard, alle Anzeigetexte und alle
 * Prüfungen liegen seit A18 (2026-09-14) in EINER netzweit byte-gleichen
 * Datei — `assets/sbkim-andock-wizard.js`, Kanon `Sage-Protokol/src/modules/16b_andock_wizard.js`.
 * Diese Datei trägt nur noch, was in jedem Knoten ANDERS sein muss.
 *
 * Warum die Trennung: gemessen über die 20 Kopien im Netz standen am 2026-09-14
 * ZWÖLF verschiedene Code-Fassungen desselben Werkzeugs. Jede Verbesserung
 * kostete Handarbeit mal zwanzig und unterblieb deshalb meistens.
 *
 * ⚠ UND DIESE DATEI WIRD NIE VERTEILT. Sie trägt die BEDEUTUNG des Knotens; ein
 * Überschreiben gäbe dieser App den Namen und den Vektor einer fremden — der
 * Schaden vom 2026-08-16 in Alis Moderaum.
 *
 * Vertrag: Sage-Protokol/docs/INTERFACES.md §11.9.
 */
(function () {
  "use strict";
  window.SBKIM_SIEGEL_WIZ = {
    domain: "Pinnwand/Notizen/Merken",
    endpoint: "https://lausiklauskn-png.github.io/Kimboard/",
    nodeType: "hybrid",
    nodeName: "Kimboard",
    domainDescription: "Kimboard — semantische Pinnwand: Fragen und Notizen an ein geborgtes „dummes Brett“ (Nostr) heften, geräteübergreifend und nach Bedeutung sortiert. Merken, Notizen, Frage-Antwort — server-los direkt im Browser, ohne Server und ohne Konto.",
    domainKeywords: ["Pinnwand", "Notizen", "Merken", "Frage-Antwort", "Nostr", "Bedeutungs-Sortierung", "SBKIM", "Mycel"],
    stammCategories: ["Pinnwand", "Notizen/Merken", "Frage-Antwort-Brett"],
    guestCategories: ["Spore-Erzeugung", "Backup", "Handshake"],
    /* ⚠ NACHGETRAGEN BEIM A18-UMBAU (2026-09-14). Vorher stand dieser Name HART
       im Wizard-Code — in einer Datei, die jetzt netzweit byte-gleich ist. Ohne
       den Eintrag hiesse die Sicherung dieser App wie jede andere. */
    backupPrefix: "kimboard-backup",
  };
})();
