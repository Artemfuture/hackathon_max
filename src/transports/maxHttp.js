import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_CA_FILE = path.join(ROOT, 'certs', 'russian_trusted_root_ca.pem');

const REQUEST_TIMEOUT_MS = 60_000;

export function loadMaxCa(file = process.env.MAX_CA_FILE || DEFAULT_CA_FILE) {
  return existsSync(file) ? [...tls.rootCertificates, readFileSync(file, 'utf8')] : undefined;
}

export function createNodeFetch({ ca, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  return (url, { method = 'GET', headers = {}, body, signal } = {}) =>
    new Promise((resolve, reject) => {
      const target = new URL(url);
      const secure = target.protocol !== 'http:';
      const options = {
        method,
        headers: body ? { ...headers, 'Content-Length': Buffer.byteLength(body) } : headers,
        signal,
        timeout: timeoutMs,
        ...(secure && ca ? { ca } : {}),
      };

      const req = (secure ? https : http).request(target, options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => text,
            json: async () => JSON.parse(text),
          });
        });
      });

      req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs} ms`)));
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
}
