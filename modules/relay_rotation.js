/*
 * relay_rotation.js — berechneter Relais-Wechsel für den engeren Kreis.
 *
 * ZWECK (ehrlich): nicht immer über dasselbe Relais sprechen. Das bringt
 *   (a) Ausfallsicherheit — fällt ein Relais aus, läuft der Kreis weiter,
 *   (b) Metadaten nicht an EINEM Ort bündeln — kein einzelnes Relais sieht alles.
 * Es ist AUSDRÜCKLICH KEIN Zensur-Schutz und keine Tarnung: die Relais-Liste ist
 * öffentlich bekannt, der Wechsel verbirgt weder Teilnehmer noch Verkehr. Wer
 * gegen gezielte Überwachung/Sperren geschützt sein muss, nimmt Signal / Tor.
 *
 * PRINZIP (berechnet, ohne Absprache): Alle im Kreis teilen ein Gruppen-Geheimnis.
 * Aus Geheimnis + Zeitfenster rechnet JEDES Gerät selbst dieselbe Relais-Auswahl
 * aus — niemand muss dem anderen etwas mitteilen. Damit beim Umschalten niemand
 * verloren geht, wird zusätzlich das VORHERIGE Fenster mitgehört (Überlappung);
 * das federt auch leicht abweichende Uhren ab.
 *
 * ANSAGE (Reserve): Für den Fall stark abweichender Uhren kann ein Kreis-Mitglied
 * eine Umschalt-Ansage schicken (über den bestehenden, verschlüsselten DM-Weg —
 * dadurch ist sie signiert und nur für den Kreis lesbar). Sie ist nur ein Notnagel;
 * die berechnete Rotation bleibt die Grundmechanik.
 *
 * DOM-frei + fail-soft → headless testbar (tests/smoke_relay_rotation.mjs).
 */

const enc = new TextEncoder();

/** Zeitfenster-Nummer für einen Zeitpunkt (ms) bei gegebener Periode (ms). */
export function windowIndex(nowMs, periodMs) {
  const p = Math.max(1, Math.floor(periodMs || 0));
  return Math.floor(Math.max(0, Math.floor(nowMs || 0)) / p);
}

/** Verbleibende ms bis zum nächsten Fenster-Wechsel. */
export function msUntilNextWindow(nowMs, periodMs) {
  const p = Math.max(1, Math.floor(periodMs || 0));
  const n = Math.max(0, Math.floor(nowMs || 0));
  return p - (n % p);
}

/** Deterministischer Byte-Strom aus (Geheimnis, Fenster) — SHA-256-Kette. */
async function keystream(secret, windowIdx, nBytes) {
  const out = new Uint8Array(nBytes);
  let filled = 0, counter = 0;
  while (filled < nBytes) {
    const seed = enc.encode(String(secret) + '|' + String(windowIdx) + '|' + counter);
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', seed));
    const take = Math.min(h.length, nBytes - filled);
    out.set(h.subarray(0, take), filled);
    filled += take; counter++;
  }
  return out;
}

/**
 * Relais-Auswahl für ein Fenster: deterministische Mischung des Pools
 * (Fisher-Yates mit dem Schlüsselstrom) → die ersten `count` Einträge.
 * Gleiches Geheimnis + gleiches Fenster ⇒ überall dieselbe Auswahl.
 */
