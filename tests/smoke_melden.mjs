#!/usr/bin/env node
/*
 * Smoke — Melde-Weg (Art. 16 DSA), echter Browser.
 *
 * WOZU: Eine Lösch-Meldung (NIP-09) darf nur der Absender selbst schicken.
 * Gegen FREMDE Hassrede war Kimboard damit bis zum 2026-08-17 werkzeuglos —
 * es gab keinen Melde-Knopf, keine Melde-Adresse, kein Verfahren. Art. 16 DSA
 * verlangt beides: einen erreichbaren Weg UND eine Rückmeldung, die sagt, wie
 * es weitergeht und wo man sich beschweren kann.
 *
 * Geprüft wird an der ECHTEN Darstellung und am ECHTEN Absende-Weg:
 *   - ⚑ steht an jedem Zettel und an jeder Antwort, ist frei treffbar und
 *     überlappt das ✕ nicht (dieselbe Falle wie 2026-08-01, als die Knopfreihe
 *     das ✕ verdeckte).
 *   - ⚑ öffnet den Melde-Dialog; er nennt den Betreiber und sagt ausdrücklich,
 *     dass NICHTS automatisch entfernt wird.
 *   - Der Melde-Weg schickt WIRKLICH etwas — gemessen am abgefangenen Aufruf,
 *     nicht an einer Absicht im Code. Mit der richtigen Adresse, `zweck:
 *     "meldung"` und der Kennung des Zettels.
 *   - Der beanstandete INHALT wird NICHT mitgeschickt. Ihn mitzusenden hieße,
 *     ihn ein weiteres Mal zu verbreiten.
 *   - Rückmeldung nach Art. 16: Eingang bestätigt + Hinweis auf den Beschwerdeweg.
 *   - FAIL-SOFT in beide Richtungen: ohne Endpunkt ein Mail-Vordruck, ohne
 *     beides eine ehrliche Ansage — nie ein Knopf, der still ins Nichts sendet.
 *   - Geht der Dienst nicht, wird das GESAGT und nicht als Erfolg gemeldet.
 *   - Der ⚑ hat eine Erklär-Blase (assets/hilfe.js).
 *
 * Gegenprobe: tests/gegenprobe_moderation.sh
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_melden.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8479;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 900, height: 1100 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });

  /* Auf die BEDINGUNG warten, nie auf die Uhr (Lehre 2026-08-17): eine feste
     Wartezeit ist ein Rennen, das man irgendwann verliert — und dann ist die
     Probe nicht falsch, sondern stumm. */
  await p.waitForFunction(() => !!(window.__kb && window.__kb.dispatch), null, { timeout: 20000 });

  console.log('== Melde-Weg (Art. 16 DSA) ==');

  // Ein fremder Zettel mit einer Antwort daran — beide echt signiert.
  const FREMD = await p.evaluate(async () => {
    const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
    const { eventId } = await import('./modules/echtheit.js');
    const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
    const priv = utils.randomPrivateKey();
    const pub = toHex(schnorr.getPublicKey(priv));
    const mach = async (text, tags) => {
      const ev = { pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1, tags, content: text };
      ev.id = await eventId(ev);
      ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
      await window.__kb.dispatch(ev, 'wss://test');
      return ev.id;
    };
    const qid = await mach('SCHLIMMER-INHALT-DER-NICHT-MITREISEN-DARF', [['t', 'sbkim-frage-antwort-test']]);
    const aid = await mach('Antwort darauf', [['t', 'sbkim-frage-antwort-test'], ['e', qid]]);
    return { pub, qid, aid };
  });
  await p.waitForFunction((q) => !!document.querySelector('[data-qid="' + q + '"]'), FREMD.qid, { timeout: 10000 });
  await p.waitForFunction((a) => !!document.querySelector('[data-aid="' + a + '"]'), FREMD.aid, { timeout: 10000 });

  // ---------- 1. Der Knopf ist da, an beiden Stellen, und frei ----------
  const lage = await p.evaluate((f) => {
    const karte = document.querySelector('[data-qid="' + f.qid + '"]');
    const antw = document.querySelector('[data-aid="' + f.aid + '"]');
    karte.scrollIntoView({ block: 'center' });
    const mq = karte.querySelector('.q-melden');
    const ma = antw.querySelector('.a-melden');
    const xq = karte.querySelector('.q-del');
    const xa = antw.querySelector('.a-del');
    if (!mq || !ma || !xq || !xa) return { fehlt: true };
    const r = (n) => { const b = n.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
    const frei = (n) => {
      const b = n.getBoundingClientRect();
      const o = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return n === o || n.contains(o);
    };
    const ueberlappt = (a, c) => !(a.r <= c.l || a.l >= c.r || a.b <= c.t || a.t >= c.b);
    return {
      mq: r(mq), ma: r(ma), xq: r(xq), xa: r(xa),
      freiMq: frei(mq), freiMa: frei(ma), freiXq: frei(xq), freiXa: frei(xa),
      ueberQ: ueberlappt(r(mq), r(xq)), ueberA: ueberlappt(r(ma), r(xa)),
      /* Der Kopftext darf nicht unter die Knöpfe laufen (Falle vom 2026-08-01).
         Gemessen wird der TEXT, nicht der Kasten: `.q-head` reserviert den
         Platz per `padding-right`, sein eigenes Rechteck reicht also bis an
         die Kartenkante — an ihm zu messen hieße, das Polster mitzuzählen und
         immer einen Treffer zu melden. Ein `Range` über den Inhalt liefert die
         Stelle, an der die Schrift wirklich aufhört. */
      kopfRechts: (() => {
        const kopf = karte.querySelector('.q-head');
        const rg = document.createRange();
        rg.selectNodeContents(kopf);
        return rg.getBoundingClientRect().right;
      })(),
      breite: document.documentElement.clientWidth
    };
  }, FREMD);
  ok(!lage.fehlt, 'jeder Zettel und jede Antwort hat ein ⚑');
  if (!lage.fehlt) {
    ok(lage.freiMq && lage.freiMa, 'beide ⚑ sind frei treffbar (nichts liegt darüber)');
    ok(lage.freiXq && lage.freiXa, '…und das ✕ ist es weiterhin');
    ok(!lage.ueberQ && !lage.ueberA, '⚑ und ✕ überlappen einander nicht');
    ok(Math.abs(lage.mq.w - lage.xq.w) <= 1 && Math.abs(lage.mq.h - lage.xq.h) <= 1,
      '⚑ und ✕ sind gleich groß (' + Math.round(lage.mq.w) + '/' + Math.round(lage.xq.w) + ' px)');
    ok(Math.abs(lage.mq.r - lage.ma.r) <= 1,
      'die beiden ⚑ stehen in einer Spalte (' + Math.round(lage.mq.r) + ' vs ' + Math.round(lage.ma.r) + ')');
    ok(lage.kopfRechts <= lage.mq.l + 1,
      'die Kopfzeile endet vor den Knöpfen — sie läuft nicht darunter durch');
    ok(lage.mq.r <= lage.breite && lage.ma.r <= lage.breite, 'kein ⚑ ragt aus dem Fenster');
  }

  // ---------- 2. Der Dialog ----------
  const dialogOffen = () => p.evaluate(() => {
    const d = document.getElementById('melde-dialog');
    return !!d && d.offsetParent !== null;
  });
  ok(!(await dialogOffen()), 'der Melde-Dialog ist anfangs zu');
  await p.evaluate((q) => document.querySelector('[data-qid="' + q + '"] .q-melden').click(), FREMD.qid);
  await p.waitForSelector('#melde-dialog', { timeout: 5000 });
  ok(await dialogOffen(), 'das ⚑ öffnet den Melde-Dialog');
  const dtxt = await p.textContent('#melde-dialog');
  ok(/nichts automatisch entfernt/.test(dtxt), 'der Dialog sagt, dass NICHTS automatisch entfernt wird');
  ok(/Klaus Nitzsche/.test(dtxt), '…und an wen die Meldung geht');
  ok(/Namen nicht angeben/.test(dtxt), '…und dass man anonym melden darf');
  ok(/nicht der beanstandete Inhalt/.test(dtxt), '…und was mitgeschickt wird und was nicht');
  const gruende = await p.evaluate(() => [...document.querySelectorAll('.kb-melde-grund')].map((r) => r.value));
  ok(gruende.includes('hass'), 'Hassrede ist ein eigener Melde-Grund');
  ok(gruende.length >= 4, '…neben weiteren (' + gruende.length + ' Gründe)');

  // ---------- 3. Der Weg schickt WIRKLICH etwas ----------
  const gesendet = await p.evaluate(async () => {
    const raus = [];
    const echt = window.fetch;
    window.fetch = async (url, o) => {
      raus.push({ url: String(url), body: o && o.body ? String(o.body) : '' });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    document.querySelector('.kb-melde-text').value = 'Bitte ansehen.';
    document.querySelector('.kb-melde-send').click();
    // Auf die BEDINGUNG warten: der Dienst wirft alles weg, was schneller als
    // 1,5 s ausgefüllt wurde — die App wartet das ab, statt eine Bestätigung
    // zu zeigen, die nicht stimmt. Also auf den Aufruf warten, nicht auf eine Uhr.
    const bis = Date.now() + 15000;
    while (!raus.length && Date.now() < bis) await new Promise((r) => setTimeout(r, 100));
    window.fetch = echt;
    return raus;
  });
  ok(gesendet.length === 1, 'der Melde-Knopf setzt genau EINEN Aufruf ab (' + gesendet.length + ')');
  const leib = gesendet.length ? JSON.parse(gesendet[0].body) : {};
  ok(gesendet.length > 0 && /einreichung\.php$/.test(gesendet[0].url),
    '…an die Adresse aus der Konfiguration (' + (gesendet[0] || {}).url + ')');
  ok(leib.zweck === 'meldung', '…mit zweck:"meldung" (der erprobte Marktplatz-Weg)');
  ok(leib.eintrag_id === FREMD.qid, '…und der Kennung genau dieses Zettels');
  ok(leib.grund === 'hass', '…und dem gewählten Grund');
  ok(String(leib.nachricht || '').includes(FREMD.pub), '…und der Absender-Kennung, damit man wiederholte Fälle sieht');
  ok(String(leib.nachricht || '').includes('Bitte ansehen.'), '…und dem Freitext des Melders');
  // Der Kern: der beanstandete Text darf NICHT mitreisen.
  ok(!JSON.stringify(leib).includes('SCHLIMMER-INHALT'),
    'der beanstandete INHALT wird NICHT mitgeschickt (sonst verbreitet man ihn erneut)');
  ok(Number(leib.fp_elapsed) >= 1500,
    '…und die Ausfüllzeit ist über dem Bot-Riegel des Dienstes (' + leib.fp_elapsed + ' ms) — sonst wirft er sie still weg');

  // ---------- 4. Rückmeldung nach Art. 16 ----------
  const rueck = await p.textContent('.kb-melde-out');
  ok(/Eingegangen/.test(rueck), 'Art. 16: der Eingang wird bestätigt');
  ok(/zeitnah/.test(rueck) && /begründet/.test(rueck), '…mit Ansage, wie es weitergeht');
  ok(!!(await p.$('.kb-melde-out a[href*="impressum"]')), '…und einem Hinweis auf den Beschwerdeweg');
  ok(await p.evaluate((q) => !document.querySelector('[data-qid="' + q + '"]'), FREMD.qid),
    'der gemeldete Zettel ist bei mir ausgeblendet (nur hier, unabhängig von der Entscheidung)');
  await p.click('.kb-melde-close');

  // ---------- 5. Fail-soft: kein Endpunkt → Mail-Vordruck ----------
  const ohneEndpunkt = await p.evaluate(async (aid) => {
    const sicher = window.KB_MODERATION.meldeEndpunkt;
    window.KB_MODERATION.meldeEndpunkt = '';
    const ev = { id: aid, pubkey: 'ab'.repeat(32) };
    const r = await window.__kb.sendeMeldung(ev, 'hass', 'x', Date.now() - 9000);
    window.KB_MODERATION.meldeEndpunkt = sicher;
    return r;
  }, FREMD.aid);
  ok(ohneEndpunkt.weg === 'mail', 'ohne Melde-Dienst fällt es auf einen Mail-Vordruck zurück');
  ok(/^mailto:info@family-projekt\.de\?/.test(ohneEndpunkt.mailto || ''), '…an die Adresse aus der Konfiguration');

  // ---------- 6. Fail-soft: gar nichts eingerichtet (der Fork-Fall) ----------
  const ohneAlles = await p.evaluate(async (aid) => {
    const a = window.KB_MODERATION.meldeEndpunkt, b = window.KB_MODERATION.meldeMail;
    window.KB_MODERATION.meldeEndpunkt = ''; window.KB_MODERATION.meldeMail = '';
    const r = await window.__kb.sendeMeldung({ id: aid, pubkey: 'ab'.repeat(32) }, 'hass', 'x', Date.now() - 9000);
    window.KB_MODERATION.meldeEndpunkt = a; window.KB_MODERATION.meldeMail = b;
    return r;
  }, FREMD.aid);
  ok(ohneAlles.weg === 'keiner', 'ohne jede Adresse wird nichts gesendet — und das wird gesagt, nicht verschwiegen');

  // ---------- 7. Der Dienst antwortet mit Fehler → ehrlich sagen ----------
  const kaputt = await p.evaluate(async (aid) => {
    const echt = window.fetch;
    window.fetch = async () => new Response(JSON.stringify({ ok: false, error: 'rate' }), { status: 429 });
    const r = await window.__kb.sendeMeldung({ id: aid, pubkey: 'ab'.repeat(32) }, 'hass', 'x', Date.now() - 9000);
    window.fetch = echt;
    return r;
  }, FREMD.aid);
  ok(kaputt.weg === 'fehler', 'ein abgelehnter Aufruf wird als Fehlschlag gemeldet, nicht als Erfolg');

  // ---------- 8. Erklär-Blase ----------
  await p.waitForFunction(() => !!(window.__hilfe && window.__hilfe.texte), null, { timeout: 20000 });
  const blase = await p.evaluate(() => window.__hilfe.texte['.q-melden']);
  ok(Array.isArray(blase) && blase.length === 2, 'der ⚑ hat einen Eintrag in assets/hilfe.js');
  ok(Array.isArray(blase) && /Melden/.test(blase[0]), '…mit sprechendem Titel');
  ok(Array.isArray(blase) && blase[1].length > 200, '…und einer Erklärung, die die Frage wirklich beantwortet');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
