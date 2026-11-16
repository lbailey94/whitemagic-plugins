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
         "args": ["-y", "whitemagic-mcp@11.2.1", "serve", "--profile", "cyberbrain"]
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
# Gen3 11.2.1 (Linux x86-64/ARM64 & Apple Silicon macOS):
curl -fsSL 'https://www.whitemagic.dev/install.sh?ref=antigravity-plugin' | sh -s -- --version v11.2.1
wm --version
wm --store "$HOME/.local/share/whitemagic/gen3" grimoire --plan
```

For manual configuration, use the expanded absolute binary path as `command`
and `["--store", "/absolute/home/.local/share/whitemagic/gen3", "serve", "--profile", "cyberbrain"]`
as `args` (`$HOME` is not expanded inside JSON).

### Windows (`x86_64`) & Intel macOS (`x86_64`) fallback (Gen2 `9.3.4`)

On Windows or Intel macOS (not yet in the Gen3 `11.2.1` native matrix), use
`npx -y whitemagic-mcp@9.3.4 serve --profile curated` (30 curated tools), or
install native Gen2 `v9.3.4` (`brew install lbailey94/tap/whitemagic` on Intel
macOS, Scoop / `install.ps1 -Version 'v9.3.4'` on Windows) and pass
`["serve", "--profile", "curated"]`.

## What it adds

| Component | Purpose |
|---|---|
| `plugin.json` | Plugin package marker |
| `mcp_config.json` | WhiteMagic MCP server (`11.2.1` `cyberbrain` profile, stdio) |
| `skills/whitemagic-recall/SKILL.md` | When/how to recall and persist memory |

These are supplied adapter recipes: Antigravity CLI and IDE discovery paths,
handshakes, and round trips need separate checks on the selected version.

Requirements: Node.js 18+ for the `npx` launcher (or native `11.2.1` / `9.3.4`).

MIT licensed.