export async function relaysForWindow(secret, pool, count, windowIdx) {
  const list = (Array.isArray(pool) ? pool : []).filter((u) => typeof u === 'string' && u);
  const n = list.length;
  if (!n) return [];
  const want = Math.max(1, Math.min(Math.floor(count || 1), n));
  if (!secret) return list.slice(0, want); // ohne Geheimnis: unveränderte Reihenfolge
  const arr = list.slice();
  const ks = await keystream(secret, windowIdx, (n - 1) * 4);
  for (let i = n - 1, k = 0; i > 0; i--, k += 4) {
    const r = ((ks[k] << 24) >>> 0) + (ks[k + 1] << 16) + (ks[k + 2] << 8) + ks[k + 3];
    const j = r % (i + 1);
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr.slice(0, want);
}

/**
 * Die Relais der letzten `howMany` Fenster — als Menge, ohne Doppelte.
 *
 * WOFÜR: Wer später dazukommt, verbindet sich nur mit den AKTUELLEN Relais.
 * Was in früheren Fenstern über andere Relais lief, sieht er nie — er ist
 * dauerhaft auf einem anderen Stand als die anderen. Weil sich die Fenster
 * aber rückwärts ausrechnen lassen, weiß jedes Gerät genau, welche Relais
 * zuletzt dran waren, und kann dort einmalig den Vorrat nachlesen.
 *
 * EHRLICH: Nach wenigen Fenstern ist das praktisch der ganze Pool — das ist
 * kein Fehler, sondern der Normalfall bei kleinen Pools. Die Funktion bleibt
 * trotzdem richtig: Sie liefert die Relais, die wirklich dran waren, in der
 * Reihenfolge „neuestes Fenster zuerst", und bei großen Pools ist das
 * deutlich weniger als alles.
 *
 * Fail-soft: leerer Pool → [], howMany ≤ 0 → nur das aktuelle Fenster.
 */
export async function relaysForRecentWindows(secret, pool, count, windowIdx, howMany) {
  const list = (Array.isArray(pool) ? pool : []).filter((u) => typeof u === 'string' && u);
  if (!list.length) return [];
  const n = Math.max(1, Math.floor(howMany || 1));
  const w = Math.floor(windowIdx || 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const fenster = await relaysForWindow(secret, list, count, w - i);
    for (const u of fenster) if (!out.includes(u)) out.push(u);
    if (out.length >= list.length) break;   // mehr als den Pool gibt es nicht
  }
  return out;
}

/**
 * Aktueller Stand der Rotation.
 * Liefert `current` (jetziges Fenster), `previous` (voriges, fürs Mithören) und
 * `union` — die Menge, mit der man verbunden sein sollte (Überlappung), damit
 * beim Umschalten nichts verloren geht.
 */
export async function currentRelays(secret, pool, opts = {}) {
  const periodMs = Math.max(60000, Math.floor(opts.periodMs || 300000)); // min. 1 Min, Default 5 Min
  const count = Math.max(1, Math.floor(opts.count || 3));
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const w = windowIndex(now, periodMs);
  const current = await relaysForWindow(secret, pool, count, w);
  const previous = await relaysForWindow(secret, pool, count, w - 1);
  const union = current.slice();
  for (const u of previous) if (!union.includes(u)) union.push(u);
  return { windowIdx: w, periodMs, current, previous, union, msUntilNext: msUntilNextWindow(now, periodMs) };
}

/* ---------- Ansage (Reserve-Weg, reist über den verschlüsselten DM) ---------- */

/** Umschalt-Ansage bauen (Datenvertrag `kbrr` v1). */
export function makeAnnouncement(windowIdx, relays, atMs) {
  return JSON.stringify({
    kbrr: 1,
    w: Math.max(0, Math.floor(windowIdx || 0)),
    r: (Array.isArray(relays) ? relays : []).filter((u) => typeof u === 'string' && u.startsWith('wss://')),
    ts: Number.isFinite(atMs) ? atMs : Date.now(),
  });
}

/** Ansage lesen; nur Relais aus dem erlaubten Pool werden übernommen (fail-soft). */
export function parseAnnouncement(text, pool) {
  if (typeof text !== 'string' || text.indexOf('"kbrr"') < 0) return null;
  let o;
  try { o = JSON.parse(text); } catch (_e) { return null; }
  if (!o || o.kbrr !== 1 || !Array.isArray(o.r)) return null;
  const allowed = Array.isArray(pool) ? pool : [];
  const relays = o.r.filter((u) => allowed.includes(u)); // NIE fremde Adressen übernehmen
  if (!relays.length) return null;
  return { windowIdx: Math.max(0, Math.floor(o.w || 0)), relays, ts: Number.isFinite(o.ts) ? o.ts : 0 };
}

/** Ist es eine Ansage? (schnelle Vorprüfung fürs Einsortieren) */
export function isAnnouncement(text) {
  return typeof text === 'string' && text.indexOf('"kbrr"') >= 0 && /^\s*\{/.test(text);
}
