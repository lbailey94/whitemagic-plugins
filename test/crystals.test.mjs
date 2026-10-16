import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  TOOLS,
  handleToolsCall,
  processMessage,
  sealCrystal,
  unsealCrystal,
} from "../bin/crystals-mcp.mjs";

test("whitemagic-crystals-mcp exposes 4 annotated tools in tools/list", async () => {
  const resp = await processMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.equal(resp.result.tools.length, 4);
  const names = resp.result.tools.map((t) => t.name);
  assert.deepEqual(names, [
    "crystal_remember",
    "crystal_recall",
    "crystal_forget",
    "crystal_status",
  ]);
  const forgetTool = TOOLS.find((t) => t.name === "crystal_forget");
  assert.equal(forgetTool.annotations.destructiveHint, true);
  const recallTool = TOOLS.find((t) => t.name === "crystal_recall");
  assert.equal(recallTool.annotations.readOnlyHint, true);
});

test("crystal_remember -> crystal_recall -> crystal_forget -> crystal_status lifecycle", async () => {
  const dir = mkdtempSync(join(tmpdir(), "wm-crystals-mcp-test-"));
  try {
    const r1 = await handleToolsCall("crystal_remember", {
      content: "First sealed crystal memory",
      metadata: { topic: "interop" },
      store_dir: dir,
    });
    const doc1 = JSON.parse(r1.content[0].text);
    assert.equal(doc1.stored, true);
    assert.equal(doc1.kek_version, 1);
    assert.match(doc1.crystal_id, /^sha256:[0-9a-f]{64}$/);

    const r2 = await handleToolsCall("crystal_remember", {
      content: "Second sealed crystal memory",
      metadata: { topic: "erasure" },
      store_dir: dir,
    });
    const doc2 = JSON.parse(r2.content[0].text);
    assert.equal(doc2.parent_crystal_id, doc1.crystal_id);
    assert.equal(doc2.set_commitment.count, 2);

    const recallSingle = await handleToolsCall("crystal_recall", {
      crystal_id: doc1.crystal_id,
      store_dir: dir,
    });
    const singleDoc = JSON.parse(recallSingle.content[0].text);
    assert.equal(singleDoc.verified, true);
    assert.equal(singleDoc.content, "First sealed crystal memory");

    const delRes = await handleToolsCall("crystal_forget", {
      crystal_id: doc2.crystal_id,
      store_dir: dir,
    });
    const delDoc = JSON.parse(delRes.content[0].text);
    assert.equal(delDoc.erased, true);
    assert.equal(delDoc.erasure_class, "cryptographic_client_dek_plus_ciphertext_purge");
    assert.equal(delDoc.erasure_receipt.kind, "wm.crystal-erasure");

    const statusRes = await handleToolsCall("crystal_status", { store_dir: dir });
    const statusDoc = JSON.parse(statusRes.content[0].text);
    assert.equal(statusDoc.active_crystals, 1);
    assert.equal(statusDoc.erased_crystals, 1);
    assert.equal(statusDoc.set_commitment.head_crystal_id, doc1.crystal_id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("crystal_forget DEK destruction renders retained envelope undecryptable", () => {
  const kek = Buffer.alloc(32, 7);
  const env = sealCrystal("secret state", kek, { tenantId: "t1", kekVersion: 1 });
  assert.equal(unsealCrystal(env, kek).toString("utf8"), "secret state");

  const erasedEnv = { ...env, wrapped_dek: null, dek_destroyed: true };
  assert.throws(() => unsealCrystal(erasedEnv, kek), /cryptographically destroyed/);
});
