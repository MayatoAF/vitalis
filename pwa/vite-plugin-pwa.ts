import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

const SW_TEMPLATE = resolve(process.cwd(), 'pwa/sw-template.js');

function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, base));
    else out.push(full);
  }
  return out;
}

/**
 * Gera o service worker de produção com a lista exata de arquivos do build
 * (precache versionado por hash de conteúdo) — sem dependência de Workbox.
 */
export function vitalisPwa(): Plugin {
  let outDir = 'dist';
  let root = process.cwd();

  return {
    name: 'vitalis-pwa',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      root = config.root;
    },
    closeBundle() {
      const files = walk(outDir)
        .filter((f) => !f.endsWith(`${sep}sw.js`))
        .map((f) => `./${relative(outDir, f).split(sep).join('/')}`)
        .sort();

      const hasher = createHash('sha256');
      for (const rel of files) {
        hasher.update(rel);
        hasher.update(readFileSync(join(outDir, rel.replace(/^\.\//, ''))));
      }
      const version = hasher.digest('hex').slice(0, 10);

      const template = readFileSync(SW_TEMPLATE, 'utf8');
      const sw = template
        .replace('__CACHE_VERSION__', version)
        .replace('__PRECACHE_MANIFEST__', JSON.stringify(files, null, 2))
        .replace('__BUILD_TIME__', new Date().toISOString());

      writeFileSync(join(outDir, 'sw.js'), sw, 'utf8');
      // eslint-disable-next-line no-console
      console.log(`\n  \x1b[32m✓ PWA\x1b[0m service worker com ${files.length} arquivos precacheados (versão ${version})`);
    },
  };
}
