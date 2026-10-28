# WhiteMagic for Cursor

Cursor Plugin bundle for [WhiteMagic](https://whitemagic.dev): registers the
WhiteMagic MCP server (local-first memory and session continuity) and adds a
recall skill plus a rule that teaches the agent when to recall and persist
project memory.

## Install

### Plugin (Cursor Marketplace)

Submit/install via <https://cursor.com/marketplace/publish> (review pending).
Until the marketplace listing is live, use the manual path below — it is the
same server and rule.

### Manual (works today)

1. **MCP server** — add to `.cursor/mcp.json` (project, committed) or
   `~/.cursor/mcp.json` (global):

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

2. **Recall rule** — copy `rules/whitemagic-recall.mdc` into
   `.cursor/rules/whitemagic-recall.mdc` (project) or your User Rules.
   The skill in `skills/whitemagic-recall/` carries the fuller how-to for
   Cursor builds that support skills.

Reload Cursor after editing `mcp.json`; the server should show as connected in
the MCP settings panel.

### Native binary instead of npx

```bash
curl -fsSL 'https://www.whitemagic.dev/install.sh?ref=cursor-plugin' | sh -s -- --version v9.3.4 \
  --dir "$HOME/.local/share/whitemagic-gen2/bin" --no-path
gen2_cli="$HOME/.local/share/whitemagic-gen2/bin/wm"
"$gen2_cli" --version
"$gen2_cli" setup cursor          # preview the selected store and config
"$gen2_cli" setup cursor --write  # apply after reviewing the preview
```

## What it adds

| Component | Purpose |
|---|---|
| `mcp.json` | WhiteMagic MCP server (curated profile, stdio) |
| `rules/whitemagic-recall.mdc` | Recall-first behavior + explicit `wm` routes |
| `skills/whitemagic-recall/SKILL.md` | When/how to recall and persist memory |

Requirements: Node.js 18+ for the `npx` launcher (or the native `wm` binary).

MIT licensed.
