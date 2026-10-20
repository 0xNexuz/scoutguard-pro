# SDK extraction

Current reusable primitive: TypeScript `ScoutGuard` class inside the repository. There is **no published `@scoutguard/sdk` package**, Python package, or ElizaOS plugin. The UI now shows a direct HTTP integration example instead of implying those packages exist.

Extract a package only after the live API and transaction-binding contract are verified. Future API should require an explicit trusted counterparty registry and policy, expose a verifiable receipt format, and reject unsupported transaction types. Distribution is **PLANNED**, not implemented.
