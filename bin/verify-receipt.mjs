#!/usr/bin/env node
/**
 * @file verify-receipt.mjs
 * Standalone offline verifier for receipt bundles and WhiteMagic profile receipts.
 *
 * Verification modes (reported as `mode` in JSON output):
 *
 *   wm-profile-exact        WhiteMagic emitted continuity receipts
 *                           (`continuity-receipt/0.5#session` / `...#state_transition`):
 *                           reimplements the kernel's exact canonical_signing_bytes,
 *                           content_digest and Ed25519 checks. No store access, no
 *                           dependencies — verifies against the issuer DID alone.
 *
 *   continuity-receipt-ref  Continuity Receipt bundles (spec 0.1–0.6): delegates to
 *                           the official published `continuity-receipt` npm package
 *                           (optional dependency). Full conformance parity with the
 *                           Python reference implementation.
 *
 *   integrity-only          Fallback when the official package is not installed:
 *                           verifies Ed25519 signatures + hash-chain linkage only.
 *                           Policy/semantic conformance is NOT evaluated — verdicts
 *                           are reported as INTEGRITY_OK / INTEGRITY_FAILED so they
 *                           can never be mistaken for full conformance.
 *
 * Verdicts:
 *   - TRUSTED: Valid signatures, unbroken hash chain, conformance evaluated.
 *   - PROVISIONAL: Reference verifier: valid but unanchored / pending disclosure.
 *   - INSUFFICIENT_EVIDENCE: Missing required fields or broken chain links.
 *   - UNTRUSTED: Cryptographic signature mismatch or tampered payload.
 *   - INTEGRITY_OK / INTEGRITY_FAILED: integrity-only mode results (no conformance claim).
 */

import { readFileSync } from "node:fs";
import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B58_MAP = {};
for (let i = 0; i < B58_ALPHABET.length; i++) {
  B58_MAP[B58_ALPHABET[i]] = BigInt(i);
}

const ED25519_MULTICODEC = Buffer.from([0xed, 0x01]);
const SPKI_PREFIX_ED25519 = Buffer.from("302a300506032b6570032100", "hex");
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

// WhiteMagic emitted continuity receipt specs (kernel `receipts.emit`).
const WM_EMITTED_SPECS = new Set([
  "continuity-receipt/0.5#session",
  "continuity-receipt/0.5#state_transition",
]);

export function decodeBase58(str) {
  let num = 0n;
  for (const c of str) {
    if (B58_MAP[c] === undefined) {
      throw new Error(`Invalid base58 character: '${c}'`);
    }
    num = num * 58n + B58_MAP[c];
  }
  let hex = num.toString(16);
  if (hex.length % 2 !== 0) hex = "0" + hex;
  let bytes = Buffer.from(hex, "hex");
  let leadingZeros = 0;
  for (const c of str) {
    if (c === "1") leadingZeros++;
    else break;
  }
  return Buffer.concat([Buffer.alloc(leadingZeros), bytes]);
}

export function decodeBase64Url(str) {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  return Buffer.from(b64, "base64");
}

