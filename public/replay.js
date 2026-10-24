import { buildRelationshipGraph, explorerAddress, explorerTransaction, sanitizedReceiptExcerpt, validateReplayBundle } from './replay-data.js';

const $ = (id) => document.getElementById(id);
const steps = [...document.querySelectorAll('[data-replay-stage]')];
const labels = ['Payment candidate', 'Blockscout evidence', 'Counterparty relationships', 'Security and policy checks', 'Final verdict'];
const state = { records: [], record: null, stage: 0, timer: null };

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function append(parent, ...nodes) { parent.append(...nodes); return parent; }
function link(label, href) {
  const a = element('a', 'replay-link', label);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}
function paragraph(value, className = 'replay-copy') { return element('p', className, value); }
function addressLink(address) { return link(address, explorerAddress(address)); }
function txLink(hash) { return link(hash, explorerTransaction(hash)); }

function heading(root, number, title, copy) {
  append(root, element('p', 'replay-kicker', `Stage ${number} / 05 · Recorded live evaluation`), element('h4', 'replay-heading', title), paragraph(copy));
}
function facts(root, pairs) {
  const dl = element('dl', 'replay-facts');
  for (const [name, value] of pairs) {
    const box = element('div', 'replay-fact');
    const dd = element('dd');
    if (value instanceof Node) dd.append(value);
    else dd.textContent = value;
    append(box, element('dt', '', name), dd);
    dl.append(box);
  }
  root.append(dl);
}

function renderCandidate(root, record) {
  const c = record.candidate;
  heading(root, '01', 'Inspect the proposed payment.', 'This candidate was evaluated before signing. The replay does not send a payment or request fresh chain data.');
  facts(root, [
    ['Network', 'Ethereum mainnet · chain 1'],
    ['Amount', `${c.amount} ${c.asset} · ${c.rawAmount} base units`],
    ['Sender wallet', addressLink(c.sender)],
    ['Proposed recipient', addressLink(c.recipient)],
    ['Transaction destination', addressLink(c.transactionTo)],
    ['Asset contract', c.tokenContract ? addressLink(c.tokenContract) : 'Native ETH · no token contract']
  ]);
}

function renderEvidence(root, record) {
  const e = record.evidence;
  heading(root, '02', 'Read the saved Blockscout evidence.', 'These are observed results from the completed production evaluation. Playback reads a static case file and makes no Blockscout request.');
  facts(root, [
    ['Recorded on', `${record.recordedDate} · exact API time unavailable`],
    ['History counterparties compared', String(e.historyCounterpartiesCompared)],
    ['Retained transfer events', String(e.observedTransfers.length)],
    ['Policy version', `${record.receiptExcerpt.policyVersionFromSource} · from deployed source`]
  ]);
  const list = element('div', 'replay-evidence-list');
  if (!e.observedTransfers.length) list.append(paragraph('No transfer event was retained. No relationship is inferred from absent evidence.'));
  for (const transfer of e.observedTransfers) {
    const item = element('div', 'replay-evidence-item');
    append(item, element('strong', '', transfer.kind), paragraph(transfer.qualification, 'replay-copy'), txLink(transfer.txHash));
    list.append(item);
  }
  root.append(list);
}

function nodeDetails(detail, node) {
  detail.replaceChildren();
  append(detail, element('strong', '', node.roles.join(' · ') || 'Observed address'), paragraph(node.address, 'replay-address'), addressLink(node.address));
  if (node.txHashes.length) {
    detail.append(paragraph('Supporting transaction records:', 'replay-copy'));
    for (const hash of node.txHashes) detail.append(element('br'), txLink(hash));
  } else detail.append(paragraph('No supporting transaction was retained for this proposed-only relationship.', 'replay-copy'));
}

