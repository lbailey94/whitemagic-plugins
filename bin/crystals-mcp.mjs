#!/usr/bin/env node
/**
 * @file crystals-mcp.mjs
 * Zero-dependency standalone Model Context Protocol (MCP) stdio server for
 * non-custodial WhiteMagic Memory Crystals (wm-crystal/1.0, I1-I9).
 *
 * Implements SAIHM-aligned non-custodial cell semantics:
 *   - crystal_remember: seal plaintext locally with per-crystal DEK wrapped
 *     under client KEK v(N) and cellId = sha256(id_kek_version_be32 || nonce || ciphertext)
 *   - crystal_recall: read-path verification + unseal (cellId recompute, DEK
 *     unwrap, AEAD AAD check, lineage DAG + export set commitment check)
 *   - crystal_forget: two-class erasure (cryptographic DEK destruction +
 *     tombstone receipt in erasures.jsonl)
 *   - crystal_status: inspect active crystal count, head, export set
 *     commitment, and erasure history
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

const SERVER_INFO = {
  name: "whitemagic-crystals-mcp",
  version: "1.1.2",
};

const SPEC = "wm-crystal/1.0";
const SALT = "whitemagic-crystal-salt-v1";

function b64urlEncode(buf) {
  return Buffer.from(buf).toString("base64url");
}

function b64urlDecode(str) {
  return Buffer.from(String(str), "base64url");
}

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export function computeTenantHash(tenantId, salt = SALT) {
  return `sha256:${sha256Hex(Buffer.from(`${salt}:${tenantId}`, "utf8"))}`;
}

export function computeCrystalId(ciphertextBuf, nonceBuf = null, idKekVersion = null) {
  if (idKekVersion !== null && idKekVersion !== undefined) {
    const ver = Number(idKekVersion);
    if (!Number.isInteger(ver) || ver < 1 || ver > 0xffffffff) {
      throw new Error(`Invalid id_kek_version: ${idKekVersion}`);
    }
    if (!nonceBuf) {
      throw new Error("nonce is required when id_kek_version is bound into crystal_id");
    }
    const verBuf = Buffer.alloc(4);
    verBuf.writeUInt32BE(ver, 0);
    const preimage = Buffer.concat([verBuf, Buffer.from(nonceBuf), Buffer.from(ciphertextBuf)]);
    return `sha256:${sha256Hex(preimage)}`;
  }
  return `sha256:${sha256Hex(Buffer.from(ciphertextBuf))}`;
}

function canonicalJsonString(obj) {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalJsonString).join(",")}]`;
  }
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonString(obj[k])}`).join(",")}}`;
}

export function buildAad(cipher, tenantHash, parentCrystalId, createdAt, metadataPublic = {}, bindMetadata = true) {
  const parentStr = parentCrystalId || "genesis";
  let base = `${cipher}|${tenantHash}|${parentStr}|${createdAt}`;
  if (bindMetadata) {
    base += `|${canonicalJsonString(metadataPublic || {})}`;
  }
  return Buffer.from(base, "utf8");
}

function aeadEncryptAesGcm(keyBuf, nonceBuf, plaintextBuf, aadBuf) {
  const cipher = createCipheriv("aes-256-gcm", keyBuf, nonceBuf);
  cipher.setAAD(aadBuf);
  const ct = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([ct, tag]);
}

function aeadDecryptAesGcm(keyBuf, nonceBuf, ciphertextWithTagBuf, aadBuf) {
  if (ciphertextWithTagBuf.length < 16) {
    throw new Error("Ciphertext too short for AES-256-GCM tag");
  }
  const ct = ciphertextWithTagBuf.subarray(0, ciphertextWithTagBuf.length - 16);
  const tag = ciphertextWithTagBuf.subarray(ciphertextWithTagBuf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", keyBuf, nonceBuf);
  decipher.setAAD(aadBuf);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function wrapCrystalDek(dekBuf, kekBuf, crystalId, kekVersion) {
  const wrapNonce = randomBytes(12);
  const wrapAad = Buffer.from(`wm-crystal-dek-wrap-v1|${crystalId.toLowerCase()}|${kekVersion}`, "utf8");
  const wrappedCt = aeadEncryptAesGcm(kekBuf, wrapNonce, dekBuf, wrapAad);
  return b64urlEncode(Buffer.concat([wrapNonce, wrappedCt]));
}

export function unwrapCrystalDek(wrappedDekStr, kekBuf, crystalId, kekVersion) {
  const raw = b64urlDecode(wrappedDekStr);
  if (raw.length !== 60) {
    throw new Error(`Invalid wrapped_dek length: ${raw.length} bytes (expected 60)`);
  }
  const wrapNonce = raw.subarray(0, 12);
  const wrappedCt = raw.subarray(12);
  const wrapAad = Buffer.from(`wm-crystal-dek-wrap-v1|${crystalId.toLowerCase()}|${kekVersion}`, "utf8");
  return aeadDecryptAesGcm(kekBuf, wrapNonce, wrappedCt, wrapAad);
}

export function sealCrystal(content, kekBuf, {
  tenantId = "local-agent",
  parentCrystalId = null,
  metadataPublic = {},
  kekVersion = 1,
} = {}) {
  if (!Buffer.isBuffer(kekBuf) || kekBuf.length !== 32) {
    throw new Error("KEK must be a 32-byte Buffer");
  }
  const ptBuf = Buffer.isBuffer(content)
    ? content
    : Buffer.from(typeof content === "string" ? content : canonicalJsonString(content), "utf8");
  const tenantHash = computeTenantHash(tenantId);
  const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const cipherName = "aes-256-gcm";
  const nonce = randomBytes(12);
  const dek = randomBytes(32);
  const aad = buildAad(cipherName, tenantHash, parentCrystalId, createdAt, metadataPublic, true);
  const ciphertext = aeadEncryptAesGcm(dek, nonce, ptBuf, aad);
  const crystalId = computeCrystalId(ciphertext, nonce, kekVersion);
  const wrappedDek = wrapCrystalDek(dek, kekBuf, crystalId, kekVersion);

  return {
    spec: SPEC,
    crystal_id: crystalId,
    parent_crystal_id: parentCrystalId,
    tenant_hash: tenantHash,
    cipher: cipherName,
    nonce: b64urlEncode(nonce),
    ciphertext: b64urlEncode(ciphertext),
    size_bytes: ciphertext.length,
    created_at: createdAt,
    kek_version: kekVersion,
    id_kek_version: kekVersion,
    wrapped_dek: wrappedDek,
    metadata_public: metadataPublic || {},
  };
}

export function unsealCrystal(envelope, kekBuf) {
  if (!Buffer.isBuffer(kekBuf) || kekBuf.length !== 32) {
    throw new Error("KEK must be a 32-byte Buffer");
  }
  if (envelope.dek_destroyed === true || ("kek_version" in envelope && !envelope.wrapped_dek)) {
    throw new Error("Crystal DEK has been cryptographically destroyed; payload is permanently undecryptable");
  }
  const nonce = b64urlDecode(envelope.nonce);
  const ciphertext = b64urlDecode(envelope.ciphertext);
  const kekVersion = envelope.kek_version ?? null;
  const idKekVersion = envelope.id_kek_version ?? kekVersion;
  const expectedId = computeCrystalId(ciphertext, nonce, idKekVersion);
  if (String(envelope.crystal_id).toLowerCase() !== expectedId.toLowerCase()) {
    throw new Error(`Crystal content-address verification failed: ${envelope.crystal_id} != ${expectedId}`);
  }
  const dek = envelope.wrapped_dek
    ? unwrapCrystalDek(envelope.wrapped_dek, kekBuf, envelope.crystal_id, Number(kekVersion))
    : kekBuf;
  const aad = buildAad(
    envelope.cipher,
    envelope.tenant_hash,
    envelope.parent_crystal_id ?? null,
    envelope.created_at,
    envelope.metadata_public || {},
    idKekVersion !== null,
  );
  return aeadDecryptAesGcm(dek, nonce, ciphertext, aad);
}

export function computeSetCommitment(crystals, tenantHash) {
  const orderedIds = crystals.map((c) => String(c.crystal_id).toLowerCase());
  const orderedDigest = `sha256:${sha256Hex(Buffer.from(orderedIds.join("\n"), "utf8"))}`;
  const headId = orderedIds.length > 0 ? orderedIds[orderedIds.length - 1] : null;
  const body = {
    kind: "wm.crystal-set-commitment",
    version: 1,
    spec: SPEC,
    tenant_hash: tenantHash,
    count: orderedIds.length,
    ordered_crystal_ids_digest: orderedDigest,
    head_crystal_id: headId,
    retrieved_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
  const commitmentDigest = `sha256:${sha256Hex(Buffer.from(canonicalJsonString(body), "utf8"))}`;
  return { ...body, commitment_digest: commitmentDigest };
}

function resolveStoreDir(customDir) {
  return resolve(customDir || process.env.WM_CRYSTALS_DIR || join(homedir(), ".local", "share", "whitemagic", "crystals"));
}

function resolveKek(hexKey, storeDir) {
  if (hexKey && /^[0-9a-fA-F]{64}$/.test(hexKey.trim())) {
    return Buffer.from(hexKey.trim(), "hex");
  }
  if (process.env.WM_CRYSTAL_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.WM_CRYSTAL_KEY.trim())) {
    return Buffer.from(process.env.WM_CRYSTAL_KEY.trim(), "hex");
  }
  mkdirSync(storeDir, { recursive: true, mode: 0o700 });
  const keyPath = join(storeDir, ".crystal_kek");
  if (existsSync(keyPath)) {
    const raw = readFileSync(keyPath, "utf8").trim();
    return Buffer.from(raw, "hex");
  }
  const generated = randomBytes(32);
  writeFileSync(keyPath, `${generated.toString("hex")}\n`, { mode: 0o600 });
  return generated;
}

function loadIndex(storeDir) {
  const idxPath = join(storeDir, "index.json");
  if (!existsSync(idxPath)) return [];
  return JSON.parse(readFileSync(idxPath, "utf8"));
}

function saveIndex(storeDir, items) {
  mkdirSync(storeDir, { recursive: true, mode: 0o700 });
  writeFileSync(join(storeDir, "index.json"), `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export const TOOLS = [
  {
    name: "crystal_remember",
    description:
      "Seal a memory locally into a client-encrypted WhiteMagic Memory Crystal (wm-crystal/1.0) with a per-crystal DEK wrapped under client KEK v(N) and SAIHM-aligned cellId = sha256(id_kek_version_be32 || nonce || ciphertext).",
    annotations: {
      title: "Seal and Store Memory Crystal",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Plaintext memory content to encrypt and seal" },
        tenant_id: { type: "string", description: "Tenant or namespace identifier (default: local-agent)" },
        metadata: { type: "object", description: "Optional non-sensitive metadata bound into AEAD AAD" },
        kek_version: { type: "integer", minimum: 1, description: "Client KEK version (default: 1)" },
        store_dir: { type: "string", description: "Optional local crystal directory override" },
        key_hex: { type: "string", description: "Optional 64-char hex 32-byte KEK override" },
      },
      required: ["content"],
      additionalProperties: false,
    },
  },
  {
    name: "crystal_recall",
    description:
      "Verify and unseal a specific Memory Crystal by crystal_id, or verify and unseal the ordered crystal chain on the read path.",
    annotations: {
      title: "Verify and Unseal Memory Crystal",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        crystal_id: { type: "string", description: "Optional crystal_id (sha256:<64 hex>); omit to verify and unseal the full chain" },
        tenant_id: { type: "string", description: "Tenant or namespace identifier (default: local-agent)" },
        store_dir: { type: "string", description: "Optional local crystal directory override" },
        key_hex: { type: "string", description: "Optional 64-char hex 32-byte KEK override" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "crystal_forget",
    description:
      "Erase a Memory Crystal using two-class erasure: destroys the wrapped per-crystal DEK (cryptographic erasure), unlinks active ciphertext, and records an erasure tombstone receipt.",
    annotations: {
      title: "Erase Memory Crystal (DEK Destruction + Tombstone)",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        crystal_id: { type: "string", description: "The crystal_id (sha256:<64 hex>) to erase" },
        mode: {
          type: "string",
          enum: ["cryptographic_and_storage_purge", "dek_destroy_only"],
          description: "Erasure mode (default: cryptographic_and_storage_purge)",
        },
        store_dir: { type: "string", description: "Optional local crystal directory override" },
      },
      required: ["crystal_id"],
      additionalProperties: false,
    },
  },
  {
    name: "crystal_status",
    description:
      "Return the current Memory Crystal store status, active count, erased count, head crystal_id, export-level set commitment, and erasure-class capabilities.",
    annotations: {
      title: "Memory Crystal Store Status & Set Commitment",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "Tenant or namespace identifier (default: local-agent)" },
        store_dir: { type: "string", description: "Optional local crystal directory override" },
      },
      additionalProperties: false,
    },
  },
];

export async function handleToolsCall(name, args = {}) {
  const storeDir = resolveStoreDir(args.store_dir);
  const tenantId = args.tenant_id || "local-agent";
  const tenantHash = computeTenantHash(tenantId);

  if (name === "crystal_remember") {
    if (!args.content || typeof args.content !== "string") {
      throw new Error("Missing required string argument 'content'");
    }
    const kek = resolveKek(args.key_hex, storeDir);
    const items = loadIndex(storeDir);
    const active = items.filter((c) => !c.dek_destroyed);
    const parentId = active.length > 0 ? active[active.length - 1].crystal_id : null;
    const envelope = sealCrystal(args.content, kek, {
      tenantId,
      parentCrystalId: parentId,
      metadataPublic: args.metadata || {},
      kekVersion: args.kek_version || 1,
    });
    items.push(envelope);
    saveIndex(storeDir, items);
    const commitment = computeSetCommitment(items.filter((c) => !c.dek_destroyed), tenantHash);
    writeFileSync(join(storeDir, "commitment.json"), `${JSON.stringify(commitment, null, 2)}\n`, "utf8");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              stored: true,
              crystal_id: envelope.crystal_id,
              parent_crystal_id: envelope.parent_crystal_id,
              tenant_hash: envelope.tenant_hash,
              kek_version: envelope.kek_version,
              id_kek_version: envelope.id_kek_version,
              size_bytes: envelope.size_bytes,
              set_commitment: commitment,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (name === "crystal_recall") {
    const kek = resolveKek(args.key_hex, storeDir);
    const items = loadIndex(storeDir);
    if (args.crystal_id) {
      const targetId = String(args.crystal_id).toLowerCase().startsWith("sha256:")
        ? String(args.crystal_id).toLowerCase()
        : `sha256:${String(args.crystal_id).toLowerCase()}`;
      const found = items.find((c) => String(c.crystal_id).toLowerCase() === targetId);
      if (!found) {
        throw new Error(`Crystal not found: ${targetId}`);
      }
      const pt = unsealCrystal(found, kek).toString("utf8");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                verified: true,
                crystal_id: found.crystal_id,
                parent_crystal_id: found.parent_crystal_id,
                tenant_hash: found.tenant_hash,
                kek_version: found.kek_version,
                created_at: found.created_at,
                metadata_public: found.metadata_public,
                content: pt,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    const active = items.filter((c) => !c.dek_destroyed);
    const recalled = [];
    for (let i = 0; i < active.length; i++) {
      const env = active[i];
      if (env.tenant_hash !== tenantHash) {
        throw new Error(`Cross-context replay detected at index ${i}`);
      }
      const pt = unsealCrystal(env, kek).toString("utf8");
      recalled.push({
        index: i,
        crystal_id: env.crystal_id,
        parent_crystal_id: env.parent_crystal_id,
        created_at: env.created_at,
        metadata_public: env.metadata_public,
        content: pt,
      });
    }
    const commitment = computeSetCommitment(active, tenantHash);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              verified: true,
              count: recalled.length,
              crystals: recalled,
              set_commitment: commitment,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (name === "crystal_forget") {
    if (!args.crystal_id) {
      throw new Error("Missing required argument 'crystal_id'");
    }
    const targetId = String(args.crystal_id).toLowerCase().startsWith("sha256:")
      ? String(args.crystal_id).toLowerCase()
      : `sha256:${String(args.crystal_id).toLowerCase()}`;
    const mode = args.mode || "cryptographic_and_storage_purge";
    const items = loadIndex(storeDir);
    const idx = items.findIndex((c) => String(c.crystal_id).toLowerCase() === targetId);
    if (idx === -1) {
      throw new Error(`Crystal not found: ${targetId}`);
    }
    const target = items[idx];
    target.wrapped_dek = null;
    target.dek_destroyed = true;
    if (mode === "cryptographic_and_storage_purge") {
      items.splice(idx, 1);
    }
    saveIndex(storeDir, items);

    const receipt = {
      kind: "wm.crystal-erasure",
      version: 1,
      crystal_id: targetId,
      tenant_hash: target.tenant_hash,
      erased_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      erasure_class: "cryptographic_client_dek_plus_ciphertext_purge",
      mode,
    };
    receipt.receipt_digest = `sha256:${sha256Hex(Buffer.from(canonicalJsonString(receipt), "utf8"))}`;
    appendFileSync(join(storeDir, "erasures.jsonl"), `${JSON.stringify(receipt)}\n`, "utf8");
    const commitment = computeSetCommitment(items.filter((c) => !c.dek_destroyed), tenantHash);
    writeFileSync(join(storeDir, "commitment.json"), `${JSON.stringify(commitment, null, 2)}\n`, "utf8");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              erased: true,
              crystal_id: targetId,
              erasure_class: receipt.erasure_class,
              erasure_receipt: receipt,
              set_commitment: commitment,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (name === "crystal_status") {
    const items = loadIndex(storeDir);
    const active = items.filter((c) => !c.dek_destroyed);
    const erasuresPath = join(storeDir, "erasures.jsonl");
    const erasures = existsSync(erasuresPath)
      ? readFileSync(erasuresPath, "utf8")
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => JSON.parse(l))
      : [];
    const commitment = computeSetCommitment(active, tenantHash);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              spec: SPEC,
              store_dir: storeDir,
              tenant_hash: tenantHash,
              active_crystals: active.length,
              erased_crystals: erasures.length,
              set_commitment: commitment,
              erasure_classes_supported: [
                "cryptographic_client_dek_plus_ciphertext_purge",
                "access_control_and_ciphertext_purge",
              ],
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

export async function processMessage(msg) {
  if (!msg || typeof msg !== "object") return null;
  const id = msg.id ?? null;

  if (msg.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      },
    };
  }
  if (msg.method === "notifications/initialized") {
    return null;
  }
  if (msg.method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }
  if (msg.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS },
    };
  }
  if (msg.method === "tools/call") {
    const { name, arguments: callArgs } = msg.params || {};
    try {
      const result = await handleToolsCall(name, callArgs);
      return { jsonrpc: "2.0", id, result };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: err.message },
      };
    }
  }
  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${msg.method}` },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  let chain = Promise.resolve();
  rl.on("line", (line) => {
    chain = chain.then(async () => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed);
        const reply = await processMessage(msg);
        if (reply !== null) {
          process.stdout.write(`${JSON.stringify(reply)}\n`);
        }
      } catch (err) {
        process.stdout.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: `Parse error: ${err.message}` },
          })}\n`,
        );
      }
    });
  });
}
