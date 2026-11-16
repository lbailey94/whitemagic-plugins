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
      "args": ["-y", "whitemagic-mcp@11.2.1", "serve", "--profile", "cyberbrain"]
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
# Gen3 11.2.1 (Linux x86-64/ARM64 & Apple Silicon macOS):
curl -fsSL 'https://www.whitemagic.dev/install.sh?ref=vscode-plugin' | sh -s -- --version v11.2.1
wm --version
wm --store "$HOME/.local/share/whitemagic/gen3" grimoire --plan
```

Set `command` in `.vscode/mcp.json` to the expanded absolute binary path and
`args` to `["--store", "/absolute/home/.local/share/whitemagic/gen3", "serve", "--profile", "cyberbrain"]`.
On Windows (`x86_64`) or Intel macOS (`x86_64`), pin Gen2 `9.3.4` instead:
`npx -y whitemagic-mcp@9.3.4 serve --profile curated` (or native `v9.3.4` with
`["serve", "--profile", "curated"]`; see the root `README.md`).

## What it adds

| Component | Purpose |
|---|---|
| `mcp.json` | WhiteMagic MCP server (`11.2.1` `cyberbrain` profile, stdio) |
| `skills/whitemagic-recall/SKILL.md` | When/how to recall and persist memory |

Requirements: Node.js 18+ for the `npx` launcher (or the native `wm` binary).

MIT licensed.
