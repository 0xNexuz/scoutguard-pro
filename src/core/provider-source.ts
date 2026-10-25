import { ProviderRequestTrace } from '../types/index.js';

/** Summarize only actual successful upstream responses; keep partial failures visible. */
export function classifyProviderSource(trace: ProviderRequestTrace[] | undefined): string {
  if (!trace?.length) return 'NO_PROVIDER_TRACE';
  const successful = trace.filter(request => request.httpStatus !== undefined
    && request.httpStatus >= 200 && request.httpStatus < 300 && !request.errorCategory);
  if (!successful.length) return 'BLOCKSCOUT_UNAVAILABLE';
  const source = successful.every(request => request.source === 'BLOCKSCOUT_PRO') ? 'BLOCKSCOUT_PRO'
    : successful.every(request => request.source === 'BLOCKSCOUT_PUBLIC_API') ? 'BLOCKSCOUT_PUBLIC_API'
      : 'MIXED_BLOCKSCOUT_SOURCES';
  return successful.length === trace.length ? source : `${source}_PARTIAL`;
}
