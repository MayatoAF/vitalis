#!/usr/bin/env node
/**
 * Verificação E2E do build servido, via Chrome DevTools Protocol (sem dependências).
 *
 *   node scripts/verify.mjs [url]
 *
 * Percorre onboarding, telas, interações, persistência e modo offline,
 * salvando screenshots em verification/ e um relatório em verification/report.json.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = (process.argv[2] || 'http://127.0.0.1:5178').replace(/\/+$/, '');
const DEBUG_PORT = 9333;
const LAN_ONLY = process.env.LAN_ONLY === '1';
const OUT_DIR = join(process.cwd(), process.env.VERIFY_OUT || 'verification');
const PROFILE_DIR = join(tmpdir(), `vitalis-verify-${Date.now()}`);

mkdirSync(OUT_DIR, { recursive: true });
rmSync(PROFILE_DIR, { recursive: true, force: true });

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--window-size=1440,920',
    'about:blank',
  ],
  { stdio: 'ignore', detached: false },
);

const cleanup = () => {
  try {
    chrome.kill();
  } catch {
    /* ignore */
  }
  try {
    rmSync(PROFILE_DIR, { recursive: true, force: true, maxRetries: 2, retryDelay: 150 });
  } catch {
    /* o perfil temporário pode ficar bloqueado pelo Chrome */
  }
};
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

