/** Isolated enforcement harness: no wallet, RPC, private key, signing bytes or broadcast. */
import { Interface } from 'ethers';
import { ScoutGuard } from '../src/core/scoutguard.js';
import { runPaymentAgent } from '../src/integration/payment-agent.js';
import { completeHistory, fixtureClient, sender, recipient, usdc } from '../test/fixtures/blockscout.js';

const abi = new Interface(['function transfer(address,uint256)']);
const guard = new ScoutGuard({ blockscoutClient: fixtureClient(completeHistory()) });
let signerCalls = 0;
const signer = { signTransaction: async () => { signerCalls++; return 'MOCK_ARTIFACT_NOT_A_SIGNED_TRANSACTION'; } };
for (const [amount, expected] of [[250n, 'SIGNED'], [1500n, 'REVIEW_REQUIRED'], [3000n, 'BLOCKED']] as const) {
  const result = await runPaymentAgent({ from: sender, to: usdc, value: '0', chainId: 1,
    data: abi.encodeFunctionData('transfer', [recipient, amount * 1000000n]) }, {
    evaluate: tx => guard.evaluateTransaction(tx), signer, authorize: async () => true
  });
  if (result.status !== expected) throw new Error(`Unexpected mock outcome: ${result.status}`);
  console.log(`${amount} USDC → ${result.status} (synthetic provider data, isolated mock signer)`);
}
if (signerCalls !== 1) throw new Error('Non-PASS reached mock signer');
console.log('Only verified PASS with separate mock authorization reached the mock signer. No real transaction exists.');
