import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ScoutGuard } from './core/scoutguard.js';
import { PoisoningDetector } from './core/poisoning-detector.js';
import { BlockscoutClient, SUPPORTED_CHAINS } from './core/blockscout-client.js';
import { normalizePayment } from './core/payment-normalizer.js';
import { DEFAULT_AGENT_POLICIES } from './core/policy-engine.js';
import { timingSafeEqual } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { TransactionCandidate } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(options: { guard?: ScoutGuard; publicLimit?: number; aggregateLimit?: number; maxConcurrent?: number; cooldownMs?: number } = {}) {
const app = express();
// Vercel previews may have no production credentials. Keep the UI/read-only routes available;
// the protected endpoint still denies every request unless a service key is configured.
const isVercelPreview = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'preview';
if (process.env.NODE_ENV === 'production' && !isVercelPreview && !process.env.SCOUTGUARD_SERVICE_KEY) {
  throw new Error('SCOUTGUARD_SERVICE_KEY is required in production');
}
if (process.env.NODE_ENV === 'production' && !isVercelPreview && !process.env.BLOCKSCOUT_API_KEY) {
  throw new Error('BLOCKSCOUT_API_KEY is required in production');
}
if (process.env.NODE_ENV === 'production' && process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  throw new Error('TLS certificate verification must be enabled in production');
}
const serviceAgentId = process.env.SCOUTGUARD_AGENT_ID || 'procurement-bot-01';
if (!Object.hasOwn(DEFAULT_AGENT_POLICIES, serviceAgentId)) {
  throw new Error('SCOUTGUARD_AGENT_ID must name a configured agent policy');
}

app.disable('x-powered-by');
// Direct Node deployments ignore forwarded IPs. Vercel's edge overwrites its client-IP header.
app.set('trust proxy', process.env.VERCEL === '1' ? 1 : false);
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '16kb', strict: true, inflate: false }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'API request limit reached. Try again later.' } }));
const publicEvaluationLimit = rateLimit({
  windowMs: 60_000,
  limit: options.publicLimit ?? 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Public live-check limit reached. Wait one minute and try again.' }
});
// Serve static UI assets from public directory
app.use(express.static(path.join(__dirname, '../public')));

