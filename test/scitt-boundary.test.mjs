import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateScittProfile } from "../bin/verify-receipt.mjs";

const fixture = (kind = "wm/session-valid") =>
  JSON.parse(readFileSync(new URL(`./fixtures/${kind}.json`, import.meta.url)));

test("self-declared heads never become authenticated external anchors", async () => {
  for (const kind of ["wm/session-valid", "cr/01_happy_minimal"]) {
    const bundle = fixture(kind);
    const baseline = await evaluateScittProfile(bundle);
    bundle.chain_head = {
      seq: baseline.chain_head.seq,
      receipt_id: bundle.receipts?.at(-1).receipt_id,
      digest: baseline.chain_head.head_digest,
      head_digest: baseline.chain_head.head_digest,
      task_id: bundle.task_id,
    };
    const result = await evaluateScittProfile(bundle);
    assert.equal(result.first_failure_code, null);
    assert.equal(result.chain_head.declared_head_comparison.matches_current, true);
    assert.equal(result.chain_head.expected_head_supplied, false);
    assert.equal(result.chain_head.anchored_head_verified, null);
    assert.equal(result.consumer_profiles.head_committed_resumption, null);
  }
});

test("an unverified COSE-shaped object is only attached metadata", async () => {
  const bundle = fixture();
  bundle.anchors = [{ type: "scitt.cose_receipt", proof: "SYNTHETIC_NOT_A_PROOF" }];
  const result = await evaluateScittProfile(bundle);
  assert.equal(result.base_verification.verdict, "TRUSTED");
  assert.equal(result.scitt_statement.scitt_cose_receipt_attached, true);
  assert.equal(result.scitt_statement.scitt_cose_receipt_verified, null);
  assert.equal(result.external_anchor_verification.status, "not_evaluated");
  assert.equal(result.consumer_profiles.regulated_retention, null);
});

test("a caller's expected head is compared separately from bundle declarations", async () => {
  const bundle = fixture();
  const baseline = await evaluateScittProfile(bundle);
  bundle.chain_head = { seq: 0, head_digest: "sha256:" + "0".repeat(64) };
  const expectedHead = {
    seq: baseline.chain_head.seq,
    head_digest: baseline.chain_head.head_digest,
  };
  const result = await evaluateScittProfile(bundle, { expectedHead });
  assert.equal(result.chain_head.declared_head_comparison.matches_current, false);
  assert.equal(result.chain_head.expected_head_comparison.matches_current, true);
  assert.equal(result.chain_head.anchored_head_verified, null);
  assert.equal(result.consumer_profiles.head_committed_resumption, null);
});

test("malformed expected sequence inputs are refused without array indexing exceptions", async () => {
  for (const seq of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, "0", null, Number.MAX_SAFE_INTEGER + 1]) {
    const bundle = fixture("cr/01_happy_minimal");
    const result = await evaluateScittProfile(bundle, {
      expectedHead: { seq, head_digest: "sha256:" + "0".repeat(64) },
    });
    assert.equal(result.first_failure_code, "expected_head_invalid", String(seq));
    assert.equal(result.verdict, "UNTRUSTED");
  }
});

test("malformed in-band sequences remain declarations and cannot grant assurance", async () => {
  for (const seq of [-1, 0.5, "0"]) {
    const bundle = fixture();
    bundle.chain_head = { seq, head_digest: "sha256:" + "0".repeat(64) };
    const result = await evaluateScittProfile(bundle);
    assert.equal(result.chain_head.declared_head_comparison.status, "invalid");
    assert.equal(result.chain_head.anchored_head_verified, null);
    assert.equal(result.consumer_profiles.head_committed_resumption, null);
  }
});

test("a separately loaded verifier without the optional package preserves integrity-only scope", () => {
  const directory = mkdtempSync(join(tmpdir(), "receipt-no-reference-"));
  try {
    const modulePath = join(directory, "verify-receipt.mjs");
    copyFileSync(new URL("../bin/verify-receipt.mjs", import.meta.url), modulePath);
    const program = `import { evaluateScittProfile, officialAvailable } from ${JSON.stringify(pathToFileURL(modulePath).href)};
      const bundle = JSON.parse(process.argv[1]);
      const result = await evaluateScittProfile(bundle);
      console.log(JSON.stringify({available: officialAvailable(), result}));`;
    const output = JSON.parse(execFileSync(process.execPath,
      ["--input-type=module", "-e", program, JSON.stringify(fixture("cr/01_happy_minimal"))],
      { encoding: "utf8" }));
    assert.equal(output.available, false);
    assert.equal(output.result.mode, "integrity-only");
    assert.equal(output.result.base_verification.conformance_evaluated, false);
    assert.equal(output.result.consumer_profiles.head_committed_resumption, null);
    assert.equal(output.result.consumer_profiles.authority_bound, null);
    assert.equal(output.result.consumer_profiles.regulated_retention, null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
