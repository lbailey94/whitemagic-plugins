---
description: Recall durable project memory and session continuity with WhiteMagic. Use when the user asks what we remember, what was decided, the current project state, or wants to persist a decision for future sessions.
---

# WhiteMagic recall

The `wm` MCP meta-tool is the only entry point. Prefer explicit routes.

- Recent session state: `wm(route="session.continuity", args={"n": 5})`
- Search memory: `wm(route="memory.search", args={"query": "..."})`
- Hybrid recall (better for concepts): `wm(route="memory.hybrid_recall", args={"query": "..."})`
- Store a decision: `wm(route="memory.create", args={"content": "...", "importance": 0.8, "tags": ["decision"]})`
- Discover the surface: `wm(route="tools.list")`

Rules:

- All data stays local by default; never send memory content to third-party services.
- On first use in a project, call `session.continuity` before answering "what do we know" questions.
- Explicit routes are the contract — prefer `route=` over natural-language routing.
