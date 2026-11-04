const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};
const GZ = new Set(['.html', '.js', '.mjs', '.json', '.css', '.webmanifest', '.svg', '.txt']);
const PRIVATE = new Set(['server.js', 'package.json', 'package-lock.json', 'firebase.json', 'database.rules.json', 'database_rules.json']);
const NOCACHE = new Set(['.html', '.js', '.json', '.webmanifest']);
const gzCache = new Map();

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ 'X-Content-Type-Options': 'nosniff' }, headers));
  res.end(body);
}
const text = { 'Content-Type': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', text);

    const raw = (req.url || '/').split('?')[0];
    if (raw === '/healthz') return send(res, 200, 'ok', text);

    let urlPath;
    try { urlPath = decodeURIComponent(raw); } catch (e) { return send(res, 400, 'Bad Request', text); }
    if (urlPath.includes('\0')) return send(res, 400, 'Bad Request', text);

    const target = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
    if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden', text);

    const rel = path.relative(ROOT, target).split(path.sep);
    if (rel.some(p => p.startsWith('.') || p === 'node_modules') || PRIVATE.has(rel[rel.length - 1])) {
      return send(res, 404, 'Not found', text);
    }

    fs.stat(target, (err, stat) => {
      let file = target, st = stat;
      if (!err && stat.isDirectory()) { file = path.join(target, 'index.html'); st = null; }
      const serve = (s) => fs.readFile(file, (readErr, data) => {
        if (readErr) return send(res, 404, 'Not found', text);
        const ext = path.extname(file).toLowerCase();
        const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream' };
        headers['Cache-Control'] = NOCACHE.has(ext) ? 'no-cache' : 'public, max-age=86400';
        let body = data;
        if (GZ.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && data.length > 512) {
          const key = file + ':' + (s ? s.mtimeMs : 0) + ':' + data.length;
          let z = gzCache.get(key);
          if (!z) { z = zlib.gzipSync(data); if (gzCache.size > 50) gzCache.clear(); gzCache.set(key, z); }
          body = z; headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding';
        }
        headers['Content-Length'] = body.length;
        send(res, 200, req.method === 'HEAD' ? '' : body, headers);
      });
      if (st) return serve(st);
      fs.stat(file, (e2, s2) => serve(e2 ? null : s2));
    });
  } catch (e) {
    console.error(e);
    try { send(res, 500, 'Server Error', text); } catch (_) {}
  }
});

server.on('clientError', (e, socket) => { try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (_) {} });
process.on('uncaughtException', e => console.error('uncaught', e));
process.on('unhandledRejection', e => console.error('unhandled', e));

server.listen(PORT, () => {
  console.log('Шумно: сервер запущен на порту ' + PORT);
});
