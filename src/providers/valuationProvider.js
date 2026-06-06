import { createCacheStore } from "../utils/cacheStore.js";

const cache = createCacheStore(6 * 60 * 60 * 1000);

export const getPrivateValuation = async (company) => {
  const cacheKey = `valuation:${company.name}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return { ...cached, freshness: "Cached" };
  }

  const seeded = {
    latestValuationUsdBn: company.latestValuationUsdBn ?? null,
    valuationDate: company.valuationDate ?? null,
    source: process.env.CRUNCHBASE_API_KEY ? "Crunchbase+Seed" : "Seed",
    freshness: "Snapshot"
  };

  // Crunchbase integration can be extended by matching company IDs.
  // Phase 1 keeps deterministic snapshot values to ensure coverage.

  cache.set(cacheKey, seeded);
  return seeded;
};
