import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

function makeXrplClaimPayload(channelIdHex, amountDrops) {
  const prefix = Buffer.from([0x43, 0x4c, 0x4d, 0x00]); // 'CLM\0'
  const channelBuf = Buffer.from(channelIdHex, "hex");
  if (channelBuf.length !== 32) {
    throw new Error("channel_id must be 32 bytes (64 hex characters)");
  }
  const amtBuf = Buffer.alloc(8);
  amtBuf.writeBigUInt64BE(BigInt(amountDrops));
  return Buffer.concat([prefix, channelBuf, amtBuf]);
}

function verifyXrplClaim(channelIdHex, amountDrops, pubKeyHex, sigHex, prevDrops = 0) {
  if (BigInt(amountDrops) <= BigInt(prevDrops)) {
    return { ok: false, reason: "non_monotonic_claim" };
  }
  const payload = makeXrplClaimPayload(channelIdHex, amountDrops);
  let pubBuf = Buffer.from(pubKeyHex, "hex");
  if (pubBuf.length === 33 && pubBuf[0] === 0xed) {
    pubBuf = pubBuf.subarray(1);
  }
  const keyObj = crypto.createPublicKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      x: pubBuf.toString("base64url"),
    },
    format: "jwk",
  });
  const sigBuf = Buffer.from(sigHex, "hex");
  const ok = crypto.verify(null, payload, keyObj, sigBuf);
  return { ok, reason: ok ? "valid" : "invalid_signature", delta: BigInt(amountDrops) - BigInt(prevDrops) };
}

test("XRPL PayChannel claim verification in Node.js matches specification", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const channelId = "5DB01B7FF38B08067508DA12D43796062D8F70E3D1377753A188FC9941FE0CE7";
  const amountDrops = 500000;

  const payload = makeXrplClaimPayload(channelId, amountDrops);
  const sig = crypto.sign(null, payload, privateKey);

  const jwk = publicKey.export({ format: "jwk" });
  const pubHex = Buffer.from(jwk.x, "base64url").toString("hex");

  // Warm up JIT
  verifyXrplClaim(channelId, amountDrops, pubHex, sig.toString("hex"), 0);

  const t0 = performance.now();
  const res = verifyXrplClaim(channelId, amountDrops, pubHex, sig.toString("hex"), 0);
  const ms = performance.now() - t0;

  assert.equal(res.ok, true);
  assert.equal(res.delta, 500000n);
  assert.ok(ms < 5.0, `Expected < 5.0ms, got ${ms.toFixed(3)}ms`);

  // Tampering amount fails
  const badRes = verifyXrplClaim(channelId, 999999, pubHex, sig.toString("hex"), 0);
  assert.equal(badRes.ok, false);

  // Non-monotonic claim fails
  const nonMono = verifyXrplClaim(channelId, amountDrops, pubHex, sig.toString("hex"), amountDrops);
  assert.equal(nonMono.ok, false);
  assert.equal(nonMono.reason, "non_monotonic_claim");
});
