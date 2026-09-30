import { test } from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { createNodeFetch, DEFAULT_CA_FILE, loadMaxCa } from '../src/transports/maxHttp.js';

function listen(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` })
    )
  );
}

test('createNodeFetch: передаёт метод, заголовки и тело, разбирает JSON-ответ', async () => {
  let seen;
  const { server, url } = await listen((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      seen = { method: req.method, auth: req.headers.authorization, length: req.headers['content-length'], body };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, echo: 'привет' }));
    });
  });

  try {
    const fetchFn = createNodeFetch();
    const payload = JSON.stringify({ text: 'привет' });
    const res = await fetchFn(new URL('/messages', url), {
      method: 'POST',
      headers: { Authorization: 'token-1', 'Content-Type': 'application/json' },
      body: payload,
    });

    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, echo: 'привет' });
    assert.equal(seen.method, 'POST');
    assert.equal(seen.auth, 'token-1');
    assert.equal(seen.body, payload);
    assert.equal(Number(seen.length), Buffer.byteLength(payload), 'длина считается в байтах, а не в символах');
  } finally {
    server.close();
  }
});

test('createNodeFetch: не-2xx ответ — ok=false, текст ошибки доступен', async () => {
  const { server, url } = await listen((req, res) => {
    res.writeHead(401);
    res.end('{"code":"verify.token"}');
  });

  try {
    const res = await createNodeFetch()(`${url}/me`);
    assert.equal(res.ok, false);
    assert.equal(res.status, 401);
    assert.match(await res.text(), /verify\.token/);
  } finally {
    server.close();
  }
});

test('createNodeFetch: отмена запроса по AbortSignal (остановка long polling)', async () => {
  const { server, url } = await listen(() => {});

  try {
    const controller = new AbortController();
    const pending = createNodeFetch()(`${url}/updates`, { signal: controller.signal });
    setTimeout(() => controller.abort(), 30);
    await assert.rejects(pending, (err) => err.name === 'AbortError');
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test('createNodeFetch: зависший сервер не держит запрос вечно', async () => {
  const { server, url } = await listen(() => {});

  try {
    await assert.rejects(createNodeFetch({ timeoutMs: 50 })(`${url}/updates`), /timeout/);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test('loadMaxCa: без файла — undefined, с файлом — стандартные центры плюс корень Минцифры', () => {
  assert.equal(loadMaxCa(path.join(os.tmpdir(), 'нет-такого-файла.pem')), undefined);

  const dir = mkdtempSync(path.join(os.tmpdir(), 'ca-'));
  const file = path.join(dir, 'extra.pem');
  writeFileSync(file, '-----BEGIN CERTIFICATE-----\nтест\n-----END CERTIFICATE-----\n');

  const ca = loadMaxCa(file);
  assert.equal(ca.length, tls.rootCertificates.length + 1);
  assert.match(ca.at(-1), /BEGIN CERTIFICATE/);
});

test('сертификат Минцифры в репозитории цел: это корень «Russian Trusted Root CA»', () => {
  const cert = new X509Certificate(readFileSync(DEFAULT_CA_FILE));
  assert.match(cert.subject, /CN=Russian Trusted Root CA/);
  assert.equal(cert.subject, cert.issuer, 'корневой сертификат самоподписан');
  assert.equal(cert.ca, true);
  assert.ok(new Date(cert.validTo) > new Date(), 'срок действия не истёк');
});
