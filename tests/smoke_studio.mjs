#!/usr/bin/env node
/*
 * Smoke — das Betreiber-Studio (Strang A), echter Browser.
 *
 * WOZU: Das Studio ist der Griff, mit dem Klaus von seinem eigenen Gerät aus
 * zufassen kann — sperren, und wo es geht, wirklich entfernen. Ein Werkzeug
 * dieser Art muss zwei Dinge zugleich beweisen: dass es WIRKT, und dass es
 * NICHT MEHR kann, als es behauptet.
 *
 * Geprüft wird — gemessen, nicht aus dem Code abgelesen:
 *
 *   1. NICHT VORAB. `assets/studio.js` wird beim normalen Laden gar nicht
 *      geholt. Ein Besucher lädt Klaus' Werkzeug nie.
 *   2. LANGER DRUCK. ~1,5 s auf das © öffnet es; ein kurzer Tipp nicht, und
 *      ein Wischen bricht ab. Sonst löste jedes Scrollen über der Fußzeile das
 *      Studio aus — der Fehler, der wie ein Geist aussieht.
 *   3. AUSWEIS. Ohne eingetragenen Betreiber und mit fremdem Schlüssel gibt es
 *      kein Studio, sondern eine ehrliche Auskunft — und keinen Sperr-Knopf.
 *   4. EINBAHNSTRASSE. Auch das Betreiber-Werkzeug kann nur sperren, nie lösen.
 *      Ein Werkzeug, das die Regel umginge, wäre ein Loch in genau der Regel,
 *      die es durchsetzen soll.
 *   5. KEIN SCHLÜSSEL NACH DRAUSSEN. Die Brücke gibt `signiere` heraus, nicht
 *      den privaten Schlüssel. Und was sie signiert, ist echt prüfbar.
 *   6. RUNDLAUF — die wichtigste. Was das Studio als Datei ausgibt, muss die
 *      App wieder ANNEHMEN. Hier wird der echte Knopf gedrückt, der echte
 *      Download aufgefangen und einer zweiten Seite als Quelle vorgelegt.
 *      Ohne das könnte das Studio fleißig Dateien erzeugen, die niemand liest.
 *   7. NIP-86 EHRLICH. Kann das Relais keine Verwaltung, sagt das Studio das
 *      und schickt NICHTS. Kann es sie, geht ein korrekt ausgewiesener Auftrag
 *      hinaus (Authorization-Kopf wird mitgelesen und geprüft).
 *   8. FAIL-SOFT. Fehlt die Brücke, stürzt nichts ab.
 *
 * Gegenprobe: tests/gegenprobe_moderation.sh
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_studio.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8487;
const SEITE = `http://127.0.0.1:${PORT}/index.html`;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const alsJs = (js) => ({ status: 200, contentType: 'application/javascript; charset=utf-8', body: js });
const modDatei = (o) => alsJs('window.KB_MODERATION = ' + JSON.stringify(Object.assign({
  meldeEndpunkt: '', meldeMail: 'test@example.invalid', betreiber: 'Test',
  beschwerdeWeg: 'impressum.html', quelle: null, pruefschluessel: null,
  betreiberSchluessel: null
}, o)) + ';');

/* Eine Seite mit ersetzter Konfiguration. Der Service-Worker bleibt aus:
   `page.route` fängt keine Abrufe ab, die aus einem Service-Worker kommen —
   die Prüfung würde sonst messen, was sie gar nicht steuert. */
