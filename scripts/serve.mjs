#!/usr/bin/env node
/**
 * Servidor estático mínimo para o build de produção (PWA).
 * Sem dependências: serve dist/ com os cabeçalhos corretos para service worker.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd(), 'dist');
const argv = process.argv.slice(2);
const argValue = (name) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
};
const numericArg = argv.find((value) => /^\d+$/.test(value));
const PORT = Number(process.env.PORT || argValue('port') || numericArg || 5178);
const HOST = process.env.HOST || argValue('host') || '127.0.0.1';

function lanAddresses() {
  const result = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) result.push({ name, ip: address.address });
    }
  }
  return result;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || HOST}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';

  const filePath = normalize(join(ROOT, pathname));
  if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
    return send(res, 403, 'Forbidden');
  }

  let target = filePath;
  if (!existsSync(target) || statSync(target).isDirectory()) {
    // SPA fallback (rotas por hash, mas mantém robustez)
    target = join(ROOT, 'index.html');
    if (!existsSync(target)) return send(res, 404, 'Build não encontrado. Rode: pnpm build');
  }

  const ext = extname(target).toLowerCase();
  const isSW = target.endsWith('sw.js');
  const isHTML = ext === '.html';
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Service-Worker-Allowed': '/',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': isSW || isHTML ? 'no-cache, must-revalidate' : 'public, max-age=31536000, immutable',
  };

  res.writeHead(200, headers);
  createReadStream(target).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Vitalis disponível em \x1b[36mhttp://${HOST}:${PORT}\x1b[0m`);
  if (HOST === '0.0.0.0' || HOST === '::') {
    for (const { name, ip } of lanAddresses()) {
      console.log(`  Rede local (${name}): \x1b[36mhttp://${ip}:${PORT}\x1b[0m`);
    }
    console.log('  Abra o endereço da rede local no celular, conectado ao mesmo Wi-Fi.');
    console.log('  PWA/offline exigem HTTPS — em HTTP o app funciona, mas sem service worker.');
  }
  console.log(`  Pressione Ctrl+C para encerrar.\n`);
});
