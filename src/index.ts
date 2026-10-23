import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ScoutGuard } from './core/scoutguard.js';
import { PoisoningDetector } from './core/poisoning-detector.js';
import { BlockscoutClient, SUPPORTED_CHAINS } from './core/blockscout-client.js';
import { normalizePayment } from './core/payment-normalizer.js';
import { timingSafeEqual } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { TransactionCandidate } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3030;
if (process.env.NODE_ENV === 'production' && !process.env.SCOUTGUARD_SERVICE_KEY) {
  throw new Error('SCOUTGUARD_SERVICE_KEY is required in production');
}
if (process.env.NODE_ENV === 'production' && !process.env.BLOCKSCOUT_API_KEY) {
  throw new Error('BLOCKSCOUT_API_KEY is required in production');
}
if (process.env.NODE_ENV === 'production' && process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  throw new Error('TLS certificate verification must be enabled in production');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '16kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));
const publicEvaluationLimit = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Public live-check limit reached. Wait one minute and try again.' }
});
// Serve static UI assets from public directory
app.use(express.static(path.join(__dirname, '../public')));

const guard = new ScoutGuard();

function parseCandidate(body: unknown, publicMode = false): TransactionCandidate | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const input = body as Partial<TransactionCandidate>;
  const candidate: TransactionCandidate = {
    from: String(input.from || ''),
    to: String(input.to || ''),
    value: String(input.value || ''),
    chainId: Number(input.chainId),
    agentId: publicMode ? 'procurement-bot-01' : input.agentId,
    memo: publicMode ? 'Public judge live evaluation' : input.memo,
    tokenAddress: input.tokenAddress ? String(input.tokenAddress) : undefined,
    data: input.data ? String(input.data) : undefined
  };
  if (publicMode && candidate.chainId !== 1) return undefined;
  try {
    normalizePayment(candidate);
    return candidate;
  } catch {
    return undefined;
  }
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
  const evaluation = await guard.evaluateTransaction(candidate);
  res.setHeader('Cache-Control', 'no-store');
  return publicMode
    ? res.json({ mode: 'LIVE', source: 'BLOCKSCOUT_PRO', evaluation })
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
    uptime: process.uptime()
  });
});

app.get('/api/chains', (req, res) => {
  res.json(SUPPORTED_CHAINS);
});

app.get('/api/counterparties', (req, res) => {
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
    limitation: 'The public live evaluator scans recent history pages and did not recover this older reference for the victim. This replay shows the decision if that reference is supplied; it is not a live detection or evidence that a later theft occurred.'
  });
});

// Small, judge-friendly public path. It is limited to Ethereum and five checks per minute per client.
app.post('/api/evaluate/public', publicEvaluationLimit, async (req, res) => {
  try {
    await evaluateRequest(req, res, true);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/evaluate', (req, res, next) => {
  const expected = process.env.SCOUTGUARD_SERVICE_KEY;
  if (!expected) return next();
  const supplied = req.get('x-scoutguard-key') || '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}, async (req, res) => {
  try {
    await evaluateRequest(req, res);
  } catch (err) {
    res.status(500).json({ error: String(err) });
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
      getSenderCounterparties: async () => [],
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
    res.status(500).json({ error: String(err) });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🛡️  ScoutGuard PRO Server is running on port ${PORT}`);
  console.log(`   Local Dashboard: http://localhost:${PORT}`);
  console.log(`   Blockscout integration: checked per request`);
  console.log(`=======================================================`);
});

export default app;
