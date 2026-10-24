/** Test-only loopback server. Never deploy: all provider methods below are synthetic. */
import express from 'express';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/index.js';
import { ScoutGuard } from '../src/core/scoutguard.js';
import { ProviderError } from '../src/core/provider-budget.js';
import { completeHistory, fixtureClient } from '../test/fixtures/blockscout.js';
process.env.SCOUTGUARD_SERVICE_KEY = 'isolated-fixture-service-key';
let mode = 'complete';
const client = fixtureClient();
client.getAddressCounters = async () => {
  if (mode === 'unavailable') throw new ProviderError('HTTP_503');
  return { transactionsCount: 142, tokenTransfersCount: 25, gasUsageCount: 0, isContract: false };
};
client.getSenderHistory = async (chainId, sender) => completeHistory({ chainId, sender: sender.toLowerCase(),
  fetchedAt: new Date().toISOString(), paginationComplete: mode !== 'partial', truncated: mode === 'partial',
  stopReasons: mode === 'partial' ? ['PAGE_LIMIT'] : [] });
const app = express();
app.use(express.json({ limit: '1kb' }));
app.post('/__fixture/provider', (req, res) => {
  if (!['complete', 'partial', 'unavailable'].includes(req.body?.mode)) return res.sendStatus(400);
  mode = req.body.mode; res.json({ mode, fixture: true });
});
app.get('/', (_req, res) => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  res.type('html').send(html.replace('<main ', '<aside style="padding:8px;text-align:center;background:#fef3c7;font:12px sans-serif">LOCAL FIXTURE VERIFICATION · synthetic provider data · no live requests</aside><main '));
});
app.use(createApp({ guard: new ScoutGuard({ blockscoutClient: client }), publicLimit: 50, aggregateLimit: 50, cooldownMs: 150 }));
const server = app.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address === 'object') process.send?.({ url: `http://127.0.0.1:${address.port}` });
});
process.on('SIGTERM', () => server.close(() => process.exit()));
