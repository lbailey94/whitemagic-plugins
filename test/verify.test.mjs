import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyReceiptBundle, evaluateScittProfile, officialAvailable } from "../bin/verify-receipt.mjs";

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

test("scitt profile (draft-bailey-scitt-agent-session-receipt-00): Section 6 head commitment & check order", async () => {
  const bundle = load("./fixtures/cr/01_happy_minimal.json");
  const baseline = await evaluateScittProfile(bundle);
  assert.equal(baseline.profile, "draft-bailey-scitt-agent-session-receipt-00");
  assert.equal(baseline.first_failure_code, null);
  const headDigest = baseline.chain_head.head_digest;
  const finalSeq = baseline.chain_head.seq;

  // A caller's expected head can match without authenticating an external anchor.
  const committed = await evaluateScittProfile(bundle, {
    anchoredHead: { seq: finalSeq, head_digest: headDigest, task_id: bundle.task_id }
  });
  assert.equal(committed.first_failure_code, null);
  assert.equal(committed.chain_head.expected_head_comparison.matches_current, true);
  assert.equal(committed.chain_head.anchored_head_verified, null);
  assert.equal(committed.consumer_profiles.head_committed_resumption, null);

  // Tail truncation (anchored seq beyond bundle length) -> anchored_head_missing
  const truncated = await evaluateScittProfile(bundle, {
    anchoredHead: { seq: finalSeq + 1, head_digest: headDigest, task_id: bundle.task_id }
  });
  assert.equal(truncated.verdict, "UNTRUSTED");
  assert.equal(truncated.first_failure_code, "anchored_head_missing");

  // Head digest mismatch (rollback) -> anchored_head_mismatch
  const rollback = await evaluateScittProfile(bundle, {
    anchoredHead: { seq: finalSeq, head_digest: "sha256:" + "0".repeat(64), task_id: bundle.task_id }
  });
  assert.equal(rollback.verdict, "UNTRUSTED");
  assert.equal(rollback.first_failure_code, "anchored_head_mismatch");

  // Different chain/task_id -> record_from_other_chain
  const wrongChain = await evaluateScittProfile(bundle, {
    anchoredHead: { seq: finalSeq, head_digest: headDigest, task_id: "other-task-id" }
  });
  assert.equal(wrongChain.verdict, "UNTRUSTED");
  assert.equal(wrongChain.first_failure_code, "record_from_other_chain");
});
