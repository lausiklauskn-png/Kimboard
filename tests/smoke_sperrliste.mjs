#!/usr/bin/env node
/*
 * Smoke — netzweite Sperr-Liste (Strang B), echter Browser.
 *
 * WOZU: Eine Lösch-Meldung (NIP-09) darf nur der Absender selbst schicken —
 * gegen FREMDE Hassrede taugt sie nicht. Die Sperr-Liste ist das Werkzeug für
 * den anderen Fall: Was darin steht, zeigt jedes Kimboard nicht mehr an, egal
 * auf welchem Relais der Zettel liegt.
 *
 * Geprüft wird — und zwar GEMESSEN, nicht aus dem Code abgelesen:
 *   1. REIHENFOLGE. Die Liste steht da, BEVOR der erste Zettel gezeichnet wird.
 *      Käme sie später, wäre ein gesperrter Zettel für einen Augenblick zu
 *      sehen — genau das, was sie verhindern soll. Gemessen an dem Moment, in
 *      dem die App ihren Prüf-Zugang setzt.
 *   2. WIRKUNG. Ein gesperrter Zettel wird nicht angezeigt — weder über seine
 *      eigene Kennung noch über die seines Absenders. Und zwar spurlos: kein
 *      Platzhalter, kein Grund am Brett (Klaus 2026-08-17 — bei Hassrede ist
 *      die stehengelassene Lücke samt Begründung schon die halbe Verbreitung).
 *   3. KEIN ÜBERSCHUSS. Was nicht in der Liste steht, bleibt sichtbar.
 *   4. EINBAHNSTRASSE. Aus der Oberfläche geht es nur nach oben. Kein Weg —
 *      auch kein Test-Haken — kann eine Sperre aufheben; das geht nur in der
 *      Datei. Ein Fehlgriff beim Sperren fällt auf, einer beim Lösen wäre still.
 *   5. FAIL-SOFT. Ohne erreichbare Liste läuft die App VOLL weiter und zeigt
 *      eben alles. Kein toter Knopf, kein Absturz, keine Fehlermeldung für
 *      jemanden, der nichts dafür kann.
 *   6. SIGNATUR. Eine nachgeladene Liste wird nur angenommen, wenn sie vom
 *      konfigurierten Schlüssel signiert ist. Fremder Absender, verfälschter
 *      Inhalt, kein Prüfschlüssel — jedes Mal verworfen.
 *   7. NACHWISCHEN. Was durch eine nachgeladene Liste gesperrt wird, ist auch
 *      dann weg, wenn es schon am Brett hing.
 *
 * Gegenprobe: tests/gegenprobe_moderation.sh
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_sperrliste.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8481;
const SEITE = `http://127.0.0.1:${PORT}/index.html`;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

/* Die Konfigurations-Dateien werden auf dem Weg ersetzt, nicht im Repo. So
   läuft die Prüfung gegen den ECHTEN Ladeweg (dieselbe Adresse, dieselbe
   Reihenfolge), ohne dass eine Probe ausgelieferte Dateien anfasst. */
const alsJs = (js) => ({ status: 200, contentType: 'application/javascript; charset=utf-8', body: js });
const sperrDatei = (o) => alsJs('window.KB_SPERRLISTE = ' + JSON.stringify(
  Object.assign({ fassung: 1, stand: '2026-01-01', ereignisse: {}, absender: {} }, o)) + ';');
const modDatei = (o) => alsJs('window.KB_MODERATION = ' + JSON.stringify(Object.assign({
  meldeEndpunkt: '', meldeMail: 'test@example.invalid', betreiber: 'Test',
  beschwerdeWeg: 'impressum.html', quelle: null, pruefschluessel: null
}, o)) + ';');

/* Merkt sich, ob die Sperr-Liste schon dastand, als die App ihren Prüf-Zugang
   setzte. Das ist der Moment, ab dem Zettel gezeichnet werden können — die
   Reihenfolge wird damit gemessen und nicht der Spezifikation entnommen. */
const REIHENFOLGE_SPITZEL = `
  (() => {
    let wert;
    Object.defineProperty(window, '__kb', {
      configurable: true,
      get: () => wert,
      set: (v) => {
        window.__reihenfolge = {
          sperrliste: !!window.KB_SPERRLISTE,
          moderation: !!window.KB_MODERATION
        };
        wert = v;
      }
    });
  })();`;

