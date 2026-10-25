// Explicit, bounded production smoke test. Never run from CI or npm test.
import { chromium } from 'playwright-core';

if (!['--three-approved-cases', '--one-approved-case'].includes(process.argv[2])) {
  console.error('Run explicitly with --one-approved-case or --three-approved-cases; this makes live evaluations.');
  process.exit(2);
}
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
try {
  const page = await browser.newPage();
  await page.goto(process.env.SCOUTGUARD_SMOKE_ORIGIN || 'https://scoutguard.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const cases = (process.argv[2] === '--one-approved-case' ? [
    { id: 'eth', asset: 'ETH', amount: '0.1' }
  ] : [
    { id: 'eth', asset: 'ETH', amount: '0.1' },
    { id: 'usdc', asset: 'USDC', amount: '250' },
    { id: 'usdc-cap', asset: 'USDC', amount: '3000' }
  ]);
  for (const sample of cases) {
    const summary = await page.evaluate(async sample => {
      const from = '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be';
      const recipient = '0x3f8702cfb1662195fcc98593789682da91dfaae3';
      const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
      const raw = sample.asset === 'USDC' ? BigInt(sample.amount) * 1000000n : 0n;
      const candidate = sample.asset === 'ETH'
        ? { from, to: recipient, value: sample.amount, chainId: 1 }
        : { from, to: usdc, value: '0', chainId: 1,
          data: `0xa9059cbb${recipient.slice(2).padStart(64, '0')}${raw.toString(16).padStart(64, '0')}` };
      const response = await fetch('/api/evaluate/public', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate) });
      const data = await response.json();
      const result = data.evaluation;
      return { case: sample.id, httpStatus: response.status, source: data.source,
        mode: data.mode, decision: result?.decision, riskScore: result?.riskScore,
        policyVersion: result?.receipt?.policyVersion,
        evaluationAt: result?.receipt?.isoDate,
        history: result?.history?.coverage && { pagesScanned: result.history.coverage.pagesScanned,
          recordsInspected: result.history.coverage.recordsInspected,
          uniqueCounterparties: result.history.coverage.uniqueCounterparties,
          paginationComplete: result.history.coverage.paginationComplete,
          providerCalls: result.history.coverage.providerCalls,
          providerErrors: result.history.coverage.providerErrors,
          stopReasons: result.history.coverage.stopReasons },
        checks: result?.checks?.map(({ id, status }) => ({ id, status })),
        trace: result?.providerTrace,
        error: data.error };
    }, sample);
    console.log(JSON.stringify(summary));
  }
} finally {
  await browser.close();
}
