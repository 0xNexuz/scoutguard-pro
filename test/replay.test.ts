import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildRelationshipGraph, sanitizedReceiptExcerpt, validateReplayBundle, validateReplayRecord } from '../public/replay-data.js';

const saved = JSON.parse(readFileSync(new URL('../public/replay/records.json', import.meta.url), 'utf8'));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test('three recorded production evaluations validate and replay without a network dependency', () => {
  const records = validateReplayBundle(saved);
  assert.equal(records.length, 3);
  assert.deepEqual(records.map((record: any) => record.result.decision), ['PASS', 'PASS', 'BLOCK']);
  for (const record of records) {
    const graph = buildRelationshipGraph(record);
    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.filter((edge: any) => edge.type === 'OBSERVED_TRANSFER_EVENT').length, 1);
    assert.equal(graph.edges.filter((edge: any) => edge.type === 'PROPOSED_UNSENT').length, 1);
    const excerpt = sanitizedReceiptExcerpt(record);
    assert.equal(excerpt.completeness, 'PARTIAL_TRANSCRIPTION_NOT_ORIGINAL_API_RECEIPT');
    assert.equal(excerpt.exactEvaluationTime, null);
    assert.equal(excerpt.receipt.receiptId, null);
    assert.equal(excerpt.evidence.observedTransfers[0].explorerUrl, `https://eth.blockscout.com/tx/${record.evidence.observedTransfers[0].txHash}`);
  }
});

test('empty evidence does not create observed relationships', () => {
  const record = clone(saved.records[0]);
  record.evidence.observedTransfers = [];
  record.evidence.historyCounterpartiesCompared = 0;
  record.evidence.similarityFindings = [];
  validateReplayRecord(record);
  const graph = buildRelationshipGraph(record);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].type, 'PROPOSED_UNSENT');
  assert.deepEqual(graph.nodes[1].txHashes, []);
});

test('supported graph relationships require transaction evidence', () => {
  const record = clone(saved.records[0]);
  record.evidence.incomingOnly = [{ address: '0x1111111111111111111111111111111111111111', txHash: record.evidence.observedTransfers[0].txHash }];
  record.evidence.explicitlyTrusted = [{ address: '0x2222222222222222222222222222222222222222', txHash: record.evidence.observedTransfers[0].txHash }];
  record.evidence.similarityFindings = [{ reference: record.candidate.recipient, candidate: '0x3333333333333333333333333333333333333333', txHash: record.evidence.observedTransfers[0].txHash }];
  const graph = buildRelationshipGraph(record);
  assert.equal(graph.nodes.length, 5);
  assert.equal(graph.edges.length, 5);
  assert.equal(graph.edges.filter((edge: any) => edge.type === 'VERIFIED_SIMILARITY').length, 1);
  record.evidence.incomingOnly[0].txHash = 'fabricated';
  assert.throws(() => validateReplayRecord(record), /Unsupported graph relationship/);
});

test('malformed and mislabeled records fail closed', () => {
  const modifications = [
    (record: any) => { record.mode = 'SIMULATED_ATTACK'; },
    (record: any) => { record.candidate.sender = 'not-an-address'; },
    (record: any) => { record.candidate.rawAmount = '1'; },
    (record: any) => { record.result.decision = 'PASS'; },
    (record: any) => { record.result.riskScore = 12; },
    (record: any) => { record.evidence.observedTransfers[0].txHash = 'fake'; },
    (record: any) => { record.sourceDocument = 'https://example.com'; }
  ];
  for (const modify of modifications) {
    const record = clone(saved.records[2]);
    modify(record);
    assert.throws(() => validateReplayRecord(record));
  }
  const bundle = clone(saved);
  bundle.records[1].id = bundle.records[0].id;
  assert.throws(() => validateReplayBundle(bundle), /Duplicate/);
});
