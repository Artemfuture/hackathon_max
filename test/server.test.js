import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createWebServer } from '../src/server.js';

let server;
let base;
let missingServer;
let missingBase;

function raw(baseUrl, requestPath, method = 'GET') {
  const { port } = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: requestPath, method }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

const listen = (instance) =>
  new Promise((resolve) =>
    instance.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${instance.address().port}`))
  );

before(async () => {
  const workdir = mkdtempSync(path.join(os.tmpdir(), 'web-'));
  const dist = path.join(workdir, 'dist');
  mkdirSync(path.join(dist, 'assets'), { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Досуг</title>');
  writeFileSync(path.join(dist, 'assets', 'app.abc123.js'), 'console.log(1)');
  writeFileSync(path.join(workdir, 'secret.txt'), 'СЕКРЕТ');

  server = createWebServer({ rootDir: dist });
  base = await listen(server);
  missingServer = createWebServer({ rootDir: path.join(workdir, 'не-собрано') });
  missingBase = await listen(missingServer);
});

after(() => {
  server.close();
  missingServer.close();
});

test('/healthz отвечает «ok» и не кэшируется', async () => {
  const res = await raw(base, '/healthz');
  assert.equal(res.status, 200);
  assert.equal(res.body, 'ok');
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('корень отдаёт index.html без кэширования, чтобы обновления доходили сразу', async () => {
  const res = await raw(base, '/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.equal(res.headers['cache-control'], 'no-cache');
  assert.match(res.body, /Досуг/);
});

test('файлы из assets/ отдаются с правильным типом и кэшируются надолго', async () => {
  const res = await raw(base, '/assets/app.abc123.js');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/javascript/);
  assert.match(res.headers['cache-control'], /immutable/);
});

test('embedding разрешён: заголовков X-Frame-Options / frame-ancestors нет (MAX открывает приложение внутри себя)', async () => {
  const res = await raw(base, '/');
  assert.equal(res.headers['x-frame-options'], undefined);
  assert.equal(res.headers['content-security-policy'], undefined);
});

test('несуществующий файл — 404', async () => {
  assert.equal((await raw(base, '/missing.js')).status, 404);
  assert.equal((await raw(base, `/${encodeURIComponent('нет-такого.js')}`)).status, 404);
});

test('нельзя выйти за пределы папки приложения (path traversal)', async () => {
  for (const attempt of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/../../secret.txt']) {
    const res = await raw(base, attempt);
    assert.equal(res.status, 404, attempt);
    assert.ok(!res.body.includes('СЕКРЕТ'), `${attempt} не должен раскрывать файл`);
  }
});

test('битая кодировка адреса — 400, а не падение сервера', async () => {
  assert.equal((await raw(base, '/%E0%A4%A')).status, 400);
  assert.equal((await raw(base, '/healthz')).status, 200, 'сервер продолжает работать');
});

test('разрешены только GET и HEAD', async () => {
  const post = await raw(base, '/', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');

  const head = await raw(base, '/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.ok(Number(head.headers['content-length']) > 0);
});

test('если мини-приложение не собрано — понятное 503, а /healthz всё равно жив', async () => {
  const page = await raw(missingBase, '/');
  assert.equal(page.status, 503);
  assert.match(page.body, /не собрано/);
  assert.equal((await raw(missingBase, '/healthz')).status, 200);
});
