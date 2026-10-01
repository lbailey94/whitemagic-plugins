# WhiteMagic for Antigravity

Plugin bundle for Google Antigravity (CLI + IDE) — registers the WhiteMagic MCP
server and adds a recall skill.

## Install

### Plugin directory

Copy this directory into the shared plugin path:

```bash
mkdir -p ~/.gemini/config/plugins
cp -r plugins/antigravity ~/.gemini/config/plugins/whitemagic
```

Antigravity picks up `plugin.json`, `mcp_config.json`, and `skills/` from the
plugin package. Restart the agent after copying.

### Manual (MCP config + skills)

1. **MCP server** — merge into `~/.gemini/config/mcp_config.json` (shared) or
   your workspace's `.agents/mcp_config.json`:

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

2. **Recall skill** — copy to the shared skills path (works across Antigravity
   tools):

   ```bash
   mkdir -p ~/.gemini/skills
   cp -r plugins/antigravity/skills/whitemagic-recall ~/.gemini/skills/
   ```

   Antigravity CLI also reads `~/.gemini/antigravity-cli/skills/` for
   CLI-only skills; the shared `~/.gemini/skills/` path is the one all
   Antigravity products see.

### Native binary instead of npx

```bash
curl -fsSL https://www.whitemagic.dev/install.sh?ref=antigravity-plugin | sh
wm connect --write   # wires every detected client, including Antigravity
```

## What it adds

| Component | Purpose |
|---|---|
| `plugin.json` | Plugin package marker |
| `mcp_config.json` | WhiteMagic MCP server (curated profile, stdio) |
| `skills/whitemagic-recall/SKILL.md` | When/how to recall and persist memory |

Requirements: Node.js 18+ for the `npx` launcher (or the native `wm` binary).

MIT licensed.
