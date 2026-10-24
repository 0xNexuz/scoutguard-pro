const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const HASH = /^0x[a-fA-F0-9]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const DECISIONS = new Set(['PASS', 'FLAG', 'BLOCK']);
const STATUSES = new Set(['PASS', 'WARN', 'FAIL']);

export function explorerAddress(address) {
  if (!ADDRESS.test(address)) throw new Error('Invalid Explorer address');
  return `https://eth.blockscout.com/address/${address}`;
}

export function explorerTransaction(hash) {
  if (!HASH.test(hash)) throw new Error('Invalid Explorer transaction');
  return `https://eth.blockscout.com/tx/${hash}`;
}

function exactUnits(amount, decimals) {
  if (typeof amount !== 'string' || !DECIMAL.test(amount)) throw new Error('Invalid recorded amount');
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > decimals) throw new Error('Recorded amount exceeds token precision');
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0')).toString();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Fail closed on malformed or mislabeled saved records. This function performs no network calls. */
export function validateReplayRecord(record) {
  assert(record && typeof record === 'object', 'Replay record is missing');
  assert(typeof record.id === 'string' && /^[a-z0-9-]+$/.test(record.id), 'Invalid record ID');
  assert(record.mode === 'RECORDED_LIVE_EVALUATION', 'A simulation cannot be presented as a recorded live evaluation');
  assert(typeof record.title === 'string' && record.title.length > 0, 'Missing title');
  assert(DATE.test(record.recordedDate), 'Missing recorded date');
  assert(record.exactEvaluationTime === null || (!Number.isNaN(Date.parse(record.exactEvaluationTime)) && typeof record.exactEvaluationTime === 'string'), 'Invalid evaluation time');
  assert(typeof record.sourceCommit === 'string' && /^[a-f0-9]{7,40}$/.test(record.sourceCommit), 'Invalid source commit');
  assert(/^https:\/\/github\.com\/0xNexuz\/scoutguard-pro\/blob\/[a-f0-9]{7,40}\/docs\/evidence\/[a-zA-Z0-9-]+\.md$/.test(record.sourceDocument), 'Invalid source document');

  const candidate = record.candidate;
  assert(candidate && candidate.chainId === 1 && ADDRESS.test(candidate.sender) && ADDRESS.test(candidate.recipient) && ADDRESS.test(candidate.transactionTo), 'Invalid recorded candidate');
  assert(candidate.asset === 'ETH' || candidate.asset === 'USDC', 'Unsupported recorded asset');
  if (candidate.asset === 'USDC') {
    assert(candidate.tokenContract?.toLowerCase() === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' && candidate.transactionTo.toLowerCase() === candidate.tokenContract.toLowerCase(), 'USDC contract mismatch');
  } else {
    assert(candidate.tokenContract === null && candidate.transactionTo.toLowerCase() === candidate.recipient.toLowerCase(), 'Native destination mismatch');
  }
  assert(candidate.rawAmount === exactUnits(candidate.amount, candidate.asset === 'USDC' ? 6 : 18), 'Recorded raw amount mismatch');

  const result = record.result;
  assert(result && DECISIONS.has(result.decision) && Number.isInteger(result.riskScore) && result.riskScore >= 0 && result.riskScore <= 100, 'Invalid recorded verdict');
  assert(Array.isArray(result.checks) && result.checks.length > 0, 'Missing recorded checks');
  let sum = 0;
  let failed = false;
  let warned = false;
  for (const check of result.checks) {
    assert(typeof check.id === 'string' && /^SEC-[A-Z0-9-]+$/.test(check.id) && typeof check.name === 'string' && typeof check.detail === 'string', 'Malformed check');
    assert(STATUSES.has(check.status) && Number.isInteger(check.scoreImpact) && check.scoreImpact >= 0 && check.scoreImpact <= 100, 'Invalid check contribution');
    sum += check.scoreImpact;
    failed ||= check.status === 'FAIL';
    warned ||= check.status === 'WARN';
  }
  assert(result.riskScore === Math.min(100, sum), 'Recorded risk score does not match checks');
  const expectedDecision = failed || result.riskScore >= 60 ? 'BLOCK' : warned || result.riskScore >= 25 ? 'FLAG' : 'PASS';
  assert(result.decision === expectedDecision, 'Recorded verdict does not match checks');

  const evidence = record.evidence;
  assert(evidence && Number.isInteger(evidence.historyCounterpartiesCompared) && evidence.historyCounterpartiesCompared >= 0, 'Invalid evidence summary');
  assert(typeof evidence.sourceNote === 'string' && evidence.sourceNote.length > 0, 'Missing evidence qualification');
  assert(Array.isArray(evidence.observedTransfers) && Array.isArray(evidence.similarityFindings), 'Malformed evidence lists');
  assert(evidence.incomingOnly === null || Array.isArray(evidence.incomingOnly), 'Invalid incoming-only evidence');
  assert(evidence.explicitlyTrusted === null || Array.isArray(evidence.explicitlyTrusted), 'Invalid trusted evidence');
  for (const transfer of evidence.observedTransfers) {
    assert(ADDRESS.test(transfer.from) && ADDRESS.test(transfer.to) && HASH.test(transfer.txHash), 'Malformed transfer evidence');
    assert(typeof transfer.kind === 'string' && typeof transfer.qualification === 'string', 'Missing transfer qualification');
  }
  for (const group of [evidence.incomingOnly, evidence.explicitlyTrusted]) {
    if (!group) continue;
    for (const item of group) assert(ADDRESS.test(item.address) && HASH.test(item.txHash), 'Unsupported graph relationship');
  }
  for (const item of evidence.similarityFindings) {
    assert(ADDRESS.test(item.reference) && ADDRESS.test(item.candidate) && HASH.test(item.txHash), 'Unsupported similarity finding');
  }

  const receipt = record.receiptExcerpt;
  assert(receipt && (receipt.integrityHash === null || HASH.test(receipt.integrityHash)), 'Malformed receipt excerpt');
  assert(receipt.originalTimestamp === null || (!Number.isNaN(Date.parse(receipt.originalTimestamp)) && typeof receipt.originalTimestamp === 'string'), 'Invalid original timestamp');
  assert(receipt.receiptId === null || typeof receipt.receiptId === 'string', 'Invalid receipt ID');
  assert(receipt.policyVersionFromSource === 'v1.2.0-blockscout-pro', 'Policy source version mismatch');
  return record;
}

export function validateReplayBundle(bundle) {
  assert(bundle?.schemaVersion === 1 && Array.isArray(bundle.records), 'Unsupported replay bundle');
  const ids = new Set();
  const records = bundle.records.map(validateReplayRecord);
  for (const record of records) {
    assert(!ids.has(record.id), 'Duplicate replay record');
    ids.add(record.id);
  }
  return records;
}

export function buildRelationshipGraph(record) {
  validateReplayRecord(record);
  const sender = record.candidate.sender.toLowerCase();
  const recipient = record.candidate.recipient.toLowerCase();
  const nodes = new Map([[sender, { address: record.candidate.sender, roles: ['Sender wallet'], txHashes: [] }]]);
  if (sender === recipient) nodes.get(sender).roles.push('Proposed recipient');
  else nodes.set(recipient, { address: record.candidate.recipient, roles: ['Proposed recipient'], txHashes: [] });
  const edges = [{ from: sender, to: recipient, type: 'PROPOSED_UNSENT', txHash: null }];
  for (const transfer of record.evidence.observedTransfers) {
    const from = transfer.from.toLowerCase();
    const to = transfer.to.toLowerCase();
    for (const address of [transfer.from, transfer.to]) {
      const key = address.toLowerCase();
      if (!nodes.has(key)) nodes.set(key, { address, roles: [], txHashes: [] });
    }
    const role = from === sender ? 'Observed outbound recipient' : to === sender ? 'Incoming-only address' : 'Observed transfer address';
    const roleNode = nodes.get(from === sender ? to : from);
    if (!roleNode.roles.includes(role)) roleNode.roles.push(role);
    for (const key of [from, to]) {
      if (!nodes.get(key).txHashes.includes(transfer.txHash)) nodes.get(key).txHashes.push(transfer.txHash);
    }
    edges.push({ from, to, type: 'OBSERVED_TRANSFER_EVENT', txHash: transfer.txHash });
  }
  for (const [items, role, type] of [
    [record.evidence.incomingOnly, 'Incoming-only address', 'INCOMING_ONLY'],
    [record.evidence.explicitlyTrusted, 'Explicitly trusted counterparty', 'EXPLICITLY_TRUSTED']
  ]) {
    for (const item of items || []) {
      const key = item.address.toLowerCase();
      if (!nodes.has(key)) nodes.set(key, { address: item.address, roles: [], txHashes: [] });
      const node = nodes.get(key);
      if (!node.roles.includes(role)) node.roles.push(role);
      if (!node.txHashes.includes(item.txHash)) node.txHashes.push(item.txHash);
      edges.push({ from: type === 'INCOMING_ONLY' ? key : sender, to: type === 'INCOMING_ONLY' ? sender : key, type, txHash: item.txHash });
    }
  }
  for (const finding of record.evidence.similarityFindings) {
    for (const address of [finding.reference, finding.candidate]) {
      const key = address.toLowerCase();
      if (!nodes.has(key)) nodes.set(key, { address, roles: [], txHashes: [] });
      const node = nodes.get(key);
      if (!node.roles.includes('Verified similarity finding')) node.roles.push('Verified similarity finding');
      if (!node.txHashes.includes(finding.txHash)) node.txHashes.push(finding.txHash);
    }
    edges.push({ from: finding.reference.toLowerCase(), to: finding.candidate.toLowerCase(), type: 'VERIFIED_SIMILARITY', txHash: finding.txHash });
  }
  return { nodes: [...nodes.values()], edges };
}

export function sanitizedReceiptExcerpt(record) {
  validateReplayRecord(record);
  return {
    kind: 'SANITIZED_RECEIPT_EXCERPT',
    completeness: 'PARTIAL_TRANSCRIPTION_NOT_ORIGINAL_API_RECEIPT',
    mode: record.mode,
    recordedDate: record.recordedDate,
    exactEvaluationTime: record.exactEvaluationTime,
    sourceDocument: record.sourceDocument,
    sourceCommit: record.sourceCommit,
    candidate: record.candidate,
    decision: record.result.decision,
    riskScore: record.result.riskScore,
    checks: record.result.checks,
    evidence: {
      historyCounterpartiesCompared: record.evidence.historyCounterpartiesCompared,
      observedTransfers: record.evidence.observedTransfers.map((transfer) => ({ ...transfer, explorerUrl: explorerTransaction(transfer.txHash) })),
      incomingOnly: record.evidence.incomingOnly,
      explicitlyTrusted: record.evidence.explicitlyTrusted,
      similarityFindings: record.evidence.similarityFindings,
      sourceNote: record.evidence.sourceNote
    },
    receipt: record.receiptExcerpt,
    warning: 'The digest is unkeyed SHA-256, not a Blockscout signature or authenticated attestation. Original receipt ID and exact timestamp were not retained.'
  };
}
