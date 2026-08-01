#!/usr/bin/env node
/*
 * Smoke — „🚫 Diese Nachricht wurde zurückgezogen" (echter Browser).
 *
 * Klaus 2026-08-01, nach der Frage „wieso geht das bei WhatsApp?": Der Zettel
 * soll beim anderen nicht SPURLOS verschwinden — sonst rätselt er, ob da eben
 * etwas war. Aber: „bis zu einer gewissen Zeit … aber dass es dann nicht
 * dauerhaft zu sehen ist." Also ein VERGÄNGLICHER Hinweis, kein Grabstein,
 * der ewig stehen bleibt.
 *
 * Geprüft wird:
 *   - Zieht der Autor seinen Zettel zurück, steht beim Empfänger der Hinweis —
 *     der Text selbst ist weg.
 *   - Antworten anderer bleiben stehen (die gehören ihnen), aber man kann auf
 *     den zurückgezogenen Zettel nicht mehr antworten.
 *   - Dasselbe für eine zurückgezogene ANTWORT.
 *   - Nach Ablauf der Frist verschwindet der Hinweis von selbst — und der
 *     Zettel kommt NICHT wieder, auch wenn ein Relais ihn erneut ausliefert.
 *   - Am EIGENEN Zettel steht kein Hinweis (ich weiß ja, was ich weggenommen
 *     habe) — und nach einem Neuladen erscheint gar nichts mehr.
 *   - Der ehrliche Satz ist eindeutig formuliert: „bitten … erzwingen können
 *     wir es nicht" statt des missverständlichen „Bitte, keine Garantie"
 *     (das sich las wie „ich bitte um keine Garantie").
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_platzhalter.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8472;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

// Ein Fremder, der echt signiert — sonst verwirft echtheit.js seine Zettel.
const FREMDER = `
  const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
  const { eventId } = await import('./modules/echtheit.js');
  const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
`;

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);

  const text = () => p.evaluate(() => document.body.innerText);
  const hat = async (t) => (await text()).includes(t);
  const grabsteine = () => p.evaluate(() => document.querySelectorAll('.kb-tombstone').length);

  console.log('== Zurückgezogen: der vergängliche Hinweis ==');

  // --- Ein Fremder stellt einen Zettel auf, ich antworte darauf ---
  const F = await p.evaluate(async (pre) => {
    const mk = new Function('return (async () => {' + pre + `
      const priv = utils.randomPrivateKey();
      const pub = toHex(schnorr.getPublicKey(priv));
      const ev = { pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
        tags: [['t', 'sbkim-frage-antwort-test']], content: 'Wer bringt den Kuchen mit?' };
      ev.id = await eventId(ev);
      ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
      await window.__kb.dispatch(ev, 'wss://test');
      return { pub, id: ev.id, priv: toHex(priv) };
    })()`)();
    return await mk;
  }, FREMDER);
  await p.waitForTimeout(700);
  ok(await hat('Wer bringt den Kuchen mit?'), 'der fremde Zettel steht auf dem Brett');

  await p.evaluate(async (qid) => {
    const ev = await window.__kb.buildEvent('Ich bringe ihn mit!', [['e', qid]]);
    await window.__kb.dispatch(ev, 'wss://test');
  }, F.id);
  await p.waitForTimeout(600);
  ok(await hat('Ich bringe ihn mit!'), 'meine Antwort darauf steht darunter');

  // --- Der Autor zieht seinen Zettel zurück ---
  await p.evaluate(async (args) => {
    const mk = new Function('f', 'return (async () => {' + args.pre + `
      const ev = { pubkey: f.pub, created_at: Math.floor(Date.now() / 1000), kind: 5,
        tags: [['t', 'sbkim-frage-antwort-test'], ['e', f.id]], content: 'zurückgezogen' };
      ev.id = await eventId(ev);
      ev.sig = toHex(await schnorr.sign(fromHex(ev.id), fromHex(f.priv)));
      await window.__kb.dispatch(ev, 'wss://test');
    })()`)(args.f);
    return await mk;
  }, { pre: FREMDER, f: F });
  await p.waitForTimeout(800);

  ok(!(await hat('Wer bringt den Kuchen mit?')), 'der Text der zurückgezogenen Nachricht ist weg');
  ok(await hat('Diese Nachricht wurde zurückgezogen'), '…an seiner Stelle steht der Hinweis (kein spurloses Verschwinden)');
  ok((await grabsteine()) === 1, '…genau ein Hinweis, nicht mehrere');
  ok(await hat('Ich bringe ihn mit!'), 'meine Antwort bleibt stehen — sie gehört mir, nicht ihm');
  const formWeg = await p.evaluate((qid) => !document.querySelector('[data-qid="' + qid + '"] .answer-form'), F.id);
  ok(formWeg, '…aber antworten kann man darauf nicht mehr');

  // --- Der Hinweis läuft ab und verschwindet von selbst ---
  await p.evaluate(() => window.__kb.setPlatzhalterDauer(0));
  await p.evaluate(() => window.__kb.raeumePlatzhalter());
  await p.waitForTimeout(300);
  ok((await grabsteine()) === 0, 'nach Ablauf der Frist ist der Hinweis von selbst weg');
  ok(!(await hat('Diese Nachricht wurde zurückgezogen')), '…er bleibt also NICHT dauerhaft stehen');
  ok(await hat('Ich bringe ihn mit!'), '…meine Antwort überlebt das Aufräumen');

  // --- Und der Zettel kommt nicht wieder, wenn ein Relais ihn erneut liefert ---
  await p.evaluate(async (args) => {
    const mk = new Function('f', 'return (async () => {' + args.pre + `
      const ev = { id: f.id, pubkey: f.pub, created_at: Math.floor(Date.now() / 1000) - 5, kind: 1,
        tags: [['t', 'sbkim-frage-antwort-test']], content: 'Wer bringt den Kuchen mit?' };
      ev.sig = toHex(await schnorr.sign(fromHex(f.id), fromHex(f.priv)));
      await window.__kb.dispatch(ev, 'wss://anderes-relais');
    })()`)(args.f);
    return await mk;
  }, { pre: FREMDER, f: F });
  await p.waitForTimeout(600);
  ok(!(await hat('Wer bringt den Kuchen mit?')), 'zurückgezogen bleibt zurückgezogen, auch bei erneuter Auslieferung');
  ok((await grabsteine()) === 0, '…und es entsteht kein neuer Hinweis dafür');

  // --- Eine zurückgezogene ANTWORT bekommt ebenfalls einen Hinweis ---
  await p.evaluate(() => window.__kb.setPlatzhalterDauer(60 * 60 * 1000));
  const F2 = await p.evaluate(async (pre) => {
    const mk = new Function('return (async () => {' + pre + `
      const priv = utils.randomPrivateKey();
      const pub = toHex(schnorr.getPublicKey(priv));
      const q = { pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
        tags: [['t', 'sbkim-frage-antwort-test']], content: 'Wann treffen wir uns?' };
      q.id = await eventId(q); q.sig = toHex(await schnorr.sign(fromHex(q.id), priv));
      await window.__kb.dispatch(q, 'wss://test');
      const a = { pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
        tags: [['t', 'sbkim-frage-antwort-test'], ['e', q.id]], content: 'Um acht am Bahnhof' };
      a.id = await eventId(a); a.sig = toHex(await schnorr.sign(fromHex(a.id), priv));
      await window.__kb.dispatch(a, 'wss://test');
      const d = { pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 5,
        tags: [['t', 'sbkim-frage-antwort-test'], ['e', a.id]], content: 'zurückgezogen' };
      d.id = await eventId(d); d.sig = toHex(await schnorr.sign(fromHex(d.id), priv));
      await window.__kb.dispatch(d, 'wss://test');
      return { qid: q.id };
    })()`)();
    return await mk;
  }, FREMDER);
  await p.waitForTimeout(900);
  ok(await hat('Wann treffen wir uns?'), 'die Frage bleibt stehen (sie wurde nicht zurückgezogen)');
  ok(!(await hat('Um acht am Bahnhof')), 'die zurückgezogene ANTWORT ist weg');
  ok((await grabsteine()) === 1, '…und an ihrer Stelle steht der Hinweis');

  // --- Am eigenen Zettel: kein Hinweis, und nach dem Neuladen nichts mehr ---
  const MEINS = await p.evaluate(async () => {
    const ev = await window.__kb.buildEvent('Mein eigener Zettel');
    await window.__kb.dispatch(ev, 'wss://test');
    return ev.id;
  });
  await p.waitForTimeout(600);
  const vorher = await grabsteine();
  await p.evaluate(async (id) => {
    const urspr = WebSocket.prototype.send;
    WebSocket.prototype.send = function () { };
    await window.__kb.zurueckziehenFuerAlle(id);
    WebSocket.prototype.send = urspr;
  }, MEINS);
  await p.waitForTimeout(500);
  ok(!(await hat('Mein eigener Zettel')), 'mein eigener Zettel ist nach dem Zurückziehen weg');
  ok((await grabsteine()) === vorher, '…ohne Hinweis an mich selbst (ich weiß ja, was ich weggenommen habe)');

  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  ok((await grabsteine()) === 0, 'nach dem Neuladen steht überhaupt kein Hinweis mehr da');

  // --- Der Satz muss eindeutig sein ---
  const dtxt = await p.evaluate(async () => {
    const ev = await window.__kb.buildEvent('Testzettel für den Dialog');
    await window.__kb.dispatch(ev, 'wss://test');
    await new Promise((r) => setTimeout(r, 500));
    document.querySelector('[data-qid="' + ev.id + '"] .q-del').click();
    await new Promise((r) => setTimeout(r, 400));
    return document.getElementById('loesch-dialog').innerText;
  });
  ok(/erzwingen können wir es nicht/.test(dtxt), 'der Dialog sagt klar: bitten ja, erzwingen nein');
  ok(!/Bitte, keine Garantie/.test(dtxt), '…und nicht mehr „Bitte, keine Garantie" (las sich wie „ich bitte um keine Garantie")');
  ok(/zurückgezogen/.test(dtxt), '…und kündigt an, was der andere sehen wird');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
