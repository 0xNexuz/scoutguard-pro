# X showcase drafts — do not post automatically

Attach a genuine product visual. Recommended: the final released live inspector after a successful traced lookup. The existing [recorded investigation screenshot](../images/recorded-replay.png) is a valid fallback **if captioned as recorded**. The [timeout inspector](../images/live-provider-timeout-1280.png) is evidence of fail-closed behavior, not a success visual. Do not use fixture browser screenshots as fresh provider proof.

## Concise post

Before an AI agent pays, ScoutGuard checks the chain. 🔎

Using @blockscout PRO, it inspects recipient history, ERC-20 transfers and contract evidence, then flags look-alikes or blocks over-limit USDC payments before signing. Try a live check or replay real evaluations: https://scoutguard.vercel.app

Code: https://github.com/0xNexuz/scoutguard-pro @craftorahq

## Expanded thread

**1/3** An autonomous agent can copy a poisoned address from transaction history and pay before anyone catches it. ScoutGuard evaluates the *unsigned* payment first. It returns `PASS`, `FLAG` or `BLOCK`; it never holds a wallet key.

**2/3** @blockscout PRO supplies recipient details, activity counters, bounded sender transaction/ERC-20 history and contract source metadata. ScoutGuard separates observed outgoing peers from incoming-only noise. The live inspector shows actual upstream statuses, links and scan limits; partial history means review, not a clean pass.

**3/3** Sprint 2 adds canonical USDC checks, a public live form, recorded investigation replay and evidence export. Try it: https://scoutguard.vercel.app · Source: https://github.com/0xNexuz/scoutguard-pro · @craftorahq

Attach a visual and verify the final release URL before posting. The official [Sprint 2 brief](https://www.craftora.tech/sprints/blockscout-pro-api-buildathon/) requires an X post with the organizer tags and a project visual plus a live or GitHub link.
