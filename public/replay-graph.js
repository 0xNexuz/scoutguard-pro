import { buildRelationshipGraph, explorerAddress, explorerTransaction } from './replay-data.js';
const NS = 'http://www.w3.org/2000/svg';
const short = address => `${address.slice(0, 6)}…${address.slice(-4)}`;
function html(tag, className, text) {
  const node = document.createElement(tag); if (className) node.className = className;
  if (text !== undefined) node.textContent = text; return node;
}
function svg(tag, attributes = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text; return node;
}
function link(text, href) {
  const a = html('a', 'replay-link', text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
}
const kinds = {
  PROPOSED_UNSENT: { label: 'Proposed payment · unsigned', style: 'proposed' },
  OBSERVED_TRANSFER_EVENT: { label: 'Observed outgoing/event relationship', style: 'observed' },
  INCOMING_ONLY: { label: 'Incoming-only observation', style: 'incoming' },
  EXPLICITLY_TRUSTED: { label: 'Operator-configured reference', style: 'configured' },
  VERIFIED_SIMILARITY: { label: 'Recorded similarity finding', style: 'similarity' }
};

/** Draw only the graph derived from validated retained evidence. Never fetches or invents data. */
export function renderRelationshipGraph(root, record, onInteract = () => {}) {
  const graph = buildRelationshipGraph(record);
  const compact = window.matchMedia('(max-width: 640px)').matches;
  const width = compact ? 300 : 720;
  const height = compact ? Math.max(390, graph.nodes.length * 210) : graph.nodes.length === 2 ? 300 : 520;
  const positions = graph.nodes.map((_, i) => graph.nodes.length === 2
    ? compact ? { x: 150, y: 95 + i * 220 } : { x: 145 + i * 430, y: 150 }
    : compact ? { x: 150, y: 95 + i * 210 }
      : { x: width / 2 + 220 * Math.cos(2 * Math.PI * i / graph.nodes.length), y: height / 2 + 170 * Math.sin(2 * Math.PI * i / graph.nodes.length) });
  const network = html('div', 'evidence-network');
  const canvas = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': 'Recorded relationship graph', class: 'evidence-network-svg' });
  canvas.append(svg('desc', {}, 'Solid lines are retained transfer evidence. Dashed lines are proposed unsigned payments. Select a node or edge for provenance. Keyboard buttons below provide the same details.'));
  const defs = svg('defs');
  for (const kind of Object.values(kinds)) {
    const marker = svg('marker', { id: `arrow-${kind.style}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    marker.append(svg('path', { d: 'M 0 0 L 10 5 L 0 10 Z', class: `graph-arrow ${kind.style}` })); defs.append(marker);
  }
  canvas.append(defs);
  const detail = html('div', 'replay-graph-detail'); detail.setAttribute('aria-live', 'polite'); detail.setAttribute('aria-atomic', 'true');
  const nodeControls = html('div', 'graph-node-controls'); nodeControls.setAttribute('role', 'group'); nodeControls.setAttribute('aria-label', 'Select graph address');
  const edgeControls = html('div', 'graph-edge-controls'); edgeControls.setAttribute('role', 'group'); edgeControls.setAttribute('aria-label', 'Inspect relationship evidence');
  const controls = [], svgControls = [];
  function activate(index, renderDetails) {
    onInteract(); controls.forEach((node, i) => node.setAttribute('aria-pressed', String(i === index)));
    svgControls.forEach((node, i) => node.setAttribute('aria-pressed', String(i === index)));
    detail.replaceChildren(); renderDetails();
  }
  function nodeDetails(node) {
    detail.append(html('strong', '', node.roles.join(' · ') || 'Retained observed address'), html('p', 'replay-address', node.address), link('Address in Blockscout', explorerAddress(node.address)));
    for (const hash of node.txHashes) detail.append(html('p', '', 'Retained supporting event:'), link(short(hash), explorerTransaction(hash)));
    if (!node.txHashes.length) detail.append(html('p', '', 'No supporting transaction was retained for this proposed-only address.'));
    detail.append(html('p', '', 'An observation is a comparison reference, not verified trust or proof that this proposed payment occurred.'));
  }
  function wireSVG(node, index, renderDetails) {
    node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button'); node.setAttribute('aria-pressed', String(index === 0));
    node.addEventListener('click', () => activate(index, renderDetails));
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(index, renderDetails); }
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? svgControls.length - 1
          : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + svgControls.length) % svgControls.length;
        svgControls[next]?.focus(); svgControls[next]?.dispatchEvent(new Event('click'));
      }
    });
    svgControls[index] = node;
  }
  graph.edges.forEach((edge, i) => {
    const from = positions[graph.nodes.findIndex(node => node.address.toLowerCase() === edge.from)];
    const to = positions[graph.nodes.findIndex(node => node.address.toLowerCase() === edge.to)];
    const kind = kinds[edge.type], index = graph.nodes.length + i;
    const details = () => {
      detail.append(html('strong', '', kind.label), html('p', 'replay-address', `${edge.from} → ${edge.to}`));
      if (edge.txHash) detail.append(link('Inspect retained transaction', explorerTransaction(edge.txHash)), html('p', '', edge.type === 'OBSERVED_TRANSFER_EVENT'
        ? 'A token event sender may differ from the transaction initiator. This event is historical; it is not the proposed payment.'
        : 'This link supports the retained reference or finding; it is not proof of a ScoutGuard payment.'));
      else detail.append(html('p', '', 'Proposed unsigned payment. No transaction hash exists for this candidate; nothing was broadcast.'));
    };
    const group = svg('g', { class: `graph-edge ${kind.style}`, 'aria-label': kind.label });
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
    const lane = i % 2 ? -1 : 1;
    const radius = compact ? 65 : 63;
    const ux = length ? dx / length : 0, uy = length ? dy / length : 0;
    const d = length
      ? `M ${from.x + ux * radius} ${from.y + uy * radius} Q ${(from.x + to.x) / 2 - uy * lane * 80} ${(from.y + to.y) / 2 + ux * lane * 80} ${to.x - ux * radius} ${to.y - uy * radius}`
      : `M ${from.x - 45} ${from.y + 45} C ${from.x - 120} ${from.y + 140} ${from.x + 120} ${from.y + 140} ${from.x + 45} ${from.y + 45}`;
    group.append(svg('path', { d, class: 'graph-edge-hit', fill: 'none' }), svg('path', { d, class: 'graph-edge-line', fill: 'none', 'marker-end': `url(#arrow-${kind.style})` }));
    wireSVG(group, index, details); canvas.append(group);
    const button = html('button', `replay-control graph-evidence-${kind.style}`, kind.label); button.type = 'button';
    button.addEventListener('click', () => activate(index, details)); controls[index] = button; edgeControls.append(button);
  });
  graph.nodes.forEach((node, i) => {
    const point = positions[i], sender = node.address.toLowerCase() === record.candidate.sender.toLowerCase();
    const group = svg('g', { class: `graph-address ${sender ? 'sender' : 'recipient'}`, 'aria-label': `${node.roles.join(', ')} ${node.address}` });
    group.append(svg('circle', { cx: point.x, cy: point.y, r: compact ? 65 : 63 }),
      svg('text', { x: point.x, y: point.y - 9, 'text-anchor': 'middle', class: 'graph-address-label' }, sender ? 'Sender wallet' : node.address.toLowerCase() === record.candidate.recipient.toLowerCase() ? 'Recipient' : 'Reference'),
      svg('text', { x: point.x, y: point.y + 17, 'text-anchor': 'middle', class: 'graph-address-short' }, short(node.address)));
    wireSVG(group, i, () => nodeDetails(node)); canvas.append(group);
    const button = html('button', 'replay-control graph-node-control', `${sender ? 'Sender' : 'Recipient / reference'} · ${short(node.address)}`); button.type = 'button';
    button.addEventListener('click', () => activate(i, () => nodeDetails(node))); controls[i] = button; nodeControls.append(button);
  });
  const legend = html('div', 'replay-legend');
  for (const type of new Set(graph.edges.map(edge => edge.type))) legend.append(html('span', `graph-key ${kinds[type].style}`, kinds[type].label));
  network.append(html('span', `replay-verdict ${record.result.decision.toLowerCase()}`, `Recorded candidate: ${record.result.decision} · ${record.result.riskScore}/100`), canvas, nodeControls, edgeControls, legend, detail);
  root.append(network, html('p', 'replay-copy', `Only ${graph.nodes.length} supported addresses are shown. Recorded candidate outcome: ${record.result.decision}; this is not a malicious-address label. Incoming-only list: ${record.evidence.incomingOnly === null ? 'not retained' : 'retained'}. Configured references: ${record.evidence.explicitlyTrusted === null ? 'not retained' : 'retained'}. Similarity findings: ${record.evidence.similarityFindings.length} retained.`));
  controls.forEach(node => node?.setAttribute('aria-pressed', 'false'));
  controls[0].setAttribute('aria-pressed', 'true'); nodeDetails(graph.nodes[0]);
}
