# Problem

Autonomous payment agents can sign a transfer to an unfamiliar or visually deceptive address without reviewing explorer history. ScoutGuard gives the caller a pre-signing risk decision using address metadata, source-verification status, configured known counterparties, and spending policy.

Target user: developer operating an EVM payment agent or treasury automation. Current alternative: manually inspect Blockscout and implement policy checks in each agent. This prototype reduces that work but cannot guarantee safety, detect all poisoning attempts, or stop a caller that ignores the result. User validation is **UNVERIFIED**.
