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
args = ["-y", "whitemagic-mcp@9.3.4", "serve", "--profile", "curated"]
startup_timeout_sec = 30
```

Prefer the native Gen2 binary? Install 9.3.4 into a separate prefix and use
`command = "/absolute/path/to/whitemagic-gen2/bin/wm"` with
`args = ["serve", "--profile", "curated"]`:

```bash
curl -fsSL 'https://www.whitemagic.dev/install.sh?ref=codex-plugin' | sh -s -- --version v9.3.4 \
  --dir "$HOME/.local/share/whitemagic-gen2/bin" --no-path
gen2_cli="$HOME/.local/share/whitemagic-gen2/bin/wm"
"$gen2_cli" --version
"$gen2_cli" setup codex          # preview the store and config change
"$gen2_cli" setup codex --write  # apply after reviewing the preview
```

Restart Codex after editing the config.

### 2. Recall skill

```bash
mkdir -p ~/.agents/skills
cp -r plugins/codex/skills/whitemagic-recall ~/.agents/skills/
```

Or install it from this repository with Codex's built-in `skill-installer`:

```text
Install the skill from github.com/lbailey94/whitemagic-plugins/plugins/codex/skills/whitemagic-recall
```

Codex discovers user skills from `~/.agents/skills`; no feature toggle is
needed. See the [official skill discovery guide](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills).
If the installed skill does not appear, restart Codex.

## What it adds

| Component | Purpose |
|---|---|
| `[mcp_servers.whitemagic]` | WhiteMagic MCP server (curated profile, stdio) |
| `skills/whitemagic-recall/SKILL.md` | When/how to recall and persist project memory |

Requirements: Node.js 18+ for the pinned Gen2 `npx` launcher (or native
9.3.4). See the root README for Gen3's different command/profile and store.
`codex mcp list` shows configuration; initialization and tool calls need
separate checks. These adapter recipes do not establish a client round trip.

MIT licensed.
