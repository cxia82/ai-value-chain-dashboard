import test from "node:test";
import assert from "node:assert/strict";
import { getPublicQuotesBatch } from "../src/providers/marketDataProvider.js";

const clearProviderKeys = () => {
  delete process.env.FINNHUB_API_KEY;
  delete process.env.ALPHAVANTAGE_API_KEY;
};

test("getPublicQuotesBatch returns structured unavailable error details on provider failures", async () => {
  clearProviderKeys();
  const originalFetch = global.fetch;

  global.fetch = async () => {
    const error = new Error("network down");
    error.code = "NET_DOWN";
    error.retryable = true;
    throw error;
  };

  try {
    const batch = await getPublicQuotesBatch([{ ticker: "ZZZFAIL1", exchange: "NASDAQ" }]);
    const quote = batch.get("NASDAQ:ZZZFAIL1");

    assert.ok(quote);
    assert.equal(quote.source, "unavailable");
    assert.equal(typeof quote.error, "string");
    assert.ok(quote.errorDetail);
    assert.equal(typeof quote.errorDetail.code, "string");
    assert.equal(typeof quote.errorDetail.source, "string");
    assert.equal(typeof quote.errorDetail.message, "string");
    assert.equal(typeof quote.errorDetail.retryable, "boolean");
  } finally {
    global.fetch = originalFetch;
  }
});

test("getPublicQuotesBatch computes usdPrice for non-USD quotes", async () => {
  clearProviderKeys();
  const originalFetch = global.fetch;

  global.fetch = async (url) => {
    if (String(url).includes("finance/spark")) {
      return {
        ok: true,
        json: async () => ({
          spark: {
            result: [
              {
                symbol: "JPTEST1",
                response: [
                  {
                    meta: {
                      regularMarketPrice: 100,
                      previousClose: 95,
                      currency: "JPY"
                    },
                    indicators: { quote: [{ close: [100] }] },
                    timestamp: [1710000000]
                  }
                ]
              }
            ]
          }
        })
      };
    }

    if (String(url).includes("frankfurter.app")) {
      return {
        ok: true,
        json: async () => ({ rates: { USD: 0.0065 } })
      };
    }

    if (String(url).includes("tradingview.com")) {
      return {
        ok: true,
        json: async () => ({ data: [] })
      };
    }

    throw new Error(`Unexpected URL in test: ${url}`);
  };

  try {
    const batch = await getPublicQuotesBatch([{ ticker: "JPTEST1", exchange: "TSE" }]);
    const quote = batch.get("TSE:JPTEST1");

    assert.ok(quote);
    assert.equal(quote.currency, "JPY");
    assert.equal(quote.price, 100);
    assert.equal(quote.usdPrice, 0.65);
  } finally {
    global.fetch = originalFetch;
  }
});
