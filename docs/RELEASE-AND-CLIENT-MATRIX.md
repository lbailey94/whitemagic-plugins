# Release and client matrix

This matrix records what a user can choose today from repository evidence. A checked-in adapter is an instruction bundle; it does not prove a client installed it or completed an MCP request.

## Package channels

| Channel | Selector | State | Meaning |
|---|---|---|---|
| Source checkout | Git commit SHA | Source | Record `git rev-parse HEAD`. The setup corrections after `0dbc032cc67642d8de1b02e0826f44a356cbfe46` are newer than the published 1.3.0 tarball; matching package versions do not establish byte parity. |
| npm | `whitemagic-plugins@latest` | Registry stable | Live npm metadata checked 2026-10-28 resolves to 1.3.0. `latest` can move; use the exact version for reproducible installs. |
| npm | `whitemagic-plugins@1.3.0` | Published | Registry integrity observed 2026-10-28: `sha512-uZnP20oRDKx4Mw96JoyIP1S0FXYYCDCHdqlFPr0bwFJeLblN8mD7coKF0HoE81I1cTamWQzpZ7AlOg9CuTxGEg==`. New source adapters are not silently republished under this immutable version. |
| GitHub Releases | latest | None observed | No release was listed by GitHub on 2026-10-26. |
| PyPI | `whitemagic==26.0.4` | Retired Gen-1 | Legacy Python package, marked inactive. It is not the Rust WhiteMagic line. |

For a reproducible install, pin a reviewed version or commit. `latest` is a moving selector. Before release, run `npm run check:release-parity`; it packs the exact local candidate, checks the embedded name/version, required adapters, and every declared executable target, and prints npm's tarball integrity and SHA-1. Keep that output with the intended immutable Git commit. The check does not publish, inspect marketplace acceptance, or prove registry parity. Registry parity requires comparing the downloaded tarball's integrity, embedded metadata, file list, and executables against this candidate.

## Client and binary paths

| Client/channel | Install route | Selector and current evidence | Journey status |
|---|---|---|---|
| Claude Code | Marketplace `/plugin marketplace add lbailey94/whitemagic-plugins` | Marketplace follows repository state; no immutable version pin stated | Instructions only; install/handshake/round-trip not exercised |
| Codex CLI | `plugins/codex/config.toml` and skills | Pin this repo to a reviewed commit when copying files | Instructions only |
| Cursor | `.cursor/mcp.json`, rules, skills | Manual project/global config; marketplace submission pending | Instructions only |
| VS Code / Copilot | `.vscode/mcp.json` and `.github/skills/` | Manual copy from `plugins/vscode` | Instructions only |
| Gemini CLI | `gemini extensions link ./plugins/gemini` | Source extension pins `whitemagic-mcp@9.3.4`, Gen2 `curated` | Instructions only; no installed client round-trip claim |
| Antigravity | Copy `plugins/antigravity` | Bundled config; external distribution status unverified | Instructions only |
| OpenClaw | ClawHub skill and explicitly selected Gen2 setup | Skill source in this repo; publication status not established here | Instructions only |
| Homebrew | `brew install lbailey94/tap/whitemagic` | Repo manifest exists; no current binary/hash/signature/first-run proof in this work | Not qualified |
| Scoop | `scoop bucket add whitemagic ...; scoop install whitemagic` | Public manifest observed at 9.3.4 for Windows x86_64 | Not qualified |
| Native installer | `curl -fsSL https://www.whitemagic.dev/install.sh | sh` | Moving hosted installer; pinning and asset proof not captured here | Not qualified |

Before claiming a client journey, attach the exact package or binary version and SHA-256, OS/architecture, client version, install output, MCP initialize/tools result, one useful memory write/read, restart result, and uninstall/rollback result. Stable, preview, and pinned are separate choices: users should be able to select a registry stable release, test a preview from a named immutable commit, or pin an exact package/binary version. Do not label a route stable from source or manifest version alone.

These source adapters use the separate core npm package
`whitemagic-mcp@9.3.4`, not `whitemagic-plugins` as a memory server. Core npm
tags observed 2026-10-28 were `latest=9.3.4` and `next=10.6.1`. Gen3 has
different CLI arguments and profiles; see the root README before replacing
the pinned Gen2 server. A protocol fixture or a controlled loopback-provider
client run establishes its named wiring only, not real-provider behavior,
marketplace acceptance, adoption, or an independent operator.

## Payment and catalogue boundaries

`whitemagic-pay` and `gold-402` source/catalogue entries describe available code and discovery metadata. Listings, HTTP 402 challenges, validation, and self-tests do not establish settlement, a customer, revenue, repeat use, or adopted integrations.

A future paid-flow qualification should use a non-self test payer and a production-equivalent endpoint, record a redacted request/response and challenge ID, verify the independent settlement receipt on the named chain/rail, show the delivered entitlement/result, and separately record retries, failures, refunds, and repeat use. Keep wallet identity private; publish aggregate evidence only with consent. No paid call is part of this candidate.
