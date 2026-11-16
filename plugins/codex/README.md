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
args = ["-y", "whitemagic-mcp@11.2.1", "serve", "--profile", "cyberbrain"]
startup_timeout_sec = 30
```

Prefer the native Gen3 `11.2.1` binary (Linux / Apple Silicon macOS)? Install
`v11.2.1` and use expanded absolute paths with `args = ["--store", "/absolute/home/.local/share/whitemagic/gen3", "serve", "--profile", "cyberbrain"]`:

```bash
curl -fsSL 'https://www.whitemagic.dev/install.sh?ref=codex-plugin' | sh -s -- --version v11.2.1
wm --version
wm --store "$HOME/.local/share/whitemagic/gen3" grimoire --plan
```

On Windows (`x86_64`) or Intel macOS (`x86_64`), pin Gen2 `9.3.4` instead:
`args = ["-y", "whitemagic-mcp@9.3.4", "serve", "--profile", "curated"]` (or
install native `v9.3.4`, where `wm setup codex` / `wm setup codex --write`
apply). See the root `README.md` for Windows PowerShell / Scoop / Homebrew recipes.

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
| `[mcp_servers.whitemagic]` | WhiteMagic MCP server (`11.2.1` `cyberbrain` profile, stdio) |
| `skills/whitemagic-recall/SKILL.md` | When/how to recall and persist project memory |

Requirements: Node.js 18+ for the `npx` launcher (or native `11.2.1` / Gen2 `9.3.4` fallback on Windows & Intel macOS).
`codex mcp list` shows configuration; initialization and tool calls need
separate checks. These adapter recipes do not establish a client round trip.

MIT licensed.
