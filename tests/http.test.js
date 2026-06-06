import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { fetchJsonWithRetry, fetchJsonWithTimeout } from "../src/utils/http.js";

const listen = (server) => new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => {
    resolve(server.address());
  });
});

const close = (server) => new Promise((resolve, reject) => {
  server.close((error) => {
    if (error) {
      reject(error);
      return;
    }
    resolve();
  });
});

test("fetchJsonWithRetry retries transient 503 errors", async () => {
  let attempts = 0;
  const server = http.createServer((_, res) => {
    attempts += 1;
    if (attempts < 3) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "temporary" }));
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });

  const address = await listen(server);
  try {
    const data = await fetchJsonWithRetry(`http://${address.address}:${address.port}/`, {}, {
      label: "retry-test",
      timeoutMs: 1000,
      retries: 2,
      baseDelayMs: 10,
      maxDelayMs: 25
    });

    assert.equal(data.ok, true);
    assert.equal(attempts, 3);
  } finally {
    await close(server);
  }
});

test("fetchJsonWithTimeout throws TIMEOUT code when request exceeds timeout", async () => {
  const server = http.createServer((_, res) => {
    setTimeout(() => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    }, 120);
  });

  const address = await listen(server);
  try {
    await assert.rejects(
      fetchJsonWithTimeout(`http://${address.address}:${address.port}/`, {}, 30, "timeout-test"),
      (error) => error?.code === "TIMEOUT"
    );
  } finally {
    await close(server);
  }
});
