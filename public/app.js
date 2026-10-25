const scenarioIds = ['legitimate-vendor', 'address-poisoning', 'unverified-contract', 'malicious-phishing', 'spending-cap-breach'];
let activeRequest = 0;

async function selectSpecimen(id) {
  if (!scenarioIds.includes(id)) return;
  const request = ++activeRequest;
  for (const key of scenarioIds) {
    const tab = document.getElementById(`tab-${key}`);
    tab.classList.toggle('active', key === id);
    tab.setAttribute('aria-pressed', String(key === id));
  }
  const badge = document.getElementById('verdict-badge');
  badge.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold border bg-stone-100 text-stone-800';
  badge.textContent = 'SIMULATED · RUNNING';
  document.getElementById('verdict-headline').textContent = 'Evaluating scenario…';
  document.getElementById('verdict-explanation').textContent = 'Running the actual policy engine against clearly labeled fixture data.';
  document.getElementById('specimen-checks').replaceChildren();
  document.getElementById('receipt-hash').textContent = 'Pending';
  document.getElementById('explorer-link').removeAttribute('href');

  try {
    const response = await fetch(`/api/simulate/${encodeURIComponent(id)}`, { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { scenario, evaluation, mode } = await response.json();
    if (request !== activeRequest) return;
    const decision = evaluation.decision;
    const color = decision === 'PASS' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
      decision === 'FLAG' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-red-100 text-red-900 border-red-300';
    badge.className = `px-3 py-1 rounded-full text-xs font-mono font-bold border ${color}`;
    badge.textContent = `${mode} · ${decision}`;
    document.getElementById('specimen-title').textContent = scenario.title;
    document.getElementById('verdict-headline').textContent = decision === 'PASS' ? 'Policy passed' :
      decision === 'FLAG' ? 'Human review required' : 'Transaction blocked';
    document.getElementById('verdict-explanation').textContent = evaluation.reasons.join(' ');
    document.getElementById('risk-score').textContent = `${evaluation.riskScore} / 100`;
    document.getElementById('tx-destination').textContent = scenario.tx.to;
    document.getElementById('tx-amount').textContent = `${scenario.tx.value} native units`;
    document.getElementById('tx-network').textContent = `Chain ${scenario.tx.chainId}`;
    document.getElementById('vanity-box').classList.toggle('hidden', id !== 'address-poisoning');
    const checks = document.getElementById('specimen-checks');
    for (const check of evaluation.checks) {
      const card = document.createElement('div');
      card.className = 'p-3 rounded-lg bg-[#FAF8F5] border border-[#E8E5DF] space-y-1';
      const heading = document.createElement('div');
      heading.className = 'flex items-center justify-between gap-3';
      const name = document.createElement('span');
      name.className = 'font-medium text-[#1C1917]';
      name.textContent = check.name;
      const status = document.createElement('span');
      status.className = 'text-[10px] font-mono font-bold';
      status.textContent = check.status;
      const detail = document.createElement('p');
      detail.className = 'text-xs text-[#57534E]';
      detail.textContent = check.detail;
      heading.append(name, status);
      card.append(heading, detail);
      checks.append(card);
    }
    document.getElementById('receipt-hash').textContent = evaluation.receipt.integrityHash;
    document.getElementById('explorer-link').href = evaluation.receipt.blockscoutExplorerUrl;
  } catch (error) {
    if (request !== activeRequest) return;
    badge.textContent = 'UNAVAILABLE';
    document.getElementById('verdict-headline').textContent = 'Demo request failed';
    document.getElementById('verdict-explanation').textContent = `Could not evaluate this scenario: ${error.message}`;
  }
}

selectSpecimen('legitimate-vendor');

const ETHEREUM_USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const liveForm = document.getElementById('live-evaluation-form');
let latestLiveRenderId = 0;
const liveCases = {
  observed: { from: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', to: '0x3f8702cfb1662195fcc98593789682da91dfaae3', asset: 'ETH', value: '0.1' },
  usdc: { from: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', to: '0x3f8702cfb1662195fcc98593789682da91dfaae3', asset: 'USDC', value: '250' },
  cap: { from: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', to: '0x3f8702cfb1662195fcc98593789682da91dfaae3', asset: 'USDC', value: '3000' }
};
document.querySelectorAll('[data-live-case]').forEach(button => button.addEventListener('click', () => {
  const selected = liveCases[button.dataset.liveCase];
  if (!selected) return;
  document.getElementById('live-from').value = selected.from;
  document.getElementById('live-to').value = selected.to;
  document.getElementById('live-asset').value = selected.asset;
  document.getElementById('live-value').value = selected.value;
  document.getElementById('live-error').classList.add('hidden');
  document.getElementById('live-submit').focus();
}));

function evidenceLink(label, href) {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'inline-flex min-h-11 items-center rounded-lg border border-[#D6D3D1] bg-white px-3 py-2 text-xs font-semibold text-[#2B7FFF] hover:border-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#1C1917]';
  link.textContent = `${label} ↗`;
  return link;
}

function renderLiveEvaluation(payload, candidate) {
  const renderId = ++latestLiveRenderId;
  const evaluation = payload.evaluation;
  if (evaluation?.receipt?.policyVersion !== 'v1.3.0-sprint2-hardening' || evaluation.receipt.integrityAlgorithm !== 'SHA-256-UNKEYED') {
    throw new Error('Unsupported API receipt version. A matching application release is required.');
  }
  if (evaluation.decision === 'PASS' && (!evaluation.history?.coverage.paginationComplete || evaluation.history.coverage.truncated)) {
    throw new Error('Incomplete history cannot support automatic payment approval.');
  }
  const payment = evaluation.receipt.transactionSummary;
  document.getElementById('live-payment').textContent = `Evaluated payment: ${payment.value} ${payment.asset === 'NATIVE' ? 'ETH' : payment.asset} · Recipient: ${payment.to} · Transaction destination: ${payment.transactionTo || payment.to} · Exact base units: ${payment.rawAmount || 'unavailable'}. Proposed and unsigned.`;
  const coverage = evaluation.history?.coverage;
  const coverageBox = document.getElementById('live-coverage');
  coverageBox.dataset.complete = String(Boolean(coverage?.paginationComplete));
  coverageBox.textContent = coverage
    ? `Sender history: ${coverage.pagesScanned.transactions} native pages + ${coverage.pagesScanned.tokenTransfers} token pages; ${coverage.recordsInspected} rows inspected; ${coverage.uniqueCounterparties} outbound counterparties. ${coverage.paginationComplete ? 'Pagination completed for these indexed endpoints at lookup time; this is not a safety guarantee.' : `Incomplete coverage — ${coverage.stopReasons.join(', ')}. A partial scan cannot authorize an automatic payment.`} Fetched: ${coverage.fetchedAt}. Hourly executed-spend accounting is unsupported.`
    : 'Required evidence was unavailable. No history completeness or address-safety claim is supported. Do not execute.';
  const decision = evaluation.decision;
  const badge = document.getElementById('live-result-badge');
  const palette = decision === 'PASS'
    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
    : decision === 'FLAG'
      ? 'bg-amber-100 text-amber-900 border-amber-300'
      : 'bg-red-100 text-red-900 border-red-300';
  badge.className = `inline-flex rounded-full border px-3 py-1 text-[10px] font-mono font-bold ${palette}`;
  badge.textContent = `${payload.mode} · ${payload.source} · ${decision}`;
  document.getElementById('live-result-title').textContent = decision === 'PASS'
    ? 'Live policy check passed'
    : decision === 'FLAG' ? 'Live review required' : 'Live transaction blocked';
  document.getElementById('live-result-summary').textContent = evaluation.reasons.join(' ');
  document.getElementById('live-risk').textContent = `${evaluation.riskScore} / 100`;
  document.getElementById('live-receipt').textContent = evaluation.receipt.integrityHash;

  const checks = document.getElementById('live-checks');
  checks.replaceChildren();
  for (const check of evaluation.checks) {
    const card = document.createElement('div');
    card.className = 'rounded-xl border border-[#E8E5DF] bg-[#FAF8F5] p-3 space-y-1';
    const heading = document.createElement('div');
    heading.className = 'flex items-start justify-between gap-3';
    const title = document.createElement('span');
    title.className = 'text-xs font-semibold text-[#1C1917]';
    title.textContent = check.name;
    const status = document.createElement('span');
    status.className = 'text-[10px] font-mono font-bold text-[#57534E]';
    status.textContent = check.status;
    const detail = document.createElement('p');
    detail.className = 'text-xs leading-relaxed text-[#57534E]';
    detail.textContent = check.detail;
    heading.append(title, status);
    card.append(heading, detail);
    if (check.metadata?.comparisonSource) {
      const provenance = document.createElement('p');
      provenance.className = 'text-[10px] font-mono text-[#78716C]';
      provenance.textContent = `Source: sender history · ${check.metadata.counterpartiesCompared ?? 0} counterparties compared`;
      card.append(provenance);
    }
    checks.append(card);
  }

  const links = document.getElementById('live-links');
  links.replaceChildren();
  if (coverage && coverage.pagesScanned.transactions + coverage.pagesScanned.tokenTransfers > 0) {
    links.append(evidenceLink('Inspected sender history', `https://eth.blockscout.com/address/${coverage.sender}`));
  }
  if (evaluation.checks.some(check => check.id !== 'SEC-FAIL-CLOSED' && check.evidenceUrl === evaluation.receipt.blockscoutExplorerUrl)) {
    links.append(evidenceLink('Evaluated recipient', evaluation.receipt.blockscoutExplorerUrl));
  }
  const historicalTx = evaluation.checks.find(check => check.metadata?.observedTransactionUrl)?.metadata.observedTransactionUrl;
  if (typeof historicalTx === 'string' && /^https:\/\/eth\.blockscout\.com\/tx\/0x[a-fA-F0-9]{64}$/.test(historicalTx)) {
    links.append(evidenceLink('Past transfer event', historicalTx));
  }
  const tokenCheck = evaluation.checks.find(check => check.id === 'SEC-TOKEN-USDC' || check.id === 'SEC-TOKEN-UNVERIFIED');
  if (tokenCheck?.evidenceUrl) links.append(evidenceLink('Evaluated USDC contract', tokenCheck.evidenceUrl));

  document.getElementById('live-empty').classList.add('hidden');
  document.getElementById('live-result').classList.remove('hidden');
  import('./live-evidence.js').then(module => {
    if (renderId === latestLiveRenderId) module.renderLiveEvidence(payload);
  }).catch(() => {
    if (renderId !== latestLiveRenderId) return;
    document.getElementById('live-intelligence').textContent = 'The evidence inspector could not load. The verdict above remains fail-closed; download and review are unavailable in this browser session.';
  });
}

document.getElementById('live-asset')?.addEventListener('change', event => {
  document.getElementById('live-value').value = event.target.value === 'USDC' ? '250' : '0.1';
});

liveForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const errorBox = document.getElementById('live-error');
  const submit = document.getElementById('live-submit');
  const from = document.getElementById('live-from').value.trim();
  const to = document.getElementById('live-to').value.trim();
  const value = document.getElementById('live-value').value.trim();
  const asset = document.getElementById('live-asset').value;
  errorBox.classList.add('hidden');
  latestLiveRenderId++;
  document.getElementById('live-result').classList.add('hidden');
  document.getElementById('live-intelligence').replaceChildren();
  document.getElementById('live-empty').classList.remove('hidden');
  if (!/^0x[a-fA-F0-9]{40}$/.test(from) || !/^0x[a-fA-F0-9]{40}$/.test(to) || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) || Number(value) <= 0) {
    errorBox.textContent = 'Enter valid 0x sender and recipient addresses and a positive decimal amount.';
    errorBox.classList.remove('hidden');
    (!from ? document.getElementById('live-from') : !to ? document.getElementById('live-to') : document.getElementById('live-value')).focus();
    return;
  }

  submit.disabled = true;
  submit.textContent = 'Querying live Blockscout data…';
  try {
    let candidate = { from, to, value, chainId: 1 };
    if (asset === 'USDC') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(to) || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) {
        throw new Error('USDC requires a valid recipient and up to six decimal places.');
      }
      const [whole, fraction = ''] = value.split('.');
      const raw = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
      const encodedRecipient = to.slice(2).toLowerCase().padStart(64, '0');
      const encodedAmount = raw.toString(16).padStart(64, '0');
      if (encodedAmount.length !== 64) throw new Error('USDC amount exceeds uint256.');
      candidate = { from, to: ETHEREUM_USDC, value: '0', chainId: 1,
        data: `0xa9059cbb${encodedRecipient}${encodedAmount}` };
    }
    const response = await fetch('/api/evaluate/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    renderLiveEvaluation(payload, { ...candidate, from, tokenAddress: asset === 'USDC' ? ETHEREUM_USDC : undefined });
  } catch (error) {
    errorBox.textContent = `Live check could not complete: ${error.message} Automatic approval was withheld. Correct the addresses or retry after one minute; a separate recorded investigation is available below.`;
    errorBox.classList.remove('hidden');
    errorBox.focus();
  } finally {
    submit.disabled = false;
    submit.textContent = 'Run live Blockscout check';
  }
});

document.getElementById('research-replay')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  const error = document.getElementById('research-error');
  button.disabled = true;
  button.textContent = 'Replaying case…';
  error.classList.add('hidden');
  try {
    const response = await fetch('/api/research-case/poisoning');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const caseData = await response.json();
    document.getElementById('research-verdict').textContent = `${caseData.mode} · ${caseData.decision}`;
    document.getElementById('research-addresses').textContent = `Victim: ${caseData.victim} · Look-alike: ${caseData.candidate} · Reference: ${caseData.reference}`;
    document.getElementById('research-explanation').textContent = `${caseData.explanation} Matched ${caseData.prefixMatchLength} leading and ${caseData.suffixMatchLength} trailing hex characters.`;
    const links = document.getElementById('research-links');
    links.replaceChildren(evidenceLink('Blockscout poisoning transaction', caseData.blockscoutTxUrl), evidenceLink('Research dataset', caseData.sourceUrl));
    document.getElementById('research-limitation').textContent = caseData.limitation;
    document.getElementById('research-result').classList.remove('hidden');
  } catch (cause) {
    error.textContent = `Recorded case could not load: ${cause.message}`;
    error.classList.remove('hidden');
  } finally {
    button.disabled = false;
    button.textContent = 'Replay recorded case';
  }
});