/* Service-Worker AUS für die geleiteten Fälle.
 *
 * Nicht aus Bequemlichkeit: `page.route` fängt keine Abrufe ab, die aus einem
 * Service-Worker kommen. Sobald der wach war, ging die Anfrage an den echten
 * Server, die Probe wurde sprunghaft rot — und zwar an wechselnden Stellen,
 * was zuerst wie Zufall aussah. Es war keiner: die Ursache steckte im
 * Service-Worker, und sie war ein echter Fehler (cache-first für die Liste,
 * behoben in sw.js). Hier wird er abgeschaltet, damit die Prüfungen das
 * MESSEN, was sie messen wollen; sein Verhalten prüft der eigene Abschnitt
 * ganz unten — mit wachem Service-Worker und einer echten Datei. */
async function neueSeite(browser, { sperr, mod, quelle, spitzel } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  if (spitzel) await p.addInitScript(REIHENFOLGE_SPITZEL);
  if (sperr !== undefined) {
    await p.route('**/assets/config/sperrliste.js', (r) =>
      sperr === null ? r.abort() : r.fulfill(sperrDatei(sperr)));
  }
  if (mod !== undefined) {
    await p.route('**/assets/config/moderation.js', (r) =>
      mod === null ? r.abort() : r.fulfill(modDatei(mod)));
  }
  if (quelle !== undefined) {
    await p.route('**/sbkim/sperrliste.json', (r) =>
      quelle === null ? r.abort()
        : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(quelle) }));
  }
  await p.goto(SEITE, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!(window.__kb && window.__kb.dispatch), null, { timeout: 20000 });
  return { p, errs };
}

/* Baut einen echt signierten Zettel und wirft ihn der App zu. Gibt die Kennungen
   zurück, damit eine spätere Runde denselben Zettel noch einmal schicken kann. */
const MACH_ZETTEL = async (p, text, privHex) => p.evaluate(async ([t, ph]) => {
  const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
  const { eventId } = await import('./modules/echtheit.js');
  const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
  const priv = ph ? fromHex(ph) : utils.randomPrivateKey();
  const pub = toHex(schnorr.getPublicKey(priv));
  const ev = { pubkey: pub, created_at: 1755000000, kind: 1,
    tags: [['t', 'sbkim-frage-antwort-test']], content: t };
  ev.id = await eventId(ev);
  ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
  await window.__kb.dispatch(ev, 'wss://test');
  return { priv: toHex(priv), pub, id: ev.id };
}, [text, privHex || null]);

/* Baut eine SIGNIERTE Sperr-Liste als echtes Nostr-Ereignis. Dieselbe Bauart
   wie ein Zettel — damit prüft sie auch dieselbe Funktion (modules/echtheit.js)
   und es gibt keinen zweiten Krypto-Pfad, der auseinanderlaufen könnte.
   `stempel` unterscheidet zwei Fassungen voneinander. */
const signiereIn = (p, privHex, inhalt, stempel) => p.evaluate(async ([ph, txt, st]) => {
  const { schnorr } = await import('./modules/noble-secp256k1.js');
  const { eventId } = await import('./modules/echtheit.js');
  const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
  const priv = fromHex(ph);
  const ev = { pubkey: toHex(schnorr.getPublicKey(priv)), created_at: 1755000001 + st,
    kind: 30078, tags: [['d', 'kimboard-sperrliste']], content: txt };
  ev.id = await eventId(ev);
  ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
  return ev;
}, [privHex, inhalt, stempel]);