async function neueSeite(browser, { mod, quelle, nip11, zaehleStudio } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 900, height: 1100 }, serviceWorkers: 'block', acceptDownloads: true
  });
  const p = await ctx.newPage();
  const errs = [], geholt = [], auftraege = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  if (zaehleStudio) p.on('request', (r) => { if (/studio\.js/.test(r.url())) geholt.push(r.url()); });

  if (mod !== undefined) {
    await p.route('**/assets/config/moderation.js', (r) =>
      mod === null ? r.abort() : r.fulfill(modDatei(mod)));
  }
  if (quelle !== undefined) {
    await p.route('**/sbkim/sperrliste.json', (r) =>
      quelle === null ? r.abort()
        : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(quelle) }));
  }
  /* Die echten Relais-Adressen abfangen: das Studio ruft sie per NIP-11 ab
     (Auskunft über sich selbst) und danach ggf. per NIP-86 (Auftrag). Beides
     läuft über dieselbe https-Adresse — unterschieden wird an der Methode. */
  if (nip11 !== undefined) {
    /* Die Freigabe-Köpfe sind kein Beiwerk: eine per `route` gefälschte Antwort
       unterliegt derselben Herkunfts-Prüfung wie eine echte. Ohne sie verwirft
       der Browser die Antwort, und das Studio meldet völlig korrekt „keine
       Auskunft" — die Probe hätte dann nicht das Studio gemessen, sondern die
       eigene Nachlässigkeit. Genau so ist es beim zweiten Lauf passiert.
       Und der POST löst wegen seines eigenen Inhaltstyps eine Vorab-Frage
       (OPTIONS) aus, die auch beantwortet werden will. */
    const frei = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept'
    };
    await p.route(/^https:\/\/relay\./, async (r) => {
      const req = r.request();
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: frei, body: '' });
      if (req.method() === 'POST') {
        auftraege.push({
          url: req.url(),
          auth: req.headers()['authorization'] || '',
          body: req.postData() || ''
        });
        return r.fulfill({
          status: 200, contentType: 'application/json', headers: frei,
          body: JSON.stringify({ result: true })
        });
      }
      if (nip11 === null) return r.abort();
      return r.fulfill({
        status: 200, contentType: 'application/nostr+json', headers: frei,
        body: JSON.stringify(nip11)
      });
    });
  }
  await p.goto(SEITE, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!(window.__kb && window.__kb.dispatch), null, { timeout: 20000 });
  return { p, ctx, errs, geholt, auftraege };
}

/* Öffnet das Studio über den kurzen Weg und wartet auf die BEDINGUNG, dass das
   Fenster wirklich steht — nie auf eine runde Zahl Millisekunden. Ein
   `waitForTimeout` ist ein Rennen, das irgendwann verloren geht, und verloren
   hieße hier nicht „rot", sondern „hat nichts geprüft". */
async function studioAuf(p) {
  await p.evaluate(() => window.__kbStudioOeffnen());
  await p.waitForFunction(() => !!document.getElementById('studio-fenster'), null, { timeout: 15000 });
}
const text = (p) => p.evaluate(() => {
  const b = document.getElementById('studio-fenster');
  return b ? b.innerText : '';
});
/* Eigene Kennung als Betreiber eintragen — sie entsteht bei jedem Start neu,
   kann also nicht fest in der Probe stehen. */
