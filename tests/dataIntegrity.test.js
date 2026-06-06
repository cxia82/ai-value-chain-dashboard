import test from "node:test";
import assert from "node:assert/strict";
import { getSubsegments } from "../src/data/valueChainData.js";

const tickerPattern = /^[A-Z0-9.\-]+$/i;

test("every subsegment has at least 10 companies", () => {
  const subsegments = getSubsegments();
  for (const subsegment of subsegments) {
    assert.ok(
      subsegment.companies.length >= 10,
      `${subsegment.id} has ${subsegment.companies.length} companies (expected at least 10)`
    );
  }
});

test("company names are unique across all subsegments", () => {
  const subsegments = getSubsegments();
  const seen = new Map();

  for (const subsegment of subsegments) {
    for (const company of subsegment.companies) {
      const key = String(company.name || "").trim().toLowerCase();
      assert.ok(key.length > 0, `blank company name in ${subsegment.id}`);

      if (seen.has(key)) {
        const first = seen.get(key);
        assert.fail(`${company.name} appears in both ${first} and ${subsegment.id}`);
      }

      seen.set(key, subsegment.id);
    }
  }
});

test("public companies include valid ticker and exchange shape", () => {
  const subsegments = getSubsegments();

  for (const subsegment of subsegments) {
    for (const company of subsegment.companies) {
      if (!company.isPublic) {
        continue;
      }

      assert.equal(typeof company.ticker, "string", `${company.name} missing ticker in ${subsegment.id}`);
      assert.equal(typeof company.exchange, "string", `${company.name} missing exchange in ${subsegment.id}`);
      assert.ok(company.ticker.trim().length > 0, `${company.name} has blank ticker in ${subsegment.id}`);
      assert.ok(company.exchange.trim().length > 0, `${company.name} has blank exchange in ${subsegment.id}`);
      assert.ok(tickerPattern.test(company.ticker), `${company.name} has invalid ticker format: ${company.ticker}`);
    }
  }
});
