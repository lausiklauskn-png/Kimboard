#!/usr/bin/env node
/*
 * Smoke — Mikrofon hört die Sprache, die gesprochen wird (echter Browser).
 *
 * Klaus' Befund 2026-08-11: „In der Suche, überall wo das Mikrofon ist, ist nur
 * Deutsch vorgesehen. Deutsch ist aber nicht jedermanns gängige Sprache … wenn
 * ich in Arabisch etwas hineinspreche, muss auch Arabisch als Text herauskommen."
 *
 * Vorher stand an beiden Mikrofonen fest `rec.lang = 'de-DE'`. Für jeden, der
 * kein Deutsch spricht, war das Mikrofon damit schlicht kaputt — es lieferte
 * den Versuch, Arabisch als Deutsch zu hören, also Buchstabensalat.
 *
 * GEPRÜFT WIRD DIE TAT, NICHT DER WORTLAUT. Eine eigene SpeechRecognition wird
 * eingehängt, die nur mitschreibt, welches `lang` die App wirklich gesetzt hat.
 * Ein Blick in den Quelltext („steht da `micLang`?") würde auch dann grün
 * melden, wenn die Zuweisung nie ausgeführt wird.
 *
 * Sabotage-Probe gemacht: `rec.lang` wieder fest auf 'de-DE' → vier Proben rot.
 *
 * WICHTIG ZUR EINORDNUNG: die Browser-Spracherkennung hat KEINE Sprach-
 * Erkennung. Sie hört genau die Sprache, die man ihr sagt. Darum zwei Stufen,
 * beide ohne Schlüssel: Vorauswahl aus der Geräte-Sprache (arabisches Handy →
 * sofort Arabisch, ohne Einstellung) und eine gespeicherte Wahl für den Fall,
 * dass Gerät und Sprecher verschiedene Sprachen haben.
 *
 * Voraussetzung: npm install --no-save playwright-core
 * Aufruf: node tests/smoke_mikrofon_sprachen.mjs   ·   Exit 0 = grün.
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
const ORT = `http://127.0.0.1:${PORT}/`;

/* Der Spion: schreibt jedes `lang` mit, mit dem eine Aufnahme gestartet wird. */
const SPION = `
  window.__gehoert = [];
  window.__fehlerAls = null;      // Testschalter: diesen Fehler beim Start werfen
  window.SpeechRecognition = function () {
    this.start = function () {
      window.__gehoert.push(this.lang);
      if (this.onstart) this.onstart();
      if (window.__fehlerAls) {
        if (this.onerror) this.onerror({ error: window.__fehlerAls });
        if (this.onend) this.onend();     // der Browser beendet nach einem Fehler
      }
    };
    this.stop = function () { if (this.onend) this.onend(); };
  };
  window.webkitSpeechRecognition = window.SpeechRecognition;
`;

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

  async function seite(locale) {
    const ctx = await browser.newContext({ locale, viewport: { width: 900, height: 800 } });
    await ctx.addInitScript(SPION);
    const page = await ctx.newPage();
    const fehler = [];
    page.on('pageerror', (e) => fehler.push(String(e)));
    await page.goto(ORT, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    return { ctx, page, fehler };
  }

  /* ── Die Auswahl selbst + das Umschalten ──────────────────────────────── */
  {
    const { ctx, page, fehler } = await seite('de-DE');
    ok(fehler.length === 0, 'Skript-Fehler beim Laden: ' + (fehler[0] || ''));

    const st = await page.evaluate(() => {
      const s = document.getElementById('tb-miclang');
      return s ? { da: true, anzahl: s.options.length, wert: s.value,
                   arabisch: [...s.options].some((o) => o.value === 'ar-SA') } : { da: false };
    });
    ok(st.da, 'Sprach-Auswahl fehlt');
    ok(st.anzahl >= 10, 'zu wenige Sprachen zur Wahl: ' + st.anzahl);
    ok(st.arabisch, 'Arabisch fehlt in der Liste');
    ok(st.wert === 'de-DE', 'deutsches Gerät wählt nicht Deutsch vor: ' + st.wert);

    await page.click('#mic');
    await page.waitForTimeout(150);
    ok((await page.evaluate(() => window.__gehoert))[0] === 'de-DE', 'Mikrofon hört nicht Deutsch');

    /* Das Mikrofon ist ein UMSCHALTER — erst stoppen, dann umschalten, dann neu
       starten. Ohne das Stoppen misst man den Stopp-Zweig und bekommt
       `undefined`; genau daran ist diese Prüfung beim Schreiben einmal
       fälschlich rot geworden. */
    await page.click('#mic');
    await page.waitForTimeout(120);
    await page.selectOption('#tb-miclang', 'ar-SA');
    await page.click('#mic');
    await page.waitForTimeout(150);
    ok((await page.evaluate(() => window.__gehoert))[1] === 'ar-SA',
       'nach dem Umschalten hört das Mikrofon nicht Arabisch');

    ok(await page.evaluate(() => document.getElementById('qmsg').getAttribute('dir')) === 'auto',
       'Feld hat keine inhalts-abhängige Leserichtung (dir="auto")');

    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(700);
    ok(await page.evaluate(() => document.getElementById('tb-miclang').value) === 'ar-SA',
       'die gewählte Sprache überlebt das Neuladen nicht');
    await ctx.close();
  }

  /* ── Vorauswahl aus der Geräte-Sprache, OHNE dass jemand etwas einstellt ──
   * Das ist der Fall, der zählt: ein arabisches Handy muss beim ersten
   * Antippen Arabisch hören. Wer erst eine Einstellung finden muss, um
   * verstanden zu werden, benutzt das Mikrofon nicht.
   * `ja-JP` steht als Gegenprobe für „Sprache nicht in der Liste": dann bleibt
   * Deutsch, weil die App auf Deutsch geschrieben ist — ehrliche Vorgabe,
   * kein Raten. */
  for (const [locale, erwartet] of [['ar-EG', 'ar-SA'], ['ru-RU', 'ru-RU'],
                                    ['en-GB', 'en-US'], ['ja-JP', 'de-DE'],
                                    ['ps-AF', 'ps-AF'], ['fa-AF', 'fa-IR']]) {
    const { ctx, page } = await seite(locale);
    await page.click('#mic');
    await page.waitForTimeout(150);
    const g = (await page.evaluate(() => window.__gehoert))[0];
    ok(g === erwartet, `Gerät ${locale} → Mikrofon hört ${g}, erwartet ${erwartet}`);
    await ctx.close();
  }

  /* ── Wenn der Browser die Sprache NICHT kann ──────────────────────────────
   *
   * Klaus' Nachfrage 2026-08-11 zu Paschtu. Welche Sprachen der Browser
   * wirklich beherrscht, verrät er NICHT vorher — es gibt keine abfragbare
   * Liste. Man kann eine Sprache also nur anbieten und dann sauber sagen, wenn
   * es nicht ging. Genau das wird hier geprüft:
   *
   *   1. Es erscheint ein SATZ, kein Fachwort. Vorher stand da
   *      „Spracheingabe-Fehler: language-not-supported" — ausgerechnet für den
   *      Menschen, der mit einem englischen Fachbegriff am wenigsten anfangen
   *      kann. Wer das liest, hält die App für kaputt.
   *   2. Der Satz BLEIBT STEHEN. Der Aufräumer nach dem Ende löschte den
   *      Hinweis, wenn darin nicht das Wort „Fehler" vorkam — die lesbaren
   *      Sätze tragen es nicht mehr. Ohne die Markierung wäre die Meldung
   *      sofort weg gewesen: schlimmer als der Fachbegriff, weil dann gar
   *      nichts mehr dasteht.
   */
  {
    const { ctx, page } = await seite('de-DE');
    await page.selectOption('#tb-miclang', 'ps-AF');
    await page.evaluate(() => { window.__fehlerAls = 'language-not-supported'; });
    await page.click('#mic');
    await page.waitForTimeout(250);
    const hinweis = await page.evaluate(() => document.getElementById('sendhint').textContent.trim());
    /* Bewusst NICHT „ist lang genug" — diese Prüfung war beim Schreiben auf dem
       Satz „kein Relay verbunden…" grün geworden und hätte den eigentlichen
       Befund verdeckt. Gefragt wird nach dem, was drinstehen MUSS. */
    ok(/Sprache|tippe/.test(hinweis), 'kein lesbarer Satz bei nicht gekonnter Sprache: "' + hinweis + '"');
    ok(!/language-not-supported/.test(hinweis), 'der rohe Fehlercode steht noch in der Meldung');
    ok(/پښتو/.test(hinweis), 'die Meldung nennt die betroffene Sprache nicht: "' + hinweis + '"');

    // Und noch einmal 300 ms später — die Meldung darf nicht verschwinden.
    await page.waitForTimeout(300);
    const spaeter = await page.evaluate(() => document.getElementById('sendhint').textContent.trim());
    ok(spaeter === hinweis, 'die Meldung wurde wieder weggeräumt: "' + spaeter + '"');

    // Ein neuer Versuch, der gelingt, räumt sie dagegen ab.
    await page.evaluate(() => { window.__fehlerAls = null; });
    await page.selectOption('#tb-miclang', 'de-DE');
    await page.click('#mic');
    await page.waitForTimeout(120);
    await page.click('#mic');            // stoppen → onend ohne Fehler
    await page.waitForTimeout(200);
    // Erwartet wird NICHT „leer": dort steht im Normalfall der Verbindungs-
    // Status, und der soll zurückkommen. Erwartet wird, dass die Sprach-Meldung
    // WEG ist — genau das ist der Unterschied zwischen „geräumt" und „stumm".
    const sauber = await page.evaluate(() => document.getElementById('sendhint').textContent.trim());
    ok(!/پښتو/.test(sauber), 'nach einem gelungenen Versuch klebt die alte Meldung noch: "' + sauber + '"');
    ok(sauber.length > 0, 'nach dem Räumen steht gar nichts mehr da — der Verbindungs-Status fehlt');
    await ctx.close();
  }
} finally {
  if (browser) await browser.close();
  srv.kill();
}

console.log(`Mikrofon-Sprachen: ${pass} grün, ${fail} rot`);
process.exit(fail > 0 ? 1 : 0);