export function sortKeys(val) {
  if (val === null || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(sortKeys);
  const sorted = {};
  for (const key of Object.keys(val).sort()) {
    sorted[key] = sortKeys(val[key]);
  }
  return sorted;
}

export function canonicalBytes(obj) {
  return Buffer.from(JSON.stringify(sortKeys(obj)), "utf8");
}

export function sha256Prefixed(data) {
  return "sha256:" + createHash("sha256").update(data).digest("hex");
}

export function didKeyToPublicKey(did) {
  if (did.startsWith("did:key:z")) {
    const decoded = decodeBase58(did.slice(9));
    if (decoded.length !== 34 || !decoded.subarray(0, 2).equals(ED25519_MULTICODEC)) {
      throw new Error(`DID is not an Ed25519 key (multicodec mismatch): ${did}`);
    }
    const rawPub = decoded.subarray(2);
    return createPublicKey({
      key: Buffer.concat([SPKI_PREFIX_ED25519, rawPub]),
      format: "der",
      type: "spki"
    });
  }
  if (did.startsWith("did:key:") && did.length === "did:key:".length + 64) {
    const rawPub = Buffer.from(did.slice("did:key:".length), "hex");
    return createPublicKey({
      key: Buffer.concat([SPKI_PREFIX_ED25519, rawPub]),
      format: "der",
      type: "spki"
    });
  }
  throw new Error(`Unsupported DID format: ${did} (expected did:key:z... or did:key:<64-hex>)`);
}

export function unsignedView(receipt) {
  const view = {};
  for (const [k, v] of Object.entries(receipt)) {
    if (k !== "sig") {
      view[k] = v;
    }
  }
  return view;
}

// ── Official continuity-receipt reference (optional dependency) ────────────

let official = null;
try {
  official = await import("continuity-receipt");
} catch {
  official = null;
}

export function officialAvailable() {
  return official !== null;
}

// ── WhiteMagic emitted receipt verification (exact kernel recipe) ──────────

function le64(value, field, errors) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    errors.push({ code: "INVALID_FIELD", detail: `${field} must be a non-negative integer` });
    return Buffer.alloc(0);
  }
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(value));
  return b;
}

/**
 * Reimplementation of the kernel's EmittedContinuityReceipt::canonical_signing_bytes
 * (WMv10 crates/wm-gen3-harness/src/bridge.rs): SHA-256 over the pipe-joined field
 * sequence with little-endian u64 integers. Ed25519 signs these 32 bytes directly;
 * content_digest = SHA-256 of those same 32 bytes (hex).
 */
export function wmEmittedCanonicalBytes(receipt, errors) {
  const hasher = createHash("sha256");
  const req = (name) => {
    const v = receipt[name];
    if (typeof v !== "string" || v.length === 0) {
      errors.push({ code: "MISSING_FIELD", detail: `Emitted receipt missing string '${name}'` });
      return "";
    }
    return v;
  };
  hasher.update(Buffer.from(req("spec"), "utf8")); hasher.update("|");
  hasher.update(Buffer.from(req("receipt_id"), "utf8")); hasher.update("|");
  hasher.update(Buffer.from(req("kind"), "utf8")); hasher.update("|");
  hasher.update(Buffer.from(req("subject"), "utf8")); hasher.update("|");
  if (receipt.session_id !== undefined && receipt.session_id !== null) {
    hasher.update(Buffer.from(String(receipt.session_id), "utf8"));
  }
  hasher.update("|");
  hasher.update(le64(receipt.created_at_ms, "created_at_ms", errors));
  for (const field of ["turn_count", "first_turn_ts", "last_turn_ts", "store_epoch", "store_record_count"]) {
    hasher.update("|");
    const v = receipt[field];
    if (v !== undefined && v !== null) hasher.update(le64(v, field, errors));
  }
  hasher.update("|");
  if (receipt.turns_digest !== undefined && receipt.turns_digest !== null) {
    hasher.update(Buffer.from(String(receipt.turns_digest), "utf8"));
  }
  hasher.update("|");
  hasher.update(Buffer.from(req("payload_digest"), "utf8"));
  hasher.update("|");
  hasher.update(Buffer.from(req("prior_receipt_digest"), "utf8"));
  hasher.update("|");
  hasher.update(Buffer.from(req("issuer_did"), "utf8"));
  return hasher.digest();
}

