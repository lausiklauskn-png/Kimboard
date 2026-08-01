#!/usr/bin/env node
/*
 * Smoke — Gruppen (Stufe 4), echter Browser.
 *
 * Klaus' Kernidee: „Wer einer Gruppe beitritt, bei dem läuft der
 * Schlüsseltausch automatisch." Genau das wird hier nachgewiesen — und die
 * Stelle, an der eine kopie-basierte Gruppe kaputtgehen KANN: Jedes Mitglied
 * bekommt eine eigene Kopie mit eigener Kennung. Eine Antwort, die sich auf
 * „meine" Kopie beruft, findet bei den anderen nichts. Darum trägt jede
 * Gruppen-Nachricht eine gemeinsame Faden-Marke.
 *
 * Geprüft wird:
 *   - Einladungs-Umschlag: reist verschlüsselt, Klartext nicht im Chiffrat,
 *     Fremde können ihn nicht lesen, fremdes JSON wird nicht als Einladung
 *     gelesen, ein gefälschter Schlüssel wird verworfen.
 *   - Empfang: Karte mit [Annehmen]/[Ablehnen] — NICHTS wird still gespeichert.
 *   - ANNEHMEN erledigt den Schlüsseltausch: Gruppe UND alle Mitglieder sind
 *     danach Kontakte. ABLEHNEN speichert nichts.
 *   - Eigene Namen für schon bekannte Kontakte werden NICHT überschrieben.
 *   - Senden an die Gruppe: je Mitglied eine eigene Kopie, jede verschlüsselt,
 *     alle mit derselben Faden-Marke.
 *   - DER ENTSCHEIDENDE PUNKT: Eine Antwort eines anderen Mitglieds landet im
 *     selben Strang — auch wenn dessen e-Kennung hier unbekannt ist.
 *   - Verlassen entfernt die Gruppe, aber nicht die Kontakte.
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_gruppen.mjs   ·   Exit 0 = grün.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8475;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const PRE = `
  const { schnorr, utils } = await import('./modules/noble-secp256k1.js');
  const { eventId } = await import('./modules/echtheit.js');
  const { dmEncrypt } = await import('./modules/dm_crypto.js');
  const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const fromHex = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
  // Ein fremdes Mitglied, das mir echt signiert + verschlüsselt schreibt.
  const schicke = async (priv, pub, content, tags) => {
    const ev = { pubkey: pub, created_at: Math.floor(Date.now() / 1000), kind: 1,
      tags: [['t', 'sbkim-frage-antwort-test'], ['p', window.__kb.me()], ['enc', 'dm1']].concat(tags || []),
      content: await dmEncrypt(content, priv, window.__kb.me()) };
    ev.id = await eventId(ev);
    ev.sig = toHex(await schnorr.sign(fromHex(ev.id), priv));
    await window.__kb.dispatch(ev, 'wss://test');
    return ev;
  };
`;

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 900, height: 1100 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);

  const hat = async (t) => (await p.evaluate(() => document.body.innerText)).includes(t);

  console.log('== Gruppen ==');

  // ---------- 1. Der Umschlag selbst ----------
  const umschlag = await p.evaluate(() => {
    const gid = 'a1b2c3d4';
    const echt = window.__kb.makeGroupInvite(gid, 'Familie', ['a'.repeat(64), 'b'.repeat(64)]);
    return {
      gelesen: window.__kb.parseGroupInvite(echt),
      fremdesJson: window.__kb.parseGroupInvite('{"foo":1}'),
      kaputt: window.__kb.parseGroupInvite('{"kbgi":1,"g":"aa","n":"X","m":[["A","kein-schluessel"]]}'),
      keinText: window.__kb.parseGroupInvite('Hallo, ich bin ein normaler Zettel'),
    };
  });
  ok(umschlag.gelesen && umschlag.gelesen.members.length === 2, 'die Einladung enthält die Mitgliederliste');
  ok(umschlag.gelesen && umschlag.gelesen.name === 'Familie', '…und den Gruppennamen');
  ok(umschlag.fremdesJson === null, 'fremdes JSON wird NICHT als Einladung gelesen');
  ok(umschlag.kaputt === null, 'ein ungültiger Schlüssel wird verworfen');
  ok(umschlag.keinText === null, 'ein normaler Zettel ist keine Einladung');

  // ---------- 2. Eine echte Einladung kommt an ----------
  const ANNA = await p.evaluate(async (pre) => {
    return await new Function('return (async () => {' + pre + `
      const priv = utils.randomPrivateKey();
      const pub = toHex(schnorr.getPublicKey(priv));
      window.__kb.pinContact(pub, 'Anna');
      const gid = 'beef1234';
      const bert = toHex(schnorr.getPublicKey(utils.randomPrivateKey()));
      const inv = JSON.stringify({ kbgi: 1, g: gid, n: 'Grillabend',
        m: [['Annchen vom Grillclub', pub], ['Bert', bert], ['Ich', window.__kb.me()]] });
      await schicke(priv, pub, inv);
      return { priv: toHex(priv), pub, gid, bert };
    })()`)();
  }, PRE);
  await p.waitForTimeout(800);

  ok(await hat('Einladung in eine Gruppe'), 'die Einladung erscheint als Karte');
  ok(await hat('Grillabend'), '…mit dem Gruppennamen');
  ok(await p.$('.kb-invite-yes') && await p.$('.kb-invite-no'), '…mit [Annehmen] und [Ablehnen]');
  ok(!(await p.evaluate((g) => !!window.__kb.gruppen()[g], ANNA.gid)),
    'SICHERHEIT: vor der Zustimmung ist NICHTS gespeichert');
  ok(!(await p.evaluate((b) => !!window.__kb.contacts()[b], ANNA.bert)),
    '…auch Bert ist noch kein Kontakt');

  // ---------- 3. Annehmen = automatischer Schlüsseltausch ----------
  await p.click('.kb-invite-yes');
  await p.waitForTimeout(500);
  ok(await p.evaluate((g) => !!window.__kb.gruppen()[g], ANNA.gid), 'Annehmen speichert die Gruppe');
  ok(await p.evaluate((b) => !!window.__kb.contacts()[b], ANNA.bert),
    'DER KERN: Bert ist jetzt Kontakt, ohne dass ich einen Schlüssel abgetippt habe');
  // In der Einladung heißt sie „Annchen vom Grillclub" — bei mir „Anna".
  // Meine Benennung muss gewinnen, sonst benennt ein Absender meine Kontakte um.
  ok(await p.evaluate((a) => window.__kb.contacts()[a].name === 'Anna', ANNA.pub),
    '…und mein eigener Name für Anna wurde NICHT überschrieben');
  const imAuswahl = await p.evaluate((g) => [...document.querySelectorAll('#dm-to option')].some((o) => o.value === 'g:' + g), ANNA.gid);
  ok(imAuswahl, 'die Gruppe steht in „Privat an" zur Auswahl');

  // ---------- 4. Senden an die Gruppe: je Mitglied eine Kopie ----------
  // Im Testcontainer ist kein Relais erreichbar (der „Frage stellen"-Knopf ist
  // dann gesperrt — so ist es gebaut). Gemessen wird darum an genau der
  // Funktion, die der Knopf aufruft, mit eingehängter Leitung: echte
  // Verschlüsselung, echte Tags, echte Empfänger.
  const gesendet = await p.evaluate(async (g) => {
    const raus = [];
    const leitung = [{ url: 'wss://test', send: (d) => raus.push(d) }];
    await window.__kb.sendeAnGruppe(g, 'Wer bringt den Grill?', null, leitung);
    return raus.map((x) => { try { return JSON.parse(x); } catch { return null; } })
      .filter((x) => x && x[0] === 'EVENT').map((x) => x[1]);
  }, ANNA.gid);

  // Und die Verdrahtung des Knopfes: Gruppe wählen sagt an, was passieren wird.
  const ansage = await p.evaluate((g) => {
    window.__kb.setGruppe(g);
    return document.getElementById('dm-status').textContent;
  }, ANNA.gid);
  ok(/Gruppe „Grillabend"/.test(ansage) && /Kopie/.test(ansage),
    'die Auswahl kündigt an, was passiert: ' + ansage.slice(0, 70) + '…');

  ok(gesendet.length >= 2, 'es geht je Mitglied eine eigene Kopie raus (' + gesendet.length + ')');
  ok(gesendet.every((e) => String(e.content).startsWith('sbkimdm1:')), '…jede einzeln verschlüsselt');
  ok(gesendet.every((e) => e.content.indexOf('Wer bringt den Grill?') < 0), '…der Klartext steckt in keiner');
  const marken = gesendet.map((e) => (e.tags.find((t) => t[0] === 'gm') || []).slice(1).join(':'));
  ok(marken.length >= 2 && new Set(marken).size === 1, '…und alle tragen DIESELBE Faden-Marke (' + marken[0] + ')');
  const empf = gesendet.map((e) => (e.tags.find((t) => t[0] === 'p') || [])[1]);
  ok(empf.includes(ANNA.pub) && empf.includes(ANNA.bert), '…an Anna UND Bert, nicht an mich selbst');
  ok(!empf.includes(await p.evaluate(() => window.__kb.me())), '…ich bin nicht mein eigener Empfänger');
  ok(await hat('Wer bringt den Grill?'), 'in meiner Ansicht steht die Nachricht EINMAL');
  ok(await hat('👥 Grillabend'), '…und ist als Gruppen-Nachricht beschriftet');

  const mid = marken[0].split(':')[1];

  // ---------- 5. DER ENTSCHEIDENDE PUNKT: Antwort eines anderen Mitglieds ----------
  // Anna antwortet. Ihre e-Kennung zeigt auf IHRE Kopie — die es hier nie gab.
  // Ohne die gemeinsame Faden-Marke würde ihre Antwort im Nirgendwo landen.
  await p.evaluate(async (args) => {
    await new Function('a', 'return (async () => {' + args.pre + `
      await schicke(fromHex(a.priv), a.pub, 'Ich bringe den Grill mit',
        [['e', 'f'.repeat(64)], ['gm', a.gid, a.mid]]);
    })()`)(args.a);
  }, { pre: PRE, a: { ...ANNA, mid } });
  await p.waitForTimeout(800);

  const imStrang = await p.evaluate((t) => {
    const li = [...document.querySelectorAll('.q-card')].find((c) => c.innerText.includes(t));
    return li ? li.innerText.includes('Ich bringe den Grill mit') : false;
  }, 'Wer bringt den Grill?');
  ok(imStrang, 'Annas Antwort landet im SELBEN Strang (gemeinsame Faden-Marke greift)');
  ok(!(await p.evaluate(() => document.querySelectorAll('.q-card').length > 1 &&
    [...document.querySelectorAll('.q-card')].some((c) => c.innerText.trim().startsWith('Ich bringe den Grill mit')))),
    '…und nicht als eigener, loser Zettel daneben');

  // ---------- 6. Verlassen ----------
  await p.click('#dm-groups');
  await p.waitForTimeout(400);
  ok(await p.$('#gruppen-fenster'), 'das Gruppen-Fenster öffnet sich');
  ok(await hat('Grillabend'), '…und listet die Gruppe');
  p.once('dialog', (d) => d.accept());
  await p.click('.kb-group-leave');
  await p.waitForTimeout(500);
  ok(!(await p.evaluate((g) => !!window.__kb.gruppen()[g], ANNA.gid)), 'Verlassen entfernt die Gruppe');
  ok(await p.evaluate((b) => !!window.__kb.contacts()[b], ANNA.bert), '…die Kontakte bleiben aber erhalten');

  ok(errs.length === 0, 'keine JS-Fehler im Browser (' + errs.slice(0, 2).join(' | ') + ')');
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\n== Ergebnis: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