const guard = options.guard || new ScoutGuard();
const aggregateLimit = rateLimit({ windowMs: 60_000, limit: options.aggregateLimit ?? 20,
  keyGenerator: () => 'public-instance', standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Public provider budget reached. Try again later.' } });
let activePublicRequests = 0;
let providerCooldownUntil = 0;

function parseCandidate(body: unknown, publicMode = false): TransactionCandidate | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const input = body as Record<string, unknown>;
  const fields = ['from', 'to', 'value', 'chainId', 'data', 'tokenAddress', 'agentId', 'memo', 'rawAmount', 'transactionTo', 'transactionValue'];
  if (Object.keys(input).some(key => !fields.includes(key))) return undefined;
  if (typeof input.from !== 'string' || typeof input.to !== 'string' || typeof input.value !== 'string'
    || typeof input.chainId !== 'number') return undefined;
  for (const field of fields.filter(field => field !== 'chainId')) {
    if (input[field] !== undefined && (typeof input[field] !== 'string' || (input[field] as string).length > (field === 'memo' ? 256 : 138))) return undefined;
  }
  const candidate: TransactionCandidate = {
    ...(input as unknown as TransactionCandidate),
    agentId: publicMode ? 'procurement-bot-01' : input.agentId as string | undefined,
    memo: publicMode ? 'Public judge live evaluation' : input.memo as string | undefined
  };
  if (publicMode && candidate.chainId !== 1) return undefined;
  try {
    normalizePayment(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}

function requireServiceKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.SCOUTGUARD_SERVICE_KEY;
  if (!expected) return res.status(401).json({ error: 'Unauthorized' });
  const supplied = req.get('x-scoutguard-key') || '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function evaluateRequest(req: Request, res: Response, publicMode = false) {
  const candidate = parseCandidate(req.body, publicMode);
  if (!candidate) {
    return res.status(400).json({
      error: publicMode
        ? 'Provide a valid Ethereum native transfer or direct canonical USDC transfer(address,uint256) transaction.'
        : 'Provide a valid native transfer or direct allowlisted ERC-20 transfer(address,uint256) transaction.'
    });
  }
  const controller = new AbortController();
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  req.once('aborted', disconnect); res.once('close', disconnect);
  let evaluation;
  try { evaluation = await guard.evaluateTransaction(candidate, { signal: controller.signal }); }
  finally { req.off('aborted', disconnect); res.off('close', disconnect); }
  if (res.destroyed) return;
  if (publicMode && (evaluation.checks.some(check => check.id === 'SEC-FAIL-CLOSED') || evaluation.history?.coverage.providerErrors.length)) {
    providerCooldownUntil = Date.now() + (options.cooldownMs ?? 30_000);
  }
  res.setHeader('Cache-Control', 'no-store');
  return publicMode
    ? res.json({ mode: 'LIVE', source: process.env.BLOCKSCOUT_API_KEY ? 'BLOCKSCOUT_PRO' : 'BLOCKSCOUT_PUBLIC_API', evaluation })
    : res.json(evaluation);
}

// Built-in demonstration scenarios for hackathon judges & testers
const DEMO_SCENARIOS: Record<string, {
  id: string;
  title: string;
  category: string;
  expectedDecision: string;
  description: string;
  tx: TransactionCandidate;
}> = {
  'legitimate-vendor': {
    id: 'legitimate-vendor',
    title: 'Scenario 1: Legitimate Vendor Invoice',
    category: 'BENIGN_FLOW',
    expectedDecision: 'PASS',
    description: 'Simulated known vendor with established fixture history.',
    tx: {
      from: '0x3F5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
      to: '0xd9A100913988f5CDbC328E07b8e5c14a60153a91',
      value: '0.85',
      chainId: 8453, // Base
      agentId: 'procurement-bot-01',
      memo: 'Monthly GPU cluster invoice payment'
    }
  },
  'address-poisoning': {
    id: 'address-poisoning',
    title: 'Scenario 2: Address Poisoning / Vanity Spoof Attack',
    category: 'CRITICAL_EXPLOIT',
    expectedDecision: 'BLOCK',
    description: 'Simulated vanity collision against the demo vendor, with zero fixture history.',
    tx: {
      from: '0x3F5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
      to: '0xd9A1846b801a2E3cD49e917A00bB9e22e9283a91', // Look-alike poison address!
      value: '0.85',
      chainId: 8453,
      agentId: 'procurement-bot-01',
      memo: 'Spoofed clipboard transaction'
    }
  },
  'unverified-contract': {
    id: 'unverified-contract',
    title: 'Scenario 3: Unverified Smart Contract / Trojan Trap',
    category: 'RISK_QUARANTINE',
    expectedDecision: 'FLAG',
    description: 'Simulated unverified smart contract metadata.',
    tx: {
      from: '0x3F5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
      to: '0x000000000000000000000000000000000000dEaD',
      value: '0.45',
      chainId: 42161, // Arbitrum
      agentId: 'procurement-bot-01',
      memo: 'Payment to new untrusted contract'
    }
  },
  'malicious-phishing': {
    id: 'malicious-phishing',
    title: 'Scenario 4: Known Malicious Phishing / Drainer',
    category: 'CRITICAL_EXPLOIT',
    expectedDecision: 'BLOCK',
    description: 'Simulated phishing tag in an address metadata fixture.',
    tx: {
      from: '0x3F5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
      to: '0x6b175474e89094c44da98b954eedeac495271d0f',
      value: '1.20',
      chainId: 1, // Ethereum
      agentId: 'procurement-bot-01',
      memo: 'Phishing signature transfer'
    }
  },
  'spending-cap-breach': {
    id: 'spending-cap-breach',
    title: 'Scenario 5: Agent Spending Policy Cap Breach',
    category: 'FINOPS_VIOLATION',
    expectedDecision: 'BLOCK',
    description: 'Agent attempts to send 12.0 ETH in a single transaction, violating the 2.5 ETH hard ceiling policy.',
    tx: {
      from: '0x3F5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
      to: '0xd9A100913988f5CDbC328E07b8e5c14a60153a91',
      value: '12.00', // Exceeds 2.5 ETH limit
      chainId: 8453,
      agentId: 'procurement-bot-01',
      memo: 'Excessive high-value unauthorized transfer'
    }
  }
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'ScoutGuard PRO AgentFinOps Engine',
    version: '1.0.0',
    blockscoutIntegration: 'REQUEST_SCOPED',
    capabilities: { hourlyExecutionAccounting: false, distributedQuota: false, authenticatedReceipts: false, signingOrBroadcasting: false },
    uptime: process.uptime()
  });
});

