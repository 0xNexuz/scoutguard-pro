# Ecosystem gap

Blockscout exposes address counters, metadata, contract source, and explorer links. ScoutGuard combines these into a pre-signing policy decision. The integration is load-bearing: a required upstream failure causes `BLOCK`, and the caller cannot receive a clean decision without Blockscout data.

Differentiation and adoption versus existing security tools are **UNVERIFIED**. Do not claim a novel poisoning detection algorithm or broad threat intelligence. The current collision check compares only with a local trusted registry; it does not inspect a sender's transaction graph.