function renderGraph(root, record) {
  heading(root, '03', 'Trace observed relationships.', 'Solid evidence is limited to recorded transfer events. A proposed payment is shown separately because it was never sent.');
  const graph = buildRelationshipGraph(record);
  const layout = element('div', 'replay-graph');
  const detail = element('div', 'replay-graph-detail');
  const buttons = [];
  for (const [index, node] of graph.nodes.entries()) {
    const button = element('button', 'replay-node');
    button.type = 'button';
    button.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
    append(button, element('span', 'replay-node-label', node.roles.join(' · ') || 'Observed address'), element('span', 'replay-address', node.address));
    button.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
      nodeDetails(detail, node);
    });
    buttons.push(button);
    if (index === 1) append(layout, element('p', 'replay-connector', '→\n'), button);
    else layout.append(button);
  }
  nodeDetails(detail, graph.nodes[0]);
  root.append(layout, detail);
  const observed = graph.edges.filter((edge) => edge.type === 'OBSERVED_TRANSFER_EVENT');
  const legend = element('div', 'replay-legend');
  append(legend, element('span', '', `${observed.length} observed transfer event${observed.length === 1 ? '' : 's'}`), element('span', '', 'Proposed recipient · unsent'));
  root.append(legend);
  if (observed.length) {
    const events = element('div', 'replay-evidence-list');
    for (const edge of observed) {
      const row = element('p', 'replay-evidence-item');
      append(row, element('strong', '', 'Observed transfer event'), txLink(edge.txHash));
      events.append(row);
    }
    root.append(events);
  }
  root.append(paragraph(`Incoming-only list: ${record.evidence.incomingOnly === null ? 'not retained' : record.evidence.incomingOnly.length + ' recorded'}. Explicit trust list: ${record.evidence.explicitlyTrusted === null ? 'not retained' : record.evidence.explicitlyTrusted.length + ' recorded'}. Similarity findings: ${record.evidence.similarityFindings.length} recorded. Missing lists are not assumed empty.`));
}

function renderChecks(root, record) {
  heading(root, '04', 'Inspect each decision input.', 'The saved checks below are the actual recorded results. Points show each check’s contribution to the risk score.');
  for (const check of record.result.checks) {
    const row = element('div', 'replay-check');
    const body = element('div');
    append(body, element('strong', '', `${check.name} · ${check.status}`), paragraph(check.detail, ''));
    append(row, body, element('span', `replay-impact ${check.status.toLowerCase()}`, `+${check.scoreImpact}`));
    root.append(row);
  }
  const meter = element('div', 'replay-meter');
  meter.setAttribute('role', 'meter');
  meter.setAttribute('aria-label', 'Recorded risk score');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', '100');
  meter.setAttribute('aria-valuenow', String(record.result.riskScore));
  const fill = element('div', 'replay-meter-fill');
  fill.style.width = `${record.result.riskScore}%`;
  append(meter, fill);
  append(root, paragraph(`Recorded risk score: ${record.result.riskScore} / 100`, 'replay-copy'), meter);
}

function renderVerdict(root, record) {
  const result = record.result;
  heading(root, '05', 'Review the final verdict.', 'This is the decision returned for the saved candidate at the time of the production evaluation. It is not a fresh authorization.');
  root.append(element('span', `replay-verdict ${result.decision.toLowerCase()}`, `${result.decision} · ${result.riskScore}/100`));
  const decisive = result.checks.filter((check) => check.status !== 'PASS' || check.scoreImpact > 0);
  root.append(paragraph(decisive.length ? decisive.map((check) => check.detail).join(' ') : 'All recorded checks passed. A PASS for this historical candidate is not a guarantee about a new payment.'));
  root.append(paragraph('No proposed payment in this archive was broadcast by ScoutGuard. For a current decision, use Live evaluation and enforce its result before signing.'));
}

