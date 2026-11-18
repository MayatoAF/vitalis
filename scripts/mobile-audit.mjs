#!/usr/bin/env node
/**
 * Auditoria mobile: captura telas em 390×844, 360×740 e paisagem,
 * mede overflow horizontal, alvos de toque e erros de console.
 *
 *   node scripts/mobile-audit.mjs [url]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:5178';
const PORT = 9334;
const OUT = join(process.cwd(), 'mobile-audit');
const PROFILE = join(tmpdir(), `vitalis-mobile-${Date.now()}`);

mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const cleanup = () => {
  try {
    chrome.kill();
  } catch {
    /* ignore */
  }
};

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
      } else {
        for (const handler of this.events.get(message.method) ?? []) handler(message.params);
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = (this.id += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    const list = this.events.get(method) ?? [];
    list.push(handler);
    this.events.set(method, list);
  }

  once(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), timeout);
      const handler = (params) => {
        clearTimeout(timer);
        this.events.set(method, (this.events.get(method) ?? []).filter((fn) => fn !== handler));
        resolve(params);
      };
      this.on(method, handler);
    });
  }
}

async function debuggerUrl() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* subindo */
    }
    await sleep(200);
  }
  throw new Error('Chrome não respondeu');
}

const errors = [];
const checks = [];