export function verifyEmittedReceipt(receipt) {
  const errors = [];
  const rId = receipt.receipt_id || "single";

  if (!WM_EMITTED_SPECS.has(receipt.spec)) {
    return {
      verdict: "INSUFFICIENT_EVIDENCE",
      mode: "wm-profile-exact",
      errors: [{ code: "UNSUPPORTED_SPEC", detail: `Not a supported emitted receipt spec: ${receipt.spec}`, receipt_id: rId }],
      provisional_reasons: [],
      insufficient_reasons: [],
      summary: { receipts: 1 }
    };
  }

  const canonical = wmEmittedCanonicalBytes(receipt, errors);
  const recomputed = createHash("sha256").update(canonical).digest("hex");

  if (errors.length === 0) {
    if (typeof receipt.content_digest !== "string" || receipt.content_digest.length === 0) {
      errors.push({ code: "MISSING_FIELD", detail: "Emitted receipt missing content_digest", receipt_id: rId });
    } else if (receipt.content_digest !== recomputed) {
      errors.push({
        code: "DIGEST_MISMATCH",
        detail: `Content digest mismatch: expected ${receipt.content_digest}, recomputed ${recomputed}`,
        receipt_id: rId
      });
    }

    if (!receipt.signature) {
      errors.push({ code: "MISSING_SIGNATURE", detail: "Emitted receipt missing signature", receipt_id: rId });
    } else {
      try {
        const pubKey = didKeyToPublicKey(receipt.issuer_did);
        const sigBytes = typeof receipt.signature === "string" && /^[0-9a-f]{128}$/i.test(receipt.signature)
          ? Buffer.from(receipt.signature, "hex")
          : decodeBase64Url(receipt.signature);
        const ok = cryptoVerify(null, canonical, pubKey, sigBytes);
        if (!ok) {
          errors.push({ code: "SIGNATURE_INVALID", detail: "Ed25519 signature check failed", receipt_id: rId });
        }
      } catch (err) {
        errors.push({ code: "CRYPTO_ERROR", detail: err.message, receipt_id: rId });
      }
    }
  }

  return {
    verdict: errors.length === 0 ? "TRUSTED" : "UNTRUSTED",
    mode: "wm-profile-exact",
    verified_offline: true,
    verification_scope: "issuer DID only (no store access); for store-gate-key verification use the wm `receipts.verify` route",
    errors,
    provisional_reasons: [],
    insufficient_reasons: [],
    summary: {
      receipts: 1,
      spec: receipt.spec,
      kind: receipt.kind,
      issuer_did: receipt.issuer_did,
      receipt_id: rId
    }
  };
}

// ── Integrity-only fallback (no official package installed) ────────────────

