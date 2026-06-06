import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const waitForServerStart = (child, timeoutMs = 6000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    reject(new Error("Server did not start in time"));
  }, timeoutMs);

  const onData = (chunk) => {
    const text = String(chunk || "");
    if (text.includes("AI Value Chain Dashboard running on")) {
      clearTimeout(timer);
      child.stdout.off("data", onData);
      resolve();
    }
  };

  child.stdout.on("data", onData);
  child.on("exit", (code) => {
    clearTimeout(timer);
    reject(new Error(`Server exited before start (code ${code})`));
  });
});

const stopServer = (child) => new Promise((resolve) => {
  if (!child || child.killed) {
    resolve();
    return;
  }

  child.once("exit", () => resolve());
  child.kill();
});

test("request-timeout middleware returns 504 for slow handlers", async () => {
  const port = 3127;
  const child = spawn("node", ["src/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      REQUEST_TIMEOUT_MS: "25",
      ENABLE_TEST_TIMEOUT_ROUTE: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServerStart(child);

    const response = await fetch(`http://localhost:${port}/api/_test/slow?ms=150`);
    const body = await response.json();

    assert.equal(response.status, 504);
    assert.equal(body.message, "Request timed out");
    assert.equal(body.timeoutMs, 25);
    assert.equal(body.path, "/api/_test/slow?ms=150");
  } finally {
    await stopServer(child);
  }
});
