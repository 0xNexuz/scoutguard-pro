import { isIP } from 'node:net';
import { AuditReceipt, EvaluationResult, TransactionCandidate } from '../types/index.js';
import { normalizePayment } from '../core/payment-normalizer.js';
import { ReceiptSigner, canonicalSerialize, paymentSummary } from '../core/receipt-signer.js';
import { PolicyEngine } from '../core/policy-engine.js';

export type Evaluator = (candidate: TransactionCandidate) => Promise<EvaluationResult>;
export interface IsolatedSigner {
  signTransaction(candidate: Readonly<TransactionCandidate>): Promise<string>;
}
export type AgentOutcome =
  | { status: 'SIGNED'; artifact: string; receipt: AuditReceipt }
  | { status: 'BLOCKED' | 'REVIEW_REQUIRED' | 'AUTHORIZATION_DENIED' | 'FAILED_CLOSED'; reason: string };

function immutable<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) immutable(item);
    Object.freeze(value);
  }
  return value;
}

/** Verifies consistency and exact payment binding, NOT service authenticity. Use a trusted evaluator/HTTPS. */
export function assertEvaluationBinding(evaluation: EvaluationResult, candidate: TransactionCandidate,
  now = Date.now(), maxAgeMs = 30_000): void {
  if (!Number.isFinite(now) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 60_000) throw new Error('Invalid freshness policy');
  const payment = normalizePayment(candidate);
  const receipt = evaluation?.receipt;
  if (!receipt || !new ReceiptSigner().verifyReceipt(receipt)) throw new Error('Receipt consistency check failed');
  if (receipt.timestamp > now + 2000 || now - receipt.timestamp > maxAgeMs) throw new Error('Evaluation is stale or future-dated');
  if (receipt.agentId !== (candidate.agentId ?? 'procurement-bot-01')) throw new Error('Agent binding mismatch');
  if (canonicalSerialize(receipt.transactionSummary) !== canonicalSerialize(paymentSummary(payment))) throw new Error('Transaction binding mismatch');
  if (canonicalSerialize(evaluation.checks) !== canonicalSerialize(receipt.checks)
    || evaluation.decision !== receipt.decision || evaluation.riskScore !== receipt.riskScore) throw new Error('Evaluation envelope mismatch');
  if (!Array.isArray(evaluation.checks) || !evaluation.checks.length || evaluation.checks.some(check =>
    !['PASS', 'WARN', 'FAIL'].includes(check.status) || !Number.isFinite(check.scoreImpact) || check.scoreImpact < 0 || check.scoreImpact > 100)) {
    throw new Error('Invalid security checks');
  }
  const synthesized = new PolicyEngine().synthesizeDecision(evaluation.checks);
  if (synthesized.decision !== evaluation.decision || synthesized.riskScore !== evaluation.riskScore
    || synthesized.executionAllowed !== evaluation.executionAllowed || synthesized.suggestedAction !== evaluation.suggestedAction) throw new Error('Decision consistency mismatch');
  if (!receipt.historyCoverage || canonicalSerialize(receipt.historyCoverage) !== canonicalSerialize(evaluation.history?.coverage)
    || receipt.historyCoverage.chainId !== payment.chainId || receipt.historyCoverage.sender.toLowerCase() !== payment.from.toLowerCase()) throw new Error('History binding mismatch');
  if (evaluation.executionAllowed && (!receipt.historyCoverage.paginationComplete || receipt.historyCoverage.truncated
    || receipt.historyCoverage.providerErrors.length > 0)) throw new Error('Incomplete history cannot authorize execution');
}

/** No automatic human approval. FLAG must leave this path and receive a fresh evaluation after review. */
export async function runPaymentAgent(candidate: TransactionCandidate, options: {
  evaluate: Evaluator;
  signer: IsolatedSigner;
  authorize: (context: { candidate: Readonly<TransactionCandidate>; receipt: Readonly<AuditReceipt> }) => Promise<boolean>;
  now?: () => number;
  maxAgeMs?: number;
}): Promise<AgentOutcome> {
  try {
    const snapshot = immutable(structuredClone(candidate));
    normalizePayment(snapshot);
    const evaluation = immutable(structuredClone(await options.evaluate(snapshot)));
    const now = options.now ?? Date.now;
    assertEvaluationBinding(evaluation, snapshot, now(), options.maxAgeMs);
    if (evaluation.decision === 'BLOCK') return { status: 'BLOCKED', reason: 'ScoutGuard requires aborting this candidate.' };
    if (evaluation.decision === 'FLAG') return { status: 'REVIEW_REQUIRED', reason: 'Explicit review and a fresh evaluation are required; this adapter cannot override FLAG.' };
    if (!evaluation.executionAllowed || evaluation.decision !== 'PASS') throw new Error('Missing execution permission');
    if (await options.authorize({ candidate: snapshot, receipt: evaluation.receipt }) !== true) {
      return { status: 'AUTHORIZATION_DENIED', reason: 'Downstream authorization was not granted.' };
    }
    // Approval can take time; recheck the same immutable transaction immediately before signing.
    assertEvaluationBinding(evaluation, snapshot, now(), options.maxAgeMs);
    const artifact = await options.signer.signTransaction(snapshot);
    return { status: 'SIGNED', artifact, receipt: evaluation.receipt };
  } catch {
    // Never expose transport details or credentials in application-visible errors.
    return { status: 'FAILED_CLOSED', reason: 'No signing permitted: evaluation, binding, freshness or authorization failed.' };
  }
}

/** Protected service transport. HTTP is allowed only for explicitly opted-in loopback tests. */
export function createServiceEvaluator(options: { endpoint: string; serviceKey: string; allowLoopbackHttp?: boolean }): Evaluator {
  const url = new URL(options.endpoint);
  const loopback = url.hostname === 'localhost' || url.hostname === '[::1]' || (isIP(url.hostname) === 4 && url.hostname.startsWith('127.'));
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/api/evaluate'
    || (url.protocol !== 'https:' && !(options.allowLoopbackHttp && url.protocol === 'http:' && loopback)) || !options.serviceKey) {
    throw new Error('A trusted HTTPS protected service endpoint and key are required');
  }
  return async candidate => {
    try {
      const response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12_000),
        headers: { 'Content-Type': 'application/json', 'x-scoutguard-key': options.serviceKey }, body: JSON.stringify(candidate) });
      if (!response.ok) throw new Error('Service unavailable');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Missing response');
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > 1_000_000) { await reader.cancel(); throw new Error('Oversized response'); }
        chunks.push(part.value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as EvaluationResult;
    } catch { throw new Error('ScoutGuard service unavailable; execution prohibited'); }
  };
}
