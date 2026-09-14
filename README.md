# WhiteMagic plugins

Claude Code plugin marketplace for [WhiteMagic](https://whitemagic.dev) —
local-first memory and session continuity for coding agents. One static Rust
binary, no cloud service, no telemetry, MIT.

## Install

```text
/plugin marketplace add lbailey94/whitemagic-plugins
/plugin install whitemagic@whitemagic
```

The plugin registers the WhiteMagic MCP server (`npx -y whitemagic-mcp serve
--profile curated`) and adds a recall skill that teaches Claude when to use it
(session continuity, memory search, decisions).

Requirements: Node.js 18+ (for the `npx` launcher). Prefer a native binary?
`curl -fsSL https://www.whitemagic.dev/install.sh?ref=plugin | sh`, then
`wm connect` wires every detected client — including Claude Code.

## What it adds

| Component | Purpose |
|---|---|
| `.mcp.json` | WhiteMagic MCP server (curated profile) |
| `skills/whitemagic-recall` | When/how to recall and persist project memory |

## Development

```bash
claude --plugin-dir ./plugins/whitemagic
```

Validate before submitting:

```bash
claude plugin validate ./plugins/whitemagic --strict
```

## Publishing

1. Push this repository (the plugin lives at `plugins/whitemagic`).
2. Validate locally with `claude plugin validate ./plugins/whitemagic --strict`.
3. Submit via the Console form for individual authors:
   <https://platform.claude.com/plugins/submit> (claude.ai form requires a
   Team/Enterprise org).
4. Approved plugins are pinned to a commit SHA in
   `anthropics/claude-plugins-community`; CI bumps the pin on new commits.

MIT licensed.
