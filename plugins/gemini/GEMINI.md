# WhiteMagic

This environment has WhiteMagic (`wm`) available over MCP: local-first durable
memory and session continuity. No cloud service, no telemetry by default; the
memory store stays on this machine.

Recall-first behavior (Gen 3 `cyberbrain` direct MCP tools; also works via `wm(route=...)` on Gen 2 `v9.3.4` fallback):

- Before answering "what do we know / what was decided / where were we", call
  `session_continuity` (or on Gen 2: `wm(route="session.continuity", args={"n": 5})`).
- Search durable memory with `memory_recall(query="...")` (or `wm(route="memory.search", args={"query": "..."})`).
- Persist decisions with `memory_remember(content="...", importance=0.8, tags=["decision"])`
  (or `wm(route="memory.create", args=...)`) and checkpoint milestones with `session_checkpoint`.
- `wm` remains available alongside the 19 `cyberbrain` tools for explicit routes or natural-language triage.

Never send memory content to third-party services.
