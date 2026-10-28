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

The plugin registers the WhiteMagic MCP server (`npx -y whitemagic-mcp@9.3.4 serve
--profile curated`) and adds a recall skill that teaches Claude when to use it
(session continuity, memory search, decisions).

Requirements: Node.js 18+ (for the `npx` launcher). These adapters pin
**Gen2 9.3.4**, whose profile is `curated`. For a native installation,
select 9.3.4 explicitly and use a separate installation directory:

```sh
curl -fsSL 'https://www.whitemagic.dev/install.sh?ref=plugin' | sh -s -- --version v9.3.4 \
  --dir "$HOME/.local/share/whitemagic-gen2/bin" --no-path
gen2_cli="$HOME/.local/share/whitemagic-gen2/bin/wm"
"$gen2_cli" --version
"$gen2_cli" connect          # preview clients, store and config changes
"$gen2_cli" connect --write  # apply after reviewing the preview
```

Gen3 is a separate experimental route. Its server uses
`/absolute/path/to/wm10 --store /absolute/path/to/separate-store serve --profile cyberbrain`
(or `full`); it has no `connect` or `setup` command and does not accept the
Gen2 `curated` profile. `grimoire --plan` prints its client recipe and may
initialize the explicitly selected store. Replace paths in client JSON/TOML
with actual absolute paths; `$HOME` is not expanded there. Select a separate
store when evaluating a different generation.

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
| Codex CLI | `plugins/codex` (config.toml + recall skill) | append the config snippet; copy/install the skill |
| OpenClaw | `clawhub/whitemagic` | see the ClawHub section below |
| Gemini CLI | `plugins/gemini` (extension: mcp + GEMINI.md + skill) | `gemini extensions link ./plugins/gemini` |
| Antigravity | `plugins/antigravity` (plugin: mcp_config.json + skill) | copy to `~/.gemini/config/plugins/whitemagic` |
| VS Code / GitHub Copilot | `plugins/vscode` (mcp.json + agent skill) | copy to `.vscode/mcp.json` + `.github/skills/` |

### Cursor

Add the server to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json`
(global), then copy the recall rule into `.cursor/rules/`:

```json
{
  "mcpServers": {
    "whitemagic": {
      "command": "npx",
      "args": ["-y", "whitemagic-mcp@9.3.4", "serve", "--profile", "curated"]
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

For the pinned Gen2 native binary above, `"$gen2_cli" setup openclaw` previews
configuration and `"$gen2_cli" setup openclaw --write` applies the reviewed
change. Confirm the executable is 9.3.4 first. The OpenClaw-specific adapter
is a source recipe; a checked-in adapter does not prove a client handshake
or memory round trip.

## Free offline receipt verification

This repo ships a free, offline receipt verifier and an MCP server for receipt
tools — no account, no network, no telemetry.

| Piece | Command / tool | Notes |
|---|---|---|
| Receipts MCP server | `npx -y --package whitemagic-plugins whitemagic-receipts-mcp` (or `node bin/receipts-mcp.mjs`) | Tools: `receipts.verify`, `receipts.inspect`, `receipts.hash`, `receipts.did_resolve` (stdio) |
| Crystals MCP server | `npx -y --package whitemagic-plugins whitemagic-crystals-mcp` (or `node bin/crystals-mcp.mjs`) | Non-custodial Memory Crystals (`wm-crystal/1.0`): `crystal_remember`, `crystal_recall`, `crystal_forget`, `crystal_status` (stdio) |
| CLI verifier | `npx -y --package whitemagic-plugins verify-receipt receipt.json` (or `node bin/verify-receipt.mjs receipt.json`) | `--json`, `-q`, `--require-anchor`, `--revocations <file>` |

> Note: run via `npx --package whitemagic-plugins` (the package is `whitemagic-plugins`;
> there is no separate `whitemagic-receipts-mcp` package on npm — that name in older
> docs resolved to a 404). After `npm i -g whitemagic-plugins`, the bare bin names
> `verify-receipt` / `whitemagic-receipts-mcp` work directly.

Verification modes (reported as `mode` in output):

- `wm-profile-exact` — WhiteMagic emitted continuity receipts
  (`continuity-receipt/0.5#session` / `#state_transition`) verified against the
  issuer DID with the kernel's exact `canonical_signing_bytes` recipe. No store
  access required.
- `continuity-receipt-ref` — continuity-receipt bundles (spec 0.1–0.6) delegated
  to the official [`continuity-receipt`](https://www.npmjs.com/package/continuity-receipt)
  package (optional dependency): full parity with the Python reference —
  71/71 conformance vectors, zero verdict mismatches.
- `integrity-only` — fallback when the official package is not installed:
  Ed25519 signatures + hash-chain linkage only. Verdicts are reported as
  `INTEGRITY_OK` / `INTEGRITY_FAILED` and never claim conformance.

The per-client `whitemagic-verify` skills teach agents when to reach for these
surfaces: review task evidence, verify execution receipts, audit signatures, or
validate proof bundles.

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
