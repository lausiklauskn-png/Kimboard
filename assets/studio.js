/*
 * studio.js — das Pflege-Studio des Betreibers.
 *
 * WOZU: Klaus betreibt dieses Brett und haftet für das, was darauf liegt
 * (Art. 16 DSA, siehe docs/MODERATION_UND_RECHT.md). Bis hierher hatte er zwei
 * Werkzeuge, und beide waren zu schwach: „bei mir ausblenden" wirkt nur auf
 * einem Gerät, und die Sperr-Liste musste er von Hand in eine Datei tippen und
 * ausliefern. Was fehlte, war der Griff, der wirklich zufasst — von seinem
 * eigenen Gerät aus, ohne Server-Konsole.
 *
 * ZUGANG: langer Druck (~1,5 s) auf das © in der Fußzeile. Die Datei wird erst
 * dann geholt; ein Besucher lädt sie nie. Vorlage ist das Studio aus
 * PWA-Toolpoint, dort seit 2026-08-09 im Betrieb.
 *
 * ── DREI REICHWEITEN, UND SIE SIND NICHT DASSELBE ─────────────────────────
 * Das ist der Kern, den die Oberfläche ehrlich zeigen muss:
 *
 *   1. NUR HIER          — ausblenden. Gibt es längst, wirkt auf einem Gerät.
 *   2. IN JEDEM KIMBOARD — Sperr-Liste. Wirkt überall, wo Kimboard läuft,
 *                          auch für Zettel auf fremden Relais. ABER: der Zettel
 *                          liegt weiter da. Ein anderer Nostr-Client zeigt ihn.
 *   3. WIRKLICH WEG      — aus dem Speicher des eigenen Relais nehmen. Nur
 *                          dort, wo Klaus der Betreiber ist. Endgültig, aber
 *                          eben nur auf seinem Server.
 *
 * Keine dieser drei ist „löschen aus der Welt". Die gibt es nicht, und das
 * Studio behauptet es an keiner Stelle. Wer es anders schriebe, verspräche
 * etwas, das er nicht halten kann — und das wäre schlimmer als die Grenze
 * offen hinzuschreiben.
 *
 * ── WORAUF DER SCHUTZ WIRKLICH BERUHT ─────────────────────────────────────
 * Nicht auf dem langen Druck und nicht auf dem Schlüssel-Vergleich hier: beide
 * halten nur die Seite aufgeräumt, und `betreiberSchluessel` steht öffentlich
 * in moderation.js. Jede Handlung, die etwas bewirkt, ist ein SIGNIERTES
 * Ereignis. Signieren kann nur, wer den privaten Schlüssel hat — der liegt in
 * genau einem Browser. Ein Fremder, der dieses Fenster aufmacht, sieht die
 * Knöpfe und erreicht damit nichts: sein Relais kennt ihn nicht.
 *
 * Kein PII: gearbeitet wird mit Kennungen (Hex). Ein Grund ist eine kurze
 * sachliche Angabe. Der beanstandete TEXT wird nirgends gespeichert oder
 * verschickt — er ist ja gerade das, was aus der Anzeige heraus soll.
 */
