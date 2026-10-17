#!/usr/bin/env node
/**
 * @file receipts-mcp.mjs
 * Lightweight standalone Model Context Protocol (MCP) server for receipt
 * verification. Zero required dependencies. Uses stdio transport.
 *
 * Tools exposed:
 *   - receipts.verify: Offline verification of continuity-receipt bundles and
 *     WhiteMagic emitted profile receipts. Bundle conformance uses the official
 *     `continuity-receipt` npm package when installed (optional dependency);
 *     otherwise falls back to an honest integrity-only check.
 *   - receipts.inspect: Inspect structural claims, signatures, sequence, and timestamps.
 *   - receipts.hash: Compute canonical RFC 8785 / JCS subset SHA-256 digest of an object.
 *   - receipts.did_resolve: Decode a did:key:z... identifier into raw Ed25519 public key.
 */

import { createInterface } from "node:readline";
import {
  verifyReceiptBundle,
  officialAvailable,
  canonicalBytes,
  sha256Prefixed,
  decodeBase58,
} from "./verify-receipt.mjs";

const SERVER_INFO = {
  name: "whitemagic-receipts-mcp",
  version: "1.3.0"
};

const TOOLS = [
  {
    name: "receipts.verify",
    description:
      "Verify a Continuity Receipt bundle or a WhiteMagic emitted continuity receipt offline. " +
      "Bundle conformance (spec 0.1-0.6) is evaluated with the official 'continuity-receipt' package when installed " +
      "(full reference parity); otherwise an integrity-only fallback is reported explicitly (verdict INTEGRITY_OK/INTEGRITY_FAILED). " +
      "WhiteMagic emitted receipts (continuity-receipt/0.5#session / #state_transition) are verified natively against the issuer DID.",
    inputSchema: {
      type: "object",
      properties: {
        bundle: {
          type: "object",
          description: "Continuity Receipt bundle or a single WhiteMagic emitted profile receipt object"
        },
        require_anchor: {
          type: "boolean",
          description: "If true, treats unanchored bundles as insufficient evidence (default: false)"
        }
      },
      required: ["bundle"],
      additionalProperties: false
    }
  },
  {
    name: "receipts.inspect",
    description: "Inspect the structure, sequence numbers, issuer DIDs, timestamps, and claims of a receipt bundle without asserting validity policy.",
    inputSchema: {
      type: "object",
      properties: {
        bundle: {
          type: "object",
          description: "Continuity Receipt bundle object"
        }
      },
      required: ["bundle"],
      additionalProperties: false
    }
  },
  {
    name: "receipts.hash",
    description: "Compute the canonical RFC 8785 / JCS subset SHA-256 digest of an arbitrary JSON object.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          description: "JSON object to canonically hash"
        }
      },
      required: ["data"],
      additionalProperties: false
    }
  },
  {
    name: "receipts.did_resolve",
    description: "Decode an Ed25519 did:key:z... identifier and verify multicodec 0xed01 framing.",
    inputSchema: {
      type: "object",
      properties: {
        did: {
          type: "string",
          description: "The did:key:z... multibase string"
        }
      },
      required: ["did"],
      additionalProperties: false
    }
  }
];

async function handleToolsCall(name, args) {
  if (name === "receipts.verify") {
    if (!args || !args.bundle) {
      throw new Error("Missing required argument 'bundle'");
    }
    const result = await verifyReceiptBundle(args.bundle, {
      requireAnchor: Boolean(args.require_anchor)
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  if (name === "receipts.inspect") {
    if (!args || !args.bundle) {
      throw new Error("Missing required argument 'bundle'");
    }
    const b = args.bundle;
    const receipts = Array.isArray(b.receipts) ? b.receipts : [b];
    const inspection = {
      spec: b.spec || "unknown",
      task_id: b.task_id || "none",
      receipt_count: receipts.length,
      receipts: receipts.map((r, i) => ({
        index: i,
        seq: r.seq,
        type: r.type || r.kind,
        issued_at: r.issued_at,
        issuer_did: (r.issuer && r.issuer.id) || r.issuer_did || (r.sig && r.sig.key),
        prev: r.prev || r.prior_receipt_digest || null,
        has_signature: Boolean(r.sig || r.signature)
      }))
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(inspection, null, 2)
        }
      ]
    };
  }

  if (name === "receipts.hash") {
    if (!args || typeof args.data !== "object") {
      throw new Error("Missing required argument 'data' (object)");
    }
    const cBytes = canonicalBytes(args.data);
    const digest = sha256Prefixed(cBytes);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            digest,
            canonical_bytes_len: cBytes.length,
            canonical_utf8: cBytes.toString("utf8")
          }, null, 2)
        }
      ]
    };
  }

  if (name === "receipts.did_resolve") {
    if (!args || !args.did) {
      throw new Error("Missing required argument 'did'");
    }
    const did = args.did;
    if (!did.startsWith("did:key:z")) {
      throw new Error("Invalid DID format: must start with 'did:key:z'");
    }
    const decoded = decodeBase58(did.slice(9));
    const prefix = decoded.subarray(0, 2);
    const isEd25519 = prefix.equals(Buffer.from([0xed, 0x01]));
    const rawKey = decoded.subarray(2);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            did,
            algorithm: isEd25519 ? "Ed25519" : "unknown",
            valid_multicodec: isEd25519,
            multicodec_hex: prefix.toString("hex"),
            public_key_hex: rawKey.toString("hex"),
            public_key_len: rawKey.length
          }, null, 2)
        }
      ]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function processMessage(msg) {
  if (!msg || typeof msg !== "object") return null;
  const id = msg.id ?? null;

  if (msg.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        serverInfo: SERVER_INFO
      }
    };
  }

  if (msg.method === "notifications/initialized") {
    return null; // Notification, no reply
  }

  if (msg.method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (msg.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: TOOLS,
        _meta: {
          verifier: {
            official_parity_available: officialAvailable(),
            fallback: "integrity-only"
          }
        }
      }
    };
  }

  if (msg.method === "tools/call") {
    const { name, arguments: callArgs } = msg.params || {};
    try {
      const result = await handleToolsCall(name, callArgs);
      return {
        jsonrpc: "2.0",
        id,
        result
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: err.message
        }
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Method not found: ${msg.method}`
    }
  };
}

// ── Line-buffered stdio transport (ordered, async-safe) ────────────────────
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let chain = Promise.resolve();
rl.on("line", (line) => {
  chain = chain.then(async () => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      const reply = await processMessage(msg);
      if (reply !== null) {
        process.stdout.write(JSON.stringify(reply) + "\n");
      }
    } catch (err) {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: `Parse error: ${err.message}` }
      }) + "\n");
    }
  }).catch((err) => {
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: `Internal error: ${err.message}` }
    }) + "\n");
  });
});
