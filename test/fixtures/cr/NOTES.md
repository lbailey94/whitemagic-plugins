# Continuity Receipt test vectors

Copied from https://github.com/lbailey94/continuity-receipt (`vectors/`, branch `main`)
for integration tests of the free offline verifier. Upstream license: Apache-2.0 / MIT.

- `01_happy_minimal.json` — expected verdict TRUSTED
- `03_tampered_body.json` — expected verdict UNTRUSTED (signature/digest tamper)
- `24d_authority_expired.json` — expected verdict UNTRUSTED (semantic policy class)
