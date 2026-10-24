/** Opt-in read-only check. Never run by npm test; at most six provider calls, no retries. */
import 'dotenv/config';
import { BlockscoutClient, HistoryUnavailableError } from '../src/core/blockscout-client.js';
import { PoisoningDetector } from '../src/core/poisoning-detector.js';
const victim = '0x3e14605bf3ebc239a6ba1fdd4cd9daf01f382faf';
const suspectedPoisoner = '0xcb9d34bbb0480e714f4c004cfd8cb72b776db1b6';
const researchReference = '0xcb9da91c741820157e81ae21cddd5d207997b1b6';
try {
  const history = await new BlockscoutClient().getSenderHistory(1, victim,
    { maxPages: 3, maxRecords: 300, maxProviderCalls: 6, maxDurationMs: 10000 });
  const recovered = history.counterparties.find(peer => peer.address === researchReference);
  console.log(JSON.stringify({ mode: 'READ_ONLY_HISTORY_RECONSTRUCTION', timestamp: new Date().toISOString(),
    referenceRecovered: Boolean(recovered), coverage: history.coverage,
    // Never inject the research reference into the live comparison set.
    finding: new PoisoningDetector().detectVanityCollision(suspectedPoisoner, history.counterparties),
    evidence: history.evidence.filter(event => event.address === researchReference),
    limitation: 'This is a bounded present-day history lookup. It does not show prevention of a historical attack.' }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ mode: 'READ_ONLY_HISTORY_RECONSTRUCTION', status: 'BLOCKED',
    referenceRecovered: false, coverage: error instanceof HistoryUnavailableError ? error.history.coverage : undefined,
    limitation: 'Required history unavailable; no live detection claim is supported.' }, null, 2));
  process.exitCode = 1;
}
