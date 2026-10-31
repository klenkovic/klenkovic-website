import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'astro';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { chromium } from '@playwright/test';

// Run against dist/, not the development server. A supplied public URL audits the live site.
const targetUrl = process.env.AUDIT_URL;
let server;
let chrome;
let failed = false;
try {
  if (!targetUrl) server = await preview({ server: { host: '127.0.0.1', port: 4330 }, logLevel: 'error' });
  const url = targetUrl || `http://127.0.0.1:${server.port}/`;
  chrome = await launch({ chromePath: process.env.CHROME_PATH || chromium.executablePath(), chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'], logLevel: 'silent' });
  await mkdir('reports/performance', { recursive: true });
  for (const device of ['mobile', 'desktop']) {
    const { default: desktopConfig } = await import('lighthouse/core/config/desktop-config.js');
    const result = await lighthouse(url, { port: chrome.port, logLevel: 'error', output: ['html', 'json'], onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] }, device === 'desktop' ? desktopConfig : undefined);
    if (!result || result.lhr.runtimeError) throw new Error(result?.lhr.runtimeError?.message || 'Audit did not complete');
    await writeFile(`reports/performance/${device}.html`, result.report[0]);
    await writeFile(`reports/performance/${device}.json`, result.report[1]);
    const scores = Object.fromEntries(Object.entries(result.lhr.categories).map(([name, category]) => [name, Math.round(category.score * 100)]));
    const metrics = Object.fromEntries(['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time'].map(name => [name, result.lhr.audits[name].displayValue]));
    console.log(JSON.stringify({ device, url, scores, metrics }));
    if (scores.performance < 90 || scores.accessibility < 95 || scores.seo < 95) failed = true;
  }
} finally {
  chrome?.kill();
  await server?.stop();
}
if (failed) process.exitCode = 1;
