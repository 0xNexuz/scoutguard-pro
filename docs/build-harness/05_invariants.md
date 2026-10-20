# Invariants

| ID | Invariant | Evidence | Status |
|---|---|---|---|
| INV-001 | Registered look-alike recipient does not pass | `test/scoutguard.test.ts` | VERIFIED locally |
| INV-002 | A clean registered fixture can pass | `test/scoutguard.test.ts` | VERIFIED with mocks |
| INV-003 | Required Blockscout failure cannot pass | `test/scoutguard.test.ts` | VERIFIED with injected outage |
| INV-004 | `FLAG` never allows execution | `PolicyEngine.synthesizeDecision` | Code verified; direct test pending |
| INV-005 | Live PRO response has a valid digest | Authenticated live test pending | UNVERIFIED |

The digest is a hash, not a signature. The policy's `maxHourlyVolumeEth` field is currently unused and must not be claimed as enforced.