const sichtbar = (p, t) => p.evaluate((x) => document.body.innerText.includes(x), t);

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  console.log('== Netzweite Sperr-Liste ==');

  /* ═══ 0. Konfiguration und Service-Worker müssen zusammenpassen ═══
     Die Netz-zuerst-Regel in sw.js hängt am Dateinamen. Heißt die Liste
     anders, als die Regel erwartet, friert sie still im Vorrat ein — die App
     zeigte dann monatelang den Stand der letzten Auslieferung, ohne dass
     irgendwo ein Fehler erschiene. Zwei Stellen, die zusammenpassen müssen,
     brauchen eine Prüfung, die sie vergleicht. */
  {
    const regel = /if \(([^)]*?)\.test\(url\.pathname\)\)/.exec(readFileSync(join(ROOT, 'sw.js'), 'utf8'));
    ok(!!regel, 'sw.js hat eine Netz-zuerst-Regel für die Sperr-Liste');
    const mod = readFileSync(join(ROOT, 'assets/config/moderation.js'), 'utf8');
    const quelle = /quelle:\s*'([^']*)'/.exec(mod);
    ok(!!quelle, 'assets/config/moderation.js nennt eine Quelle');
    if (regel && quelle) {
      // Die Regel aus sw.js WIRKLICH anwenden, nicht nachbauen: ein Nachbau
      // könnte auseinanderlaufen und sähe dabei richtig aus.
      // eslint-disable-next-line no-eval
      const passt = eval(regel[1]).test(new URL(quelle[1], 'https://x.invalid/').pathname);
      ok(passt, 'die konfigurierte Quelle (' + quelle[1] + ') fällt unter die Netz-zuerst-Regel');
    }
  }

  // ═══ 1. Reihenfolge: die Liste steht vor dem ersten Zettel da ═══
  {
    const { p, errs } = await neueSeite(browser, { spitzel: true });
    const r = await p.evaluate(() => window.__reihenfolge);
    ok(!!r, 'die App setzt ihren Prüf-Zugang (Messpunkt erreicht)');
    ok(r && r.sperrliste === true,
      'die Sperr-Liste steht da, BEVOR der erste Zettel gezeichnet werden kann');
    ok(r && r.moderation === true, '…und die Melde-Konfiguration ebenso');
    ok(errs.length === 0, 'keine JS-Fehler dabei (' + errs.slice(0, 2).join(' | ') + ')');
    await p.close();
  }

  // ═══ 2./3. Wirkung und kein Überschuss ═══
  // Erste Runde ohne Sperre: Kennungen einsammeln.
  let boese, boeserAbsender;
  {
    const { p } = await neueSeite(browser, { sperr: {} });
    boese = await MACH_ZETTEL(p, 'GESPERRT-EINZELN');
    boeserAbsender = await MACH_ZETTEL(p, 'ERSTER-VOM-GESPERRTEN-ABSENDER');
    await p.waitForFunction((i) => !!document.querySelector('[data-qid="' + i + '"]'), boese.id, { timeout: 10000 });
    ok(await sichtbar(p, 'GESPERRT-EINZELN'), 'ohne Sperre ist der Zettel normal zu sehen (Ausgangslage)');
    await p.close();
  }
  // Zweite Runde MIT Sperre — derselbe Zettel, dieselbe Signatur.
  {
    const { p, errs } = await neueSeite(browser, {
      sperr: {
        ereignisse: { [boese.id]: { grund: 'Volksverhetzung', seit: '2026-08-17' } },
        absender: { [boeserAbsender.pub]: { grund: 'Wiederholung', seit: '2026-08-17' } }
      }
    });
    await MACH_ZETTEL(p, 'GESPERRT-EINZELN', boese.priv);
    await MACH_ZETTEL(p, 'ZWEITER-VOM-GESPERRTEN-ABSENDER', boeserAbsender.priv);
    const harmlos = await MACH_ZETTEL(p, 'HARMLOSER-ZETTEL');
    await p.waitForFunction((i) => !!document.querySelector('[data-qid="' + i + '"]'), harmlos.id, { timeout: 10000 });

    ok(!(await sichtbar(p, 'GESPERRT-EINZELN')), 'ein gesperrter Zettel wird NICHT angezeigt');
    ok(!(await sichtbar(p, 'ZWEITER-VOM-GESPERRTEN-ABSENDER')),
      '…und auch nichts Neues von einem gesperrten Absender');
    ok(await sichtbar(p, 'HARMLOSER-ZETTEL'), 'kein Überschuss: alles andere bleibt sichtbar');

    // Spurlos: kein Platzhalter, kein Grund, keine Lücke mit Erklärung am Brett.
    const brett = await p.evaluate(() => document.getElementById('threads').innerText);
    ok(!/Volksverhetzung/.test(brett), 'spurlos: der Grund steht NICHT am Brett');
    ok(!/[Gg]esperrt/.test(brett), '…und auch kein Platzhalter „gesperrt"');
    ok(await p.evaluate((i) => !document.querySelector('[data-qid="' + i + '"]'), boese.id),
      '…und im Brett existiert gar kein Eintrag dafür');

    // ═══ 4. Einbahnstraße ═══
    const versuche = await p.evaluate(async (b) => {
      const erg = {};
      // (a) Die Absender-Entsperrung darf die NETZWEITE Sperre nicht aufheben.
      window.__kb.entsperreAbsender(b.absender);
      erg.nachEntsperren = window.__kb.istNetzGesperrt({ id: 'x', pubkey: b.absender });
      // (b) Die herausgegebene Liste ist eine Kopie — daran zu drehen wirkt nicht.
      const kopie = window.__kb.sperrliste();
      kopie.ereignisse.length = 0;
      kopie.absender.length = 0;
      erg.nachKopieLeeren = window.__kb.istNetzGesperrt({ id: b.id, pubkey: 'y' });
      // (c) Auch wer die lokale Ausblend-Liste leert, bekommt ihn nicht zurück.
      erg.nachAusblendListe = window.__kb.istNetzGesperrt({ id: b.id, pubkey: 'y' });
      // (d) Es gibt keinen einzigen Weg nach draußen, der entsperrt.
      erg.keinEntsperrWeg = !Object.keys(window.__kb).some((k) => /entsperr|loese|freigab/i.test(k)
        && k !== 'entsperreAbsender');
      return erg;
    }, { id: boese.id, absender: boeserAbsender.pub });
    ok(versuche.nachEntsperren === true,
      'EINBAHNSTRASSE: „🔔 wieder zeigen" hebt eine netzweite Sperre nicht auf');
    ok(versuche.nachKopieLeeren === true, '…die herausgegebene Liste ist eine Kopie, kein Griff hinein');
    ok(versuche.nachAusblendListe === true, '…und die lokale Ausblend-Liste erreicht sie auch nicht');
    ok(versuche.keinEntsperrWeg === true, '…und es gibt keinen Entsperr-Weg nach draußen');

    // Der harte Beweis: derselbe Zettel noch einmal, nach allen Versuchen.
    await MACH_ZETTEL(p, 'GESPERRT-EINZELN', boese.priv);
    await MACH_ZETTEL(p, 'DRITTER-VOM-GESPERRTEN-ABSENDER', boeserAbsender.priv);
    const marke = await MACH_ZETTEL(p, 'ZEITMARKE-NACH-DEN-VERSUCHEN');
    await p.waitForFunction((i) => !!document.querySelector('[data-qid="' + i + '"]'), marke.id, { timeout: 10000 });
    ok(!(await sichtbar(p, 'GESPERRT-EINZELN')), '…und der Zettel bleibt weg, auch nach allen Versuchen');
    ok(!(await sichtbar(p, 'DRITTER-VOM-GESPERRTEN-ABSENDER')), '…der Absender ebenso');

    ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
    await p.close();
  }

  // ═══ 5. Fail-soft: gar keine Liste erreichbar ═══
  {
    const { p, errs } = await neueSeite(browser, { sperr: null, quelle: null });
    const z = await MACH_ZETTEL(p, 'LAEUFT-AUCH-OHNE-LISTE');
    await p.waitForFunction((i) => !!document.querySelector('[data-qid="' + i + '"]'), z.id, { timeout: 10000 });
    ok(await sichtbar(p, 'LAEUFT-AUCH-OHNE-LISTE'),
      'FAIL-SOFT: ohne erreichbare Liste läuft die App voll weiter');
    const liste = await p.evaluate(() => window.__kb.sperrliste());
    ok(liste.ereignisse.length === 0 && liste.absender.length === 0, '…und es ist eben nichts gesperrt');
    // Der Nutzer darf davon nichts merken — keine Fehlermeldung auf der Seite.
    ok(!(await p.evaluate(() => /Sperr-Liste.*(Fehler|fehlgeschlagen)/i.test(document.body.innerText))),
      '…und niemand bekommt einen Fehler zu sehen, für den er nichts kann');
    // Melden und Ausblenden müssen weiter gehen — kein toter Knopf.
    ok(await p.evaluate((i) => !!document.querySelector('[data-qid="' + i + '"] .q-melden'), z.id),
      '…der Melde-Knopf ist trotzdem da');
    ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
    await p.close();
  }

  /* ═══ 5b. Fail-soft: die Liste ist DA, aber Schrott ═══
     Die gefährlichere Hälfte von fail-soft. Ein fehlender Abruf ist harmlos —
     die Auswertung der eingebackenen Liste läuft dagegen SYNCHRON beim Start
     und ohne Fangnetz. Wirft sie, stirbt das ganze App-Modul, und Kimboard
     zeigt eine weiße Seite. Ein Forker, der die Datei halb ausfüllt, hätte
     genau das. Aufgefallen ist die Lücke der Gegenprobe: mein erster
     eingebauter Fehler traf die Netz-Hälfte, die ohnehin abgesichert ist. */
  for (const [name, js, erwartung] of [
    ['null statt Liste', 'window.KB_SPERRLISTE = null;'],
    ['ein Text statt einer Liste', 'window.KB_SPERRLISTE = "kaputt";'],
    ['Felder fehlen', 'window.KB_SPERRLISTE = { fassung: 1 };'],
    ['falsche Typen in den Feldern', 'window.KB_SPERRLISTE = { ereignisse: 7, absender: "nein" };'],
    ['Kennungen sind Unsinn', 'window.KB_SPERRLISTE = { ereignisse: { "kein-hex": { grund: 1 } }, absender: { "0815": {} } };', 'leer']
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.route('**/assets/config/sperrliste.js', (r) => r.fulfill(alsJs(js)));
    /* Die SIGNIERTE Liste hier wegnehmen. Sie trägt seit dem 2026-08-18 einen
       echten Eintrag, und ohne diese Zeile misst der Test unten nicht mehr,
       was er meint: „aus der KAPUTTEN eingebackenen Liste kommt nichts durch"
       würde an einem völlig gesunden Eintrag aus der anderen Quelle scheitern.
       Ein Fehlschlag aus dem falschen Grund ist so wertlos wie ein grüner Haken
       aus dem falschen Grund. */
    await p.route('**/sbkim/sperrliste.json', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto(SEITE, { waitUntil: 'domcontentloaded' });
    let lebt = true;
    try {
      await p.waitForFunction(() => !!(window.__kb && window.__kb.dispatch), null, { timeout: 15000 });
    } catch { lebt = false; }
    let zeigt = false;
    if (lebt) {
      const z = await MACH_ZETTEL(p, 'UEBERLEBT-KAPUTTE-LISTE');
      try {
        await p.waitForFunction((i) => !!document.querySelector('[data-qid="' + i + '"]'), z.id, { timeout: 8000 });
        zeigt = true;
      } catch { zeigt = false; }
    }
    ok(lebt && zeigt && errs.length === 0,
      'FAIL-SOFT bei kaputter Liste (' + name + '): die App startet und zeigt Zettel'
      + (errs.length ? ' — Fehler: ' + errs[0].slice(0, 90) : ''));
    /* Überleben allein genügt hier nicht: Unsinn darf auch nicht LEISE in die
       Liste rutschen. Sonst zählte das Fenster „👁 Ausgeblendet" Sperren, die
       keine sind, und die Zahl dort wäre eine Behauptung statt einer Auskunft.
       Ohne diese Zeile blieb die Prüfung grün, obwohl die Kennungs-Prüfung
       ausgebaut war — gefunden von der Gegenprobe. */
    if (lebt && erwartung === 'leer') {
      const l = await p.evaluate(() => window.__kb.sperrliste());
      ok(l.ereignisse.length === 0 && l.absender.length === 0,
        '…und die unsinnigen Kennungen landen NICHT in der Liste ('
        + l.ereignisse.concat(l.absender).join(', ') + ')');
    }
    await p.close();
  }

  // ═══ 6./7. Nachgeladene Liste: nur mit gültiger Signatur ═══
  {
    // Ein Schlüsselpaar für den „Betreiber", und ein zweites für den Angreifer.
    const { p: vor } = await neueSeite(browser, { sperr: {} });
    const schluessel = await vor.evaluate(async () => {
      const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
      const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      const mach = () => { const s = utils.randomPrivateKey(); return { priv: toHex(s), pub: toHex(schnorr.getPublicKey(s)) }; };
      return { chef: mach(), fremder: mach() };
    });
    const signiere = (privHex, inhalt) => signiereIn(vor, privHex, inhalt, 0);

    const opfer = await MACH_ZETTEL(vor, 'PER-NACHLADEN-GESPERRT');
    const inhalt = JSON.stringify({ ereignisse: { [opfer.id]: { grund: 'Hassrede', seit: '2026-08-17' } }, absender: {} });
    const echt = await signiere(schluessel.chef.priv, inhalt);
    const vomFremden = await signiere(schluessel.fremder.priv, inhalt);
    const verfaelscht = Object.assign({}, echt, {
      content: JSON.stringify({ ereignisse: { ['ff'.repeat(32)]: { grund: 'untergeschoben' } }, absender: {} })
    });
    await vor.close();

    /* Die Seite startet BEWUSST ohne Quelle (`quelle: null`) und bekommt sie
       erst danach eingesetzt. Sonst läuft der Abruf beim Start gegen das
       Setzen des Zettels — der wäre schon gesperrt, bevor er je am Brett hing,
       und „NACHWISCHEN" prüfte nichts. Genau dieses Rennen ist die Probe beim
       ersten Lauf gefahren und daran gescheitert; die Uhr hätte es verdeckt,
       die Bedingung hat es gezeigt. */
    const laden = async (json, pruefschluessel, quelleNachher) => {
      const { p } = await neueSeite(browser, {
        sperr: {}, quelle: json, mod: { quelle: null, pruefschluessel }
      });
      const z = await MACH_ZETTEL(p, 'PER-NACHLADEN-GESPERRT', opfer.priv);
      await p.waitForFunction((i) => !!document.querySelector('[data-qid="' + i + '"]'), z.id, { timeout: 10000 });
      const vorher = await sichtbar(p, 'PER-NACHLADEN-GESPERRT');
      const erg = await p.evaluate(async (q) => {
        window.KB_MODERATION.quelle = q;
        return window.__kb.ladeSperrQuelle();
      }, quelleNachher);
      const nachher = await sichtbar(p, 'PER-NACHLADEN-GESPERRT');
      const liste = await p.evaluate(() => window.__kb.sperrliste());
      await p.close();
      return { vorher, nachher, erg, liste };
    };
    const ADRESSE = './sbkim/sperrliste.json';

    const gut = await laden(echt, schluessel.chef.pub, ADRESSE);
    ok(gut.vorher === true, 'der Zettel hing am Brett, bevor die Liste kam (Ausgangslage)');
    ok(gut.erg.geladen === true, 'eine gültig signierte Liste wird angenommen (' + JSON.stringify(gut.erg) + ')');
    ok(gut.liste.ereignisse.includes(opfer.id.toLowerCase()), '…und ihre Einträge wirken');
    ok(gut.nachher === false, 'NACHWISCHEN: was schon am Brett hing, ist danach weg');

    const fremd = await laden(vomFremden, schluessel.chef.pub, ADRESSE);
    ok(fremd.erg.geladen === false && /fremder Absender/.test(fremd.erg.grund),
      'SICHERHEIT: eine Liste von einem FREMDEN Schlüssel wird verworfen');
    ok(fremd.nachher === true, '…und sie sperrt nichts');

    const kaputt = await laden(verfaelscht, schluessel.chef.pub, ADRESSE);
    ok(kaputt.erg.geladen === false && /Signatur/.test(kaputt.erg.grund),
      'SICHERHEIT: ein nachträglich verfälschter Inhalt wird verworfen');
    ok(kaputt.liste.ereignisse.length === 0, '…und das Untergeschobene steht nirgends');

    const ohneSchluessel = await laden(echt, null, ADRESSE);
    ok(ohneSchluessel.erg.geladen === false,
      'ohne Prüfschlüssel wird gar nicht erst geladen — lieber keine Liste als eine ohne Absender');
    ok(ohneSchluessel.nachher === true, '…und nichts wird gesperrt');

    /* ═══ 8. Der Service-Worker darf die Liste nicht einfrieren ═══
       Der Kern: unten in sw.js gilt cache-first. Ohne Ausnahme würde die Liste
       EINMAL geholt und danach für immer aus dem Vorrat bedient — bis zur
       nächsten Auslieferung. Klaus sperrt etwas, und die installierten
       Kimboards sähen es nie. Eine Moderations-Liste, die veraltet
       ausgeliefert wird, ist schlimmer als keine: sie sieht aus, als wirke sie.

       Hier läuft der Service-Worker WACH, gegen eine ECHTE Datei, die sich
       zwischen zwei Abrufen ändert. Damit ist es gemessen und nicht behauptet. */
    const PROBEDATEI = 'sbkim/.tmp-sperrliste-probe.json';
    const absPfad = join(ROOT, PROBEDATEI);
    mkdirSync(dirname(absPfad), { recursive: true });
    try {
      /* Beide Fassungen VORAB auf einer eigenen Seite signieren. Sie müssen
         fertig sein, bevor die Prüf-Seite lädt — deren Start ruft die Liste ja
         schon selbst ab. (Erster Versuch signierte auf der noch leeren Seite;
         dort gibt es keine Modul-Adressen, und der Aufruf starb.) */
      const sigCtx = await browser.newContext({ serviceWorkers: 'block' });
      const sig = await sigCtx.newPage();
      await sig.route('**/assets/config/sperrliste.js', (r) => r.fulfill(sperrDatei({})));
      await sig.route('**/assets/config/moderation.js', (r) => r.fulfill(modDatei({})));
      await sig.goto(SEITE, { waitUntil: 'domcontentloaded' });
      await sig.waitForFunction(() => !!(window.__kb && window.__kb.dispatch), null, { timeout: 20000 });
      const spaet = await MACH_ZETTEL(sig, 'ERST-SPAETER-GESPERRT');
      const listeLeer = await signiereIn(sig, schluessel.chef.priv,
        JSON.stringify({ ereignisse: {}, absender: {} }), 1);
      const listeVoll = await signiereIn(sig, schluessel.chef.priv,
        JSON.stringify({ ereignisse: { [spaet.id]: { grund: 'x', seit: '2026-08-17' } }, absender: {} }), 2);
      await sigCtx.close();

      writeFileSync(absPfad, JSON.stringify(listeLeer));

      // Jetzt die eigentliche Seite — MIT wachem Service-Worker.
      const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 } });
      const p = await ctx.newPage();
      await p.route('**/assets/config/moderation.js', (r) => r.fulfill(modDatei({
        quelle: './' + PROBEDATEI, pruefschluessel: schluessel.chef.pub
      })));
      await p.route('**/assets/config/sperrliste.js', (r) => r.fulfill(sperrDatei({})));
      await p.goto(SEITE, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => !!(window.__kb && window.__kb.dispatch), null, { timeout: 20000 });
      /* Auf die BEDINGUNG warten: der Service-Worker muss die Seite übernommen
         haben, sonst prüft dieser Abschnitt gar nicht den Fall, den er meint —
         und wäre stumm statt falsch. */
      const wach = await p.waitForFunction(
        () => !!(navigator.serviceWorker && navigator.serviceWorker.controller), null, { timeout: 20000 }
      ).then(() => true).catch(() => false);
      ok(wach, 'der Service-Worker ist wach und beantwortet die Abrufe der Seite');

      const erste = await p.evaluate(() => window.__kb.ladeSperrQuelle());
      ok(erste.geladen === true && erste.neu === 0,
        'erster Abruf: die Liste ist noch leer (' + JSON.stringify(erste) + ')');

      await MACH_ZETTEL(p, 'ERST-SPAETER-GESPERRT', spaet.priv);
      await p.waitForFunction((i) => !!document.querySelector('[data-qid="' + i + '"]'), spaet.id, { timeout: 10000 });
      ok(await sichtbar(p, 'ERST-SPAETER-GESPERRT'), 'der Zettel hängt am Brett (Ausgangslage)');

      // Die Datei ändert sich auf der Platte — wie bei einem Push von Klaus.
      writeFileSync(absPfad, JSON.stringify(listeVoll));

      const zweite = await p.evaluate(() => window.__kb.ladeSperrQuelle());
      ok(zweite.geladen === true && zweite.neu === 1,
        'zweiter Abruf holt den NEUEN Stand — der Service-Worker friert die Liste nicht ein ('
        + JSON.stringify(zweite) + ')');
      ok(!(await sichtbar(p, 'ERST-SPAETER-GESPERRT')),
        '…und der erst nachträglich gesperrte Zettel verschwindet vom Brett');
      await ctx.close();
    } finally {
      try { unlinkSync(absPfad); } catch { /* schon weg */ }
    }

    const garNicht = await laden(echt, schluessel.chef.pub, null);
    ok(garNicht.erg.geladen === false && /nicht eingerichtet/.test(garNicht.erg.grund),
      'ohne Adresse wird nichts abgerufen (kein Abruf, kein Fehler)');
  }
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
