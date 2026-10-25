// Manual, one-request capture against a locally hosted API with a valid Blockscout key.
// Never run in CI. No credentials are written to the output files.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
if (process.argv[2] !== '--one-approved-capture' || !process.env.SCOUTGUARD_SMOKE_ORIGIN?.startsWith('http://localhost:')) {
  console.error('Set SCOUTGUARD_SMOKE_ORIGIN to a localhost server and pass --one-approved-capture.');
  process.exit(2);
}
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(process.env.SCOUTGUARD_SMOKE_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-live-case="observed"]').click();
  const response = page.waitForResponse(r => r.url().endsWith('/api/evaluate/public'));
  await page.locator('#live-submit').click();
  const data = await (await response).json();
  await page.locator('.live-intel-title').waitFor({ state: 'visible' });
  if (data.source !== 'BLOCKSCOUT_PRO' || !data.evaluation?.history?.coverage
    || !data.evaluation?.providerTrace?.length
    || data.evaluation.providerTrace.some(row => row.httpStatus !== 200 || row.errorCategory)) {
    throw new Error('The Blockscout trace was incomplete or failed; success capture refused.');
  }
  const evidence = data.evaluation;
  const summary = {
    mode: data.mode, source: data.source, evaluatedAt: evidence.receipt.isoDate,
    evaluationId: evidence.providerTrace[0].evaluationId, chainId: evidence.receipt.transactionSummary.chainId,
    candidate: evidence.receipt.transactionSummary,
    decision: evidence.decision, riskScore: evidence.riskScore,
    trace: evidence.providerTrace, observations: evidence.providerObservations,
    coverage: evidence.history?.coverage, checks: evidence.checks.map(({ id, name, status, scoreImpact, detail, evidenceUrl }) =>
      ({ id, name, status, scoreImpact, detail, evidenceUrl })),
    observedCounterparties: evidence.history?.counterparties,
    sampleHistoricalEvents: evidence.history?.evidence?.filter(row => row.relationship === 'OUTBOUND_ERC20' || row.relationship === 'OUTBOUND_NATIVE').slice(0, 3),
    receiptDigest: evidence.receipt.integrityHash,
    captureNote: 'Fresh local application evaluation using the configured Blockscout PRO key. The candidate was unsigned and not broadcast. Only a bounded history window was inspected.'
  };
  await mkdir('docs/images', { recursive: true });
  await mkdir('docs/evidence', { recursive: true });
  await writeFile('docs/evidence/2026-10-25-local-live-trace.json', JSON.stringify(summary, null, 2));
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('#live-intelligence').evaluate(node => window.scrollTo(0,
      node.getBoundingClientRect().top + window.scrollY - 110));
    await page.screenshot({ path: `docs/images/live-evidence-${width}.png`, fullPage: false, animations: 'disabled' });
  }
  await page.locator('.live-intel-graph').evaluate(node => window.scrollTo(0,
    node.getBoundingClientRect().top + window.scrollY - 110));
  await page.screenshot({ path: 'docs/images/live-relationships-390.png', fullPage: false, animations: 'disabled' });
  console.log(JSON.stringify({ source: summary.source, decision: summary.decision,
    traceCount: summary.trace.length, successful: summary.trace.filter(row => row.httpStatus === 200).length,
    rowsInspected: summary.coverage?.recordsInspected, images: ['live-evidence-1280.png', 'live-evidence-390.png'] }));
} finally {
  await browser.close();
}
