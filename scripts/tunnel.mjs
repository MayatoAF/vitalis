#!/usr/bin/env node
/**
 * Cria uma URL HTTPS temporária para o Vitalis usando um quick tunnel do
 * Cloudflare — necessário para o Android permitir instalação e modo offline.
 *
 *   pnpm serve:lan    # em um terminal
 *   pnpm tunnel       # em outro
 *
 * Baixa o cloudflared automaticamente na primeira execução (tools/).
 * Sem conta Cloudflare; a URL muda a cada execução e não tem SLA.
 */
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PORT = Number(process.env.PORT || 5178);
const TOOLS = resolve(process.cwd(), 'tools');
const isWindows = process.platform === 'win32';
const exeName = isWindows ? 'cloudflared.exe' : 'cloudflared';
const exePath = join(TOOLS, exeName);

const DOWNLOAD = isWindows
  ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
  : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';

async function ensureCloudflared() {
  if (existsSync(exePath)) return;
  if (process.platform === 'darwin') {
    console.error('No macOS, instale o cloudflared com: brew install cloudflared');
    process.exit(1);
  }
  mkdirSync(TOOLS, { recursive: true });
  console.log('Baixando cloudflared (uma vez, ~55 MB)…');
  const response = await fetch(DOWNLOAD);
  if (!response.ok) throw new Error(`Download falhou: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(exePath, buffer);
  if (!isWindows) chmodSync(exePath, 0o755);
  console.log(`cloudflared salvo em ${exePath}`);
}

async function ensureServer() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    console.error(`\nO servidor não está respondendo em http://127.0.0.1:${PORT}`);
    console.error('Abra outro terminal e rode: pnpm serve:lan\n');
    process.exit(1);
  }
}

const main = async () => {
  await ensureServer();
  await ensureCloudflared();

  console.log(`\nAbrindo túnel HTTPS para http://127.0.0.1:${PORT} …\n`);
  const child = spawn(
    exePath,
    ['tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate', '--protocol', 'http2'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let announced = false;
  const handleOutput = (chunk) => {
    const text = chunk.toString();
    if (process.env.DEBUG_TUNNEL) process.stderr.write(text);
    if (announced) return;
    const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
    const match = clean.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!match) return;
    announced = true;
    console.log('─'.repeat(64));
    console.log(`  Vitalis em HTTPS:  ${match[0]}`);
    console.log('─'.repeat(64));
    console.log('  1. Abra essa URL no Chrome do Android.');
    console.log('  2. Aguarde o carregamento e o service worker ativar.');
    console.log('  3. Menu ⋮ → "Instalar app" (ou "Adicionar à tela inicial").');
    console.log('  4. Abra pelo ícone uma vez e teste em modo avião.');
    console.log('\n  Android exige HTTPS para instalar e funcionar offline.');
    console.log('  Os dados continuam apenas no aparelho. Ctrl+C encerra o túnel.\n');
  };

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);
  child.on('error', (error) => {
    console.error('Falha ao iniciar o cloudflared:', error.message);
    process.exit(1);
  });
  child.on('exit', (code) => {
    if (!announced) console.error('\nO túnel terminou sem divulgar uma URL. Verifique sua conexão.');
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    child.kill();
    process.exit(0);
  });

  setTimeout(() => {
    if (!announced) console.log('Ainda conectando ao Cloudflare… aguarde mais alguns segundos.');
  }, 15000);
};

main().catch((error) => {
  console.error('Erro:', error.message);
  process.exit(1);
});
