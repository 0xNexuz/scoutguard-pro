// Captures the UI only. The homepage load does not submit a live evaluation.
import { chromium } from 'playwright-core';
if (!process.env.SCOUTGUARD_SMOKE_ORIGIN?.startsWith('http://localhost:')) throw new Error('Set a localhost SCOUTGUARD_SMOKE_ORIGIN');
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let evaluations = 0;
  page.on('request', request => { if (request.url().includes('/api/evaluate/')) evaluations++; });
  await page.goto(process.env.SCOUTGUARD_SMOKE_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.locator('#page-title').waitFor({ state: 'visible' });
  if (evaluations) throw new Error('Unexpected live provider evaluation while capturing the homepage');
  await page.screenshot({ path: 'docs/images/sprint2-home.png', animations: 'disabled' });
  console.log('Homepage captured without a live evaluation.');
} finally {
  await browser.close();
}
