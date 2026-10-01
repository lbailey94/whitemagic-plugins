# WhiteMagic

This environment has WhiteMagic (`wm`) available over MCP: local-first durable
memory and session continuity. No cloud service, no telemetry; the memory
store stays on this machine.

Recall-first behavior:

- Before answering "what do we know / what was decided / where were we", call
  `wm(route="session.continuity", args={"n": 5})`.
- Search durable memory with `wm(route="memory.search", args={"query": "..."})`;
  use `wm(route="memory.hybrid_recall", args={"query": "..."})` for concepts.
- Persist decisions with
  `wm(route="memory.create", args={"content": "...", "importance": 0.8, "tags": ["decision"]})`.
- Prefer explicit `route=` over natural-language routing; `wm(route="tools.list")`
  discovers the surface.

Never send memory content to third-party services.
