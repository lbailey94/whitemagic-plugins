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

## Standalone CLI verifier

When validating bundles from shell commands or CI scripts:

```bash
# Verify a bundle file
verify-receipt path/to/bundle.json

# Machine-readable JSON output
verify-receipt --json path/to/bundle.json
```

## Standard verdicts

- **TRUSTED**: Ed25519 signatures valid, hash chain unbroken, strict canonical serialization verified.
- **PROVISIONAL**: Signatures valid but bundle is unanchored or awaiting public ledger finality.
- **INSUFFICIENT_EVIDENCE**: Missing required envelope fields or unverified schema types.
- **UNTRUSTED**: Cryptographic signature failure or tampered payload detected.

Modes (reported in output):
- `wm-profile-exact` — WhiteMagic emitted receipts verified against the issuer DID (kernel recipe).
- `continuity-receipt-ref` — bundle conformance via the official `continuity-receipt` package (full parity).
- `integrity-only` — crypto integrity only (`INTEGRITY_OK`/`INTEGRITY_FAILED`); conformance not evaluated.
