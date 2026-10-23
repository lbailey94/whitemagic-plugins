# Release and client matrix

This matrix records what a user can choose today from repository evidence. A checked-in adapter is an instruction bundle; it does not prove a client installed it or completed an MCP request.

## Package channels

| Channel | Selector | State | Meaning |
|---|---|---|---|
| Source checkout | Git commit SHA | Preview/candidate | Inspect and run a specific checkout. Current integration source is 1.3.0 at `3ccf7a55386da3e8314abed811e40bfcff446eed`. |
| npm | `whitemagic-plugins@latest` | Registry stable | Scout observation on 2026-10-23: resolves to 1.2.0, gitHead `494595e58e371c50faae015b83a9995b3ad3fef0`. It is behind source 1.3.0. |
| npm | `whitemagic-plugins@1.3.0` | Unverified | Do not assume it exists. The source checkout alone does not establish publication. |
| GitHub Releases | latest | None observed | No latest release was present in the scout observation. |
| PyPI | `whitemagic==26.0.4` | Retired Gen-1 | Legacy Python package, marked inactive. It is not the Rust WhiteMagic line. |

For a reproducible install, pin a reviewed version or commit. `latest` is a moving selector. Before release, run `npm run check:release-parity`; it packs the exact local candidate, checks the embedded name/version, required adapters, and every declared executable target, and prints npm's tarball integrity and SHA-1. Keep that output with the intended immutable Git commit. The check does not publish, inspect marketplace acceptance, or prove registry parity. Registry parity requires comparing the downloaded tarball's integrity, embedded metadata, file list, and executables against this candidate.

## Client and binary paths

| Client/channel | Install route | Selector and current evidence | Journey status |
|---|---|---|---|
| Claude Code | Marketplace `/plugin marketplace add lbailey94/whitemagic-plugins` | Marketplace follows repository state; no immutable version pin stated | Instructions only; install/handshake/round-trip not exercised |
| Codex CLI | `plugins/codex/config.toml` and skills | Pin this repo to a reviewed commit when copying files | Instructions only |
| Cursor | `.cursor/mcp.json`, rules, skills | Manual project/global config; marketplace submission pending | Instructions only |
| VS Code / Copilot | `.vscode/mcp.json` and `.github/skills/` | Manual copy from `plugins/vscode` | Instructions only |
| Gemini CLI | `gemini extensions link ./plugins/gemini` | Extension manifest separately references `wm`; public manifest observed at 9.3.4 | Instructions only; no binary/hash/handshake proof |
| Antigravity | Copy `plugins/antigravity` | Bundled config; external distribution status unverified | Instructions only |
| OpenClaw | ClawHub skill and local `wm` setup | Skill source in this repo; publication status not established here | Instructions only |
| Homebrew | `brew install lbailey94/tap/whitemagic` | Repo manifest exists; no current binary/hash/signature/first-run proof in this work | Not qualified |
| Scoop | `scoop bucket add whitemagic ...; scoop install whitemagic` | Public manifest observed at 9.3.4 for Windows x86_64 | Not qualified |
| Native installer | `curl -fsSL https://www.whitemagic.dev/install.sh | sh` | Moving hosted installer; pinning and asset proof not captured here | Not qualified |

Before claiming a client journey, attach the exact package or binary version and SHA-256, OS/architecture, client version, install output, MCP initialize/tools result, one useful memory write/read, restart result, and uninstall/rollback result. Stable, preview, and pinned are separate choices: users should be able to select a registry stable release, test a preview from a named immutable commit, or pin an exact package/binary version. Do not label a route stable from source or manifest version alone.

## Payment and catalogue boundaries

`whitemagic-pay` and `gold-402` source/catalogue entries describe available code and discovery metadata. Listings, HTTP 402 challenges, validation, and self-tests do not establish settlement, a customer, revenue, repeat use, or adopted integrations.

A future paid-flow qualification should use a non-self test payer and a production-equivalent endpoint, record a redacted request/response and challenge ID, verify the independent settlement receipt on the named chain/rail, show the delivered entitlement/result, and separately record retries, failures, refunds, and repeat use. Keep wallet identity private; publish aggregate evidence only with consent. No paid call is part of this candidate.
