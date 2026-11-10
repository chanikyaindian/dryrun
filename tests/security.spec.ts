import { expect, test, type Page } from '@playwright/test';
import { parseTrace } from '../js/engine/trace-boundary.js';

async function inspectOutput(page: Page, source: string) {
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.getByRole('textbox', { name: 'Python code' }).fill(source);
  await page.getByRole('complementary', { name: 'Run your Python' }).getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Playback step' })).toBeVisible({ timeout: 40000 });
  await page.getByRole('button', { name: 'Last step' }).click();
  await page.getByRole('tab', { name: 'Output' }).click();
}

test('the app has security headers and the sandbox blocks network and origin storage', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  const requests: string[] = [];
  await page.route('**/security-probe', route => {
    requests.push(route.request().url());
    return route.fulfill({ body: 'unexpected network access' });
  });
  const result = await page.evaluate(() => new Promise<string>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.sandbox.add('allow-scripts');
    frame.hidden = true;
    frame.src = '/python-runner.html';
    const { port1, port2 } = new MessageChannel();
    const timer = window.setTimeout(() => reject(Error('Security probe timed out')), 5000);
    port1.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        port1.postMessage({ id: 1, src: 'probe' });
        return;
      }
      clearTimeout(timer);
      frame.remove();
      port1.close();
      resolve(data.json);
    };
    frame.addEventListener('load', () => {
      frame.contentWindow!.postMessage('dryrun-init', '*', [port2]);
    }, { once: true });
    const target = location.origin + '/security-probe';
    port1.postMessage({
      wasm: new ArrayBuffer(0), stdlib: new ArrayBuffer(0), lock: new ArrayBuffer(0),
      script: `
        self.onmessage = () => {
          postMessage({ type: 'ready', version: '0.0.0' });
          self.onmessage = async ({ data: { id } }) => {
            const blocked = async action => { try { await action(); return false; } catch { return true; } };
            const denied = await Promise.all([
              blocked(() => fetch(${JSON.stringify(target)})),
              blocked(() => importScripts(${JSON.stringify(target)})),
              blocked(() => new Promise((resolve, reject) => {
                const request = indexedDB.open('sandbox-probe');
                request.onsuccess = resolve;
                request.onerror = reject;
              })),
              blocked(() => caches.open('sandbox-probe')),
            ]);
            postMessage({ type: 'result', id, json: JSON.stringify(denied) });
          };
        };
      `,
    });
    document.body.append(frame);
  }));
  expect(JSON.parse(result)).toEqual([true, true, true, true]);
  expect(requests).toEqual([]);
});

test('custom runs use a fresh sandbox and render hostile class names as text', async ({ page }) => {
  test.setTimeout(100000);
  await page.goto('/');
  await inspectOutput(page, `import random
random.dryrun_probe = True
Thing = type('<img src=x onerror=alert(1)>', (), {})
thing = Thing()
thing.value = 42
print(thing.value)`);
  await expect(page.locator('.output-block pre')).toHaveText('42');
  await expect(page.locator('#stage .hd').filter({ hasText: '<img src=x onerror=alert(1)>' })).toBeVisible();
  await expect(page.locator('#stage img')).toHaveCount(0);
  await expect(page.locator('iframe[title="Isolated Python runtime"]')).toHaveCount(0);

  await inspectOutput(page, `import random
import asyncio
await asyncio.sleep(0)
print(hasattr(random, 'dryrun_probe'))`);
  await expect(page.locator('.output-block pre')).toHaveText('False');
});

test('the app rejects a tampered Python runtime download', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js', route =>
    route.fulfill({ contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'throw Error("tampered");' }));
  await page.goto('/#write');
  await expect(page.getByText('Python unavailable', { exact: true })).toBeVisible({ timeout: 35000 });
  await expect(page.locator('iframe[title="Isolated Python runtime"]')).toHaveCount(0);
});

test('the trace boundary rejects malformed data and safely decodes valid snapshots', () => {
  const step = { l: 1, out: '', F: [{ n: '<module>', a: [], v: { number: { $: 'inf' } } }], H: {}, rd: [] };
  const encode = (item: unknown) => JSON.stringify({ steps: [item], evs: [], feat: [] });
  const trace = parseTrace(encode(step));
  expect(trace[0].F[0].v.number).toBe(Infinity);
  expect(Object.getPrototypeOf(trace[0].H)).toBeNull();
  expect(() => parseTrace(encode({ ...step, F: [] }))).toThrow('invalid or oversized');
  expect(() => parseTrace(encode({ ...step, H: { 1: { k: 'd', v: ['bad pair'] } } }))).toThrow('invalid or oversized');
  expect(() => parseTrace(encode({ ...step, F: [{ ...step.F[0], v: { broken: { r: 1 } } }] }))).toThrow('invalid or oversized');
});
