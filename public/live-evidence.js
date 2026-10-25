const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const HASH = /^0x[a-fA-F0-9]{64}$/;
const labels = {
  ADDRESS_COUNTERS: 'Recipient activity counters', ADDRESS_DETAILS: 'Recipient address details',
  SENDER_TRANSACTIONS: 'Sender transactions', SENDER_TOKEN_TRANSFERS: 'Sender ERC-20 transfers',
  SMART_CONTRACT: 'Contract source verification'
};
const explorer = (kind, value) => `https://eth.blockscout.com/${kind}/${value}`;
const short = address => `${address.slice(0, 8)}…${address.slice(-6)}`;
const el = (tag, className = '', content) => {
  const node = document.createElement(tag);
  node.className = className;
  if (content !== undefined) node.textContent = String(content);
  return node;
};
const link = (label, href) => {
  const node = el('a', 'live-intel-link', `${label} ↗`);
  node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer';
  return node;
};

/** Relationships are derived only from the current response's retained evidence. */
export function buildLiveGraphModel(evaluation) {
  const payment = evaluation?.receipt?.transactionSummary;
  if (!ADDRESS.test(payment?.from || '') || !ADDRESS.test(payment?.to || '')) return [];
  const history = evaluation?.history;
  const nodes = new Map();
  const add = (address, role, event) => {
    if (!ADDRESS.test(address || '')) return;
    const key = address.toLowerCase();
    if (!nodes.has(key)) nodes.set(key, { address: key, roles: new Set(), events: [] });
    const node = nodes.get(key); node.roles.add(role);
    if (event && HASH.test(event.transactionHash || '') && !node.events.some(item => item.transactionHash === event.transactionHash)) {
      node.events.push({ transactionHash: event.transactionHash, relationship: event.relationship,
        direction: event.direction, timestamp: event.timestamp, tokenAddress: event.tokenAddress,
        rawAmount: event.rawAmount, blockNumber: event.blockNumber, logIndex: event.logIndex });
    }
  };
  add(payment.from, 'Payment sender');
  add(payment.to, 'Proposed beneficiary · unsigned');
  for (const event of history?.evidence || []) {
    if (event.relationship === 'OUTBOUND_NATIVE' || event.relationship === 'OUTBOUND_ERC20') add(event.address, 'Observed outgoing recipient', event);
    if (event.relationship === 'INCOMING_ONLY') add(event.address, 'Incoming-only address', event);
  }
  for (const check of evaluation?.checks || []) {
    const reference = check.metadata?.vendorAddress;
    if (ADDRESS.test(reference || '') && check.id?.startsWith('SEC-POISON-') && check.id !== 'SEC-POISON-OK') {
      const supported = (history?.evidence || []).some(event => event.address?.toLowerCase() === reference.toLowerCase()
        && ['OUTBOUND_NATIVE', 'OUTBOUND_ERC20'].includes(event.relationship));
      if (supported) add(reference, 'ScoutGuard look-alike reference');
    }
  }
  const priority = node => node.roles.has('Payment sender') ? 0 : node.roles.has('Proposed beneficiary · unsigned') ? 1
    : node.roles.has('ScoutGuard look-alike reference') ? 2 : node.roles.has('Observed outgoing recipient') ? 3 : 4;
  return [...nodes.values()].sort((a, b) => priority(a) - priority(b) || b.events.length - a.events.length
    || a.address.localeCompare(b.address)).map(node => ({ ...node, roles: [...node.roles] }));
}

export function buildEvidenceExport(payload) {
  const evaluation = payload?.evaluation || {};
  const receipt = evaluation.receipt || {};
  const history = evaluation.history || {};
  return {
    kind: 'SCOUTGUARD_LIVE_EVALUATION_EVIDENCE', mode: 'LIVE', source: payload.source || 'NO_PROVIDER_TRACE',
    evaluationId: evaluation.providerTrace?.[0]?.evaluationId || null,
    evaluatedAt: receipt.isoDate || null, chainId: receipt.transactionSummary?.chainId || null,
    candidate: receipt.transactionSummary || null,
    providerTrace: evaluation.providerTrace || [], providerObservations: evaluation.providerObservations || null,
    historyCoverage: history.coverage || null,
    observedCounterparties: history.counterparties || [],
    observedEvents: history.evidence || [],
    checks: evaluation.checks || [], decision: evaluation.decision || null, riskScore: evaluation.riskScore ?? null,
    reasons: evaluation.reasons || [], receipt,
    note: 'Proposed payments were not signed or broadcast. Historical events are Blockscout observations, not ScoutGuard payments. SHA-256-UNKEYED is a consistency digest, not a provider signature.'
  };
}