app.get('/api/chains', (req, res) => {
  res.json(SUPPORTED_CHAINS);
});

app.get('/api/counterparties', requireServiceKey, (req, res) => {
  res.json(guard.getKnownCounterparties());
});

app.get('/api/scenarios', (req, res) => {
  res.json(Object.values(DEMO_SCENARIOS));
});

// A sourced historical case replay. This runs the current similarity detector against
// published case addresses; it is explicitly separate from the live history endpoint.
app.get('/api/research-case/poisoning', (req, res) => {
  const victim = '0x3e14605bf3ebc239a6ba1fdd4cd9daf01f382faf';
  const candidate = '0xcb9d34bbb0480e714f4c004cfd8cb72b776db1b6';
  const reference = '0xcb9da91c741820157e81ae21cddd5d207997b1b6';
  const finding = new PoisoningDetector().detectVanityCollision(candidate, [{
    address: reference, name: 'Research dataset reference', category: 'VENDOR',
    verifiedSince: 'published case', totalTransfers: 1
  }]);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    mode: 'RECORDED_RESEARCH_REPLAY',
    decision: finding.severity === 'CRITICAL' ? 'BLOCK' : finding.severity === 'SUSPICIOUS' ? 'FLAG' : 'PASS',
    candidate, reference, victim,
    prefixMatchLength: finding.prefixMatchLength,
    suffixMatchLength: finding.suffixMatchLength,
    explanation: finding.explanation,
    source: 'Poison-Hunter (ACM CCS 2024) sample dataset',
    sourceUrl: 'https://github.com/DS2L/Poison-Hunter/blob/main/phishing_transfers_sample.csv',
    blockscoutTxUrl: 'https://eth.blockscout.com/tx/0xd599a08dc631fbae475bf9ba90f93d5ed075a896336a23027fc321f589d9de1b',
    limitation: 'The recorded 2026-10-23 live scan did not recover this older reference. Bounded pagination now reports coverage, but recovery of this research reference has not been verified with the new scanner. This replay shows the decision if that reference is supplied; it is not a live detection or evidence that a later theft occurred.'
  });
});

// Small, judge-friendly public path. It is limited to Ethereum and five checks per minute per client.
app.post('/api/evaluate/public', publicEvaluationLimit, aggregateLimit, async (req, res) => {
  if (Date.now() < providerCooldownUntil) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((providerCooldownUntil - Date.now()) / 1000))));
    return res.status(503).json({ error: 'Provider temporarily unavailable. Evaluation is unavailable; do not execute.' });
  }
  if (activePublicRequests >= (options.maxConcurrent ?? 2)) {
    res.setHeader('Retry-After', '5');
    return res.status(429).json({ error: 'Public evaluator busy. Try again shortly.' });
  }
  activePublicRequests++;
  try {
    await evaluateRequest(req, res, true);
  } catch (err) {
    res.status(500).json({ error: 'Evaluation unavailable. Do not execute.' });
  } finally { activePublicRequests--; }
});