async function waitForDebugger() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* ainda subindo */
    }
    await sleep(200);
  }
  throw new Error('Chrome DevTools não respondeu');
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (event) => reject(new Error(`WS error: ${event.message ?? 'unknown'}`)));
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
        else entry.resolve(message.result);
        return;
      }
      const handlers = this.handlers.get(message.method) ?? [];
      for (const handler of handlers) handler(message.params);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = (this.nextId += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    const list = this.handlers.get(method) ?? [];
    list.push(handler);
    this.handlers.set(method, list);
  }

  once(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout esperando ${method}`)), timeout);
      const handler = (params) => {
        clearTimeout(timer);
        const list = this.handlers.get(method) ?? [];
        this.handlers.set(
          method,
          list.filter((item) => item !== handler),
        );
        resolve(params);
      };
      this.on(method, handler);
    });
  }
}

const report = {
  url: BASE,
  startedAt: new Date().toISOString(),
  consoleErrors: [],
  exceptions: [],
  failedRequests: [],
  checks: [],
  screenshots: [],
};

const check = (name, ok, detail = '') => {
  report.checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return Boolean(ok);
};

const main = async () => {
  const wsUrl = await waitForDebugger();
  const cdp = new CDP(wsUrl);
  await cdp.ready;

  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type !== 'error') return;
    const text = params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ');
    report.consoleErrors.push(text);
  });
  cdp.on('Runtime.exceptionThrown', (params) => {
    report.exceptions.push(params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text ?? 'erro');
  });
  cdp.on('Network.loadingFailed', (params) => {
    if (params.errorText === 'net::ERR_ABORTED') return;
    report.failedRequests.push(`${params.errorText} ${params.type}`);
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: "window.__vitalisBip = false; window.addEventListener('beforeinstallprompt', () => { window.__vitalisBip = true; });",
  });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  const evaluate = async (expression, awaitPromise = false) => {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? 'erro na avaliação');
    }
    return result.result?.value;
  };

  const waitFor = async (expression, timeout = 15000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await evaluate(expression)) return true;
      } catch {
        /* contexto ainda carregando */
      }
      await sleep(200);
    }
    return false;
  };

  const screenshot = async (name) => {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const file = join(OUT_DIR, `${name}.png`);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    report.screenshots.push(name);
    return name;
  };

  const clickText = async (text, selector = 'button') =>
    evaluate(`(() => {
      const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const el = nodes.find((node) => (node.textContent || '').trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
      if (!el) return 'NOT_FOUND';
      el.click();
      return 'OK';
    })()`);

  const clickQuick = async (text) =>
    evaluate(`(() => {
      const nodes = [...document.querySelectorAll('.quick-action')];
      const el = nodes.find((node) => (node.textContent || '').trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
      if (!el) return 'NOT_FOUND';
      el.click();
      return 'OK';
    })()`);

  const waterValue = async () => evaluate(`document.querySelector('.kpi--cyan .kpi__value')?.innerText?.replace(/\\n/g, ' ') ?? ''`);
  const lastToast = async () => evaluate(`(() => { const list = [...document.querySelectorAll('.toast')]; return list.length ? list[list.length - 1].innerText : ''; })()`);

  const fill = async (selector, value) =>
    evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return 'NOT_FOUND';
      const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'OK';
    })()`);

  const goto = async (url) => {
    const loaded = cdp.once('Page.loadEventFired', 20000);
    await cdp.send('Page.navigate', { url });
    await loaded.catch(() => undefined);
    await sleep(900);
  };

  console.log(`\nVitalis — verificação E2E em ${BASE}\n`);

  // 1. Onboarding
  await goto(BASE);
  const onboardingVisible = await waitFor(`!!document.querySelector('.onboarding__card')`);
  check('Onboarding renderiza', onboardingVisible);
  await screenshot('01-onboarding');

  await fill('#onb-name', 'Marina');
  await fill('#onb-birth', '1994-03-12');
  await clickText('Continuar');
  await sleep(600);
  check('Etapa 2 do onboarding', await waitFor(`!!document.querySelector('#onb-height')`));
  await screenshot('02-onboarding-metas');

  await clickText('Continuar');
  await sleep(500);
  await clickText('Perder peso');
  await fill('#onb-rate', '0.4');
  await sleep(300);
  await clickText('Continuar');
  await sleep(600);
  check('Etapa final com resumo de metas', await waitFor(`document.body.innerText.includes('Começar agora')`));
  await screenshot('03-onboarding-resumo');

  // Ativa dados de demonstração para popular a interface
  const toggled = await evaluate(`(() => {
    const el = document.querySelector('.onboarding__card input[type="checkbox"]');
    if (!el) return 'NOT_FOUND';
    if (!el.checked) el.click();
    return el.checked ? 'OK' : 'UNCHECKED';
  })()`);
  check('Checkbox de demonstração marcado', toggled === 'OK', String(toggled));
  await clickText('Começar agora');

  const dashboardReady = await waitFor(`!!document.querySelector('.hero') && document.querySelectorAll('.kpi').length >= 4`, 20000);
  check('Dashboard carrega após onboarding', dashboardReady);
  await sleep(1600);
  await screenshot('04-dashboard');

  const kpiText = await evaluate(`document.querySelector('.kpi')?.innerText ?? ''`);
  check('KPIs com dados de demonstração', /\d/.test(kpiText), kpiText.replace(/\n/g, ' | ').slice(0, 90));

  const canvasCount = await evaluate(`document.querySelectorAll('canvas').length`);
  check('Canvas three.js no hero', canvasCount >= 1, `${canvasCount} canvas`);
  const webglOk = await evaluate(`(() => {
    const canvas = document.querySelector('.hero__canvas canvas');
    if (!canvas) return 'SEM_CANVAS';
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return gl ? 'WEBGL_OK' : 'SEM_CONTEXTO';
  })()`);
  check('Contexto WebGL ativo', webglOk === 'WEBGL_OK', String(webglOk));

  // 2. Adicionar água (aguarda o toast da demonstração sumir)
  await waitFor(`!document.querySelector('.toast')`, 8000);
  const before = await waterValue();
  const waterClick = await clickQuick('+ 250 ml');
  check('Atalho de água encontrado', waterClick === 'OK', String(waterClick));
  await sleep(1200);
  const toastVisible = await lastToast();
  check('Registro rápido de água', /250/.test(toastVisible), toastVisible.trim().replace(/\n/g, ' '));
  const after = await waterValue();
  check('Água atualizada na interface', before !== after, `${before} -> ${after}`);

  // 3. Glicemia
  await clickQuick('Glicemia');
  await sleep(900);
  const sheetOpen = await waitFor(`!!document.querySelector('.sheet')`);
  check('Sheet de glicemia abre', sheetOpen);
  await fill('#glucose-note', 'verificação automatizada');
  await evaluate(`(() => { const input = document.querySelector('.sheet input[type="number"]'); if (!input) return; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, '142'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(300);
  await clickText('Salvar leitura', '.sheet button');
  await sleep(1200);
  const glucoseLogged = await evaluate(`document.body.innerText.includes('142')`);
  check('Leitura de glicemia salva', glucoseLogged);

  // 4. Refeição
  await waitFor(`!document.querySelector('.sheet')`, 5000);
  await clickQuick('Refeição');
  await sleep(900);
  check('Sheet de refeição abre', await waitFor(`!!document.querySelector('.sheet input[type="search"]')`));
  await fill('.sheet input[type="search"]', 'banana');
  await sleep(600);
  const foodRows = await evaluate(`document.querySelectorAll('.food-row').length`);
  check('Busca de alimentos retorna resultados', foodRows > 0, `${foodRows} itens`);
  await evaluate(`document.querySelector('.food-row')?.click()`);
  await sleep(600);
  const cartCount = await evaluate(`document.querySelectorAll('.cart-item').length`);
  check('Item adicionado à refeição', cartCount === 1, `${cartCount} item`);
  await screenshot('05-sheet-refeicao');
  await clickText('Adicionar (', '.sheet button');
  await sleep(1400);
  const mealToast = await lastToast();
  check('Refeição registrada', mealToast.toLowerCase().includes('refeição'), mealToast.trim().replace(/\n/g, ' '));

  // 5. Navegação pelas telas
  const routes = [
    ['nutrition', '06-nutricao'],
    ['hydration', '07-hidratacao'],
    ['carbs', '08-carboidratos'],
    ['glucose', '09-glicemia'],
    ['progress', '10-progresso'],
    ['settings', '11-ajustes'],
  ];
  for (const [route, name] of routes) {
    await evaluate(`location.hash = '#/${route}'`);
    await sleep(1200);
    const ok = await evaluate(`!!document.querySelector('.page-head')`);
    check(`Tela ${route} renderiza`, ok);
    await screenshot(name);
  }

  const screensWithCanvas = await evaluate(`document.querySelectorAll('canvas').length`);
  check('Cena three.js na tela de ajustes (nenhuma esperada)', screensWithCanvas === 0, `${screensWithCanvas} canvas`);

  // 6. Persistência após recarregar
  await goto(`${BASE}/#/today`);
  const persisted = await waitFor(`!!document.querySelector('.hero')`, 15000);
  check('Dados persistem após reload', persisted);
  const profilePersisted = await evaluate(`document.body.innerText.includes('Marina')`);
  check('Perfil salvo no IndexedDB', profilePersisted);

  if (!LAN_ONLY) {
    // 7. Service worker
    await sleep(2500);
    const swState = await evaluate(
      `navigator.serviceWorker.getRegistration().then(async (reg) => {
        if (!reg) return 'SEM_REGISTRO';
        const keys = await caches.keys();
        const names = keys.filter((key) => key.startsWith('vitalis-precache-'));
        const cache = await caches.open(names[0]);
        const entries = await cache.keys();
        return JSON.stringify({ scope: reg.scope, active: !!reg.active, keys: names, entries: entries.length });
      })`,
      true,
    );
    let swInfo = {};
    try {
      swInfo = JSON.parse(swState);
    } catch {
      swInfo = { raw: swState };
    }
    check('Service worker ativo', Boolean(swInfo.active), String(swState).slice(0, 140));
    check('Precache do app shell', (swInfo.entries ?? 0) >= 5, `${swInfo.entries ?? 0} entradas`);
    const expectedScope = new URL('./', `${BASE}/`).href;
    check('Escopo do service worker correto', swInfo.scope === expectedScope, `${swInfo.scope} (esperado ${expectedScope})`);

    // 7.1 Instalabilidade (Android/Chrome)
    const secureContext = await evaluate('window.isSecureContext');
    check('Contexto seguro (HTTPS)', secureContext === true, `isSecureContext=${secureContext}`);
    let manifestData = {};
    try {
      const manifest = await cdp.send('Page.getAppManifest');
      manifestData = JSON.parse(manifest.data || '{}');
      const manifestErrors = manifest.errors ?? [];
      check('Manifest sem erros', manifestErrors.length === 0, manifestErrors.map((item) => item.message ?? item.critical).join(' | ').slice(0, 160));
      check('Manifest com nome, start_url e ícones', Boolean(manifestData.name) && Boolean(manifestData.start_url) && (manifestData.icons?.length ?? 0) >= 2, `${manifestData.name ?? '?'} · ${manifestData.icons?.length ?? 0} ícones`);
    } catch (error) {
      check('Manifest acessível', false, error instanceof Error ? error.message : 'erro');
    }
    try {
      const installability = await cdp.send('Page.getInstallabilityErrors');
      const installErrors = installability.installabilityErrors ?? [];
      check('Critérios de instalação atendidos', installErrors.length === 0, installErrors.map((item) => item.errorId).join(', ').slice(0, 160));
    } catch (error) {
      check('Critérios de instalação atendidos', false, error instanceof Error ? error.message : 'erro');
    }
    const bip = await evaluate('window.__vitalisBip === true');
    report.beforeInstallPrompt = bip;
    if (!bip) console.log('  INFO  beforeinstallprompt não disparou no headless (o menu Instalar ainda pode estar disponível)');

    // 8. Offline
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    const loaded = cdp.once('Page.loadEventFired', 20000);
    await cdp.send('Page.reload', { ignoreCache: false });
    await loaded.catch(() => undefined);
    await sleep(2200);
    const offlineHero = await waitFor(`!!document.querySelector('.hero')`, 12000);
    const offlineBadge = await evaluate(`document.body.innerText.includes('Offline')`);
    check('App abre offline pelo service worker', offlineHero);
    check('Indicador de offline visível', offlineBadge);
    await screenshot('12-offline');

    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  } else {
    const swAvailable = await evaluate(`'serviceWorker' in navigator`);
    check('HTTP na rede: sem service worker (esperado)', !swAvailable, `serviceWorker=${swAvailable}`);
    check('App segue funcional sem contexto seguro', await evaluate(`!!document.querySelector('.hero')`));
  }

  // 9. Versão mobile
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await goto(`${BASE}/#/today`);
  await waitFor(`!!document.querySelector('.hero')`, 15000);
  await sleep(1600);
  const bottomNavVisible = await evaluate(`(() => { const el = document.querySelector('.bottom-nav'); return el ? getComputedStyle(el).display !== 'none' : false; })()`);
  check('Navegação inferior no mobile', bottomNavVisible);
  await screenshot('13-mobile-hoje');

  await evaluate(`location.hash = '#/glucose'`);
  await sleep(1400);
  await screenshot('14-mobile-glicemia');

  const mobileOverflow = await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 2`);
  check('Sem overflow horizontal no mobile', mobileOverflow);

  // 10. Tema claro
  await evaluate(`location.hash = '#/settings'`);
  await sleep(900);
  await evaluate(`(() => { const buttons = [...document.querySelectorAll('.theme-toggle button')]; buttons[1]?.click(); })()`);
  await sleep(800);
  const theme = await evaluate(`document.documentElement.dataset.theme`);
  check('Tema claro aplicado', theme === 'light', String(theme));
  await evaluate(`location.hash = '#/today'`);
  await sleep(1500);
  await screenshot('15-mobile-tema-claro');

  // Relatório
  const relevantErrors = report.consoleErrors.filter(
    (text) => !text.includes('Download the React DevTools') && !text.includes('WebGL') && !text.toLowerCase().includes('warning'),
  );
  check('Sem erros de console', relevantErrors.length === 0, relevantErrors.slice(0, 3).join(' | '));
  check('Sem exceções não tratadas', report.exceptions.length === 0, report.exceptions.slice(0, 2).join(' | '));

  report.finishedAt = new Date().toISOString();
  report.passed = report.checks.filter((item) => item.ok).length;
  report.total = report.checks.length;
  writeFileSync(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log(`\n${report.passed}/${report.total} verificações aprovadas`);
  if (report.consoleErrors.length) console.log('Console errors:', report.consoleErrors.slice(0, 5));
  if (report.exceptions.length) console.log('Exceptions:', report.exceptions.slice(0, 5));
  console.log(`Screenshots: ${report.screenshots.length} em ${OUT_DIR}/\n`);

  cleanup();
  process.exit(report.passed === report.total ? 0 : 1);
};

main().catch((error) => {
  console.error('Falha na verificação:', error);
  cleanup();
  process.exit(1);
});
