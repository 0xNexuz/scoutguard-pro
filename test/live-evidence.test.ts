import { it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveGraphModel, buildEvidenceExport } from '../public/live-evidence.js';

const sender = `0x${'1'.repeat(40)}`;
const beneficiary = `0x${'2'.repeat(40)}`;
const outbound = `0x${'3'.repeat(40)}`;
const incoming = `0x${'4'.repeat(40)}`;
const hash = `0x${'a'.repeat(64)}`;
const event = (address: string, relationship: string, transactionHash = hash) => ({
  address, relationship, transactionHash, direction: relationship === 'INCOMING_ONLY' ? 'INCOMING' : 'OUTGOING', rawAmount: '1'
});

it('live graph includes only retained observed relationships and proposed addresses', () => {
  const evaluation = { receipt: { transactionSummary: { from: sender, to: beneficiary } },
    history: { evidence: [event(outbound, 'OUTBOUND_ERC20'), event(incoming, 'INCOMING_ONLY'),
      event(`0x${'5'.repeat(40)}`, 'INCOMPLETE'), event(`0x${'6'.repeat(40)}`, 'ZERO_VALUE'),
      event(outbound, 'OUTBOUND_ERC20')] },
    checks: [{ id: 'SEC-POISON-01', metadata: { vendorAddress: outbound } }] };
  const nodes = buildLiveGraphModel(evaluation);
  assert.equal(nodes.length, 4);
  assert.deepEqual(nodes.slice(0, 3).map((node: any) => node.address), [sender, beneficiary, outbound]);
  assert.equal(nodes.find((node: any) => node.address === outbound)?.events.length, 1);
  assert.ok(nodes.find((node: any) => node.address === outbound)?.roles.includes('ScoutGuard look-alike reference'));
  assert.ok(nodes.find((node: any) => node.address === incoming)?.roles.includes('Incoming-only address'));
  assert.equal(nodes.find((node: any) => node.address === beneficiary)?.events.length, 0);
});

it('empty or malformed live evidence never creates an observed edge', () => {
  assert.deepEqual(buildLiveGraphModel({ receipt: { transactionSummary: { from: 'bad', to: beneficiary } } }), []);
  const nodes = buildLiveGraphModel({ receipt: { transactionSummary: { from: sender, to: beneficiary } },
    history: { evidence: [event(outbound, 'OUTBOUND_NATIVE', 'not-a-hash')] } });
  assert.equal(nodes.find((node: any) => node.address === outbound)?.events.length, 0);
});

it('sanitized export labels its mode, source and unsigned limitation', () => {
  const exportData = buildEvidenceExport({ source: 'NO_PROVIDER_TRACE', evaluation: { decision: 'BLOCK',
    receipt: { isoDate: '2026-10-25T00:00:00Z', transactionSummary: { from: sender, to: beneficiary, chainId: 1 } } } });
  assert.equal(exportData.mode, 'LIVE');
  assert.equal(exportData.source, 'NO_PROVIDER_TRACE');
  assert.deepEqual(exportData.providerTrace, []);
  assert.match(exportData.note, /not signed or broadcast/);
});
