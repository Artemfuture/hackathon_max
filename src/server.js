import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const send = (res, status, text, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(text);
};

export function createWebServer({ rootDir, api = null }) {
  const root = path.resolve(rootDir);

  return createServer(async (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(res, 400, 'Bad Request');
    }

    if (api && (await api.handle(req, res, pathname))) return;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    }

    if (pathname === '/healthz') return send(res, 200, 'ok', { 'Cache-Control': 'no-store' });

    const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const filePath = path.join(root, path.normalize(relative));
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      return send(res, 404, 'Not Found');
    }

    let info;
    try {
      info = await stat(filePath);
    } catch {
      const built = await stat(root).then(() => true, () => false);
      return built
        ? send(res, 404, 'Not Found')
        : send(res, 503, 'Мини-приложение не собрано: выполните npm run build в папке miniapp.');
    }
    if (!info.isFile()) return send(res, 404, 'Not Found');

    const immutable = pathname.startsWith('/assets/');
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(filePath).on('error', () => res.destroy()).pipe(res);
  });
}
