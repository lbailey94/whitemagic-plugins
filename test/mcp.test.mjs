import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

function runServer(messages, doneId) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["bin/receipts-mcp.mjs"], { stdio: ["pipe", "pipe", "pipe"] });
    let buf = "";
    const replies = [];
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      proc.kill();
      resolve(replies);
    };
    proc.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        replies.push(msg);
        if (msg.id === doneId) finish();
      }
    });
    proc.on("error", reject);
    proc.stderr.on("error", () => {});
    for (const m of messages) proc.stdin.write(JSON.stringify(m) + "\n");
    setTimeout(finish, 8000);
  });
}

test("receipts-mcp: initialize, list tools, verify a WM emitted fixture", async () => {
  const wm = JSON.parse(readFileSync(new URL("./fixtures/wm/session-valid.json", import.meta.url), "utf8"));
  const replies = await runServer(
    [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } },
      },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "receipts.verify", arguments: { bundle: wm } } },
    ],
    3
  );
  const byId = Object.fromEntries(replies.map((r) => [r.id, r]));
  assert.equal(byId[1].result.serverInfo.name, "whitemagic-receipts-mcp");
  const toolNames = byId[2].result.tools.map((t) => t.name);
  for (const name of ["receipts.verify", "receipts.inspect", "receipts.hash", "receipts.did_resolve"]) {
    assert.ok(toolNames.includes(name), `missing tool ${name}`);
  }
  const content = JSON.parse(byId[3].result.content[0].text);
  assert.equal(content.verdict, "TRUSTED");
  assert.equal(content.mode, "wm-profile-exact");
});
