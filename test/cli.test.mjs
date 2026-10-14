import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { symlinkSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL("..", import.meta.url));
const binPath = join(here, "bin", "verify-receipt.mjs");
const fixture = join(here, "test", "fixtures", "wm", "session-valid.json");

test("cli: --help prints usage", () => {
  const r = spawnSync(process.execPath, [binPath, "--help"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /WhiteMagic Receipts Verifier/);
});

test("cli: verifies a WM fixture (mode wm-profile-exact)", () => {
  const r = spawnSync(process.execPath, [binPath, "--json", fixture], { encoding: "utf8" });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.verdict, "TRUSTED");
  assert.equal(out.mode, "wm-profile-exact");
});

test("cli: works when invoked through a symlink (npm bin parity)", () => {
  const dir = mkdtempSync(join(tmpdir(), "wm-cli-"));
  const link = join(dir, "verify-receipt");
  symlinkSync(binPath, link);
  const r = spawnSync(process.execPath, [link, "--help"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /WhiteMagic Receipts Verifier/);
  rmSync(dir, { recursive: true, force: true });
});
