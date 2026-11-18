#!/usr/bin/env node
/**
 * Build de produção alternativo (sem Vite/Rollup), usando o binário do esbuild
 * via CLI com stdio herdado. Útil em ambientes que bloqueiam pipes de processos.
 *
 *   node scripts/build-esbuild.mjs
 *
 * Gera dist/ com o app shell, assets com hash, manifest, ícones e sw.js.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, 'dist');
const OUT = join(DIST, 'assets');

function findEsbuild() {
  const candidates = [
    join(ROOT, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe'),
    join(ROOT, 'node_modules', '@esbuild', 'linux-x64', 'bin', 'esbuild'),
    join(ROOT, 'node_modules', '@esbuild', 'darwin-arm64', 'bin', 'esbuild'),
    join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  // Tenta o virtual store do pnpm
  const pnpmDir = join(ROOT, 'node_modules', '.pnpm');
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (!entry.startsWith('@esbuild+')) continue;
      const platform = entry.split('@')[1];
      const ext = platform.startsWith('win32') ? 'esbuild.exe' : 'bin/esbuild';
      const candidate = join(pnpmDir, entry, 'node_modules', '@esbuild', platform, ...ext.split('/'));
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const esbuild = findEsbuild();
if (!esbuild) {
  console.error('esbuild não encontrado. Rode o install antes.');
  process.exit(1);
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const args = [
  join(ROOT, 'src', 'main.tsx'),
  '--bundle',
  '--minify',
  '--format=esm',
  '--target=es2022',
  '--jsx=automatic',
  '--define:process.env.NODE_ENV="production"',
  '--outdir=' + OUT,
  '--entry-names=[name]-[hash]',
  '--asset-names=[name]-[hash]',
  '--public-path=./assets',
  '--log-level=warning',
  '--metafile=' + join(DIST, 'meta.json'),
  '--legal-comments=none',
];

const result = spawnSync(esbuild, args, { cwd: ROOT, stdio: 'inherit', shell: false });
if (result.status !== 0) {
  console.error('Falha no esbuild');
  process.exit(result.status ?? 1);
}

const files = readdirSync(OUT);
const js = files.find((file) => file.startsWith('main-') && file.endsWith('.js'));
const css = files.find((file) => file.startsWith('main-') && file.endsWith('.css'));
if (!js) {
  console.error('Bundle JS não gerado');
  process.exit(1);
}

// index.html de produção
const devHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const assetsTags = `    <link rel="stylesheet" href="./assets/${css ?? ''}" />\n    <script type="module" src="./assets/${js}"></script>\n`;
const prodHtml = devHtml
  .replace(/\s*<script type="module" src="\/src\/main\.tsx"><\/script>/, '')
  .replace('</head>', `${assetsTags}  </head>`);
writeFileSync(join(DIST, 'index.html'), prodHtml, 'utf8');

// arquivos públicos
cpSync(join(ROOT, 'public'), DIST, { recursive: true });

// service worker
function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(full);
  }
  return out;
}

const precache = walk(DIST)
  .filter((file) => !file.endsWith(`${sep}sw.js`) && !file.endsWith(`${sep}meta.json`))
  .map((file) => `./${relative(DIST, file).split(sep).join('/')}`)
  .sort();

const hasher = createHash('sha256');
for (const rel of precache) {
  hasher.update(rel);
  hasher.update(readFileSync(join(DIST, rel.replace(/^\.\//, ''))));
}
const version = hasher.digest('hex').slice(0, 10);

const swTemplate = readFileSync(join(ROOT, 'pwa', 'sw-template.js'), 'utf8');
const sw = swTemplate
  .replace('__CACHE_VERSION__', version)
  .replace('__PRECACHE_MANIFEST__', JSON.stringify(precache, null, 2))
  .replace('__BUILD_TIME__', new Date().toISOString());
writeFileSync(join(DIST, 'sw.js'), sw, 'utf8');
rmSync(join(DIST, 'meta.json'), { force: true });

const kb = (path) => (statSync(path).size / 1024).toFixed(1);
console.log(`\n  ✓ dist/index.html`);
console.log(`  ✓ assets/${js} (${kb(join(OUT, js))} kB)`);
if (css) console.log(`  ✓ assets/${css} (${kb(join(OUT, css))} kB)`);
console.log(`  ✓ sw.js (${precache.length} arquivos precacheados, versão ${version})`);
