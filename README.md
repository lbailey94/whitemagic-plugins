# WhiteMagic plugins

[![whitemagic.agent](https://dmv.agentcommunity.org/badge?id=UNIT-FA2-46DL)](https://dmv.agentcommunity.org/c/UNIT-FA2-46DL/whitemagic)

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

## Clients

| Client | Adapter | Install |
|---|---|---|
| Claude Code | `plugins/whitemagic` | `/plugin marketplace add lbailey94/whitemagic-plugins` |
| Cursor | `plugins/cursor` (Cursor plugin: mcp.json + rule + skill) | manual `.cursor/mcp.json` today; marketplace submission pending |
| OpenClaw | `clawhub/whitemagic` | see the ClawHub section below |
| Codex CLI | planned | — |
| Gemini CLI / Antigravity | planned | — |
| VS Code / GitHub Copilot | planned | — |

### Cursor

Add the server to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json`
(global), then copy the recall rule into `.cursor/rules/`:

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

The full bundle lives at `plugins/cursor/` (`.cursor-plugin/plugin.json`,
`mcp.json`, `rules/whitemagic-recall.mdc`,
`skills/whitemagic-recall/SKILL.md`) and is listed in
`.cursor-plugin/marketplace.json`. Details: `plugins/cursor/README.md`.

## The stack

> Local memory → governed execution → verifiable continuity

- [`whitemagic`](https://github.com/lbailey94/whitemagic) — local-first memory and session continuity for AI agents
- [`continuity-receipt`](https://github.com/lbailey94/continuity-receipt) — portable, offline-verifiable evidence for governed tasks (Apache-2.0)
- [`mandalaos-gate-lite`](https://github.com/lbailey94/mandalaos-gate-lite) — bounded agent execution that emits receipts (review snapshot)
- [`whitemagic-plugins`](https://github.com/lbailey94/whitemagic-plugins) — client integrations and adapters (this repo)

Each repository stands on its own: WhiteMagic does not require MandalaOS, and
Continuity Receipt does not require WhiteMagic. Three entrances — **use it** →
`whitemagic`; **review a protocol** → `continuity-receipt`; **attack the
security architecture** → `mandalaos-gate-lite`.

## ClawHub (OpenClaw)

`clawhub/whitemagic/` is a ClawHub-publishable skill (AgentSkills `SKILL.md`).
It teaches OpenClaw agents to wire WhiteMagic and to use recall-first behavior.

```bash
clawhub login   # browser OIDC
clawhub skill publish ./clawhub/whitemagic \
  --slug whitemagic --name "WhiteMagic Memory" \
  --categories agents,development,knowledge \
  --topics memory,continuity,mcp,recall,provenance
```

Wire the local server with `wm setup openclaw --write` (v9.3.1+) or
`openclaw mcp add whitemagic --command wm --arg serve --arg --profile --arg curated`.

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
3. Submit via the directory portal: <https://claude.ai/directory/manage>
   (as of 2026-09-25; any paid Claude plan can submit — the old
   `platform.claude.com/plugins/submit` Console form is retired).
4. Approved plugins are pinned to a commit SHA in
   `anthropics/claude-plugins-community`; CI bumps the pin on new commits.

MIT licensed.
