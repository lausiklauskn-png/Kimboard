/*
 * moderation.js — Konfiguration für Melde-Weg und Sperr-Liste.
 *
 * WARUM DIESE DATEI GETRENNT LIEGT: Wer Kimboard forkt, betreibt weder Klaus'
 * Relais noch sein Postfach. Stünden Adresse und Sperr-Liste im Code, erbte
 * jeder Fork beides — Meldungen über eine fremde App gingen an Klaus, und
 * Klaus' Sperr-Liste würde in einer App wirken, mit der er nichts zu tun hat.
 * Hier ist beides in einer Datei, die ein Forker in einer Minute ersetzt.
 *
 * WARUM SIE MIT `defer` IM <head> STEHT und nicht in der Nachlade-Kette:
 * Die Sperr-Liste muss VOR dem ersten Zettel dastehen. Käme sie später, wäre
 * ein gesperrter Zettel für einen Augenblick zu sehen — und genau das soll sie
 * verhindern. `defer` ist dabei nicht render-blockierend: die Datei wird neben
 * dem Aufbau der Seite geholt und läuft, bevor das Haupt-Modul startet.
 * Bewacht von `tests/smoke_sperrliste.mjs` („die Liste steht vor dem ersten
 * Zettel da") — die Reihenfolge wird gemessen, nicht behauptet.
 *
 * ALLES FAIL-SOFT: Fehlt diese Datei, fehlt ein Feld oder ist eine Adresse
 * leer, läuft die App voll weiter. Der Melde-Knopf fällt dann auf einen
 * Mail-Vordruck zurück, und gesperrt ist eben nichts.
 *
 * Kein Geheimnis in dieser Datei — sie ist öffentlich lesbar.
 */
(function () {
  'use strict';

  window.KB_MODERATION = {
    /* ── Melde-Weg (Art. 16 DSA) ──────────────────────────────────────────
     * Endpunkt: derselbe erprobte Dienst, den der family-projekt.de-Marktplatz
     * für seinen Melde-Knopf benutzt (`zweck: "meldung"`). Kimboards Herkunft
     * `lausiklauskn-png.github.io` steht dort bereits in `allowed_origins` —
     * es war keine Server-Änderung nötig.
     *
     * Leer lassen = der Melde-Knopf öffnet stattdessen einen Mail-Vordruck an
     * `meldeMail`. Beides leer = der Knopf sagt ehrlich, dass kein Weg
     * eingerichtet ist, statt still ins Nichts zu senden. */
    meldeEndpunkt: 'https://www.family-projekt.de/formular/einreichung.php',
    meldeMail: 'info@family-projekt.de',

    /* Wie der Betreiber heißt und wo man sich beschweren kann, wenn einem die
     * Entscheidung nicht passt. Steht so im Melde-Fenster — Art. 16 Abs. 5 DSA
     * verlangt den Hinweis auf Rechtsbehelfe. */
    betreiber: 'Klaus Nitzsche',
    beschwerdeWeg: 'impressum.html',

    /* ── Sperr-Liste ──────────────────────────────────────────────────────
     * `quelle`: zusätzlich zur eingebackenen Liste (assets/config/sperrliste.js)
     * eine signierte Liste aus dem Netz nachladen. Sie wirkt NUR ergänzend und
     * NUR, wenn ihre Signatur zu `pruefschluessel` passt.
     *
     * Für einen Fork gibt es damit drei saubere Wege:
     *   1. beides auf null → keine fremde Sperr-Liste, nur die eigene Datei;
     *   2. hierauf zeigen lassen → Klaus' Liste mitlaufen lassen;
     *   3. eigene Adresse + eigener Schlüssel → eigene netzweite Liste.
     *
     * `null` heißt: es wird gar nichts nachgeladen (kein Abruf, kein Fehler).
     * Voreinstellung ist die eigene Liste dieses Repos — sie erlaubt Klaus,
     * zwischen zwei Auslieferungen zu sperren. */
    quelle: './sbkim/sperrliste.json',

    /* ── Betreiber-Ausweis (Studio) ───────────────────────────────────────
     * Wer dieses Brett betreibt, erkennbar an seinem öffentlichen Schlüssel.
     * Nur wer DIESEN Schlüssel im Gerät hat, bekommt das Studio zu sehen
     * (langer Druck auf das © in der Fußzeile).
     *
     * DAS IST KEIN TÜRSCHLOSS, und es soll auch keines vortäuschen. Der Wert
     * steht öffentlich in dieser Datei; jeder kann sie lesen und das Studio
     * mit einem Handgriff aufmachen. Was er dort NICHT kann, ist irgendetwas
     * bewirken: jede Handlung des Studios ist ein signiertes Ereignis, und
     * signieren kann sie nur, wer den PRIVATEN Schlüssel hat. Der liegt in
     * genau einem Browser und verlässt ihn nie.
     *
     * Die Autorität sitzt also beim Relais und beim Schlüssel, nicht in der
     * Oberfläche. Der Vergleich hier hält nur die App aufgeräumt — er hält
     * niemanden auf, und er behauptet es auch nicht.
     *
     * Klaus trägt hier die Kennung ein, die im Siegel unter „Eigene Identität"
     * steht. Solange sie fehlt, gibt es kein Studio (der lange Druck tut dann
     * schlicht nichts). Ein Forker trägt seine eigene ein — oder lässt sie
     * leer, wenn seine App kein Studio haben soll. */
    betreiberSchluessel: '7dee8dd9088022e0a9be3667ad6ed3551a68c263ce557f34907485075d2fd6a0',

    /* Öffentlicher Schlüssel (Nostr, 64 Hex-Zeichen), mit dem eine nachgeladene
     * Liste signiert sein MUSS. Ohne diesen Wert wird nichts nachgeladen —
     * eine unsignierte Liste anzunehmen hieße, jedem zu glauben, der die Datei
     * austauschen kann.
     *
     * Klaus trägt hier die Kennung ein, die im Siegel unter „Eigene Identität"
     * steht. Solange sie fehlt, wirkt allein die eingebackene Liste. */
    pruefschluessel: null
  };
})();
