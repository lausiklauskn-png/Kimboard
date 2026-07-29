/*
 * echtheit.js — Ist dieser Zettel wirklich von dem, der draufsteht?
 *
 * WARUM ES DAS GIBT
 * Ein Relais gehört uns nicht. Es reicht Zettel durch — und könnte dabei
 * `pubkey` und `content` beliebig verändern. Ohne Prüfung wäre deshalb JEDE
 * Absender-Anzeige und jede darauf gebaute Regel wertlos: ein bösartiges
 * Relais könnte einen Zettel unter dem Namen eines Bekannten einschleusen,
 * und eine Kontakt-Allowlist würde ihn durchwinken.
 *
 * WAS GEPRÜFT WIRD (beides muss stimmen)
 *   1. Die Event-ID wird NEU BERECHNET (NIP-01-Form, dieselbe wie beim Senden)
 *      und gegen die mitgelieferte gehalten → Inhalt und Absender sind
 *      unverändert.
 *   2. Die Schnorr-Signatur über diese ID → sie stammt wirklich von dem
 *      Schlüssel, der als Absender behauptet wird.
 *
 * WAS ES NICHT LEISTET (ehrlich)
 *   Es beweist, dass ein Zettel von diesem SCHLÜSSEL kommt — nicht, dass der
 *   Schlüssel einem bestimmten MENSCHEN gehört. Dafür sind Kontakte (TOFU) und
 *   die Sicherheitsnummer zuständig.
 *
 * Konsequent fail-soft: alles Unklare gilt als unecht, es wirft nie.
 */
import { schnorr } from './noble-secp256k1.js';

const fromHex = (h) => {
  const s = String(h);
  if (s.length % 2 !== 0 || /[^0-9a-fA-F]/.test(s)) throw new Error('kein Hex');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
};
const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return toHex(new Uint8Array(buf));
}

/**
 * Berechnet die Event-ID nach NIP-01 — exakt die Form, die auch beim Senden
 * verwendet wird. Getrennt exportiert, damit Sender und Prüfer nie
 * auseinanderlaufen können.
 */
export async function eventId(ev) {
  return sha256Hex(JSON.stringify(
    [0, ev.pubkey, ev.created_at, ev.kind, ev.tags || [], ev.content]));
}

/**
 * true = der Zettel ist unverändert und wirklich signiert.
 * false = alles andere (gefälscht, verstümmelt, unvollständig, kaputtes Hex).
 */
export async function isAuthentic(ev) {
  try {
    if (!ev || typeof ev.id !== 'string' || typeof ev.sig !== 'string'
        || typeof ev.pubkey !== 'string' || typeof ev.content !== 'string'
        || typeof ev.created_at !== 'number' || typeof ev.kind !== 'number') return false;
    if (await eventId(ev) !== ev.id) return false;          // Inhalt verändert
    return await schnorr.verify(fromHex(ev.sig), fromHex(ev.id), fromHex(ev.pubkey));
  } catch { return false; }                                  // kaputtes Hex u. ä.
}