const main = async () => {
  const cdp = new CDP(await debuggerUrl());
  await cdp.ready;
  cdp.on('Runtime.exceptionThrown', (params) => errors.push(params.exceptionDetails?.text ?? 'exception'));
  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') errors.push(params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  const evaluate = async (expression, awaitPromise = false) => {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise, userGesture: true });
    return result.result?.value;
  };
  const waitFor = async (expression, timeout = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(expression)) return true;
      await sleep(200);
    }
    return false;
  };
  const clickText = (text, selector = 'button') =>
    evaluate(`(() => {
      const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((node) => (node.textContent || '').trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
      if (!el) return 'NOT_FOUND';
      el.click();
      return 'OK';
    })()`);
  const clickQuick = (text) =>
    evaluate(`(() => {
      const el = [...document.querySelectorAll('.quick-action')].find((node) => (node.textContent || '').trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
      if (!el) return 'NOT_FOUND';
      el.click();
      return 'OK';
    })()`);
  const fill = (selector, value) =>
    evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return 'NOT_FOUND';
      const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'OK';
    })()`);
  const shot = async (name) => {
    const data = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data.data, 'base64'));
  };
  const viewport = async (width, height) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
    await sleep(600);
  };
  const metrics = async (label) => {
    const data = await evaluate(`(() => {
      const doc = document.documentElement;
      const small = [...document.querySelectorAll('button, a[href], input, select')]
        .map((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), tag: el.tagName, text: (el.textContent || '').trim().slice(0, 24) }; })
        .filter((item) => item.w > 0 && item.h > 0 && (item.h < 36 || item.w < 36));
      const clipped = [...document.querySelectorAll('*')]
        .filter((el) => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible')
        .slice(0, 6)
        .map((el) => el.className || el.tagName);
      return { overflowX: doc.scrollWidth - window.innerWidth, small: small.slice(0, 8), clipped };
    })()`);
    checks.push({ label, ...data });
    return data;
  };

  const url = `${BASE}/`;
  const loaded = cdp.once('Page.loadEventFired', 20000);
  await cdp.send('Page.navigate', { url });
  await loaded.catch(() => undefined);

  await viewport(390, 844);
  await waitFor(`!!document.querySelector('.onboarding__card')`);
  const reducedMotion = await evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`);
  const rafFrames = await evaluate(
    `new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const step = () => {
        frames += 1;
        if (performance.now() - start < 800) requestAnimationFrame(step);
        else resolve(frames);
      };
      requestAnimationFrame(step);
    })`,
    true,
  );
  console.log('prefers-reduced-motion:', reducedMotion, '| RAF em 800ms:', rafFrames);
  await shot('01-onboarding-390');

  await fill('#onb-name', 'Marina');
  await fill('#onb-birth', '1994-03-12');
  await clickText('Continuar');
  await sleep(500);
  await clickText('Continuar');
  await sleep(500);
  await clickText('Perder peso');
  await sleep(300);
  await clickText('Continuar');
  await sleep(600);
  await evaluate(`(() => { const el = document.querySelector('.onboarding__card input[type="checkbox"]'); if (el && !el.checked) el.click(); })()`);
  await clickText('Começar agora');
  await waitFor(`!!document.querySelector('.hero')`, 20000);
  await sleep(1800);
  await shot('02-hoje-390');
  console.log('hoje', await metrics('hoje-390'));

  const routes = ['nutrition', 'hydration', 'carbs', 'glucose', 'progress', 'settings'];
  for (const route of routes) {
    await evaluate(`location.hash = '#/${route}'`);
    await sleep(1200);
    await metrics(`${route}-390`);
    await shot(`03-${route}-390`);
  }

  // Sheet de refeição (categorias)
  await evaluate(`location.hash = '#/today'`);
  await sleep(900);
  await clickQuick('Refeição');
  await sleep(900);
  await shot('04-sheet-refeicao-390');
  await metrics('sheet-refeicao-390');
  const catRow = await evaluate(`(() => {
    const row = document.querySelector('.sheet .cat-row');
    if (!row) return null;
    const pills = [...row.querySelectorAll('.cat-pill')];
    const rowRect = row.getBoundingClientRect();
    const rows = new Map();
    for (const pill of pills) {
      const rect = pill.getBoundingClientRect();
      const key = Math.round(rect.top);
      rows.set(key, [...(rows.get(key) ?? []), rect]);
    }
    const centered = [...rows.values()].every((rects) => {
      const left = Math.min(...rects.map((rect) => rect.left));
      const right = Math.max(...rects.map((rect) => rect.right));
      return Math.abs((left + right) / 2 - (rowRect.left + rowRect.right) / 2) < 3;
    });
    return {
      count: pills.length,
      rowWidth: Math.round(rowRect.width),
      scrollWidth: row.scrollWidth,
      rows: rows.size,
      centered,
      justify: getComputedStyle(row).justifyContent,
      flexWrap: getComputedStyle(row).flexWrap,
    };
  })()`);
  console.log('cat-row', catRow);
  checks.push({ label: 'cat-row', ...catRow });

  // Fecha e abre "Mais"
  await evaluate(`document.querySelector('.sheet__close')?.click()`);
  await sleep(600);
  await evaluate(`document.querySelector('.bottom-nav button')?.click()`);
  await sleep(800);
  await shot('05-mais-390');
  await evaluate(`document.querySelector('.sheet__close')?.click()`);
  await sleep(700);

  // 360px
  await viewport(360, 740);
  for (const route of ['today', 'nutrition', 'carbs', 'glucose', 'progress', 'settings']) {
    await evaluate(`location.hash = '#/${route}'`);
    await sleep(1200);
    await metrics(`${route}-360`);
    await shot(`06-${route}-360`);
  }

  // Paisagem
  await viewport(844, 390);
  await evaluate(`location.hash = '#/today'`);
  await sleep(1400);
  await shot('07-hoje-paisagem');
  await metrics('hoje-paisagem');

  // Animação da glicemia: duas capturas separadas
  await viewport(390, 844);
  await evaluate(`location.hash = '#/glucose'`);
  await sleep(1500);
  await shot('08-glicemia-a');
  await sleep(1200);
  await shot('08-glicemia-b');

  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ checks, errors }, null, 2), 'utf8');
  console.log('\nErros de console:', errors);
  console.log('Overflows:', checks.filter((item) => item.overflowX > 0).map((item) => `${item.label}:${item.overflowX}`));
  const smallTargets = checks.flatMap((item) => (item.small ?? []).map((target) => `${item.label} ${target.tag} ${target.w}x${target.h} ${target.text}`));
  console.log('Alvos pequenos (amostra):', smallTargets.slice(0, 15));
  cleanup();
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  cleanup();
  process.exit(1);
});