(function () {
  'use strict';

  var HEX64 = /^[0-9a-f]{64}$/i;
  var offen = false, bg = null;

  function K() { return window.KB_MODERATION || {}; }
  function brücke() { return window.__kb || null; }

  /* ---------- kleine Helfer ---------------------------------------------- */

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }
  function knopf(text, css) {
    var b = el('button', 'margin:2px 6px 2px 0;' + (css || ''), text);
    b.className = 'tbtn';
    return b;
  }
  function kurz(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function heute() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }
  /* wss://relay.example/ → https://relay.example/ — NIP-11 und NIP-86 laufen
     über dieselbe Adresse, nur über HTTP statt WebSocket. */
  function httpAdresse(url) {
    return String(url || '').replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
  }
  async function sha256Hex(text) {
    var b = new TextEncoder().encode(text);
    var h = await crypto.subtle.digest('SHA-256', b);
    return [].map.call(new Uint8Array(h), function (x) {
      return x.toString(16).padStart(2, '0');
    }).join('');
  }

  /* ---------- NIP-11: was ist das für ein Relais? -------------------------
   * Ein Relais beschreibt sich selbst, wenn man seine Adresse mit
   * `Accept: application/nostr+json` abruft: Name, Software, Fassung und die
   * Liste der NIPs, die es kann.
   *
   * DAS IST DIE ANTWORT AUF EINE FRAGE, DIE MONATE OFFEN WAR. Aus einer
   * Sitzungs-Umgebung ist Klaus' Server nicht erreichbar (der Egress-Proxy
   * verweigert beide Relais-Namen mit 403, belegt am 2026-08-17 und erneut am
   * 2026-08-18). Aus SEINEM Browser ist er es sehr wohl. Die Frage „welche
   * Software läuft dort, und kann sie Verwaltung?" beantwortet deshalb nicht
   * mehr eine Sitzung mit einem SSH-Befehl, sondern die App selbst — dort, wo
   * die Leitung offen ist.
   * ---------------------------------------------------------------------- */
  async function relaisAuskunft(wssUrl) {
    var url = httpAdresse(wssUrl);
    try {
      var a = await fetch(url, {
        headers: { Accept: 'application/nostr+json' },
        cache: 'no-store'
      });
      if (!a.ok) return { url: wssUrl, ok: false, grund: 'HTTP ' + a.status };
      var j = await a.json();
      var nips = Array.isArray(j.supported_nips) ? j.supported_nips : [];
      return {
        url: wssUrl, ok: true,
        name: j.name || '', software: j.software || '', fassung: j.version || '',
        nips: nips,
        kannVerwaltung: nips.indexOf(86) >= 0
      };
    } catch (e) {
      /* Häufigster Grund ist nicht „Relais kaputt", sondern CORS: viele Relais
         geben ihre Auskunft nicht an fremde Seiten heraus. Das ist kein Fehler
         des Nutzers und wird auch nicht als solcher gezeigt. */
      return { url: wssUrl, ok: false, grund: 'keine Auskunft (CORS oder offline)' };
    }
  }

  /* ---------- NIP-86: dem eigenen Relais etwas auftragen ------------------
   * Der Standard-Weg, mit dem ein Betreiber sein Relais aus einem Client
   * heraus verwaltet — ohne SSH, ohne Passwort. Der Auftrag geht als POST an
   * dieselbe Adresse; ausgewiesen wird er durch ein signiertes Ereignis
   * (kind 27235, NIP-98) im Authorization-Kopf. Das Relais prüft, ob dieser
   * Schlüssel sein Betreiber ist — die Entscheidung fällt also DORT, nicht
   * hier. Genau deshalb ist es sicher, die Knöpfe überhaupt anzubieten.
   * ---------------------------------------------------------------------- */
  async function verwaltungsAuftrag(wssUrl, methode, parameter) {
    var b = brücke();
    if (!b || typeof b.signiere !== 'function') {
      return { ok: false, grund: 'App nicht bereit' };
    }
    var url = httpAdresse(wssUrl);
    var body = JSON.stringify({ method: methode, params: parameter || [] });
    var ausweis;
    try {
      ausweis = await b.signiere({
        kind: 27235,
        tags: [['u', url], ['method', 'POST'], ['payload', await sha256Hex(body)]],
        content: ''
      });
    } catch (e) { return { ok: false, grund: 'konnte nicht signieren' }; }

    try {
      var a = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/nostr+json+rpc',
          Authorization: 'Nostr ' + btoa(JSON.stringify(ausweis))
        },
        body: body
      });
      var j = null;
      try { j = await a.json(); } catch (_e) { /* manche antworten leer */ }
      if (!a.ok) return { ok: false, grund: 'HTTP ' + a.status + (j && j.error ? ' — ' + j.error : '') };
      if (j && j.error) return { ok: false, grund: String(j.error) };
      return { ok: true, antwort: j };
    } catch (e) {
      return { ok: false, grund: 'nicht erreichbar (CORS oder offline)' };
    }
  }

  /* ---------- Bereich: dein Relais ---------------------------------------- */

  function bereichRelais(box) {
    var s = abschnitt(box, '📡 Deine Relais — was können sie?');
    var hin = el('div', 'opacity:.78;margin:.2em 0 .7em;line-height:1.5');
    hin.textContent = 'Endgültig entfernen kann nur, wer ein Relais betreibt. Hier steht, '
      + 'was deine Relais über sich sagen. „Verwaltung" heißt: Kimboard darf ihnen direkt '
      + 'auftragen, einen Zettel aus dem Speicher zu nehmen.';
    s.appendChild(hin);

    var liste = el('div', 'font-size:.88rem');
    s.appendChild(liste);
    liste.textContent = 'wird abgefragt …';

    var b = brücke();
    var urls = [];
    try {
      urls = (b && typeof b.verbundeneRelais === 'function') ? b.verbundeneRelais() : [];
      if (!urls.length && b && typeof b.relaisListe === 'function') urls = b.relaisListe();
    } catch (_e) { urls = []; }

    if (!urls.length) { liste.textContent = 'Kein Relais verbunden.'; return; }

    Promise.all(urls.map(relaisAuskunft)).then(function (alle) {
      liste.textContent = '';
      alle.forEach(function (r) {
        var z = el('div', 'border-top:1px solid rgba(255,255,255,.10);padding:7px 0;');
        var kopf = el('div', 'font-weight:600;word-break:break-all', r.url);
        z.appendChild(kopf);
        var d = el('div', 'opacity:.8;margin-top:.15em');
        if (!r.ok) {
          d.textContent = '— ' + r.grund;
        } else {
          d.textContent = [
            r.software ? ('Software: ' + r.software.replace(/^.*\//, '')) : 'Software: unbekannt',
            r.fassung ? ('Fassung: ' + r.fassung) : null,
            r.kannVerwaltung ? '✔ Verwaltung möglich (NIP-86)' : '✖ keine Verwaltung (NIP-86 fehlt)'
          ].filter(Boolean).join(' · ');
        }
        z.appendChild(d);
        if (r.ok && !r.kannVerwaltung) {
          var e = el('div', 'opacity:.72;margin-top:.25em;line-height:1.45');
          e.textContent = 'Dieses Relais nimmt keine Aufträge entgegen. Endgültiges Entfernen '
            + 'geht dort nur auf dem Server selbst. Sperren wirkt trotzdem — in jedem Kimboard.';
          z.appendChild(e);
        }
        liste.appendChild(z);
      });
      merkeRelaisStand(alle);
    });
  }

  var relaisStand = [];
  function merkeRelaisStand(alle) { relaisStand = alle || []; }
  function verwaltbareRelais() {
    return relaisStand.filter(function (r) { return r.ok && r.kannVerwaltung; });
  }

  /* ---------- Bereich: was liegt auf dem Brett ---------------------------- */

  function bereichZettel(box) {
    var s = abschnitt(box, '📋 Was gerade auf dem Brett liegt');
    var b = brücke();
    var zettel = [];
    try { zettel = (b && typeof b.zettel === 'function') ? b.zettel() : []; } catch (_e) { zettel = []; }

    // Fragen und Antworten in eine flache Liste — beides kann zu sperren sein.
    var alle = [];
    zettel.forEach(function (z) {
      alle.push({ ev: z.ev, art: 'Frage' });
      (z.antworten || []).forEach(function (a) { alle.push({ ev: a, art: 'Antwort' }); });
    });

    var hin = el('div', 'opacity:.78;margin:.2em 0 .7em;line-height:1.5');
    hin.textContent = alle.length
      ? 'Der Text steht hier nur gekürzt und wird nirgends gespeichert. Gearbeitet wird mit der Kennung.'
      : 'Nichts geladen. Schließ das Studio, lass das Brett vollständig laden und öffne es erneut.';
    s.appendChild(hin);

    var suche = null;
    if (alle.length > 6) {
      suche = document.createElement('input');
      suche.type = 'search';
      suche.placeholder = 'Im Text oder in der Kennung suchen …';
      suche.style.cssText = 'width:100%;padding:7px 9px;margin:0 0 .6em;border-radius:8px;'
        + 'border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:inherit;font:inherit;';
      s.appendChild(suche);
    }

    var liste = el('div', 'font-size:.88rem');
    s.appendChild(liste);

    function zeichne() {
      var f = (suche && suche.value || '').trim().toLowerCase();
      liste.textContent = '';
      var gezeigt = 0;
      alle.forEach(function (e) {
        var text = String(e.ev.content || '');
        if (f && text.toLowerCase().indexOf(f) < 0 && String(e.ev.id).indexOf(f) < 0) return;
        if (gezeigt >= 60) return;      // Deckel: das Studio ist kein Archiv
        gezeigt++;
        liste.appendChild(zettelZeile(e));
      });
      if (!gezeigt) liste.appendChild(el('div', 'opacity:.7', 'Nichts gefunden.'));
    }
    if (suche) suche.addEventListener('input', zeichne);
    zeichne();
  }

  function zettelZeile(e) {
    var ev = e.ev;
    var z = el('div', 'border-top:1px solid rgba(255,255,255,.10);padding:8px 0;');

    var kopf = el('div', 'opacity:.72;font-size:.82rem');
    kopf.textContent = e.art + ' · ' + String(ev.id).slice(0, 12) + '… · von '
      + String(ev.pubkey || '?').slice(0, 12) + '…';
    z.appendChild(kopf);

    var t = el('div', 'margin:.2em 0 .4em;line-height:1.45', kurz(ev.content, 160));
    z.appendChild(t);

    var reihe = el('div', '');

    var bSperr = knopf('⛔ Netzweit sperren');
    bSperr.title = 'Verschwindet aus jedem Kimboard. Der Zettel liegt danach weiter auf den Relais.';
    bSperr.addEventListener('click', function () { sperrDialog(ev, z); });
    reihe.appendChild(bSperr);

    var bWeg = knopf('🗑 Endgültig vom Relais');
    bWeg.title = 'Nimmt den Zettel aus dem Speicher deines eigenen Relais. Wirkt nur dort.';
    bWeg.addEventListener('click', function () { entfernenDialog(ev, z); });
    reihe.appendChild(bWeg);

    z.appendChild(reihe);
    return z;
  }

  /* ---------- Sperren ------------------------------------------------------ */

  function sperrDialog(ev, zeile) {
    var grund = prompt(
      'Netzweit sperren — Grund (kurz und sachlich, steht später in der Liste):\n\n'
      + 'Er verschwindet dann aus JEDEM Kimboard. Der Zettel selbst liegt weiter auf den '
      + 'Relais; ein anderer Nostr-Client zeigt ihn.\n\n'
      + 'Gelöst wird eine Sperre nur in der Datei — hier geht es nur in eine Richtung.',
      'Volksverhetzung'
    );
    if (grund == null) return;
    grund = String(grund).trim();
    if (!grund) { alert('Ohne Grund wird nichts gesperrt.'); return; }

    var auchAbsender = confirm(
      'Nur diesen einen Zettel sperren — oder ALLES von diesem Absender?\n\n'
      + 'OK = alles von ihm (auch Harmloses, auch Künftiges).\n'
      + 'Abbrechen = nur dieser Zettel.'
    );

    var liste = { ereignisse: {}, absender: {} };
    liste.ereignisse[String(ev.id).toLowerCase()] = { grund: grund, seit: heute() };
    if (auchAbsender && HEX64.test(String(ev.pubkey || ''))) {
      liste.absender[String(ev.pubkey).toLowerCase()] = { grund: grund, seit: heute() };
    }

    var b = brücke(), n = 0;
    try { n = (b && typeof b.sperreJetzt === 'function') ? b.sperreJetzt(liste) : 0; } catch (_e) { n = 0; }

    neuGesperrt.push(liste);
    if (zeile) {
      zeile.style.opacity = '.45';
      var m = el('div', 'margin-top:.3em;color:var(--acc,#c9a961);font-size:.84rem',
        '⛔ gesperrt — jetzt in „Sperr-Liste" die Datei erzeugen, sonst gilt es nur hier.');
      zeile.appendChild(m);
    }
    zeichneListenStand();
    if (!n) {
      alert('Eingetragen. (Auf diesem Gerät war er schon gesperrt.)\n\n'
        + 'Damit es überall gilt, unten unter „Sperr-Liste" die Datei erzeugen und einchecken.');
    }
  }

  /* Was in DIESER Sitzung dazugekommen ist. Wird beim Erzeugen der Datei mit
     dem bestehenden Stand zusammengeführt. */
  var neuGesperrt = [];

  /* ---------- Endgültig vom eigenen Relais -------------------------------- */

  function entfernenDialog(ev, zeile) {
    var ziele = verwaltbareRelais();
    if (!ziele.length) {
      alert(
        'Keines deiner Relais nimmt Aufträge entgegen (NIP-86).\n\n'
        + 'Das heißt nicht, dass nichts geht — es heißt nur, dass es nicht von hier aus geht. '
        + 'Auf deinem eigenen Server kannst du den Zettel weiterhin aus dem Speicher nehmen; '
        + 'oben unter „Deine Relais" steht, welche Software dort läuft.\n\n'
        + 'Sperren wirkt unabhängig davon — in jedem Kimboard, sofort.'
      );
      return;
    }
    var namen = ziele.map(function (r) { return r.url; }).join('\n');
    if (!confirm(
      'Diesen Zettel endgültig aus dem Speicher nehmen?\n\n' + namen + '\n\n'
      + 'Ehrlich, damit es hinterher keine Überraschung gibt:\n'
      + '· Wirkt NUR auf deinen eigenen Relais. Liegt er auch auf einem fremden, bleibt er dort.\n'
      + '· Wer ihn schon gelesen oder kopiert hat, hat ihn weiterhin.\n'
      + '· Rückgängig geht das nicht.\n\n'
      + 'Zusätzlich sperren (⛔) ist meist richtig — das wirkt in jedem Kimboard.'
    )) return;

    var grund = prompt('Grund für das Protokoll deines Relais (kurz):', 'rechtswidriger Inhalt');
    if (grund == null) return;

    var meldung = el('div', 'margin-top:.35em;font-size:.84rem;opacity:.85', '… wird beauftragt');
    if (zeile) zeile.appendChild(meldung);

    Promise.all(ziele.map(function (r) {
      return verwaltungsAuftrag(r.url, 'banevent', [String(ev.id), String(grund)])
        .then(function (a) { return { url: r.url, a: a }; });
    })).then(function (alle) {
      var gut = alle.filter(function (x) { return x.a.ok; });
      var schlecht = alle.filter(function (x) { return !x.a.ok; });
      var text = '';
      if (gut.length) text += '✔ entfernt auf: ' + gut.map(function (x) { return x.url; }).join(', ');
      if (schlecht.length) {
        if (text) text += ' — ';
        text += '✖ nicht entfernt auf: ' + schlecht.map(function (x) {
          return x.url + ' (' + x.a.grund + ')';
        }).join(', ');
      }
      meldung.textContent = text;
      meldung.style.color = schlecht.length ? '#e0231b' : 'var(--acc,#c9a961)';
    });
  }

  /* ---------- Bereich: Sperr-Liste ---------------------------------------- */

  var standKnoten = null;

  function bereichListe(box) {
    var s = abschnitt(box, '📜 Sperr-Liste');
    var hin = el('div', 'opacity:.78;margin:.2em 0 .7em;line-height:1.5');
    hin.textContent = 'Was hier steht, zeigt jedes Kimboard nicht mehr an. Damit das über dieses '
      + 'Gerät hinaus gilt, muss die Liste als signierte Datei ins Repo — sie erzeugt sich hier, '
      + 'aber einchecken musst du sie selbst.';
    s.appendChild(hin);

    standKnoten = el('div', 'font-size:.88rem;margin-bottom:.6em');
    s.appendChild(standKnoten);
    zeichneListenStand();

    var bDatei = knopf('💾 Signierte Liste erzeugen');
    bDatei.title = 'Erzeugt sbkim/sperrliste.json — signiert mit deinem Schlüssel.';
    bDatei.addEventListener('click', dateiErzeugen);
    s.appendChild(bDatei);

    var fuss = el('div', 'opacity:.72;margin-top:.6em;line-height:1.45;font-size:.85rem');
    fuss.textContent = 'Die Datei kommt nach sbkim/sperrliste.json. Damit sie überhaupt gelesen '
      + 'wird, muss in assets/config/moderation.js „pruefschluessel" auf deine Kennung stehen — '
      + 'sonst lädt Kimboard bewusst gar nichts nach.';
    s.appendChild(fuss);
  }

  function zeichneListenStand() {
    if (!standKnoten) return;
    var b = brücke(), stand = { ereignisse: [], absender: [] };
    try { if (b && typeof b.sperrliste === 'function') stand = b.sperrliste(); } catch (_e) { /* */ }
    standKnoten.textContent = 'Aktuell gesperrt: ' + (stand.ereignisse || []).length + ' Zettel, '
      + (stand.absender || []).length + ' Absender.';
  }

  /* Baut die Liste als signiertes Nostr-Ereignis. Genau dieselbe Form, die
     `ladeSperrQuelle` in index.html erwartet und prüft — ein Ort der Wahrheit,
     kein zweites Format, das auseinanderlaufen könnte. */
  async function dateiErzeugen() {
    var b = brücke();
    if (!b || typeof b.signiere !== 'function') { alert('App nicht bereit.'); return; }

    // Bestehenden Stand einsammeln (Kennungen), dazu die dieser Sitzung mit
    // Grund und Datum. Für alte Einträge, deren Grund hier nicht mehr vorliegt,
    // bleibt das Grund-Feld leer — lieber leer als erfunden.
    var liste = { ereignisse: {}, absender: {} };
    var stand = { ereignisse: [], absender: [] };
    try { stand = b.sperrliste(); } catch (_e) { /* */ }
    (stand.ereignisse || []).forEach(function (id) { liste.ereignisse[id] = { grund: '', seit: '' }; });
    (stand.absender || []).forEach(function (p) { liste.absender[p] = { grund: '', seit: '' }; });
    neuGesperrt.forEach(function (teil) {
      Object.keys(teil.ereignisse || {}).forEach(function (k) { liste.ereignisse[k] = teil.ereignisse[k]; });
      Object.keys(teil.absender || {}).forEach(function (k) { liste.absender[k] = teil.absender[k]; });
    });

    var inhalt = JSON.stringify({
      fassung: 1, stand: heute(),
      ereignisse: liste.ereignisse, absender: liste.absender
    });

    var ereignis;
    try {
      ereignis = await b.signiere({
        kind: 30078,                                  // anwendungseigene Daten
        tags: [['d', 'kimboard-sperrliste']],
        content: inhalt
      });
    } catch (e) { alert('Konnte nicht signieren.'); return; }

    var blob = new Blob([JSON.stringify(ereignis, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sperrliste.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () {
      try { URL.revokeObjectURL(a.href); document.body.removeChild(a); } catch (_e) { /* */ }
    }, 1000);

    alert('Datei erzeugt: sperrliste.json\n\n'
      + 'Sie gehört ins Repo nach sbkim/sperrliste.json. Erst dann gilt die Sperre '
      + 'auf allen Geräten — bis dahin nur auf diesem.');
  }

  /* ---------- Rahmen ------------------------------------------------------- */

  function abschnitt(box, titel) {
    var s = el('div', 'border-top:1px solid rgba(255,255,255,.14);padding:12px 0;');
    var h = el('div', 'font-weight:700;margin-bottom:.1em', titel);
    s.appendChild(h);
    box.appendChild(s);
    return s;
  }

  function fremdesFenster(meine, erwartet) {
    var box = rahmen('🔧 Studio');
    var t = el('div', 'line-height:1.55');
    if (!erwartet) {
      t.textContent = 'Für dieses Brett ist noch kein Betreiber eingetragen. Wenn du es betreibst, '
        + 'gehört deine Kennung in assets/config/moderation.js — dann öffnet sich hier das Studio.';
      /* Die Kennung zum Mitnehmen. Sie entsteht in jedem Browser neu und steht
         deshalb nirgends im Repo; ohne diesen Knopf müsste man sie abtippen. */
      if (HEX64.test(String(meine || ''))) {
        var zeile = 'betreiberSchluessel: \'' + meine + '\',';
        var kasten = el('div', 'margin:.7em 0 .3em;padding:8px 10px;border-radius:8px;'
          + 'background:rgba(0,0,0,.28);font-family:ui-monospace,monospace;font-size:.8rem;'
          + 'word-break:break-all;', zeile);
        t.appendChild(kasten);
        var kopf = knopf('📋 Zeile kopieren');
        kopf.addEventListener('click', function () {
          try {
            navigator.clipboard.writeText(zeile);
            kopf.textContent = '✓ kopiert';
          } catch (_e) { kopf.textContent = 'Bitte von Hand markieren'; }
        });
        t.appendChild(kopf);
        var wo = el('div', 'opacity:.72;margin-top:.5em;line-height:1.45;font-size:.85rem');
        wo.textContent = 'Diese Zeile ersetzt in assets/config/moderation.js die Zeile '
          + '„betreiberSchluessel: null,". Achtung: die Kennung gehört zu DIESEM Browser — '
          + 'auf einem anderen Gerät ist sie eine andere.';
        t.appendChild(wo);
      }
    } else {
      t.textContent = 'Das ist nicht dein Brett. Das Studio gehört dem Betreiber, und dein Gerät '
        + 'trägt einen anderen Schlüssel.';
      var d = el('div', 'opacity:.72;margin-top:.5em;font-size:.85rem');
      d.textContent = 'Deine Kennung: ' + String(meine || '—').slice(0, 16) + '…  ·  '
        + 'Betreiber: ' + String(erwartet).slice(0, 16) + '…';
      t.appendChild(d);
    }
    box.appendChild(t);
    var e = el('div', 'opacity:.72;margin-top:.7em;line-height:1.45;font-size:.85rem');
    e.textContent = 'Falls du hier Inhalte gefunden hast, die nicht hierher gehören: Jeder Zettel '
      + 'hat einen ⚑-Knopf. Darüber sieht ein Mensch sie sich an.';
    box.appendChild(e);
  }

  function rahmen(titel) {
    bg = el('div', 'position:fixed;inset:0;background:rgba(20,18,16,.6);display:flex;'
      + 'align-items:center;justify-content:center;z-index:10050;padding:16px;');
    var box = el('div', 'background:var(--card,#1c1a17);color:var(--fg,#eee);'
      + 'border:1px solid var(--acc,#c9a961);border-radius:14px;max-width:640px;width:100%;'
      + 'max-height:86vh;overflow:auto;padding:16px 18px;font-size:.92rem;');
    box.id = 'studio-fenster';

    var kopf = el('div', 'display:flex;align-items:baseline;gap:10px;margin-bottom:.3em');
    var h = el('h3', 'margin:.1em 0;flex:1', titel);
    kopf.appendChild(h);
    var zu = knopf('Schließen');
    zu.id = 'studio-schliessen';
    zu.addEventListener('click', schliessen);
    kopf.appendChild(zu);
    box.appendChild(kopf);

    bg.appendChild(box);
    document.body.appendChild(bg);
    bg.addEventListener('click', function (ev) { if (ev.target === bg) schliessen(); });
    offen = true;
    return box;
  }

  function schliessen() {
    try { if (bg && bg.parentNode) bg.parentNode.removeChild(bg); } catch (_e) { /* */ }
    bg = null; offen = false; standKnoten = null;
  }

  function oeffnen() {
    if (offen) return;
    var b = brücke();
    var meine = '';
    try { meine = (b && typeof b.me === 'function') ? b.me() : ''; } catch (_e) { meine = ''; }
    var erwartet = K().betreiberSchluessel;
    erwartet = (typeof erwartet === 'string' && HEX64.test(erwartet.trim()))
      ? erwartet.trim().toLowerCase() : '';

    if (!erwartet || String(meine).toLowerCase() !== erwartet) {
      fremdesFenster(meine, erwartet);
      return;
    }

    var box = rahmen('🔧 Studio — dieses Brett verwalten');
    var hin = el('div', 'opacity:.8;line-height:1.5;margin-bottom:.2em');
    hin.textContent = 'Drei Reichweiten, und sie sind nicht dasselbe: ausblenden gilt nur hier, '
      + 'sperren gilt in jedem Kimboard, und endgültig entfernen geht nur auf deinen eigenen '
      + 'Relais. Keine davon holt einen Zettel aus der Welt zurück.';
    box.appendChild(hin);

    bereichRelais(box);
    bereichZettel(box);
    bereichListe(box);
  }

  window.KBStudio = {
    umschalten: function () { if (offen) schliessen(); else oeffnen(); },
    oeffnen: oeffnen,
    schliessen: schliessen,
    istOffen: function () { return offen; }
  };
})();
