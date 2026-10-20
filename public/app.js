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
