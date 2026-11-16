# WhiteMagic for Gemini CLI

Gemini CLI extension for [WhiteMagic](https://whitemagic.dev): registers the
WhiteMagic MCP server, loads recall-first context (`GEMINI.md`), and bundles a
recall skill.

## Install

### Extension (recommended)

```bash
git clone https://github.com/lbailey94/whitemagic-plugins
gemini extensions link ./whitemagic-plugins/plugins/gemini
```

`gemini extensions link` loads the extension from disk (the extension root is
`plugins/gemini/`, which is where `gemini-extension.json` lives). Restart
Gemini CLI after linking; the `whitemagic` MCP server and the
`whitemagic-recall` skill are discovered automatically.

### Manual

Add the server to `~/.gemini/settings.json` (or a project
`.gemini/settings.json`):

```json
{
  "mcpServers": {
    "whitemagic": {
      "command": "npx",
      "args": ["-y", "whitemagic-mcp@11.2.1", "serve", "--profile", "cyberbrain"]
    }
  }
}
```

Then copy `skills/whitemagic-recall/` into your skills directory and copy the
`GEMINI.md` guidance into your context if you want it always loaded.

### Native binary instead of npx

```bash
# Gen3 11.2.1 (Linux x86-64/ARM64 & Apple Silicon macOS):
curl -fsSL 'https://www.whitemagic.dev/install.sh?ref=gemini-plugin' | sh -s -- --version v11.2.1
wm --version
wm --store "$HOME/.local/share/whitemagic/gen3" grimoire --plan
```

For manual configuration, set `command` to the expanded absolute binary path
and `args` to `["--store", "/absolute/home/.local/share/whitemagic/gen3", "serve", "--profile", "cyberbrain"]`.
On Windows (`x86_64`) or Intel macOS (`x86_64`), use Gen2 `9.3.4` instead:
`npx -y whitemagic-mcp@9.3.4 serve --profile curated` (or native `v9.3.4` with
`["serve", "--profile", "curated"]`; see the root `README.md`). These
instructions do not establish an installed Gemini memory round trip.

## What it adds

| Component | Purpose |
|---|---|
| `gemini-extension.json` | WhiteMagic MCP server (`11.2.1` `cyberbrain` profile, stdio) |
| `GEMINI.md` | Recall-first context |
| `skills/whitemagic-recall/SKILL.md` | When/how to recall and persist memory |

Requirements: Node.js 18+ for the `npx` launcher (or the native `wm` binary).

MIT licensed.
