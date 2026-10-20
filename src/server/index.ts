import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ScoutGuard } from '../core/scoutguard.js';
import { SUPPORTED_CHAINS } from '../core/blockscout-client.js';
import { BlockscoutClient } from '../core/blockscout-client.js';
import { isAddress } from 'ethers';
import { timingSafeEqual } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { TransactionCandidate } from '../types/index.js';

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
app.use(express.json({ limit: '16kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));
// Serve static UI assets from public directory
app.use(express.static(path.join(__dirname, '../../public')));

const guard = new ScoutGuard();

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
    blockscoutIntegration: 'UNVERIFIED',
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
    const candidate = req.body as TransactionCandidate;
    if (!candidate || !isAddress(candidate.to || '') || !isAddress(candidate.from || '') ||
        typeof candidate.value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(candidate.value) ||
        !Number.isFinite(Number(candidate.value)) || !SUPPORTED_CHAINS[candidate.chainId] ||
        candidate.tokenAddress || candidate.data) {
      return res.status(400).json({ error: 'Provide valid from/to EVM addresses, a nonnegative native amount, and a supported chainId. Token transfers and calldata are not supported.' });
    }

    const result = await guard.evaluateTransaction(candidate);
    res.json(result);
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
