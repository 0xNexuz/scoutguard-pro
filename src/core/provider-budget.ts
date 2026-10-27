import { randomUUID } from 'node:crypto';
import { ProviderRequestTrace } from '../types/index.js';

/** A fresh scope for each evaluation. No retries; all endpoints share these bounds. */
export interface ProviderBudget {
  evaluationId: string;
  trace: ProviderRequestTrace[];
  controller: AbortController;
  deadline: number;
  maxCalls: number;
  calls: number;
  nextRequestAt: number;
  minIntervalMs: number;
  requestTimeoutMs: number;
  parallelHistoryFirstPages: boolean;
}
export function createProviderBudget(overrides: Partial<ProviderBudget> = {}): ProviderBudget {
  return { evaluationId: randomUUID(), trace: [], controller: new AbortController(), deadline: Date.now() + 10_000, maxCalls: 12, calls: 0, nextRequestAt: 0,
    minIntervalMs: 250, requestTimeoutMs: 4000, parallelHistoryFirstPages: false, ...overrides };
}
export class ProviderError extends Error {
  constructor(public readonly code: string) { super(`Blockscout unavailable (${code})`); }
}

// Shared by all evaluations in this Node process, including protected traffic.
let nextProviderRequestAt = 0;

export async function requestJson(url: string, budget: ProviderBudget, metadata?: Pick<ProviderRequestTrace, 'chainId' | 'endpoint' | 'source' | 'page'>): Promise<any> {
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
  const started = Date.now();
  const trace = metadata && { evaluationId: budget.evaluationId, ...metadata,
    timestamp: new Date(started).toISOString(), durationMs: 0 } as ProviderRequestTrace;
  if (trace) budget.trace.push(trace);
  try {
    const response = await fetch(url, { signal: AbortSignal.any([AbortSignal.timeout(timeout), budget.controller.signal]), redirect: 'error' });
    if (trace) trace.httpStatus = response.status;
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
    if (trace) {
      if (Array.isArray(data.items)) trace.recordCount = data.items.length;
      if (Object.hasOwn(data, 'next_page_params')) trace.hasNextPage = data.next_page_params !== null;
    }
    return data;
  } catch (error) {
    if (trace) trace.errorCategory = error instanceof ProviderError ? error.code
      : budget.controller.signal.aborted ? 'CANCELLED'
        : error instanceof Error && /Timeout|Abort/.test(error.name) ? 'TIMEOUT' : 'INVALID_OR_UNAVAILABLE_RESPONSE';
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && /Timeout|Abort/.test(error.name)) throw new ProviderError('TIMEOUT');
    // Never relay fetch errors, URLs, headers, response bodies, or credentials.
    throw new ProviderError('INVALID_OR_UNAVAILABLE_RESPONSE');
  } finally {
    if (trace) trace.durationMs = Date.now() - started;
  }
}
