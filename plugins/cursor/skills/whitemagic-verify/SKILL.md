---
name: whitemagic-verify
description: Verify cryptographic continuity receipts, audit agent actions, inspect provenance, and check task governance with WhiteMagic. Use when reviewing task evidence, verifying execution receipts, auditing signatures, or validating proof bundles.
---

# WhiteMagic receipt verification

Receipt verification is 100% offline, local-first, and free forever. No API key or cloud account is required.

## Tool routes via `wm`

Prefer explicit routes on the WhiteMagic MCP server:

- Verify a receipt bundle:
  `wm(route="receipts.verify", args={"bundle": <receipt_bundle_object>})`
- Emit a session continuity receipt:
  `wm(route="receipts.emit", args={"kind": "session", "limit": 200})`
- Emit a state transition receipt:
  `wm(route="receipts.emit", args={"kind": "state_transition"})`

## CLI verifier

```bash
verify-receipt bundle.json
verify-receipt --json bundle.json
```

Full conformance parity for continuity-receipt bundles comes from the official
`continuity-receipt` package (optional dependency). Without it the CLI reports
`INTEGRITY_OK` / `INTEGRITY_FAILED` (crypto integrity only). WhiteMagic emitted
receipts verify exactly via `wm-profile-exact` mode.
