import { chromium } from 'playwright-core';
import { fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { once } from 'node:events';
const artifacts = process.env.SCOUTGUARD_BROWSER_ARTIFACTS || 'work/browser';
await mkdir(artifacts, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync);
if (!executablePath) throw new Error('Install a Chromium browser and set CHROMIUM_PATH; no browser was downloaded or test skipped.');
const child = fork(new URL('./browser-fixture-server.ts', import.meta.url), [], {
  execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_ENV: 'test', BLOCKSCOUT_API_KEY: '', VERCEL: '' }
});
let terminal = ''; child.stdout.on('data', text => { terminal += text; }); child.stderr.on('data', text => { terminal += text; });
const checks = [], consoleErrors = [], externalRequests = [], apiCalls = [];
let browser, healthyEvaluation;
async function check(name, task) {
  try { await task(); checks.push({ name, status: 'PASS' }); console.log('PASS', name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); throw error; }
}
try {
  const { url } = await Promise.race([once(child, 'message').then(([message]) => message), once(child, 'exit').then(() => { throw new Error(`Fixture server exited: ${terminal}`); }), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Fixture startup timeout')), 15000); timer.unref(); })]);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/')) apiCalls.push(request.url()); });
  await page.route('**/*', route => {
    const target = route.request().url();
    if (target.startsWith(url) || target.startsWith('blob:')) return route.continue();
    externalRequests.push(target); return route.abort();
  });
  await check('homepage, local icons and SDK initialize with external resources blocked', async () => {
    await page.goto(url);
    await page.locator('#replay-player').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#replay-records button').count(), 3);
    assert.match(await page.locator('#sdk-code').innerText(), /runPaymentAgent/);
    assert.equal(await page.locator('script[src*="unpkg"]').count(), 0);
    assert.deepEqual(consoleErrors, []);
  });
  const complete = async () => { await fetch(url + '/__fixture/provider', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'complete' }) }); };
  async function candidate(preset, expected) {
    await page.locator(`[data-live-case="${preset}"]`).click();
    const response = page.waitForResponse(r => r.url().endsWith('/api/evaluate/public'));
    await page.locator('#live-submit').click();
    const body = await (await response).json();
    await page.waitForFunction(expected => document.querySelector('#live-result-badge').textContent.endsWith(expected) && !document.querySelector('#live-submit').disabled, expected);
    assert.equal(body.evaluation.decision, expected);
    return body;
  }
  await check('ETH form → HTTP → engine → exact recipient, coverage and PASS (fixture)', async () => {
    await complete(); const body = await candidate('observed', 'PASS'); healthyEvaluation = structuredClone(body);
    assert.match(await page.locator('#live-payment').innerText(), /0\.1 ETH/);
    assert.equal(body.evaluation.receipt.transactionSummary.rawAmount, '100000000000000000');
    assert.match(await page.locator('#live-coverage').innerText(), /Pagination completed/);
    assert.equal(await page.locator('#live-links a').count(), 2);
  });
  await check('USDC form → ABI recipient/amount → canonical contract check → PASS (fixture)', async () => {
    const body = await candidate('usdc', 'PASS');
    assert.equal(body.evaluation.receipt.transactionSummary.rawAmount, '250000000');
    assert.equal(body.evaluation.receipt.transactionSummary.transactionTo.toLowerCase(), '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
    assert.match(await page.locator('#live-payment').innerText(), /250\.0 USDC/);
    assert.equal(await page.locator('#live-links a').count(), 3);
  });
  await check('above-cap canonical USDC displays policy BLOCK (fixture)', async () => {
    const body = await candidate('cap', 'BLOCK');
    assert.ok(body.evaluation.checks.some(check => check.id === 'SEC-POLICY-CAP' && check.status === 'FAIL'));
  });
  await check('partial history cannot render an automatic-payment PASS', async () => {
    await fetch(url + '/__fixture/provider', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'partial' }) });
    await candidate('observed', 'FLAG');
    assert.match(await page.locator('#live-coverage').innerText(), /Incomplete coverage/);
    assert.match(await page.locator('#live-checks').innerText(), /Historical Coverage Requires Review/);
    await complete();
  });
  await check('invalid candidate displays a helpful error without API work', async () => {
    const before = apiCalls.length;
    await page.locator('#live-to').fill('invalid'); await page.locator('#live-submit').click();
    await page.locator('#live-error').waitFor({ state: 'visible' });
    assert.match(await page.locator('#live-error').innerText(), /valid 0x/);
    assert.equal(apiCalls.length, before);
  });
  await check('provider outage displays fail-closed BLOCK and no fabricated evidence links', async () => {
    await fetch(url + '/__fixture/provider', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'unavailable' }) });
    await candidate('observed', 'BLOCK');
    assert.match(await page.locator('#live-checks').innerText(), /Fail-Closed/);
    assert.equal(await page.locator('#live-links a').count(), 0);
    await complete();
  });
  await check('HTTP 429 is visible and the submit control recovers', async () => {
    await page.route('**/api/evaluate/public', route => route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"Public live-check limit reached"}' }));
    await page.locator('#live-submit').click();
    await page.waitForFunction(() => document.querySelector('#live-error').textContent.includes('limit reached') && !document.querySelector('#live-submit').disabled);
    await page.unroute('**/api/evaluate/public');
  });
  await check('legacy or incomplete-PASS API responses cannot display a fresh approval', async () => {
    const valid = structuredClone(healthyEvaluation);
    for (const legacy of [true, false]) {
      const modified = structuredClone(valid);
      if (legacy) modified.evaluation.receipt.policyVersion = 'v1.2.0-blockscout-pro';
      else modified.evaluation.history.coverage.paginationComplete = false;
      await page.route('**/api/evaluate/public', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(modified) }));
      await page.locator('#live-submit').click();
      await page.locator('#live-error').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#live-result').isVisible(), false);
      assert.match(await page.locator('#live-error').innerText(), legacy ? /Unsupported API receipt/ : /Incomplete history/);
      await page.unroute('**/api/evaluate/public');
    }
  });
  const apiBeforeReplay = apiCalls.length;
  await check('all three recorded decisions and five stages render without new evaluations', async () => {
    for (const [index, verdict] of ['PASS', 'PASS', 'BLOCK'].entries()) {
      await page.locator('#replay-records button').nth(index).click();
      for (let stage = 0; stage < 5; stage++) {
        await page.locator(`[data-replay-stage="${stage}"]`).click();
        assert.equal(await page.locator('#replay-progress').getAttribute('value'), String(stage + 1));
        assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-replay-stage'), String(stage));
      }
      assert.match(await page.locator('#replay-stage').innerText(), new RegExp(verdict));
    }
    assert.equal(apiCalls.length, apiBeforeReplay);
  });
  await check('SVG graph has exactly two supported nodes, distinct observed/proposed edges and provenance', async () => {
    await page.locator('[data-replay-stage="2"]').click();
    assert.equal(await page.locator('.graph-address').count(), 2);
    assert.equal(await page.locator('.graph-edge.observed').count(), 1);
    assert.equal(await page.locator('.graph-edge.proposed').count(), 1);
    await page.locator('.graph-edge-controls button').filter({ hasText: 'Observed' }).click();
    const link = page.locator('.replay-graph-detail a');
    assert.equal(await link.getAttribute('href'), 'https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f');
    assert.match(await page.locator('.replay-graph-detail').innerText(), /initiator/);
    await page.locator('.graph-edge-controls button').filter({ hasText: 'Proposed' }).click();
    assert.match(await page.locator('.replay-graph-detail').innerText(), /No transaction hash/);
  });
  await check('graph supports keyboard selection and arrow-key navigation', async () => {
    const node = page.locator('.graph-address').first(); await node.focus(); await page.keyboard.press('Enter');
    assert.equal(await node.getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.graph-address').nth(1).getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.replay-graph-detail').innerText(), /0x3f8702/);
  });
  await check('play/pause/restart/previous/next, speed and final progress work', async () => {
    await page.locator('#replay-restart').click();
    await page.locator('#replay-speed').selectOption('2');
    await page.locator('#replay-play').click(); await page.locator('#replay-pause').click();
    assert.equal(await page.locator('#replay-pause').isDisabled(), true);
    await page.locator('#replay-next').click(); await page.locator('#replay-previous').click();
    assert.equal(await page.locator('#replay-progress').getAttribute('value'), '1');
    await page.locator('#replay-play').click();
    await page.waitForFunction(() => document.querySelector('#replay-progress').value === 5, undefined, { timeout: 12000 });
    assert.equal(await page.locator('#replay-next').isDisabled(), true);
    assert.equal(await page.locator('#replay-play').isDisabled(), true);
  });
  await check('sanitized receipt download preserves partial provenance and missing original fields', async () => {
    const download = page.waitForEvent('download'); await page.locator('#replay-download').click();
    const file = await download; await file.saveAs(`${artifacts}/receipt-excerpt.json`);
    const excerpt = JSON.parse(await readFile(`${artifacts}/receipt-excerpt.json`, 'utf8'));
    assert.equal(excerpt.kind, 'SANITIZED_RECEIPT_EXCERPT');
    assert.equal(excerpt.receipt.receiptId, null); assert.equal(excerpt.exactEvaluationTime, null);
    assert.equal(excerpt.completeness, 'PARTIAL_TRANSCRIPTION_NOT_ORIGINAL_API_RECEIPT');
  });
  await check('research replay stays conditional and distinct from live and recorded-live', async () => {
    await page.locator('#research-replay').click();
    await page.waitForFunction(() => document.querySelector('#research-verdict').textContent.includes('RECORDED_RESEARCH_REPLAY'));
    assert.match(await page.locator('#research-limitation').innerText(), /not a live detection/);
  });
  await check('all five simulations keep SIMULATED labels and expected decisions', async () => {
    const scenarios = [['legitimate-vendor', 'PASS'], ['address-poisoning', 'BLOCK'], ['unverified-contract', 'FLAG'], ['malicious-phishing', 'BLOCK'], ['spending-cap-breach', 'BLOCK']];
    for (const [id, decision] of scenarios) {
      await page.locator(`#tab-${id}`).click();
      await page.waitForFunction(expected => document.querySelector('#verdict-badge').textContent === `SIMULATED · ${expected}`, decision);
    }
  });
  for (const width of [320, 390, 768, 1280]) await check(`layout at ${width}px has no horizontal overflow and graph remains usable`, async () => {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('[data-replay-stage="2"]').click();
    const layout = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth,
      outside: [...document.querySelectorAll('.site-header a, #live-from, #live-to, #live-submit, .graph-node-controls button, #replay-download')].filter(node => { const r = node.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(node => node.id || node.className) }));
    if (layout.scroll > width) {
      layout.allOutside = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(node => { const r = node.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(node => ({tag:node.tagName,id:node.id,cls:String(node.className).slice(0,90),right:node.getBoundingClientRect().right,left:node.getBoundingClientRect().left,text:node.textContent.slice(0,40)})).slice(0,30));
    }
    assert.ok(layout.scroll <= width, JSON.stringify(layout)); assert.deepEqual(layout.outside, []);
    const buttons = await page.locator('.graph-node-controls button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    assert.ok(buttons.every(height => height >= 44));
    await page.screenshot({ path: `${artifacts}/graph-${width}.png`, fullPage: false, animations: 'disabled' });
  });
  await check('mobile ETH and USDC interactions stay usable', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await complete(); await candidate('observed', 'PASS'); await candidate('usdc', 'PASS');
    assert.equal(await page.locator('#live-submit').isEnabled(), true);
  });
  await check('reduced motion removes graph/stage animation without disabling manual controls', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#replay-restart').click(); await page.locator('[data-replay-stage="2"]').click();
    assert.equal(await page.locator('#replay-stage').evaluate(node => getComputedStyle(node).animationName), 'none');
    assert.equal(await page.locator('.graph-edge-line').first().evaluate(node => getComputedStyle(node).animationName), 'none');
  });
  await check('tampered archive fails closed without displaying a recorded verdict', async () => {
    const archived = JSON.parse(await readFile(new URL('../public/replay/records.json', import.meta.url), 'utf8'));
    archived.records[2].result.decision = 'PASS';
    await page.route('**/replay/records.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(archived) }));
    await page.reload(); await page.locator('#replay-error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#replay-player').isVisible(), false);
    await page.unroute('**/replay/records.json');
  });
  await check('unavailable archive displays a missing-evidence error, not a stale verdict', async () => {
    await page.route('**/replay/records.json', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.reload(); await page.locator('#replay-error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#replay-player').isVisible(), false);
    assert.match(await page.locator('#replay-error').innerText(), /archive unavailable/);
    await page.unroute('**/replay/records.json');
  });
  await check('no browser runtime exceptions and no external API/provider calls', async () => {
    assert.deepEqual(consoleErrors, []);
    assert.ok(externalRequests.every(url => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)));
  });
} catch (error) { console.error(error); process.exitCode = 1; }
finally {
  await browser?.close(); child.kill('SIGTERM');
  await writeFile(`${artifacts}/results.json`, JSON.stringify({ mode: 'LOCAL_FIXTURE_BROWSER_VERIFICATION', checks,
    pass: checks.filter(check => check.status === 'PASS').length, fail: checks.filter(check => check.status === 'FAIL').length,
    consoleErrors, externalRequests, actualBlockscoutChecks: 0, terminal }, null, 2));
}