app.post('/api/evaluate', requireServiceKey, async (req, res) => {
  // A shared key authorizes one policy identity; a caller cannot choose a higher cap.
  const requestedAgentId = req.body?.agentId ?? 'procurement-bot-01';
  if (requestedAgentId !== serviceAgentId) return res.status(403).json({ error: 'Agent policy not authorized for this service key' });
  try {
    await evaluateRequest(req, res);
  } catch (err) {
    res.status(500).json({ error: 'Evaluation unavailable. Do not execute.' });
  }
});

app.post('/api/simulate/:scenarioId', async (req, res) => {
  const scenario = DEMO_SCENARIOS[req.params.scenarioId];
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }

  try {
    const demoCounters = { transactionsCount: scenario.id === 'address-poisoning' ? 0 : 142,
      tokenTransfersCount: scenario.id === 'address-poisoning' ? 0 : 25, gasUsageCount: 0, isContract: scenario.id === 'unverified-contract' };
    const demoDetails = { isContract: scenario.id === 'unverified-contract',
      isScamOrPhishing: scenario.id === 'malicious-phishing',
      tags: scenario.id === 'malicious-phishing' ? ['Simulated phishing tag'] : [], reputationScore: 60 };
    const demoClient = Object.assign(new BlockscoutClient(), {
      getAddressCounters: async () => demoCounters,
      getAddressDetails: async () => demoDetails,
      getSenderHistory: async () => ({ counterparties: [], evidence: [], coverage: {
        chainId: scenario.tx.chainId, sender: scenario.tx.from.toLowerCase(),
        pagesScanned: { transactions: 0, tokenTransfers: 0 }, recordsInspected: 0, uniqueCounterparties: 0,
        outgoingNativeTransfers: 0, outgoingTokenTransfers: 0, duplicatesSkipped: 0, incomingOnlyAddresses: 0,
        zeroValueInteractions: 0, paginationComplete: true, truncated: false, stopReasons: [],
        timeBudgetExhausted: false, requestBudgetExhausted: false, providerCalls: 0, providerErrors: [],
        fetchedAt: new Date().toISOString(), limits: { maxPages: 3, maxRecords: 300, maxProviderCalls: 8, maxDurationMs: 10000 }
      } }),
      getContractSecurity: async () => ({ isContract: true, isVerified: false })
    });
    const demoGuard = new ScoutGuard({ blockscoutClient: demoClient, customCounterparties: [{
      address: DEMO_SCENARIOS['legitimate-vendor'].tx.to.toLowerCase(), name: 'Demo vendor',
      category: 'VENDOR', verifiedSince: 'simulated', totalTransfers: 142
    }] });
    const result = await demoGuard.evaluateTransaction({ ...scenario.tx,
      from: scenario.tx.from.toLowerCase(), to: scenario.tx.to.toLowerCase() });

    res.json({
      scenario,
      mode: 'SIMULATED',
      evaluation: result
    });
  } catch (err) {
    res.status(500).json({ error: 'Evaluation unavailable. Do not execute.' });
  }
});

// JSON parser failures must not return Express HTML stacks or body excerpts.
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = error?.type === 'entity.too.large' ? 413 : error?.type === 'entity.parse.failed' ? 400 : error?.type === 'encoding.unsupported' ? 415 : 500;
  res.status(status).json({ error: status === 413 ? 'Request body too large' : status === 400 ? 'Invalid JSON body' : status === 415 ? 'Compressed request bodies are unsupported' : 'Request failed' });
});
return app;
}

const app = createApp();
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  app.listen(process.env.PORT || 3030, () => console.log('ScoutGuard PRO listening; Blockscout checked per request'));
}
export default app;
