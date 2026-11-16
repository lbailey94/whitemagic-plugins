import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');

function extractNpxSpec(args) {
  const pkgArg = args.find((a) => a.startsWith('whitemagic-mcp@'));
  assert.ok(pkgArg, 'missing whitemagic-mcp@<version> arg');
  const version = pkgArg.slice('whitemagic-mcp@'.length);
  const profileIdx = args.indexOf('--profile');
  assert.ok(profileIdx >= 0 && profileIdx + 1 < args.length, 'missing --profile arg');
  const profile = args[profileIdx + 1];
  return { version, profile };
}

test('all client MCP configs pin one coherent whitemagic-mcp version and profile', () => {
  const configs = [
    ['plugins/whitemagic/.mcp.json', JSON.parse(read('plugins/whitemagic/.mcp.json')).mcpServers.whitemagic.args],
    ['plugins/antigravity/mcp_config.json', JSON.parse(read('plugins/antigravity/mcp_config.json')).mcpServers.whitemagic.args],
    ['plugins/cursor/mcp.json', JSON.parse(read('plugins/cursor/mcp.json')).mcpServers.whitemagic.args],
    ['plugins/gemini/gemini-extension.json', JSON.parse(read('plugins/gemini/gemini-extension.json')).mcpServers.whitemagic.args],
    ['plugins/vscode/mcp.json', JSON.parse(read('plugins/vscode/mcp.json')).servers.whitemagic.args],
  ];

  const toml = read('plugins/codex/config.toml');
  const tomlArgsMatch = toml.match(/^args\s*=\s*(\[[^\]]+\])/m);
  assert.ok(tomlArgsMatch, 'plugins/codex/config.toml missing active args array');
  configs.push(['plugins/codex/config.toml', JSON.parse(tomlArgsMatch[1])]);

  const specs = configs.map(([path, args]) => [path, extractNpxSpec(args)]);
  const expected = specs[0][1];
  const major = Number(expected.version.split('.')[0]);
  assert.equal(expected.profile, major >= 11 ? 'cyberbrain' : 'curated', 'MCP profile must match major release generation');

  for (const [path, spec] of specs) {
    assert.deepEqual(spec, expected, `${path} drifted from ${specs[0][0]}`);
  }
});

test('all client skills, rules, and READMEs stay aligned with active generation and v9.3.4 fallback', () => {
  const { args } = JSON.parse(read('plugins/whitemagic/.mcp.json')).mcpServers.whitemagic;
  const { version, profile } = extractNpxSpec(args);
  const major = Number(version.split('.')[0]);

  const recallDocs = [
    'plugins/whitemagic/skills/whitemagic-recall/SKILL.md',
    'plugins/antigravity/skills/whitemagic-recall/SKILL.md',
    'plugins/codex/skills/whitemagic-recall/SKILL.md',
    'plugins/cursor/skills/whitemagic-recall/SKILL.md',
    'plugins/gemini/skills/whitemagic-recall/SKILL.md',
    'plugins/vscode/skills/whitemagic-recall/SKILL.md',
    'plugins/gemini/GEMINI.md',
    'plugins/cursor/rules/whitemagic-recall.mdc',
    'clawhub/whitemagic/SKILL.md',
  ];

  for (const path of recallDocs) {
    const text = read(path);
    if (major >= 11) {
      assert.doesNotMatch(text, /wm MCP meta-tool is the only entry point/i, `${path} still claims Gen2 wm-only routing`);
      for (const tool of ['session_continuity', 'memory_recall', 'memory_remember']) {
        assert.ok(text.includes(tool), `${path} missing Gen3 cyberbrain tool ${tool}`);
      }
    }
  }

  const readmes = [
    'README.md',
    'docs/RELEASE-AND-CLIENT-MATRIX.md',
    'plugins/antigravity/README.md',
    'plugins/codex/README.md',
    'plugins/cursor/README.md',
    'plugins/gemini/README.md',
    'plugins/vscode/README.md',
  ];

  for (const path of readmes) {
    const text = read(path);
    assert.ok(text.includes(`whitemagic-mcp@${version}`), `${path} must reference whitemagic-mcp@${version}`);
    assert.ok(text.includes(profile), `${path} must reference --profile ${profile}`);
    if (major >= 11) {
      assert.ok(text.includes('9.3.4') && text.includes('curated'), `${path} must retain explicit Gen2 9.3.4 curated fallback guidance`);
    }
  }
});
