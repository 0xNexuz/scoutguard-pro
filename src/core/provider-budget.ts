/** A fresh scope for each evaluation. No retries; all endpoints share these bounds. */
export interface ProviderBudget {
  controller: AbortController;
  deadline: number;
  maxCalls: number;
  calls: number;
  nextRequestAt: number;
  minIntervalMs: number;
  requestTimeoutMs: number;
}
export function createProviderBudget(overrides: Partial<ProviderBudget> = {}): ProviderBudget {
  return { controller: new AbortController(), deadline: Date.now() + 10_000, maxCalls: 12, calls: 0, nextRequestAt: 0,
    minIntervalMs: 250, requestTimeoutMs: 4000, ...overrides };
}
export class ProviderError extends Error {
  constructor(public readonly code: string) { super(`Blockscout unavailable (${code})`); }
}

// Shared by all evaluations in this Node process, including protected traffic.
let nextProviderRequestAt = 0;

export async function requestJson(url: string, budget: ProviderBudget): Promise<any> {
  if (budget.controller.signal.aborted) throw new ProviderError('CANCELLED');
  if (budget.calls >= budget.maxCalls) throw new ProviderError('REQUEST_BUDGET');
  const scheduled = Math.max(Date.now(), budget.nextRequestAt, budget.minIntervalMs ? nextProviderRequestAt : 0);
  if (scheduled >= budget.deadline) throw new ProviderError('TIME_BUDGET');
  budget.calls++;
  budget.nextRequestAt = scheduled + budget.minIntervalMs;
  if (budget.minIntervalMs) nextProviderRequestAt = budget.nextRequestAt;
  if (scheduled > Date.now()) await new Promise<void>((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(new ProviderError('CANCELLED')); };
    const timer = setTimeout(() => { budget.controller.signal.removeEventListener('abort', onAbort); resolve(); }, scheduled - Date.now());
    budget.controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  if (budget.controller.signal.aborted) throw new ProviderError('CANCELLED');
  const timeout = Math.min(budget.requestTimeoutMs, budget.deadline - Date.now());
  if (timeout <= 0) throw new ProviderError('TIME_BUDGET');
  try {
    const response = await fetch(url, { signal: AbortSignal.any([AbortSignal.timeout(timeout), budget.controller.signal]), redirect: 'error' });
    if (!response.ok) throw new ProviderError(`HTTP_${response.status}`);
    // Bound response allocation and keep body reads inside the same abort deadline.
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError('MALFORMED_RESPONSE');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); throw new ProviderError('RESPONSE_TOO_LARGE'); }
      chunks.push(part.value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ProviderError('MALFORMED_RESPONSE');
    return data;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && /Timeout|Abort/.test(error.name)) throw new ProviderError('TIMEOUT');
    // Never relay fetch errors, URLs, headers, response bodies, or credentials.
    throw new ProviderError('INVALID_OR_UNAVAILABLE_RESPONSE');
  }
}
