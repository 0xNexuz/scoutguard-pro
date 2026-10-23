# ScoutGuard PRO — Craftora project page draft

## The problem

Autonomous payment agents can send funds without a person checking the destination first. A look-alike address inserted into wallet history, an unverified recipient contract, or a payment above an agent's spending policy can turn a routine transfer into a costly mistake. A block explorer shows useful evidence, but the agent needs a decision before it signs.

## Who it is for

ScoutGuard PRO is for developers building AI payment agents, treasury automation, and on-chain procurement workflows. It is a pre-signing check that the caller can place between payment planning and wallet signing.

## How it works with Blockscout

For a proposed ETH or allowlisted USDC payment, ScoutGuard queries Blockscout PRO for recipient counters, address metadata, contract source status, and the sender's recent outbound transaction and ERC-20 transfer history. It compares the destination with counterparties derived from that history to flag look-alike addresses. It then applies agent and asset specific spending limits and returns `PASS`, `FLAG`, or `BLOCK` with individual check results, a local integrity digest, and Blockscout Explorer links. If required Blockscout data is unavailable, the decision is `BLOCK`. ScoutGuard never signs or broadcasts a transaction. A `PASS` is a policy result, not a guarantee of safety or proof that a historical payment occurred.

## Try the product

Open https://scoutguard.vercel.app/ and use **Live check**. Pick one of the proposed payment presets or enter Ethereum sender and recipient addresses, choose ETH or USDC, and select **Run live Blockscout check**. The public route needs no ScoutGuard service key and allows five checks per minute per client in one server process. The sample sender and recipient are public addresses whose recent outbound relationship was observed through Blockscout. Try 0.1 ETH for a normal policy result, 250 USDC for the supported token path, or 3,000 USDC to see the procurement agent's spending cap block. These are candidate evaluations against live data, not claims of real payments or attacks.

The **Demo** section contains five clearly labeled fixture simulations for reproducible attack and policy walkthroughs. The **Integration** section shows a server-side example that checks the protected API before invoking a USDC transfer. Production callers must enforce `executionAllowed` and bind approval to the exact transaction they sign.

Repository: https://github.com/0xNexuz/scoutguard-pro

## Evidence and limitations

The live result links the sender history, recipient, and USDC contract pages that informed the decision. For the sample recipient it also links a [past on-chain token transfer event](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f) observed between the sample addresses. That event is historical evidence of an address relationship; the proposed payment was not broadcast. The poisoning comparison currently covers recent Blockscout pages, not a complete lifetime history. Rate limiting is in process and needs a shared store for scaled production use. Base USDC is implemented but this Blockscout key's Base access returned HTTP 402, so the public judge path is Ethereum. Docker execution and a real wallet signer integration have not been verified.

**Publication note:** The Sprint 2 revision described above is currently verified locally and must be pushed and deployed before this text is published as a description of the live site.
