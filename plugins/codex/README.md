# WhiteMagic for Codex CLI

Adapter for [WhiteMagic](https://whitemagic.dev): registers the WhiteMagic MCP
server with Codex and adds a recall skill.

## Install

### 1. MCP server

Append to `~/.codex/config.toml` (or a trusted project's
`.codex/config.toml`):

```toml
[mcp_servers.whitemagic]
command = "npx"
args = ["-y", "whitemagic-mcp", "serve", "--profile", "curated"]
startup_timeout_sec = 30
```

Prefer the native binary? Install it and use `command = "wm"` with
`args = ["serve", "--profile", "curated"]`:

```bash
curl -fsSL https://www.whitemagic.dev/install.sh?ref=codex-plugin | sh
wm setup codex --write   # writes the Codex config for you
```

Restart Codex after editing the config.

### 2. Recall skill

```bash
mkdir -p ~/.codex/skills
cp -r plugins/codex/skills/whitemagic-recall ~/.codex/skills/
```

Or install it from this repository with Codex's built-in `skill-installer`:

```text
Install the skill from github.com/lbailey94/whitemagic-plugins/plugins/codex/skills/whitemagic-recall
```

Ensure skills are enabled in `~/.codex/config.toml`:

```toml
[features]
skills = true
```

Restart Codex; the skill appears as `whitemagic-recall`.

## What it adds

| Component | Purpose |
|---|---|
| `[mcp_servers.whitemagic]` | WhiteMagic MCP server (curated profile, stdio) |
| `skills/whitemagic-recall/SKILL.md` | When/how to recall and persist project memory |

Requirements: Node.js 18+ for the `npx` launcher (or the native `wm` binary).

MIT licensed.