function renderProvenance(record) {
  const box = $('replay-evidence-content');
  box.replaceChildren();
  append(box, paragraph(`Recorded date: ${record.recordedDate}. Exact evaluation timestamp and original receipt ID were not retained. Policy ${record.receiptExcerpt.policyVersionFromSource} is established from deployed source revision ${record.sourceCommit}.`, ''), link('Read the contemporaneous production evidence record', record.sourceDocument));
  box.append(paragraph(record.evidence.sourceNote, ''));
  for (const transfer of record.evidence.observedTransfers) {
    const item = element('div', 'replay-evidence-item');
    append(item, element('strong', '', transfer.kind), paragraph('Event sender: ', ''));
    item.append(addressLink(transfer.from), paragraph('Event recipient: ', ''), addressLink(transfer.to), paragraph('Transaction: ', ''), txLink(transfer.txHash), paragraph(transfer.qualification, ''));
    box.append(item);
  }
  box.append(paragraph(`Recorded integrity digest: ${record.receiptExcerpt.integrityHash || 'not retained'}. This unkeyed SHA-256 digest is not an authenticated Blockscout signature.`, 'replay-address'));
}

function pause() {
  if (state.timer !== null) clearInterval(state.timer);
  state.timer = null;
  $('replay-play').disabled = !state.record || state.stage === 4;
  $('replay-pause').disabled = true;
}
function render() {
  if (!state.record) return;
  const root = $('replay-stage');
  root.replaceChildren();
  root.classList.remove('replay-enter');
  void root.offsetWidth;
  root.classList.add('replay-enter');
  [renderCandidate, renderEvidence, renderGraph, renderChecks, renderVerdict][state.stage](root, state.record);
  root.setAttribute('aria-label', labels[state.stage]);
  steps.forEach((button, index) => {
    if (index === state.stage) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  $('replay-previous').disabled = state.stage === 0;
  $('replay-next').disabled = state.stage === 4;
  $('replay-play').disabled = state.timer !== null || state.stage === 4;
  $('replay-pause').disabled = state.timer === null;
}
function setStage(index) { pause(); state.stage = Math.max(0, Math.min(4, index)); render(); }
function play() {
  if (!state.record || state.timer !== null || state.stage === 4) return;
  state.timer = setInterval(() => {
    if (state.stage < 4) state.stage += 1;
    if (state.stage === 4) pause();
    render();
  }, 3200);
  render();
}
function selectRecord(record) {
  pause();
  state.record = record;
  state.stage = 0;
  $('replay-player').classList.remove('hidden');
  $('replay-title').textContent = record.title;
  $('replay-date').textContent = `Recorded ${record.recordedDate} · exact evaluation time unavailable · policy ${record.receiptExcerpt.policyVersionFromSource}`;
  $('replay-provenance').textContent = 'Sanitized partial transcriptions of real production results. Exact API timestamps and complete original receipts were not retained.';
  for (const button of $('replay-records').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.recordId === record.id));
  renderProvenance(record);
  render();
}

$('replay-play').addEventListener('click', play);
$('replay-pause').addEventListener('click', () => { pause(); render(); });
$('replay-previous').addEventListener('click', () => setStage(state.stage - 1));
$('replay-next').addEventListener('click', () => setStage(state.stage + 1));
$('replay-restart').addEventListener('click', () => setStage(0));
for (const button of steps) button.addEventListener('click', () => setStage(Number(button.dataset.replayStage)));
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); render(); } });
$('replay-download').addEventListener('click', () => {
  if (!state.record) return;
  const blob = new Blob([JSON.stringify(sanitizedReceiptExcerpt(state.record), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = element('a');
  a.href = url;
  a.download = `scoutguard-${state.record.id}-sanitized-receipt.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

try {
  const response = await fetch('/replay/records.json', { cache: 'force-cache' });
  if (!response.ok) throw new Error('Saved case archive unavailable');
  state.records = validateReplayBundle(await response.json());
  if (!state.records.length) throw new Error('No validated recorded evaluations available');
  const list = $('replay-records');
  for (const record of state.records) {
    const button = element('button', 'replay-control', `${record.title} · ${record.result.decision}`);
    button.type = 'button';
    button.dataset.recordId = record.id;
    button.addEventListener('click', () => selectRecord(record));
    list.append(button);
  }
  selectRecord(state.records[0]);
} catch (error) {
  pause();
  $('replay-player').classList.add('hidden');
  $('replay-error').textContent = `Recorded replay unavailable: ${error instanceof Error ? error.message : 'invalid saved evidence'}. No decision will be shown from an unverified record.`;
  $('replay-error').classList.remove('hidden');
}