export function renderLiveEvidence(payload) {
  const root = document.getElementById('live-intelligence');
  if (!root) return;
  root.replaceChildren();
  const evaluation = payload.evaluation;
  const trace = Array.isArray(evaluation.providerTrace) ? evaluation.providerTrace : [];
  const successful = trace.filter(request => request.httpStatus >= 200 && request.httpStatus < 300 && !request.errorCategory);
  const coverage = evaluation.history?.coverage;
  const observations = evaluation.providerObservations;
  const title = el('div', 'live-intel-heading');
  const heading = el('div');
  heading.append(el('p', 'live-intel-kicker', 'LIVE · FRESH BLOCKSCOUT REQUESTS'),
    el('h4', 'live-intel-title', 'Blockscout Intelligence — Live Evidence'));
  title.append(heading, el('span', `live-intel-source ${String(payload.source).includes('PARTIAL') || payload.source === 'BLOCKSCOUT_UNAVAILABLE' ? 'is-partial' : ''}`,
    payload.source || 'NO_PROVIDER_TRACE'));
  root.append(title);

  const metrics = el('dl', 'live-intel-metrics');
  for (const [name, value] of [
    ['Network', 'Ethereum Mainnet · chain 1'], ['Successful lookups', `${successful.length} / ${trace.length}`],
    ['Last successful lookup', successful.at(-1)?.timestamp || 'None recorded'],
    ['History rows inspected', coverage?.recordsInspected ?? 'Unavailable']
  ]) {
    const item = el('div'); item.append(el('dt', '', name), el('dd', '', value)); metrics.append(item);
  }
  root.append(metrics);

  const flow = el('ol', 'live-intel-flow');
  for (const [number, name] of [['01', 'Blockscout observations'], ['02', 'ScoutGuard analysis'], ['03', 'Payment policy'], ['04', `${evaluation.decision} verdict`]]) {
    const item = el('li'); item.append(el('span', '', number), el('strong', '', name)); flow.append(item);
  }
  root.append(flow);

  const observationsSection = el('section', 'live-intel-layer');
  observationsSection.append(el('h5', '', 'A · Blockscout observations'));
  if (!trace.length) observationsSection.append(el('p', 'live-intel-warning',
    'No upstream request trace was retained. Provider success cannot be independently confirmed from this response.'));
  const requestList = el('ol', 'live-intel-trace');
  for (const request of trace) {
    const row = el('li', request.errorCategory ? 'is-error' : 'is-success');
    const status = request.httpStatus === undefined ? `No HTTP response · ${request.errorCategory || 'unavailable'}`
      : `HTTP ${request.httpStatus}${request.errorCategory ? ` · ${request.errorCategory}` : ''}`;
    row.append(el('strong', '', labels[request.endpoint] || request.endpoint),
      el('span', '', `${status} · ${request.durationMs} ms${request.recordCount === undefined ? '' : ` · ${request.recordCount} rows`}${request.page ? ` · page ${request.page}` : ''}`));
    requestList.append(row);
  }
  observationsSection.append(requestList);
  if (observations) {
    const detail = el('div', 'live-intel-observation');
    detail.append(el('p', '', `Recipient: ${observations.recipientDetails?.isContract ? 'contract' : 'externally owned address'}; ${observations.recipientCounters?.transactionsCount ?? 'unknown'} transactions and ${observations.recipientCounters?.tokenTransfersCount ?? 'unknown'} token transfers indexed.`));
    if (observations.tokenContract) detail.append(el('p', '', `Canonical USDC source: ${observations.tokenContract.isVerified ? 'verified on Blockscout' : 'not verified by the returned metadata'}. Source verification is not a security audit.`));
    observationsSection.append(detail);
  }
  if (coverage) observationsSection.append(el('p', 'live-intel-coverage',
    `Sender history: ${coverage.pagesScanned.transactions} transaction pages + ${coverage.pagesScanned.tokenTransfers} ERC-20 pages; ${coverage.uniqueCounterparties} outgoing counterparties. ${coverage.paginationComplete ? 'Indexed pagination reached both terminal pages within the scan.' : `Partial scan (${coverage.stopReasons.join(', ') || 'unknown reason'}); no exhaustive-history claim.`}`));
  root.append(observationsSection);

  const relationships = el('section', 'live-intel-layer');
  relationships.append(el('h5', '', 'B · ScoutGuard relationship analysis'), el('p', 'live-intel-note',
    'Select an address to inspect its role and historical Explorer evidence. A proposed payment has no transaction hash. Observed outbound activity is a comparison reference, not verified trust.'));
  const nodes = buildLiveGraphModel(evaluation);
  if (nodes.length) {
    const graph = el('div', 'live-intel-graph');
    const controls = el('div', 'live-intel-node-list');
    const detail = el('div', 'live-intel-node-detail'); detail.setAttribute('aria-live', 'polite');
    const search = el('input', 'live-intel-search'); search.type = 'search';
    search.placeholder = 'Search a retained address'; search.setAttribute('aria-label', 'Search retained relationship addresses');
    const count = el('p', 'live-intel-note');
    const activate = (node, selectedButton) => {
      controls.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === selectedButton)));
      detail.replaceChildren(el('strong', '', node.roles.join(' · ')), el('p', 'live-intel-address', node.address),
        link('Open address in Blockscout', explorer('address', node.address)));
      for (const event of node.events.slice(0, 8)) {
        const row = el('div', 'live-intel-event');
        row.append(el('span', '', `${event.relationship.replaceAll('_', ' ')} · ${event.timestamp || 'timestamp unavailable'} · raw ${event.rawAmount}`),
          link('Historical transaction', explorer('tx', event.transactionHash)));
        detail.append(row);
      }
      if (node.events.length > 8) detail.append(el('p', '', `${node.events.length - 8} more retained events are in the sanitized receipt download.`));
      if (!node.events.length) detail.append(el('p', '', 'No historical transfer record was retained for this address in this evaluation.'));
    };
    const renderNodes = () => {
      controls.replaceChildren();
      const matching = nodes.filter(node => node.address.includes(search.value.trim().toLowerCase())
        || node.roles.join(' ').toLowerCase().includes(search.value.trim().toLowerCase()));
      const visible = matching.slice(0, 10);
      count.textContent = `Showing ${visible.length} of ${matching.length} matching addresses (${nodes.length} retained). Search to inspect another address; full observations are in the receipt download.`;
      for (const node of visible) {
        const button = el('button', 'live-intel-node', `${node.roles.join(' · ')}\n${short(node.address)}`);
        button.type = 'button'; button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => activate(node, button)); controls.append(button);
      }
      if (visible.length) controls.firstElementChild.click();
      else detail.replaceChildren(el('p', '', 'No retained address matches this search.'));
    };
    search.addEventListener('input', renderNodes);
    graph.append(search, count, controls, detail); relationships.append(graph); renderNodes();
  } else relationships.append(el('p', 'live-intel-warning', 'No valid relationship addresses were retained.'));
  const similarity = evaluation.checks.find(check => check.id?.startsWith('SEC-POISON'));
  if (similarity) relationships.append(el('p', 'live-intel-analysis', `${similarity.name}: ${similarity.detail}`));
  root.append(relationships);

  const policy = el('section', 'live-intel-layer');
  policy.append(el('h5', '', 'C · Security checks and policy verdict'));
  const checks = el('div', 'live-intel-checks');
  for (const check of evaluation.checks || []) {
    const row = el('div', 'live-intel-check');
    row.append(el('strong', '', `${check.status} · ${check.name}`),
      el('span', '', `+${check.scoreImpact} risk points`), el('p', '', check.detail));
    checks.append(row);
  }
  policy.append(checks, el('p', 'live-intel-verdict', `${evaluation.decision} · ${evaluation.riskScore}/100. ${evaluation.decision === 'BLOCK' ? 'Do not sign.' : evaluation.decision === 'FLAG' ? 'Human review required; no automatic signing.' : 'The policy passed this candidate; a separate authorized signer is still required.'}`));
  root.append(policy);

  const download = el('button', 'live-intel-download', 'Download sanitized evidence receipt ↓');
  download.type = 'button'; download.addEventListener('click', () => {
    const file = new Blob([JSON.stringify(buildEvidenceExport(payload), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `scoutguard-evidence-${evaluation.providerTrace?.[0]?.evaluationId || 'untraced'}.json`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const developer = el('details', 'live-intel-developer');
  developer.append(el('summary', '', 'Developer view · sanitized request trace'),
    el('pre', '', JSON.stringify({ trace, observations, coverage }, null, 2)));
  root.append(download, developer, el('p', 'live-intel-note',
    'This response contains public chain data and a proposed unsigned payment. The unkeyed SHA-256 digest checks receipt consistency; it is not a Blockscout signature or proof of service authenticity.'));
}

if (typeof window !== 'undefined') window.ScoutGuardLiveEvidence = { renderLiveEvidence };
