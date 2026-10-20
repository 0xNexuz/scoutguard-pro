# Authenticated Blockscout PRO evaluation — 2026-10-20

Environment: local Windows checkout, Node.js 24, authenticated Blockscout PRO gateway on Ethereum chain 1. The key stayed in a Git-ignored `.env` file and is omitted from this record. Node used the Windows system certificate authorities via `--use-system-ca`; TLS verification remained enabled.

## Observed results

| Check | Result |
|---|---|
| Authenticated PRO address detail | HTTP 200 |
| Authenticated PRO address counters | HTTP 200 |
| Local evaluation of `0x1111111111111111111111111111111111111111` on Ethereum | `PASS`, `executionAllowed: true` |
| Evaluation check IDs | `SEC-POISON-OK`, `SEC-CONTRACT-EOA`, `SEC-POLICY-OK` |
| Explorer navigation URL returned | https://eth.blockscout.com/address/0x1111111111111111111111111111111111111111 |
| Production-mode local `POST /api/evaluate` without service key | HTTP 401 |
| Same request with service key | `PASS`, `executionAllowed: true` |
| Authenticated PRO Base chain 8453 | HTTP 402; gateway stated Builder, Business, or Pro plan required |

The Explorer URL is the address page linked by the application. It is not proof that an on-chain transfer occurred, and no transaction was signed or broadcast. The direct address/counters responses and evaluation were observed locally; an independent Explorer comparison and public deployment were not completed.

## Regression and limitations

The PRO URL builder initially dropped the chain ID by resolving an absolute `/api/v2` path. It now preserves `/1/api/v2/...` for Ethereum and `/8453/api/v2/...` for Base. A regression test checks the chain-scoped URL and API-key query parameter. `npm run build` and `npm test` passed afterward (17/17 tests).

A high-activity Ethereum address did not return its detail response within a 30-second direct request, so this evidence uses a simpler EOA. Endpoint timeouts were increased to 12 seconds in the client. This evidence establishes one functioning authenticated Ethereum path, not performance or coverage across every configured chain.
