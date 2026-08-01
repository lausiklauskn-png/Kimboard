/*
 * _werkzeug.mjs — geteiltes Handwerkszeug für die Browser-Prüfungen.
 *
 * ZWEI DINGE, die mehrere Prüfungen brauchen:
 *
 * 1. `starteRelais(port)` — ein winziges, echtes Relais. Es nimmt Zettel an,
 *    hält sie als Vorrat und liefert sie auf Abfrage aus (dann EOSE). Damit
 *    lässt sich MESSEN, was tatsächlich wo ankommt, statt eine Absicht im Code
 *    zu behaupten.
 *
 * 2. `testSeite(root, relais)` — dieselbe index.html, nur mit den Test-Relais
 *    statt der echten Adressen. Die App prüft jede Relais-Angabe gegen ihren
 *    festen Pool (zu Recht — sonst könnte eine Ansage den Verkehr umleiten).
 *    Statt dafür eine Hintertür in den ausgelieferten Code zu bauen, wird hier
 *    nur die Adressliste ersetzt; der ganze übrige Code bleibt der echte.
 *
 * Beides bewusst klein gehalten: nur so viel Protokoll, wie die Prüfungen
 * brauchen (Text-Rahmen, REQ/EVENT/EOSE, Schließen-Rahmen).
 */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export async function starteRelais(port) {
  const empfangen = [], vorrat = [], leitungen = new Set();
  let gesamt = 0;   // wie viele Leitungen insgesamt aufgebaut wurden
  const srv = createServer();
  srv.on('upgrade', (req, sock) => {
    // Offene Leitungen merken: `srv.close()` wartet sonst ewig auf sie, solange
    // der Browser seine WebSocket-Verbindung hält.
    leitungen.add(sock); gesamt++;
    sock.on('close', () => leitungen.delete(sock));
    sock.on('error', () => { /* fail-soft */ });
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
      + 'Sec-WebSocket-Accept: ' + createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64') + '\r\n\r\n');
    let puffer = Buffer.alloc(0);
    const sende = (text) => {
      const n = Buffer.from(text);
      const kopf = n.length < 126 ? Buffer.from([0x81, n.length])
        : (() => { const k = Buffer.alloc(4); k[0] = 0x81; k[1] = 126; k.writeUInt16BE(n.length, 2); return k; })();
      try { sock.write(Buffer.concat([kopf, n])); } catch (_e) { /* */ }
    };
    sock.on('data', (d) => {
      puffer = Buffer.concat([puffer, d]);
      while (puffer.length >= 2) {
        if ((puffer[0] & 0x0f) === 0x8) { try { sock.end(); } catch (_e) { /* */ } return; }
        const maskiert = (puffer[1] & 0x80) !== 0;
        let len = puffer[1] & 0x7f, off = 2;
        if (len === 126) { len = puffer.readUInt16BE(2); off = 4; }
        else if (len === 127) return;               // so große Rahmen braucht keine Prüfung
        const maske = maskiert ? puffer.subarray(off, off + 4) : null;
        const start = off + (maskiert ? 4 : 0);
        if (puffer.length < start + len) return;    // Rest abwarten
        const roh = Buffer.from(puffer.subarray(start, start + len));
        if (maske) for (let i = 0; i < roh.length; i++) roh[i] ^= maske[i % 4];
        puffer = puffer.subarray(start + len);
        let m; try { m = JSON.parse(roh.toString()); } catch { continue; }
        if (!Array.isArray(m)) continue;
        if (m[0] === 'REQ') {
          for (const ev of vorrat) sende(JSON.stringify(['EVENT', m[1], ev]));
          sende(JSON.stringify(['EOSE', m[1]]));
        } else if (m[0] === 'EVENT') { empfangen.push(m[1]); vorrat.push(m[1]); }
      }
    });
  });
  await new Promise((r) => srv.listen(port, r));
  const aus = () => new Promise((fertig) => {
    for (const sock of leitungen) { try { sock.destroy(); } catch (_e) { /* */ } }
    leitungen.clear();
    srv.close(() => fertig());
  });
  return { srv, port, url: `ws://127.0.0.1:${port}`, empfangen, vorrat, aus,
    offen: () => leitungen.size, gesamt: () => gesamt };
}

export function testSeite(root, relais, datei = '.tmp-test-seite.html') {
  const quelle = readFileSync(join(root, 'index.html'), 'utf8');
  const poolAlt = quelle.match(/const RELAY_POOL = \[[\s\S]*?\];/)[0];
  const inhalt = quelle
    .replace(poolAlt, 'const RELAY_POOL = [' + relais.map((u) => `'${u}'`).join(', ') + '];')
    .replace("const HOME_RELAY = 'wss://relay.family-projekt.de';", `const HOME_RELAY = '${relais[0]}';`);
  writeFileSync(join(root, datei), inhalt);
  return { datei, quelle, weg: () => { try { unlinkSync(join(root, datei)); } catch (_e) { /* */ } } };
}
