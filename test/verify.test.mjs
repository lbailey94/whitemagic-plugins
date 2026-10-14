import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyReceiptBundle, officialAvailable } from "../bin/verify-receipt.mjs";

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

test("wm emitted receipt: valid fixture -> TRUSTED (wm-profile-exact)", async () => {
  const r = await verifyReceiptBundle(load("./fixtures/wm/session-valid.json"));
  assert.equal(r.verdict, "TRUSTED");
  assert.equal(r.mode, "wm-profile-exact");
  assert.equal(r.verified_offline, true);
});

test("wm emitted receipt: tampered fixture -> UNTRUSTED with DIGEST_MISMATCH", async () => {
  const r = await verifyReceiptBundle(load("./fixtures/wm/session-tampered.json"));
  assert.equal(r.verdict, "UNTRUSTED");
  assert.ok(r.errors.some((e) => e.code === "DIGEST_MISMATCH"), "expected DIGEST_MISMATCH");
});

test("wm emitted receipt: bad signature hex -> UNTRUSTED", async () => {
  const receipt = load("./fixtures/wm/session-valid.json");
  receipt.signature = receipt.signature.replace(/^../, "00");
  const r = await verifyReceiptBundle(receipt);
  // Digest still matches (signature is not part of the digest), signature must fail.
  assert.equal(r.verdict, "UNTRUSTED");
  assert.ok(r.errors.some((e) => e.code === "SIGNATURE_INVALID"), "expected SIGNATURE_INVALID");
});

test("unknown/non-bundle object is never trusted", async () => {
  const r = await verifyReceiptBundle({ spec: "wm.session/v1", receipt_id: "x" });
  if (officialAvailable()) {
    // Reference verifier: unsupported spec -> UNTRUSTED (version_unsupported).
    assert.equal(r.verdict, "UNTRUSTED");
    assert.ok(r.errors.some((e) => e.code === "version_unsupported"));
  } else {
    assert.equal(r.verdict, "INSUFFICIENT_EVIDENCE");
  }
});

test("cr bundle: happy vector", async () => {
  const r = await verifyReceiptBundle(load("./fixtures/cr/01_happy_minimal.json"));
  if (officialAvailable()) {
    assert.equal(r.verdict, "TRUSTED");
    assert.equal(r.mode, "continuity-receipt-ref");
    assert.equal(r.conformance_evaluated, true);
  } else {
    assert.equal(r.verdict, "INTEGRITY_OK");
    assert.equal(r.conformance_evaluated, false);
  }
});

test("cr bundle: tampered vector fails cryptography in both modes", async () => {
  const r = await verifyReceiptBundle(load("./fixtures/cr/03_tampered_body.json"));
  if (officialAvailable()) {
    assert.equal(r.verdict, "UNTRUSTED");
  } else {
    assert.equal(r.verdict, "INTEGRITY_FAILED");
  }
});

test("cr bundle: semantic class (authority expired) needs reference parity", async () => {
  const r = await verifyReceiptBundle(load("./fixtures/cr/24d_authority_expired.json"));
  if (officialAvailable()) {
    assert.equal(r.verdict, "UNTRUSTED");
  } else {
    // Honest fallback: integrity is intact; conformance was NOT evaluated.
    assert.equal(r.verdict, "INTEGRITY_OK");
    assert.equal(r.conformance_evaluated, false);
  }
});
