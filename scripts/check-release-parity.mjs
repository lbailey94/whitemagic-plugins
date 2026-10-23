#!/usr/bin/env node
/** Verify the exact local npm tarball before any release action. No publish/network side effects. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expectedVersion = process.argv[2];
if (expectedVersion && expectedVersion !== pkg.version) {
  throw new Error(`expected version ${expectedVersion}, source is ${pkg.version}`);
}
const dir = mkdtempSync(join(tmpdir(), 'whitemagic-plugins-pack-'));
try {
  const result = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', dir], { encoding: 'utf8' }))[0];
  const archive = join(dir, result.filename);
  const packed = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }));
  if (packed.name !== pkg.name || packed.version !== pkg.version) throw new Error('packed package identity differs from source');
  const paths = new Set(execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n').map(p => p.replace(/^package\//, '')));
  for (const f of ['README.md', 'LICENSE', 'bin/receipts-mcp.mjs', 'bin/crystals-mcp.mjs', 'bin/verify-receipt.mjs', 'plugins/codex/config.toml', 'plugins/cursor/mcp.json', 'plugins/vscode/mcp.json', 'plugins/gemini/gemini-extension.json']) {
    if (!paths.has(f)) throw new Error(`required release file missing from tarball: ${f}`);
  }
  for (const [name, target] of Object.entries(pkg.bin)) {
    if (!paths.has(target)) throw new Error(`bin ${name} points to absent packed file ${target}`);
  }
  if (result.entryCount !== paths.size) throw new Error('npm pack file count does not match tar listing');
  console.log(JSON.stringify({ name: pkg.name, version: pkg.version, filename: result.filename, integrity: result.integrity, shasum: result.shasum, entryCount: result.entryCount, requiredFiles: 'present', binTargets: pkg.bin }, null, 2));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
