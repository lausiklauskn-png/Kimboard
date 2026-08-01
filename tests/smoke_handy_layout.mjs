#!/usr/bin/env node
/*
 * Smoke — Zettel-Layout am Handy (echter Browser, 360 px).
 *
 * Klaus' Befund 2026-08-01 (Screenshot vom Handy): „Der durchgestrichene
 * Lautsprecher steht auf dem ✕ — du kannst das ✕ nicht drücken, weil er davor
 * ist." Ursache: `.q-del` schwebt absolut oben rechts, die Kopfzeile reservierte
 * aber KEINEN Platz dafür — die Knopfreihe (Name · ➕ Kontakt · 🔇) lief darunter
 * durch und verdeckte es.
 *
 * Geprüft wird bei Handy-Breite (360 px):
 *   - Das ✕ ist frei treffbar (elementFromPoint trifft wirklich das ✕).
 *   - Weder der Kontakt-Knopf noch der Stumm-Knopf überlappen es.
 *   - Der Kontakt-Knopf bleibt beschriftet („Kontakt" steht auch am Handy dabei) —
 *     ein nacktes ➕ wirft die Frage „Was Plus?" auf.
 *   - Das Antwort-Feld ist breit genug zum Schreiben (es brach vorher senkrecht
 *     um), die Knöpfe rücken darunter.
 * Und bei Tablet-/Desktop-Breite:
 *   - dasselbe, mit voller Beschriftung.
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_handy_layout.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8467;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

// Einen fremden Zettel einschleusen (echt signiert — sonst verwirft echtheit.js).
const ZETTEL = async (p) => p.evaluate(async () => {
  const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
  const { eventId } = await import('./modules/echtheit.js');
  const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
  const priv = utils.randomPrivateKey();
  const pub = toHex(schnorr.getPublicKey(priv));
  const ev = {
    pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
    tags: [['t', 'sbkim-frage-antwort-test'], ['nick', 'Company Brain']],
    content: 'Was ist Privat Brain?',
  };
  ev.id = await eventId(ev);
  ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
  await window.__kb.dispatch(ev, 'wss://relay.family-projekt.de');
  // Eine Antwort dazu — sonst gäbe es kein zweites ✕ zu vergleichen.
  const a = { pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
    tags: [['t', 'sbkim-frage-antwort-test'], ['e', ev.id]], content: 'Eine Antwort darauf' };
  a.id = await eventId(a);
  a.sig = toHex(await schnorr.sign(fromHex(a.id), priv));
  await window.__kb.dispatch(a, 'wss://relay.family-projekt.de');
});

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

  console.log('== Zettel-Layout am Handy ==');

  // ---------- Handy: 360 px ----------
  const p = await browser.newPage({ viewport: { width: 360, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  await ZETTEL(p);
  await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector('.q-card').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(400);

  const messung = await p.evaluate(() => {
    const del = document.querySelector('.q-del');
    const b = del.getBoundingClientRect();
    const oben = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    const btn = document.querySelector('.kb-addcontact');
    const mute = document.querySelector('.kb-mute');
    const ta = document.querySelector('.answer-form textarea');
    const ueberlappt = (a, c) => {
      if (!a || !c) return null;
      const x = a.getBoundingClientRect(), y = c.getBoundingClientRect();
      return !(x.right <= y.left || x.left >= y.right || x.bottom <= y.top || x.top >= y.bottom);
    };
    const lbl = document.querySelector('.kb-addcontact .kb-lbl');
    return {
      xFrei: del === oben || del.contains(oben),
      daraufliegt: oben ? String(oben.className || oben.tagName).slice(0, 30) : '-',
      muteUeberX: ueberlappt(mute, del),
      btnUeberX: ueberlappt(btn, del),
      wortSichtbar: lbl ? (lbl.checkVisibility ? lbl.checkVisibility() : lbl.offsetParent !== null) : null,
      feldBreite: ta ? Math.round(ta.getBoundingClientRect().width) : 0,
    };
  });

  ok(messung.xFrei, 'das ✕ ist frei treffbar (darauf liegt: ' + messung.daraufliegt + ')');
  ok(messung.muteUeberX === false, 'der Stumm-Knopf überlappt das ✕ nicht mehr');
  ok(messung.btnUeberX === false, 'der Kontakt-Knopf überlappt das ✕ nicht');
  // Klaus 2026-08-01: Das WORT muss bleiben — „es gibt Leute, die fragen: Was
  // Plus?". Platz schafft der reservierte Rand oben, nicht das Weglassen.
  ok(messung.wortSichtbar === true, 'am Handy steht „Kontakt" trotzdem dabei (kein nacktes ➕)');
  ok(messung.feldBreite >= 180, 'das Antwort-Feld ist breit genug zum Schreiben (' + messung.feldBreite + ' px)');
  // Klaus 2026-08-01 nach dem Sichttest: „Die X am rechten Rand sind immer
  // noch nicht in einer Reihe." Ursache waren zwei Bezugsrahmen — das
  // Zettel-✕ misst von der Kartenkante, das Antwort-✕ von der Innenkante.
  const spalte = await p.evaluate(() => {
    const q = document.querySelector('.q-del'), a = document.querySelector('.a-del');
    if (!q || !a) return null;
    const rq = q.getBoundingClientRect(), ra = a.getBoundingClientRect();
    return {
      rechtsQ: Math.round(rq.right), rechtsA: Math.round(ra.right),
      mitteQ: Math.round(rq.left + rq.width / 2), mitteA: Math.round(ra.left + ra.width / 2),
      breiteQ: Math.round(rq.width), breiteA: Math.round(ra.width),
      imBild: ra.right <= document.documentElement.clientWidth,
    };
  });
  ok(!!spalte, 'Zettel und Antwort haben beide ein ✕');
  ok(spalte && Math.abs(spalte.rechtsQ - spalte.rechtsA) <= 1,
    'beide ✕ haben dieselbe rechte Kante (' + (spalte && spalte.rechtsQ) + ' vs ' + (spalte && spalte.rechtsA) + ')');
  ok(spalte && Math.abs(spalte.mitteQ - spalte.mitteA) <= 1,
    '…und stehen damit in EINER Spalte (Mitte ' + (spalte && spalte.mitteQ) + ' vs ' + (spalte && spalte.mitteA) + ')');
  ok(spalte && spalte.breiteQ === spalte.breiteA,
    '…und sind gleich groß (' + (spalte && spalte.breiteQ) + '/' + (spalte && spalte.breiteA) + ' px)');
  ok(spalte && spalte.imBild, '…und ragen nicht über den Rand hinaus');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');

  // ---------- Tablet/Desktop: 900 px ----------
  const p2 = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await p2.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(1800);
  await ZETTEL(p2);
  await p2.waitForTimeout(700);
  await p2.evaluate(() => document.querySelector('.q-card').scrollIntoView({ block: 'center' }));
  await p2.waitForTimeout(400);
  const gross = await p2.evaluate(() => {
    const lbl = document.querySelector('.kb-addcontact .kb-lbl');
    const del = document.querySelector('.q-del');
    const b = del.getBoundingClientRect();
    const oben = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return {
      wortSichtbar: lbl ? (lbl.checkVisibility ? lbl.checkVisibility() : lbl.offsetParent !== null) : null,
      text: document.querySelector('.kb-addcontact').innerText,
      xFrei: del === oben || del.contains(oben),
    };
  });
  ok(gross.wortSichtbar === true, 'auf großen Schirmen steht wieder „Kontakt" dabei');
  ok(/Kontakt/.test(gross.text), '…der Knopf ist dort voll beschriftet: ' + gross.text.trim());
  ok(gross.xFrei, 'auch dort bleibt das ✕ frei');
  const spalte2 = await p2.evaluate(() => {
    const q = document.querySelector('.q-del'), a = document.querySelector('.a-del');
    if (!q || !a) return null;
    const rq = q.getBoundingClientRect(), ra = a.getBoundingClientRect();
    return { d: Math.abs(Math.round(rq.right) - Math.round(ra.right)),
             m: Math.abs(Math.round(rq.left + rq.width / 2) - Math.round(ra.left + ra.width / 2)) };
  });
  ok(spalte2 && spalte2.d <= 1 && spalte2.m <= 1,
    'auch auf großen Schirmen stehen die ✕ in einer Spalte (Versatz ' + (spalte2 && spalte2.d) + ' px)');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
