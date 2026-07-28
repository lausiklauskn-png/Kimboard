/*
 * hilfe.js — Erklär-Blasen (ein-/ausschaltbar) + Testanleitung in der App.
 *
 * ZWECK: Jeder Knopf, jedes Feld und jeder Bereich der Pinnwand erklärt sich
 * selbst — ohne dass man eine Anleitung außerhalb der App suchen muss.
 *
 * ZWEI TEILE
 *   1. ❓-Knopf in der Werkzeug-Leiste öffnet die HILFE: Testanleitung Schritt
 *      für Schritt (auch für zwei Geräte) + der Schalter für die Erklär-Blasen.
 *   2. ERKLÄR-MODUS (Lern-Modus): Solange er an ist, wird ein Antippen NICHT
 *      ausgeführt, sondern ERKLÄRT. So kann man gefahrlos alles anfassen —
 *      es wird nichts gesendet, nichts gelöscht, nichts umgestellt.
 *      (Tablet-tauglich: kein Schweben mit der Maus nötig.)
 *
 * Die Wahl (an/aus) wird lokal gemerkt. Alles fail-soft: fehlt ein Element,
 * wird es still übersprungen — die App läuft normal weiter.
 * Kein Netz, keine Daten nach außen, keine personenbezogenen Daten.
 */
