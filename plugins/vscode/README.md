# WhiteMagic for VS Code / GitHub Copilot

Adapter for [WhiteMagic](https://whitemagic.dev): registers the WhiteMagic MCP
server with VS Code and adds an Agent Skill for recall.

## Install

### 1. MCP server

Copy `mcp.json` to your workspace `.vscode/mcp.json` (commit it so teammates
get the same tools), or merge the `servers.whitemagic` entry into your user
profile config (Command Palette → **MCP: Open User Configuration**):

```json
{
  "servers": {
    "whitemagic": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "whitemagic-mcp@9.3.4", "serve", "--profile", "curated"]
    }
  }
}
```

Reload the window after editing; the server appears under **MCP SERVERS —
INSTALLED**, and its tools can be toggled in the Chat tool picker.

### 2. Recall skill

Copy the skill into the project's skills directory:

```bash
mkdir -p .github/skills
cp -r plugins/vscode/skills/whitemagic-recall .github/skills/
```

VS Code loads project skills from `.github/skills/`, `.claude/skills/`, or
`.agents/skills/`; personal skills live under `~/.copilot/skills/`. The skill
shows up in the `/` menu as `whitemagic-recall`.

### Native binary instead of npx

```bash
curl -fsSL 'https://www.whitemagic.dev/install.sh?ref=vscode-plugin' | sh -s -- --version v9.3.4 \
  --dir "$HOME/.local/share/whitemagic-gen2/bin" --no-path
"$HOME/.local/share/whitemagic-gen2/bin/wm" --version
```

Replace `command` in the manual MCP JSON above with that binary's actual
absolute path and `args` with `["serve", "--profile", "curated"]`. Gen2's
`setup` client list does not include VS Code. See the root README for Gen3's
separate binary/store/profile recipe.

## What it adds

| Component | Purpose |
|---|---|
| `mcp.json` | WhiteMagic MCP server (curated profile, stdio) |
| `skills/whitemagic-recall/SKILL.md` | When/how to recall and persist memory |

Requirements: Node.js 18+ for the `npx` launcher (or the native `wm` binary).

MIT licensed.