const meine = (p) => p.evaluate(() => window.__kb.me());

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  console.log('== Betreiber-Studio ==');

  /* ═══ 1. Das Werkzeug liegt nicht auf dem Weg jedes Besuchers ═══ */
  {
    const { p, ctx, geholt } = await neueSeite(browser, { mod: {}, zaehleStudio: true });
    await p.waitForFunction(() => !!document.querySelector('.fp-copy'), null, { timeout: 10000 });
    ok(geholt.length === 0, 'assets/studio.js wird beim normalen Laden NICHT geholt');
    ok(await p.evaluate(() => !window.KBStudio), 'und es gibt vorher kein KBStudio');
    ok(await p.evaluate(() => typeof window.__kbStudioOeffnen === 'function'),
      'der Zugang hängt aber am ©, sobald die Seite steht');
    await ctx.close();
  }

  /* ═══ 2. Langer Druck — und nur der ═══
     Das ist der Punkt, an dem ein Werkzeug lästig wird, wenn man ihn falsch
     baut: löste schon ein Tipp oder ein Scrollen aus, ginge das Studio beim
     Lesen ständig von allein auf. */
  {
    const { p, ctx, geholt } = await neueSeite(browser, { mod: {}, zaehleStudio: true });
    /* Erst ins Sichtfeld rollen. Ohne das liegt die Fußzeile unterhalb des
       Fensters, die Maus trifft sie nie — und die beiden Prüfungen darunter
       („öffnet nichts") wären grün, ohne irgendetwas berührt zu haben. Genau
       so ist es beim ersten Lauf passiert. */
    await p.locator('.fp-copy').scrollIntoViewIfNeeded();
    const kasten = await p.locator('.fp-copy').boundingBox();
    ok(!!kasten, 'das © in der Fußzeile ist da und greifbar');
    ok(!!kasten && kasten.y >= 0 && kasten.y < 1100,
      '…und liegt beim Drücken wirklich im Sichtfeld (sonst prüft der Rest nichts)');

    const mitte = { x: kasten.x + kasten.width / 2, y: kasten.y + kasten.height / 2 };

    // a) kurzer Tipp — darf nichts tun
    await p.mouse.move(mitte.x, mitte.y);
    await p.mouse.down(); await p.waitForTimeout(250); await p.mouse.up();
    ok(geholt.length === 0, 'ein kurzer Tipp aufs © öffnet nichts');

    /* b) langer Druck MIT Wischen — muss abbrechen.
       Gewischt wird INNERHALB der Zeile (nur waagerecht). Der erste Entwurf
       wischte 40 px nach unten und verließ damit das Element: dann greift
       ohnehin `pointerleave`, und die Prüfung maß nicht mehr den Wisch-Abbruch,
       sondern etwas anderes. Aufgefallen ist das erst der Gegenprobe — sie baute
       den Abbruch aus, und die Probe blieb grün. */
    const links = { x: kasten.x + kasten.width * 0.2, y: kasten.y + kasten.height / 2 };
    const rechts = { x: kasten.x + kasten.width * 0.8, y: links.y };
    ok(rechts.x - links.x > 20, 'die Zeile ist breit genug, um darin zu wischen');
    await p.mouse.move(links.x, links.y);
    await p.mouse.down();
    await p.mouse.move(rechts.x, rechts.y);
    await p.waitForTimeout(1800);
    await p.mouse.up();
    ok(geholt.length === 0, 'ein Wischen INNERHALB des © bricht ab (kein Geist beim Scrollen)');

    // b2) und wer die Zeile ganz verlässt, bricht ebenfalls ab
    await p.mouse.move(mitte.x, mitte.y);
    await p.mouse.down();
    await p.mouse.move(mitte.x, mitte.y + kasten.height + 60);
    await p.waitForTimeout(1800);
    await p.mouse.up();
    ok(geholt.length === 0, '…und wer die Zeile ganz verlässt, ebenso');

    // c) langer Druck ohne Wischen — muss öffnen
    await p.mouse.move(mitte.x, mitte.y);
    await p.mouse.down();
    await p.waitForFunction(() => !!window.KBStudio, null, { timeout: 8000 });
    await p.mouse.up();
    ok(geholt.length === 1, 'ein langer Druck (~1,5 s) holt studio.js — und zwar nur einmal insgesamt');
    await p.waitForFunction(() => !!document.getElementById('studio-fenster'), null, { timeout: 8000 });
    ok(true, 'und öffnet das Fenster');
    await ctx.close();
  }

  /* ═══ 2b. Der Wisch-Abbruch, isoliert gemessen ═══
     Eigene, frische Seite: der Abschnitt lädt das Studio absichtlich, und das
     würde die Zählung in Abschnitt 2 verfälschen. */
  {
    const { p, ctx, geholt } = await neueSeite(browser, { mod: {}, zaehleStudio: true });
    await p.locator('.fp-copy').scrollIntoViewIfNeeded();
    const k = await p.locator('.fp-copy').boundingBox();
    const mitte = { x: k.x + k.width / 2, y: k.y + k.height / 2 };

    /* Mit der MAUS ist dieser Handler nicht messbar: sobald man über Text
       zieht, beginnt Chrome eine Textauswahl und schickt von sich aus
       `pointercancel` — der Druck bricht dann auch ohne unseren Handler ab.
       Die Gegenprobe hat das aufgedeckt: sie baute ihn aus, und die Probe blieb
       grün, weil in Wahrheit etwas anderes gemessen wurde.
       Auf Klaus' Tablet ist aber genau dieser Handler der wirksame Weg — dort
       scrollt der Finger. Deshalb hier echte Pointer-Ereignisse, ohne
       Textauswahl und ohne `pointercancel`. */
    await p.evaluate(async ([x, y]) => {
      const z = document.querySelector('.fp-copy');
      const mach = (art, dx) => z.dispatchEvent(new PointerEvent(art, {
        bubbles: true, clientX: x + dx, clientY: y, pointerId: 1
      }));
      mach('pointerdown', 0);
      mach('pointermove', 40);
      await new Promise((r) => setTimeout(r, 1900));
    }, [mitte.x, mitte.y]);
    ok(geholt.length === 0, 'ein pointermove über die Schwelle bricht den Druck ab (der Finger-Fall)');

    /* Und sofort die Gegenprobe dazu: ohne Wischen MUSS derselbe Weg öffnen.
       Sonst wäre die Prüfung darüber grün, weil die künstlichen Ereignisse
       überhaupt nichts auslösen — grün aus dem falschen Grund. */
    await p.evaluate(async ([x, y]) => {
      document.querySelector('.fp-copy').dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, clientX: x, clientY: y, pointerId: 2
      }));
      await new Promise((r) => setTimeout(r, 1900));
    }, [mitte.x, mitte.y]);
    await p.waitForFunction(() => !!window.KBStudio, null, { timeout: 8000 });
    ok(geholt.length === 1, '…derselbe Weg OHNE Wischen öffnet aber (die Prüfung misst wirklich etwas)');
    await ctx.close();
  }

  /* ═══ 3. Der Ausweis ═══ */
  {
    // a) kein Betreiber eingetragen
    const a = await neueSeite(browser, { mod: { betreiberSchluessel: null } });
    await studioAuf(a.p);
    const t1 = await text(a.p);
    ok(/kein Betreiber eingetragen/i.test(t1), 'ohne eingetragenen Betreiber sagt das Studio das ehrlich');
    ok(!/Netzweit sperren/.test(t1), '…und bietet keinen Sperr-Knopf an');
    /* …aber es sagt, WIE man Betreiber wird. Die Kennung entsteht in jedem
       Browser neu und steht nirgends im Repo; ohne diesen Weg müsste Klaus sie
       abtippen — und ein Werkzeug, das man nur mit Abtippen in Gang bringt,
       bleibt aus. */
    const ichA = await meine(a.p);
    ok(t1.indexOf(ichA) >= 0, '…zeigt aber die eigene Kennung zum Eintragen');
    ok(/betreiberSchluessel:/.test(t1), '…als fertige Zeile für moderation.js');
    ok(/DIESEM Browser/.test(t1), '…mit dem Hinweis, dass sie am Gerät hängt');
    await a.ctx.close();

    // b) fremder Betreiber
    const b = await neueSeite(browser, { mod: { betreiberSchluessel: 'b'.repeat(64) } });
    await studioAuf(b.p);
    const t2 = await text(b.p);
    ok(/nicht dein Brett/i.test(t2), 'mit fremdem Schlüssel: „das ist nicht dein Brett"');
    ok(!/Netzweit sperren/.test(t2), '…und ebenfalls kein Sperr-Knopf');
    ok(/⚑/.test(t2), '…dafür der Hinweis auf den Melde-Weg');
    await b.ctx.close();

    // c) der echte Betreiber
    const c = await neueSeite(browser, { mod: {}, nip11: null });
    const ich = await meine(c.p);
    ok(/^[0-9a-f]{64}$/.test(ich), 'die eigene Kennung ist eine echte Schlüssel-Kennung');
    await c.p.evaluate((k) => { window.KB_MODERATION.betreiberSchluessel = k; }, ich);
    await studioAuf(c.p);
    const t3 = await text(c.p);
    ok(/Deine Relais/.test(t3), 'als Betreiber: Bereich „Deine Relais" ist da');
    ok(/auf dem Brett liegt/.test(t3), '…Bereich „Was gerade auf dem Brett liegt"');
    ok(/Sperr-Liste/.test(t3), '…Bereich „Sperr-Liste"');
    ok(/nur auf deinen eigenen Relais|nicht dasselbe/.test(t3),
      '…und die drei Reichweiten stehen ehrlich im Kopf');
    await c.ctx.close();
  }

  /* ═══ 4. Einbahnstraße — auch für den Betreiber ═══ */
  {
    const { p, ctx } = await neueSeite(browser, { mod: {}, nip11: null });
    const erg = await p.evaluate(() => {
      const id = 'a'.repeat(64), pub = 'c'.repeat(64);
      const o = {};
      window.__kb.sperreJetzt({ ereignisse: { [id]: { grund: 'Probe', seit: '2026-08-18' } }, absender: {} });
      o.gesperrt = window.__kb.istNetzGesperrt({ id, pubkey: pub });
      // Versuch, dieselbe Kennung mit leerem Grund zu „überschreiben"
      window.__kb.sperreJetzt({ ereignisse: { [id]: { grund: '', seit: '' } }, absender: {} });
      o.nochGesperrt = window.__kb.istNetzGesperrt({ id, pubkey: pub });
      // Die herausgegebene Karte darf nur eine Kopie sein
      const kopie = window.__kb.sperrliste();
      kopie.ereignisse.length = 0;
      o.nachKopieLeeren = window.__kb.istNetzGesperrt({ id, pubkey: pub });
      /* `entsperreAbsender` ist ausgenommen und muss es sein: das ist die
         LOKALE Stummschaltung („ich will den nicht sehen"), die man selbst
         zurücknehmen können muss. Die NETZ-Sperre ist etwas anderes — für sie
         darf es keinen Weg geben. Dieselbe Ausnahme trifft smoke_sperrliste. */
      o.keinLoeseWeg = !Object.keys(window.__kb)
        .some((k) => /entsperr|loese|freigab|entferneSperr/i.test(k) && k !== 'entsperreAbsender');
      return o;
    });
    ok(erg.gesperrt, 'das Studio kann über die Brücke sperren');
    ok(erg.nochGesperrt, '…und ein zweiter Aufruf hebt die Sperre nicht auf');
    ok(erg.nachKopieLeeren, '…die herausgegebene Liste ist eine Kopie, kein Hebel');
    ok(erg.keinLoeseWeg, '…und es gibt keinen Weg, eine NETZ-Sperre zu lösen (nur die Datei)');
    await ctx.close();
  }

  /* ═══ 5. Signieren, ohne den Schlüssel herzugeben ═══ */
  {
    const { p, ctx } = await neueSeite(browser, { mod: {}, nip11: null });
    const erg = await p.evaluate(async () => {
      const { schnorr } = await import('./modules/noble-secp256k1.js');
      const { eventId } = await import('./modules/echtheit.js');
      const ev = await window.__kb.signiere({ kind: 27235, tags: [['u', 'https://x']], content: 'hallo' });
      const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      const roh = (h) => Uint8Array.from(h.match(/.{2}/g).map((x) => parseInt(x, 16)));
      const idNeu = await eventId(ev);
      return {
        kind: ev.kind,
        eigenerAbsender: ev.pubkey === window.__kb.me(),
        idStimmt: idNeu === ev.id,
        sigStimmt: await schnorr.verify(roh(ev.sig), roh(ev.id), roh(ev.pubkey)),
        /* Nicht nach Namen suchen — der echte Schlüssel liegt im Speicher des
           Browsers, also wird nachgesehen, ob er IRGENDWO in der Brücke oder im
           Ergebnis auftaucht. Ein Namensfilter hätte hier `setPrivatAn`
           gefangen (Privat-Nachrichten) und dabei nichts über Schlüssel
           ausgesagt: rot aus dem falschen Grund. */
        /* In BEIDEN Formen suchen. Im Modul liegt der Schlüssel als Byte-Feld
           (`fromHex(privHex)`), nicht als Text — eine Suche nur nach der
           Hex-Zeichenkette ginge daran vorbei. Die Gegenprobe hat genau das
           gezeigt: sie hängte `_priv: priv` in die Brücke, und die Prüfung
           blieb grün, weil `JSON.stringify` daraus `{"0":18,…}` macht. */
        keinPrivat: (() => {
          const geheim = localStorage.getItem('sbkim_nostr_test_priv') || '';
          if (!/^[0-9a-f]{64}$/.test(geheim)) return false;   // nichts zu messen = kein Freispruch
          const bytes = geheim.match(/.{2}/g).map((x) => parseInt(x, 16));
          const alsFeld = JSON.stringify(bytes);                        // [18,52,…]
          const alsObjekt = JSON.stringify(Object.assign({}, bytes));   // {"0":18,…}
          const alles = Object.keys(window.__kb).map((k) => {
            const v = window.__kb[k];
            try {
              if (typeof v === 'function') return String(v);
              if (v && (ArrayBuffer.isView(v) || Array.isArray(v))) return JSON.stringify([...v]);
              return JSON.stringify(v);
            } catch (_e) { return ''; }
          }).join('|');
          return alles.indexOf(geheim) < 0
            && alles.indexOf(alsFeld) < 0
            && alles.indexOf(alsObjekt) < 0;
        })(),
        keinPrivatImErgebnis: JSON.stringify(ev)
          .indexOf(localStorage.getItem('sbkim_nostr_test_priv') || 'XX') < 0,
        hex: typeof hex === 'function'
      };
    });
    ok(erg.kind === 27235, 'signiere() nimmt eine freie Art an (nicht auf Zettel festgelegt)');
    ok(erg.eigenerAbsender, '…signiert mit der eigenen Kennung');
    ok(erg.idStimmt, '…die Kennung passt zum Inhalt (derselbe Rechenweg wie der Prüfer)');
    ok(erg.sigStimmt, '…und die Signatur hält der echten Prüfung stand');
    ok(erg.keinPrivat, 'die Brücke gibt keinen privaten Schlüssel heraus');
    ok(erg.keinPrivatImErgebnis, '…und im signierten Ereignis steckt keiner');
    await ctx.close();
  }

  /* ═══ 6. RUNDLAUF — was das Studio ausgibt, muss die App annehmen ═══
     Der Kern der ganzen Prüfung. Ohne ihn könnte das Studio tadellos aussehen
     und Dateien erzeugen, die niemand liest. */
  {
    const { p, ctx } = await neueSeite(browser, { mod: {}, nip11: null });
    const ich = await meine(p);
    await p.evaluate((k) => { window.KB_MODERATION.betreiberSchluessel = k; }, ich);

    // Ein Zettel, der gesperrt werden soll — echt signiert, echt zugestellt.
    const zettel = await p.evaluate(async () => {
      const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
      const { eventId } = await import('./modules/echtheit.js');
      const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      const roh = (h) => Uint8Array.from(h.match(/.{2}/g).map((x) => parseInt(x, 16)));
      const priv = utils.randomPrivateKey();
      const pub = hex(schnorr.getPublicKey(priv));
      const e = {
        pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
        tags: [['t', 'sbkim-pin']], content: 'STUDIO-PROBE-BOESE'
      };
      e.id = await eventId(e);
      e.sig = hex(await schnorr.sign(roh(e.id), priv));
      await window.__kb.dispatch(e, 'wss://test');
      return { id: e.id, pubkey: pub };
    });
    await p.waitForFunction((i) => !!document.querySelector('[data-qid="' + i + '"]'),
      zettel.id, { timeout: 10000 });
    ok(true, 'Probe-Zettel hängt am Brett');

    await studioAuf(p);
    ok(/STUDIO-PROBE-BOESE/.test(await text(p)), 'das Studio zeigt ihn in der Übersicht');

    // Sperren über den echten Knopf. prompt/confirm/alert beantworten.
    p.on('dialog', (d) => {
      const t = d.message();
      if (/Grund/.test(t) && d.type() === 'prompt') return d.accept('Volksverhetzung');
      if (/ALLES von diesem Absender/.test(t)) return d.dismiss();   // nur dieser Zettel
      return d.accept();
    });
    await p.evaluate(() => {
      const knoepfe = [...document.querySelectorAll('#studio-fenster button')];
      const b = knoepfe.find((x) => /Netzweit sperren/.test(x.textContent));
      b.click();
    });
    await p.waitForFunction((i) => !document.querySelector('[data-qid="' + i + '"]'),
      zettel.id, { timeout: 10000 });
    ok(true, 'der gesperrte Zettel verschwindet sofort vom Brett');

    // Datei über den echten Knopf erzeugen und den Download auffangen.
    const [dl] = await Promise.all([
      p.waitForEvent('download', { timeout: 15000 }),
      p.evaluate(() => {
        const b = [...document.querySelectorAll('#studio-fenster button')]
          .find((x) => /Signierte Liste erzeugen/.test(x.textContent));
        b.click();
      })
    ]);
    ok(dl.suggestedFilename() === 'sperrliste.json', 'die erzeugte Datei heißt sperrliste.json');
    const strom = await dl.createReadStream();
    let inhalt = '';
    for await (const stueck of strom) inhalt += stueck;
    let datei = null;
    try { datei = JSON.parse(inhalt); } catch (_e) { /* bleibt null */ }
    ok(!!datei && typeof datei.content === 'string' && !!datei.sig,
      'sie ist ein signiertes Ereignis, kein nacktes JSON');
    ok(!!datei && datei.pubkey === ich, '…vom Betreiber signiert');
    let drin = null;
    try { drin = JSON.parse(datei.content); } catch (_e) { /* */ }
    ok(!!drin && !!drin.ereignisse[zettel.id], '…und der gesperrte Zettel steht darin');
    ok(!!drin && drin.ereignisse[zettel.id].grund === 'Volksverhetzung', '…mit dem angegebenen Grund');
    ok(!!drin && !drin.absender[zettel.pubkey],
      '…der Absender NICHT (es war „nur dieser Zettel")');
    ok(!/STUDIO-PROBE-BOESE/.test(inhalt),
      'der beanstandete Text steht NICHT in der Datei (nur Kennungen)');
    await ctx.close();

    // Und jetzt der Beweis: eine frische Seite nimmt genau diese Datei an.
    const zwei = await neueSeite(browser, {
      mod: { quelle: './sbkim/sperrliste.json', pruefschluessel: ich },
      quelle: datei, nip11: null
    });
    const erg = await zwei.p.evaluate(() => window.__kb.ladeSperrQuelle());
    ok(erg && erg.geladen === true, 'RUNDLAUF: eine frische App nimmt die erzeugte Liste an');
    ok(await zwei.p.evaluate((i) => window.__kb.istNetzGesperrt({ id: i, pubkey: 'x' }), zettel.id),
      '…und der Zettel gilt dort als gesperrt');
    await zwei.ctx.close();
  }

  /* ═══ 7. NIP-86: ehrlich, wenn das Relais nicht mitspielt ═══ */
  {
    // a) Relais OHNE Verwaltung
    const a = await neueSeite(browser, {
      mod: {}, nip11: { name: 'Test', software: 'git+https://github.com/scsibug/nostr-rs-relay', version: '0.9.0', supported_nips: [1, 9, 11] }
    });
    const ichA = await meine(a.p);
    await a.p.evaluate((k) => { window.KB_MODERATION.betreiberSchluessel = k; }, ichA);
    await studioAuf(a.p);
    /* Auf ein Wort warten, das es NUR nach der Abfrage gibt. „Verwaltung" steht
       schon in der Erklärzeile darüber — darauf zu warten hieße, sofort
       weiterzulaufen und den Text „wird abgefragt …" zu lesen. Genau so ist es
       beim dritten Lauf passiert: rot, obwohl das Studio richtig arbeitete. */
    await a.p.waitForFunction(
      () => /Software:|keine Auskunft/.test(document.getElementById('studio-fenster').innerText),
      null, { timeout: 20000 });
    const tA = await text(a.p);
    ok(/nostr-rs-relay/.test(tA), 'das Studio nennt die Software des Relais (das war Schritt 0)');
    ok(/0\.9\.0/.test(tA), '…samt Fassung');
    ok(/keine Verwaltung/.test(tA), '…und sagt ehrlich, dass es keine Aufträge annimmt');
    ok(a.auftraege.length === 0, '…und schickt vorsorglich gar nichts hin');
    await a.ctx.close();

    // b) Relais MIT Verwaltung
    const b = await neueSeite(browser, {
      mod: {}, nip11: { name: 'Test', software: 'strfry', version: '1.0', supported_nips: [1, 9, 11, 86] }
    });
    const ichB = await meine(b.p);
    await b.p.evaluate((k) => { window.KB_MODERATION.betreiberSchluessel = k; }, ichB);
    await studioAuf(b.p);
    await b.p.waitForFunction(
      () => /Software:|keine Auskunft/.test(document.getElementById('studio-fenster').innerText),
      null, { timeout: 20000 });
    ok(/Verwaltung möglich/.test(await text(b.p)), 'ein Relais mit NIP-86 wird als verwaltbar erkannt');

    /* Und jetzt der Auftrag selbst: Er muss AUSGEWIESEN hinausgehen. Geprüft
       wird nicht, dass ein Knopf existiert, sondern was auf der Leitung liegt —
       Methode, Kennung und ein Authorization-Kopf, dessen Ereignis der echten
       Signatur-Prüfung standhält. */
    const auftragErg = await b.p.evaluate(async () => {
      const b2 = window.__kb;
      const url = (b2.relaisListe() || [])[0];
      const körper = JSON.stringify({ method: 'banevent', params: ['d'.repeat(64), 'Probe'] });
      const puffer = new TextEncoder().encode(körper);
      const h = await crypto.subtle.digest('SHA-256', puffer);
      const hex = [].map.call(new Uint8Array(h), (x) => x.toString(16).padStart(2, '0')).join('');
      const ausweis = await b2.signiere({
        kind: 27235,
        tags: [['u', url.replace(/^wss:/, 'https:')], ['method', 'POST'], ['payload', hex]],
        content: ''
      });
      const a = await fetch(url.replace(/^wss:/, 'https:'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/nostr+json+rpc',
          Authorization: 'Nostr ' + btoa(JSON.stringify(ausweis))
        },
        body: körper
      });
      return { status: a.status };
    });
    ok(auftragErg.status === 200, 'ein Verwaltungs-Auftrag geht wirklich hinaus');
    ok(b.auftraege.length === 1, '…und kommt genau einmal am Relais an');
    const auf = b.auftraege[0] || {};
    ok(/^Nostr /.test(auf.auth || ''), '…mit einem Nostr-Ausweis im Kopf');
    let ausweis = null;
    try { ausweis = JSON.parse(Buffer.from((auf.auth || '').slice(6), 'base64').toString()); } catch (_e) { /* */ }
    ok(!!ausweis && ausweis.kind === 27235, '…der Ausweis ist ein NIP-98-Ereignis');
    ok(!!ausweis && ausweis.pubkey === ichB, '…vom Betreiber signiert');
    const echt = await b.p.evaluate(async (ev) => {
      const { schnorr } = await import('./modules/noble-secp256k1.js');
      const { eventId } = await import('./modules/echtheit.js');
      const roh = (h) => Uint8Array.from(h.match(/.{2}/g).map((x) => parseInt(x, 16)));
      return (await eventId(ev)) === ev.id
        && await schnorr.verify(roh(ev.sig), roh(ev.id), roh(ev.pubkey));
    }, ausweis);
    ok(echt, '…und seine Signatur hält der echten Prüfung stand');
    let auftrag = null;
    try { auftrag = JSON.parse(auf.body || 'null'); } catch (_e) { /* */ }
    ok(!!auftrag && auftrag.method === 'banevent', '…der Auftrag lautet banevent');
    await b.ctx.close();
  }

  /* ═══ 8. Fail-soft ═══ */
  {
    const { p, ctx, errs } = await neueSeite(browser, { mod: {}, nip11: null });
    // Brücke wegnehmen — das Studio darf trotzdem nicht krachen.
    await p.evaluate(() => { window.__kb = undefined; });
    await p.evaluate(() => window.__kbStudioOeffnen());
    await p.waitForFunction(() => !!document.getElementById('studio-fenster'), null, { timeout: 15000 });
    ok(true, 'ohne Brücke öffnet das Studio trotzdem ein Fenster');
    ok(errs.length === 0, '…und wirft dabei keinen Fehler');
    await ctx.close();
  }

  /* ═══ 9. Der Cache-Vorrat kennt die neue Datei nicht — mit Absicht ═══ */
  {
    const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
    ok(!/assets\/studio\.js/.test(sw),
      'studio.js steht NICHT im Offline-Vorrat (es wird nur auf Druck geholt und braucht ohnehin Netz)');
    const idx = readFileSync(join(ROOT, 'index.html'), 'utf8');
    ok(/assets\/studio\.js\?v=/.test(idx), 'der Zugang lädt studio.js mit Fassungs-Nummer');

    /* Der ausgelieferte Betreiber-Schlüssel muss BRAUCHBAR sein, wenn er
       überhaupt gesetzt ist. `null` ist erlaubt und richtig (ein Forker
       betreibt dieses Brett nicht) — aber ein Tippfehler wäre still: das
       Studio ginge nie auf, und nirgends erschiene ein Fehler. Groß
       geschriebenes Hex fiele genauso durch, weil der Vergleich in oeffnen()
       auf Kleinschreibung normiert und HEX64 zwar beides annimmt, die App aber
       gegen `me()` prüft — das ist immer klein. */
    const mod = readFileSync(join(ROOT, 'assets/config/moderation.js'), 'utf8');
    const treffer = /betreiberSchluessel:\s*(null|'([^']*)')/.exec(mod);
    ok(!!treffer, 'moderation.js hat einen Eintrag für den Betreiber');
    if (treffer && treffer[2] !== undefined) {
      ok(/^[0-9a-f]{64}$/.test(treffer[2]),
        'der eingetragene Betreiber-Schlüssel ist 64 Zeichen Hex in Kleinschreibung');
    } else {
      ok(true, 'kein Betreiber eingetragen — erlaubt (Fork-Fall), das Studio bleibt dann zu');
    }
  }
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