(function () {
  'use strict';

  var LS_KEY = 'sbkim_pinnwand_hilfe';
  var on = false;
  try { on = localStorage.getItem(LS_KEY) === '1'; } catch (_e) { /* fail-soft */ }

  /* ---------------- Erklärungen: Element-Kennung → Text ---------------- */
  // Reihenfolge egal; Kennung ist die id des Elements (oder ein CSS-Selektor).
  var TEXTE = {
    // — Werkzeug-Leiste oben —
    'tb-zoom':    ['🔍 Text vergrößern', 'Macht die Schrift der ganzen Seite größer oder wieder kleiner. Ändert nichts an deinen Daten — reine Ansichtssache.'],
    'tb-full':    ['🔳 Vollbild', 'Blendet die Leisten des Browsers aus, damit die Pinnwand den ganzen Bildschirm nutzt. Nochmal tippen beendet es.'],
    'tb-reload':  ['🔄 Neu laden', 'Lädt die Seite frisch und wirft den Zwischenspeicher weg. Immer dann nützlich, wenn du eine neue Version bekommen hast und noch die alte siehst.'],
    'hilfe-btn':  ['❓ Hilfe', 'Öffnet die Anleitung und den Schalter für diese Erklär-Blasen.'],

    // — Identität / Gerät —
    'geraetename': ['🏷️ Gerätename', 'Ein frei wählbarer Anzeige-Name (z. B. „Klaus-Handy"), damit man deine Zettel zuordnen kann — praktisch, wenn du mehrere Geräte hast. Nur ein Hinweis, KEIN Echtheits-Beweis: jeder kann jeden Namen wählen. Die kryptische Kennung daneben ist das Verlässliche.'],

    // — Relais —
    '#relays':    ['📡 Relais-Leiste', 'Relais sind die „schwarzen Bretter" im Netz, über die deine Zettel laufen. Ein Punkt zeigt, ob die Verbindung steht. Tippen schaltet ein Relais zu oder ab. Mehrere gleichzeitig sind gut: fällt eines aus, tragen die anderen weiter.'],
    'rot-on':     ['🔄 Relais automatisch wechseln', 'Wechselt von selbst zwischen den Relais. Alle im Kreis rechnen aus demselben Geheimnis dieselbe Auswahl aus — ihr müsst euch nichts sagen. NUTZEN: Ausfallsicherheit, und kein einzelnes Relais sieht alles. WICHTIG: Das ist KEIN Schutz gegen Sperren oder Überwachung.'],
    'rot-secret': ['🔑 Kreis-Geheimnis', 'Das gemeinsame Wort, aus dem alle im Kreis dieselbe Relais-Auswahl berechnen. Es MUSS bei allen exakt gleich sein — sonst landet ihr auf verschiedenen Relais und seht euch nicht. Es verschlüsselt nichts; es ist nur der gemeinsame „Würfel".'],
    'rot-period': ['⏱️ Wechsel-Takt', 'Wie oft das Relais gewechselt wird. Häufiger ist nicht automatisch besser — 15 Minuten oder stündlich sind im Alltag angenehm.'],
    'rot-count':  ['🔢 Anzahl Relais', 'Mit wie vielen Relais gleichzeitig gesprochen wird. Mehr = ausfallsicherer.'],
    'rot-announce': ['📢 Wechsel ansagen', 'Notnagel: Sagt deinen Kontakten verschlüsselt, welche Relais gerade dran sind — falls die Uhren der Geräte stark auseinanderlaufen. Normalerweise nicht nötig, weil alle dasselbe ausrechnen.'],

    // — Brett-Passwort —
    'boardkey':     ['🔒 Privates Brett', 'Vergibst du hier ein Passwort, sind ALLE Zettel auf dem Brett verschlüsselt — nur wer dasselbe Passwort hat, kann sie lesen. Das Relais sieht dann nur Kauderwelsch. Leer = offenes Brett, für alle lesbar.'],
    'boardkey-set': ['Setzen', 'Übernimmt das Passwort für das private Brett.'],

    // — Private Nachrichten —
    'dm-to':       ['🔒 Privat an', 'Wählst du hier eine Person, geht dein nächster Zettel NUR an sie — Ende-zu-Ende verschlüsselt. Kein Relais und kein Dritter kann ihn lesen. „öffentlich / Brett" schickt an alle.'],
    'dm-multi':    ['👥 Mehrere', 'Mehrere Empfänger auf einmal wählen. Jeder bekommt eine eigene, nur für ihn verschlüsselte Kopie — die Empfänger sehen einander nicht.'],
    'dm-contacts': ['👤 Kontakte', 'Achtung: NICHT die Kontakte deines Telefons — nur Leute, mit denen du hier verschlüsselt schreiben willst. Einen Kontakt bekommst du so: die andere Person stellt einen Zettel aufs Brett, du tippst auf ihren Namen → Name vergeben, fertig. (Oder du fügst ihren Schlüssel von Hand ein.) Die SICHERHEITSNUMMER musst du nirgends beantragen: Sobald ein Kontakt da ist, erscheint sie automatisch bei ihm in der Liste — berechnet aus euren beiden Schlüsseln und bei euch beiden gleich. Einmal vorlesen und vergleichen: stimmt sie, ist kein Fremder dazwischen.'],

    // — Frage schreiben —
    'qmsg':    ['✏️ Deine Frage', 'Hier schreibst du, was du wissen willst oder mitteilen möchtest. Geht ans offene Brett — oder privat, wenn du oben „Privat an" gewählt hast.'],
    'mic':     ['🎤 Diktieren', 'Statt tippen: sprich deine Frage, der Browser schreibt sie auf. Der Text landet im Feld und kann vor dem Senden noch geändert werden.'],
    'ocrbtn':  ['📷 Foto → Text', 'Fotografiere einen Zettel oder eine Handschrift — der Text wird erkannt und ins Feld geschrieben. Braucht Internet und einen eigenen Schlüssel (Texterkennung in der EU).'],
    'dmvoice': ['🎙️ Sprachnotiz (privat)', 'Nimmt eine Sprachnachricht auf und schickt sie VERSCHLÜSSELT an deinen privaten Kontakt. Erstes Tippen startet, zweites sendet. Nur möglich, wenn oben „Privat an" gewählt ist. Kurz halten — die Relais mögen keine großen Pakete.'],
    'dmimg':   ['🖼️ Bild (privat)', 'Schickt ein Bild VERSCHLÜSSELT an deinen privaten Kontakt. Es wird vorher automatisch verkleinert, damit es durch die Relais passt. Nur möglich, wenn oben „Privat an" gewählt ist.'],
    'ask':     ['Frage stellen', 'Sendet deinen Zettel. Ans offene Brett — oder verschlüsselt an die gewählte Person.'],

    // — Brett-Ansicht —
    'board-clear': ['🧹 Leeren', 'Blendet die angezeigten Zettel bei DIR aus (bleibt auch nach dem Neuladen weg). Bei den anderen bleibt alles stehen — es wird nichts wirklich gelöscht.'],
    'semantic':    ['🧠 Nach Bedeutung sortieren', 'Sortiert die Antworten danach, wie gut sie inhaltlich zur Frage passen — nicht nach Uhrzeit. Beim ersten Einschalten wird ein Sprachmodell geladen (~30 MB), danach läuft es ohne Internet auf deinem Gerät.'],

    // — KI-Richter —
    'judgeprov':      ['⚖️ KI-Richter', 'Optional: Eine KI beurteilt zusätzlich, wie gut die Antworten passen. Standard ist AUS — die Sortierung nach Bedeutung ist gratis und braucht das nicht. Achtung: Bei den Cloud-Diensten verlassen die Texte dein Gerät.'],
    'judgekey':       ['🔑 API-Schlüssel', 'Dein eigener Schlüssel für den gewählten KI-Dienst. Er bleibt auf deinem Gerät und wird nur an diesen Dienst geschickt.'],
    'judgeremember':  ['💾 Schlüssel merken', 'Speichert den Schlüssel für das nächste Mal, damit du ihn nicht neu eintippen musst.'],
    'orModel':        ['Modell', 'Welches KI-Modell den Vergleich macht. Im Zweifel die Voreinstellung lassen.'],
    'orFree':         ['Gratis-Modelle', 'Zeigt die kostenlosen Modelle des Anbieters.'],
    'webllmmodel':    ['Modell auf dem Gerät', 'Ein KI-Modell, das KOMPLETT auf deinem Gerät läuft — nichts verlässt es. Dafür muss es einmal geladen werden und braucht Speicher.'],
    'webllmload':     ['Modell laden', 'Lädt das gewählte Gerät-Modell herunter. Das dauert und braucht Platz — danach läuft es ohne Internet.'],
    'webllm-clear':   ['Modell löschen', 'Wirft das geladene Gerät-Modell wieder vom Speicher.'],
    'judgerun':       ['Richter starten', 'Lässt die gewählte KI die Antworten bewerten.'],

    // — Status-Lampen des Knoten-Widgets (SBKIM) —
    'sbkim-widget-slot-lebt':    ['💚 LEBT', 'Zeigt, dass dein Knoten wach ist und eine eigene, unterschriebene Identität hat. Leuchtet sie nicht, ist die Pinnwand noch am Starten.'],
    'sbkim-widget-slot-verkehr': ['🔄 VERKEHR', 'Zeigt Bewegung: ob gerade Zettel ankommen oder rausgehen und ob eine Verbindung zu anderen Knoten steht.'],
    'sbkim-widget-slot-fremd':   ['🛡️ FREMD', 'Der Türsteher. Er meldet, wenn etwas von außen an deinen Knoten klopft (z. B. eine andere Seite im selben Browser). Er WARNT nur — er öffnet nie von selbst. Antippen zeigt das Protokoll.'],
    'sbkim-widget-slot-siegel':  ['🏅 SIEGEL', 'Der Knoten prüft beim Start selbst, ob seine Schutz-Bausteine geladen sind, und zeigt das offen an. Kein Amt vergibt das — es heißt „prüf mich nach", nicht „vertrau mir blind". Antippen öffnet die Einzelheiten.'],
  };

  /* ---------------- Testanleitung ---------------- */
  var ANLEITUNG =
    '<h3>Was ist diese Pinnwand?</h3>' +
    '<p>Ein <b>geborgtes schwarzes Brett</b>: Du heftest eine Frage oder Notiz an, andere sehen sie und antworten — ' +
    'auch von einem anderen Gerät. Es gibt <b>keinen eigenen Server</b> und <b>kein Konto</b>. Zusätzlich kannst du ' +
    '<b>privat und verschlüsselt</b> an einzelne Kontakte schreiben.</p>' +

    '<h3>Erster Test — allein, 2 Minuten</h3>' +
    '<ol>' +
    '<li>Warte, bis oben bei den <b>Relais</b> mindestens ein Punkt grün ist (Verbindung steht).</li>' +
    '<li>Schreibe unten eine Frage ins Feld und tippe <b>„Frage stellen"</b>.</li>' +
    '<li>Dein Zettel erscheint in der Liste. Fertig — so einfach ist der Grundgebrauch.</li>' +
    '<li>Probiere <b>🎤</b> (sprechen statt tippen) und <b>🧹</b> (Ansicht aufräumen).</li>' +
    '</ol>' +

    '<h3>Zweiter Test — zu zweit, verschlüsselt</h3>' +
    '<p><i>Ihr braucht zwei Geräte (oder du und ein Freund).</i></p>' +
    '<ol>' +
    '<li><b>Beide</b> öffnen die Pinnwand und stellen je einen Zettel aufs Brett, damit ihr euch seht.</li>' +
    '<li>Jeder tippt auf den <b>Namen des anderen</b> über dessen Zettel → als <b>Kontakt merken</b> (Name vergeben). ' +
    '<i>So entsteht ein Kontakt — es sind nicht die Kontakte deines Telefons.</i></li>' +
    '<li>Öffnet <b>👤 Kontakte</b>. Dort steht jetzt bei dem Kontakt eine <b>Sicherheitsnummer</b>. ' +
    'Du musst sie nirgends beantragen: sie wird aus euren beiden Schlüsseln berechnet und ist bei euch beiden dieselbe. ' +
    'Lest sie euch <b>einmal laut vor</b>. Stimmt sie überein, ist sicher kein Fremder dazwischen. ' +
    '<i>Stimmt sie nicht: nicht weitermachen.</i></li>' +
    '<li>Wählt oben bei <b>„🔒 Privat an"</b> den anderen aus.</li>' +
    '<li>Schreibt eine Nachricht und sendet sie. Beim Empfänger erscheint sie mit <b>🔒 privat</b>.</li>' +
    '<li>Probiert <b>🎙️</b> (Sprachnotiz) und <b>🖼️</b> (Bild) — beides wird verschlüsselt übertragen.</li>' +
    '</ol>' +

    '<h3>Dritter Test — Relais automatisch wechseln</h3>' +
    '<ol>' +
    '<li>Tragt bei <b>beiden</b> Geräten <b>dasselbe</b> Kreis-Geheimnis ein (exakt gleich schreiben!).</li>' +
    '<li>Setzt bei beiden das Häkchen <b>„🔄 Relais automatisch wechseln"</b>.</li>' +
    '<li>Unter dem Häkchen steht nun, welche Relais gerade dran sind — bei beiden <b>dieselben</b>. ' +
    'Nach dem eingestellten Takt wechselt es von selbst.</li>' +
    '<li>Schreibt euch weiter — es soll ohne Unterbrechung durchlaufen (das vorige Relais wird mitgehört).</li>' +
    '</ol>' +

    '<h3>Was geschützt ist — und was nicht</h3>' +
    '<p><b>Geschützt:</b> der <b>Inhalt</b> deiner privaten Nachrichten (Ende-zu-Ende verschlüsselt) — und mit der ' +
    'Sicherheitsnummer weißt du, dass wirklich dein Kontakt am anderen Ende ist.</p>' +
    '<p><b>Nicht geschützt:</b> die <b>Begleitumstände</b> — dass du das Netz überhaupt nutzt und wann. ' +
    'Das <i>Was</i> ist verborgen, das <i>Dass</i> nicht.</p>' +
    '<p>Das ist guter Alltags-Datenschutz. Wenn Freiheit oder Sicherheit davon abhängen, nimm dafür bitte erprobte ' +
    'Werkzeuge: <b>Signal</b> und <b>Tor</b>.</p>' +

    '<h3>Wenn etwas klemmt</h3>' +
    '<ul>' +
    '<li><b>Kein Punkt wird grün:</b> Internet prüfen, dann <b>🔄</b> (neu laden).</li>' +
    '<li><b>Der andere sieht meinen Zettel nicht:</b> Habt ihr mindestens ein gemeinsames Relais aktiv? ' +
    'Bei Automatik: ist das Kreis-Geheimnis wirklich identisch?</li>' +
    '<li><b>Ich sehe eine alte Version:</b> <b>🔄</b> drücken oder Strg+Umschalt+R.</li>' +
    '<li><b>Sprachnotiz/Bild geht nicht:</b> Es muss oben ein Kontakt bei „🔒 Privat an" gewählt sein.</li>' +
    '</ul>';

  /* ---------------- kleine Helfer ---------------- */
  function el(tag, css, html) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function findTarget(node) {
    // Nächstes Element nach oben, für das es eine Erklärung gibt.
    while (node && node !== document.body) {
      if (node.id && TEXTE[node.id]) return { key: node.id, node: node };
      if (node.id === 'relays' || (node.parentNode && node.parentNode.id === 'relays')) {
        if (TEXTE['#relays']) return { key: '#relays', node: document.getElementById('relays') };
      }
      node = node.parentNode;
    }
    return null;
  }

  /* ---------------- Erklär-Blase ---------------- */
  var bubble = null;
  function hideBubble() { if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble); bubble = null; }
  function showBubble(key, node) {
    hideBubble();
    var t = TEXTE[key]; if (!t) return;
    bubble = el('div', 'position:fixed;z-index:2147483640;max-width:min(92vw,430px);background:#14181c;color:#e7eef4;' +
      'border:1px solid #36d6c3;border-radius:12px;padding:12px 14px;box-shadow:0 10px 34px rgba(0,0,0,.55);' +
      'font-size:.93rem;line-height:1.5;',
      '<div style="font-weight:700;color:#36d6c3;margin-bottom:5px">' + t[0] + '</div>' +
      '<div>' + t[1] + '</div>' +
      '<div style="margin-top:9px;text-align:right"><button type="button" style="background:#20272d;color:#cfe;' +
      'border:1px solid #37454f;border-radius:8px;padding:5px 12px;cursor:pointer;font:inherit">verstanden</button></div>');
    document.body.appendChild(bubble);
    bubble.querySelector('button').addEventListener('click', hideBubble);
    // In die Nähe des Elements setzen, aber immer im Bild bleiben.
    var r = node.getBoundingClientRect(), b = bubble.getBoundingClientRect();
    var top = r.bottom + 8;
    if (top + b.height > window.innerHeight - 8) top = Math.max(8, r.top - b.height - 8);
    var left = Math.min(Math.max(8, r.left), window.innerWidth - b.width - 8);
    bubble.style.top = top + 'px'; bubble.style.left = left + 'px';
  }

  /* ---------------- Erklär-Modus ---------------- */
  var banner = null;
  function markElements(active) {
    Object.keys(TEXTE).forEach(function (k) {
      var n = k.charAt(0) === '#' ? document.querySelector(k) : document.getElementById(k);
      if (!n) return;
      n.style.outline = active ? '2px dashed rgba(54,214,195,.75)' : '';
      n.style.outlineOffset = active ? '2px' : '';
    });
  }
  function onCapture(ev) {
    if (!on) return;
    // Das Hilfe-Fenster selbst bleibt IMMER normal bedienbar (sonst käme man
    // im Erklär-Modus nicht mehr heraus).
    if (ev.target && ev.target.closest && ev.target.closest('#hilfe-fenster')) return;
    if (bubble && bubble.contains(ev.target)) return;   // Blase selbst bedienbar
    var hit = findTarget(ev.target);
    if (!hit) { if (ev.type === 'click') hideBubble(); return; }
    if (hit.key === 'hilfe-btn') return;                // Hilfe bleibt benutzbar
    ev.preventDefault(); ev.stopPropagation();          // erklären STATT ausführen
    // Manche Bedien-Elemente (z. B. die Status-Lampen) reagieren schon auf
    // „pointerdown" — deshalb wird die frühe Phase mit abgefangen und die
    // Blase dort gezeigt; der spätere Klick wird nur noch geblockt.
    if (ev.type !== 'click') showBubble(hit.key, hit.node);
  }
  function setMode(v) {
    on = !!v;
    try { localStorage.setItem(LS_KEY, on ? '1' : '0'); } catch (_e) { /* */ }
    markElements(on);
    if (on && !banner) {
      // Kompakte Pille LINKS unten — lässt die Status-Lampen rechts unten frei
      // (sie sollen im Erklär-Modus ja gerade antippbar bleiben).
      banner = el('div', 'position:fixed;left:12px;bottom:12px;z-index:2147483630;background:#0f3b36;color:#dff;' +
        'border:1px solid #36d6c3;border-radius:12px;padding:9px 12px;font-size:.88rem;display:flex;gap:10px;' +
        'align-items:center;flex-wrap:wrap;max-width:min(88vw,470px);box-shadow:0 6px 22px rgba(0,0,0,.45);',
        '<span>💡 <b>Erklär-Modus</b> — tippen <b>erklärt</b> statt auszuführen.</span>');
      var b = el('button', 'background:#36d6c3;color:#06231f;border:none;border-radius:8px;padding:6px 14px;' +
        'font:inherit;font-weight:700;cursor:pointer;', 'beenden');
      b.addEventListener('click', function () { setMode(false); });
      banner.appendChild(b);
      document.body.appendChild(banner);
    } else if (!on && banner) {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
      banner = null; hideBubble();
    }
    var cb = document.getElementById('hilfe-schalter');
    if (cb) cb.checked = on;
  }

  /* ---------------- Hilfe-Fenster ---------------- */
  function openHelp() {
    var bg = el('div', 'position:fixed;inset:0;background:rgba(10,14,16,.72);z-index:2147483645;display:flex;' +
      'align-items:center;justify-content:center;padding:14px;');
    var box = el('div', 'background:#14181c;color:#dce6ed;border:1px solid #36d6c3;border-radius:14px;' +
      'max-width:640px;width:100%;max-height:86vh;overflow:auto;padding:18px 20px;line-height:1.6;');
    box.id = 'hilfe-fenster';
    box.innerHTML = '<h2 style="margin:.1em 0 .5em;color:#eef3f6">❓ Hilfe &amp; Anleitung</h2>' +
      '<div style="border:1px solid #2b3d43;background:rgba(54,214,195,.07);border-radius:10px;padding:11px 13px;margin-bottom:14px">' +
      '<label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer">' +
      '<input type="checkbox" id="hilfe-schalter" style="margin-top:4px">' +
      '<span><b>Erklär-Blasen anschalten</b><br><span style="opacity:.8;font-size:.9rem">' +
      'Danach wird jedes Antippen <b>erklärt statt ausgeführt</b> — du kannst gefahrlos alles anfassen. ' +
      'Zum normalen Bedienen einfach wieder ausschalten.</span></span></label></div>' +
      ANLEITUNG;
    // Überschriften im Fließtext etwas hervorheben
    box.querySelectorAll('h3').forEach(function (h) { h.style.cssText = 'color:#36d6c3;font-size:1.02rem;margin:1.25em 0 .35em'; });
    var close = el('button', 'margin-top:16px;background:#20272d;color:#cfe;border:1px solid #37454f;' +
      'border-radius:9px;padding:8px 16px;font:inherit;cursor:pointer;', 'Schließen');
    close.id = 'hilfe-close';
    close.addEventListener('click', function () { if (bg.parentNode) document.body.removeChild(bg); });
    box.appendChild(close);
    bg.appendChild(box);
    bg.addEventListener('click', function (e) { if (e.target === bg) document.body.removeChild(bg); });
    document.body.appendChild(bg);
    var cb = box.querySelector('#hilfe-schalter');
    cb.checked = on;
    cb.addEventListener('change', function () { setMode(cb.checked); });
  }

  /* ---------------- Start ---------------- */
  function init() {
    var bar = document.querySelector('.toolbar');
    if (bar && !document.getElementById('hilfe-btn')) {
      var btn = document.createElement('button');
      btn.id = 'hilfe-btn'; btn.className = 'tbtn'; btn.type = 'button';
      btn.title = 'Hilfe, Anleitung und Erklär-Blasen';
      btn.textContent = '❓';
      btn.addEventListener('click', openHelp);
      bar.appendChild(btn);
    }
    // capture: VOR der App — inkl. der frühen Zeige-Phasen (Tablet: touchstart).
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(function (t) {
      document.addEventListener(t, onCapture, true);
    });
    window.addEventListener('resize', hideBubble);
    if (on) setMode(true);                                  // Wahl von letztem Mal
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Für den Test einsehbar (keine Geheimnisse, nur Texte/Zustand).
  window.__hilfe = { texte: TEXTE, setMode: setMode, isOn: function () { return on; }, open: openHelp };
})();