export function integrityVerifyBundle(bundle) {
  const errors = [];
  const issuers = new Set();
  const types = [];

  if (!bundle || typeof bundle !== "object") {
    return {
      verdict: "MALFORMED",
      mode: "integrity-only",
      conformance_evaluated: false,
      errors: [{ code: "MALFORMED_BUNDLE", detail: "Bundle must be a valid JSON object" }],
      provisional_reasons: [],
      insufficient_reasons: [],
      summary: { receipts: 0 }
    };
  }

  const receipts = bundle.receipts;
  if (!Array.isArray(receipts) || receipts.length === 0) {
    return {
      verdict: "INSUFFICIENT_EVIDENCE",
      mode: "integrity-only",
      conformance_evaluated: false,
      errors: [{ code: "NO_RECEIPTS", detail: "Bundle contains no receipts array" }],
      provisional_reasons: [],
      insufficient_reasons: [],
      summary: { receipts: 0 }
    };
  }

  let prevDigest = null;
  let terminated = false;
  let settled = false;

  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    const rId = r.receipt_id || `index_${i}`;

    if (!r.type || typeof r.type !== "string") {
      errors.push({ code: "MISSING_TYPE", detail: `Receipt ${i} missing 'type'`, receipt_id: rId });
      continue;
    }
    types.push(r.type);
    if (r.type === "task.termination") terminated = true;
    if (r.type === "settlement") settled = true;

    if (r.issued_at && !TIMESTAMP_RE.test(r.issued_at)) {
      errors.push({ code: "INVALID_TIMESTAMP", detail: `Malformed issued_at timestamp '${r.issued_at}'`, receipt_id: rId });
    }

    if (r.seq !== i) {
      errors.push({ code: "SEQ_MISMATCH", detail: `Receipt seq ${r.seq} does not match chain index ${i}`, receipt_id: rId });
    }

    if (i === 0) {
      if (r.prev !== null) {
        errors.push({ code: "INVALID_GENESIS", detail: "Genesis receipt prev must be null", receipt_id: rId });
      }
    } else if (r.prev !== prevDigest) {
      errors.push({
        code: "CHAIN_BROKEN",
        detail: `Hash chain broken at ${i}: got ${r.prev}, expected ${prevDigest}`,
        receipt_id: rId
      });
    }

    prevDigest = sha256Prefixed(canonicalBytes(unsignedView(r)));

    if (!r.sig || typeof r.sig !== "object") {
      errors.push({ code: "MISSING_SIGNATURE", detail: `Receipt ${i} is unsigned`, receipt_id: rId });
      continue;
    }

    const keyDid = r.sig.key || (r.issuer && r.issuer.id);
    if (!keyDid) {
      errors.push({ code: "MISSING_KEY_DID", detail: `Receipt ${i} missing signing key DID`, receipt_id: rId });
      continue;
    }
    issuers.add(keyDid);

    try {
      const pubKey = didKeyToPublicKey(keyDid);
      const sigBytes = decodeBase64Url(r.sig.value);
      const ok = cryptoVerify(null, canonicalBytes(unsignedView(r)), pubKey, sigBytes);
      if (!ok) {
        errors.push({ code: "SIGNATURE_INVALID", detail: `Ed25519 signature verification failed for ${keyDid}`, receipt_id: rId });
      }
    } catch (err) {
      errors.push({ code: "CRYPTO_ERROR", detail: err.message, receipt_id: rId });
    }
  }

  const hasCryptoFault = errors.some((e) => e.code === "SIGNATURE_INVALID" || e.code === "CHAIN_BROKEN");
  let verdict = "INTEGRITY_OK";
  if (errors.length > 0) verdict = hasCryptoFault ? "INTEGRITY_FAILED" : "INSUFFICIENT_EVIDENCE";

  return {
    verdict,
    mode: "integrity-only",
    conformance_evaluated: false,
    note: "Signatures and hash-chain linkage only. Policy/semantic conformance NOT evaluated; install the 'continuity-receipt' package for full parity.",
    errors,
    provisional_reasons: [],
    insufficient_reasons: [],
    summary: {
      receipts: receipts.length,
      types: Array.from(new Set(types)),
      issuers: Array.from(issuers),
      terminated,
      settled
    }
  };
}

// ── Main dispatcher ────────────────────────────────────────────────────────

/**
 * Verify a receipt bundle or a single WhiteMagic emitted receipt.
 * Returns a normalized result: { verdict, mode, errors, provisional_reasons,
 * insufficient_reasons, summary, ... }.
 */
export async function verifyReceiptBundle(bundle, options = {}) {
  if (!bundle || typeof bundle !== "object") {
    return integrityVerifyBundle(bundle);
  }

  // WhiteMagic emitted profile receipts: exact native verification.
  if (typeof bundle.spec === "string" && WM_EMITTED_SPECS.has(bundle.spec)) {
    return verifyEmittedReceipt(bundle);
  }

  // Continuity Receipt bundles: delegate to the official reference package.
  if (official) {
    const result = await official.verifyBundle(bundle, {
      requireAnchor: Boolean(options.requireAnchor),
      externalRevocations: options.externalRevocations ?? null,
    });
    const dict = typeof result.asDict === "function" ? result.asDict() : result;
    return {
      ...dict,
      mode: "continuity-receipt-ref",
      conformance_evaluated: true,
    };
  }

  return integrityVerifyBundle(bundle);
}

