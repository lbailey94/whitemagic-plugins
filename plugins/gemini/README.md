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
      "args": ["-y", "whitemagic-mcp", "serve", "--profile", "curated"]
    }
  }
}
```

Then copy `skills/whitemagic-recall/` into your skills directory and copy the
`GEMINI.md` guidance into your context if you want it always loaded.

### Native binary instead of npx

```bash
curl -fsSL https://www.whitemagic.dev/install.sh?ref=gemini-plugin | sh
wm setup gemini --write   # writes the Gemini CLI config for you
```

## What it adds

| Component | Purpose |
|---|---|
| `gemini-extension.json` | WhiteMagic MCP server (curated profile, stdio) |
| `GEMINI.md` | Recall-first context |
| `skills/whitemagic-recall/SKILL.md` | When/how to recall and persist memory |

Requirements: Node.js 18+ for the `npx` launcher (or the native `wm` binary).

MIT licensed.
