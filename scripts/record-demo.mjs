import { chromium } from 'playwright-core';
import { fork, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
const output = process.env.SCOUTGUARD_DEMO_OUTPUT || 'work/demo-recording';
await mkdir(`${output}/frames`, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || ['/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
if (!executablePath) throw new Error('CHROMIUM_PATH is required; no browser download is performed.');
const child = fork(new URL('./record-demo-server.ts', import.meta.url), [], { execArgv: ['--import', 'tsx'],
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, NODE_ENV: 'test', BLOCKSCOUT_API_KEY: '', SCOUTGUARD_SERVICE_KEY: '', VERCEL: '' } });
let terminal = ''; child.stderr.on('data', text => { terminal += text; });
const [{ url }] = await Promise.race([once(child, 'message'), once(child, 'exit').then(() => { throw new Error(terminal); })]);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const apiRequests = [], frames = [], writes = [];
let capturing = true, lastFrame = -1000;
try {
  await page.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
  page.on('request', request => {
    if (request.url().includes('/api/')) apiRequests.push(request.url().replace(url, ''));
  });
  await page.goto(url); await page.locator('#replay-player').waitFor({ state: 'visible' });
  const session = await page.context().newCDPSession(page);
  const start = performance.now();
  const initial = await page.screenshot({ type: 'jpeg', quality: 85 });
  await writeFile(`${output}/frames/frame-00000.jpg`, initial); frames.push({ file: 'frame-00000.jpg', time: 0 });
  session.on('Page.screencastFrame', frame => {
    session.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
    const now = performance.now() - start;
    if (!capturing || now - lastFrame < 1000 / 12) return;
    lastFrame = now;
    const file = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push({ file, time: now });
    writes.push(writeFile(`${output}/frames/${file}`, Buffer.from(frame.data, 'base64')));
  });
  await session.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 1280, maxHeight: 900 });
  async function at(second, action, label) {
    const wait = second * 1000 - (performance.now() - start);
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    await action(); console.log(`Captured ${second}s: ${label}`);
  }
  await at(7, () => page.locator('#evidence').scrollIntoViewIfNeeded(), 'live form, no fresh request');
  await at(16, () => page.locator('#recorded-replay').scrollIntoViewIfNeeded(), 'three recorded cases');
  await at(23, async () => { await page.locator('#replay-records button').nth(1).click(); await page.locator('#replay-stage').scrollIntoViewIfNeeded(); }, '250 USDC candidate');
  await at(31, () => page.locator('[data-replay-stage="1"]').click(), 'retained evidence');
  await at(40, async () => { await page.locator('[data-replay-stage="2"]').click(); await page.locator('.evidence-network-svg').scrollIntoViewIfNeeded(); }, 'two supported nodes');
  await at(50, async () => { await page.locator('.graph-edge-controls button').filter({ hasText: 'Observed' }).click(); await page.locator('.replay-graph-detail').scrollIntoViewIfNeeded(); }, 'historical event provenance');
  await at(60, async () => { await page.locator('.graph-node-controls button').nth(1).click(); await page.locator('.replay-graph-detail').scrollIntoViewIfNeeded(); }, 'recipient details');
  await at(68, async () => { await page.locator('#replay-records button').nth(2).click(); await page.locator('[data-replay-stage="3"]').click(); await page.locator('#replay-stage').scrollIntoViewIfNeeded(); }, 'recorded 3000 USDC cap and risk 75');
  await at(79, () => page.locator('[data-replay-stage="4"]').click(), 'recorded BLOCK outcome');
  await at(86, async () => { const wait = page.waitForEvent('download'); await page.locator('#replay-download').click(); await (await wait).saveAs(`${output}/sanitized-receipt-excerpt.json`); }, 'partial receipt excerpt download');
  await at(92, async () => { await page.locator('#tab-address-poisoning').click(); await page.locator('#verdict-badge').scrollIntoViewIfNeeded(); }, 'clearly labeled simulation');
  await at(98, async () => { await page.locator('#sdk').scrollIntoViewIfNeeded(); }, 'agent enforcement example');
  await at(100, async () => {}, 'end');
  capturing = false; await session.send('Page.stopScreencast'); await Promise.all(writes);
  const concat = frames.map((frame, i) => `file 'frames/${frame.file}'\nduration ${((frames[i + 1]?.time ?? 100000) - frame.time) / 1000}`).join('\n');
  await writeFile(`${output}/frames.ffconcat`, concat + `\nfile 'frames/${frames.at(-1).file}'\n`);
  if (apiRequests.some(path => path.startsWith('/api/evaluate'))) throw new Error('Recording unexpectedly requested a live evaluation');
  const segments = [
    [0,7,'ScoutGuard PRO · Local application walkthrough'],
    [7,16,'Fresh live checks are not run: this cloud cannot reach Blockscout.'],
    [16,31,'Three recorded production evaluations · proposed payments were never sent'],
    [31,40,'Retained historical evidence · exact original API times are unavailable'],
    [40,50,'Only two supported addresses · solid evidence and dashed proposed payment'],
    [50,60,'The token event sender differs from the transaction initiator.'],
    [60,68,'Observed activity is not verified trust.'],
    [68,79,'Recorded 3,000 USDC candidate · 2,500 USDC cap · 75 risk points'],
    [79,86,'Recorded BLOCK · no historical prevention or fresh authorization claimed'],
    [86,92,'Sanitized partial excerpt · SHA-256 is unkeyed, not a signature'],
    [92,98,'SIMULATED address-poisoning scenario · separate from live evidence'],
    [98,100,'Mock-agent harness: npm run demo:agent · no real signer or broadcast']
  ];
  const stamp = s => `00:${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')},000`;
  await writeFile(`${output}/captions.srt`, segments.map(([start,end,text],i)=>`${i+1}\n${stamp(start)} --> ${stamp(end)}\n${text}\n`).join('\n'));
  const args = ['-y','-loglevel','error','-f','concat','-safe','0','-i','frames.ffconcat','-vf','subtitles=captions.srt,fps=24','-t','100','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart','scoutguard-recorded-walkthrough.mp4'];
  const encoder = spawn('ffmpeg', args, { cwd: output, stdio: 'inherit' });
  if ((await once(encoder, 'exit'))[0] !== 0) throw new Error('Recording encoder failed');
  await writeFile(`${output}/recording.json`, JSON.stringify({ mode: 'LOCAL_APP_RECORDING', durationSeconds: 100, width: 1280, height: 900,
    audio: 'NONE; narration script provided separately', providerRequests: 0, actualBlockscoutChecks: 0,
    content: 'Unchanged recorded-live archive and explicitly labeled simulations; fresh live form not submitted', apiRequests,
    frames: frames.length, externalAssets: 'Blocked; local icons and font fallbacks used', file: 'scoutguard-recorded-walkthrough.mp4' }, null, 2));
  console.log('Actual 100-second local-app recording encoded. No live provider requests, wallet or broadcast.');
} finally { capturing = false; await browser.close(); child.kill('SIGTERM'); }