// ── CLI Runner ─────────────────────────────────────────────────────────────

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  let jsonOutput = false;
  let requireAnchor = false;
  let quiet = false;
  let revocationsPath = null;
  let filePath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") jsonOutput = true;
    else if (arg === "--require-anchor") requireAnchor = true;
    else if (arg === "-q" || arg === "--quiet") quiet = true;
    else if (arg === "--revocations") { revocationsPath = args[++i] || null; }
    else if (arg === "-h" || arg === "--help") {
      console.log(`WhiteMagic Receipts Verifier (free, offline)

Usage:
  verify-receipt [OPTIONS] <path/to/receipt.json>
  cat receipt.json | verify-receipt [OPTIONS] -

Modes:
  wm-profile-exact        WhiteMagic emitted receipts (0.5#session / 0.5#state_transition),
                          verified against the issuer DID with the kernel's exact recipe.
  continuity-receipt-ref  Continuity Receipt bundles (0.1-0.6) via the official
                          'continuity-receipt' npm package (full reference parity).
  integrity-only          Fallback when the official package is absent: crypto
                          integrity only (INTEGRITY_OK / INTEGRITY_FAILED).

Options:
  --json             Output raw JSON report
  --require-anchor   Treat bundles without a public anchor proof as insufficient
  --revocations PATH Pass an external revocation statements file (JSON)
  -q, --quiet        Suppress output, return exit code (0=TRUSTED/INTEGRITY_OK, 1=other)
  -h, --help         Show this help message

Verdicts:
  TRUSTED                 Signatures & hash chains valid; conformance evaluated
  PROVISIONAL             Valid but unanchored / pending disclosure (reference mode)
  INSUFFICIENT_EVIDENCE   Missing required envelope or schema fields
  UNTRUSTED               Invalid signature or tampered content digest
  INTEGRITY_OK/FAILED     Integrity-only fallback verdicts (no conformance claim)
`);
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      filePath = arg;
    }
  }

  try {
    let rawContent;
    if (!filePath || filePath === "-") {
      rawContent = readFileSync(0, "utf8");
    } else {
      rawContent = readFileSync(filePath, "utf8");
    }

    const bundle = JSON.parse(rawContent);

    let externalRevocations = null;
    if (revocationsPath) {
      externalRevocations = JSON.parse(readFileSync(revocationsPath, "utf8"));
    }

    const result = await verifyReceiptBundle(bundle, { requireAnchor, externalRevocations });
    const ok = result.verdict === "TRUSTED" || result.verdict === "PROVISIONAL" || result.verdict === "INTEGRITY_OK";

    if (quiet) {
      process.exit(ok ? 0 : 1);
    }

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const color = ok ? "\x1b[32m" : "\x1b[31m";
      const reset = "\x1b[0m";
      console.log(`\n${color}■ VERDICT: ${result.verdict}${reset}  (mode: ${result.mode || "unknown"})`);
      console.log(`  Receipts checked : ${result.summary?.receipts ?? 0}`);
      if (result.summary?.issuers) {
        console.log(`  Issuers (${result.summary.issuers.length})  : ${result.summary.issuers.join(", ")}`);
      }
      if (result.summary?.issuer_did) {
        console.log(`  Issuer           : ${result.summary.issuer_did}`);
      }
      if (result.summary?.types) {
        console.log(`  Record Types     : ${result.summary.types.join(", ")}`);
      }
      if (result.summary?.terminated !== undefined) {
        console.log(`  Terminated       : ${result.summary.terminated ? "yes" : "no"}`);
      }
      if (result.summary?.settled !== undefined) {
        console.log(`  Settled          : ${result.summary.settled ? "yes" : "no"}`);
      }
      if (result.mode === "integrity-only") {
        console.log(`  \x1b[33mNote:${reset} conformance NOT evaluated — install 'continuity-receipt' for full parity.`);
      }
      if (result.errors?.length > 0) {
        console.log(`\n  \x1b[31mErrors (${result.errors.length}):\x1b[0m`);
        for (const err of result.errors) {
          console.log(`    - [${err.code}] ${err.detail}`);
        }
      }
      console.log();
    }

    process.exit(ok ? 0 : 1);
  } catch (err) {
    if (!quiet) {
      console.error(`Verification error: ${err.message}`);
    }
    process.exit(2);
  }
}
