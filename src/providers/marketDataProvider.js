import { createCacheStore } from "../utils/cacheStore.js";
import { fetchJsonWithRetry } from "../utils/http.js";

const cache = createCacheStore(60_000);
const fxCache = createCacheStore(10 * 60_000);
const PROVIDER_TIMEOUT_MS = 5000;

const hasFinnhubKey = () => Boolean(process.env.FINNHUB_API_KEY);
const hasAlphaVantageKey = () => Boolean(process.env.ALPHAVANTAGE_API_KEY);

const EXCHANGE_TO_TV = {
  NASDAQ: "NASDAQ",
  NYSE: "NYSE",
  HKEX: "HKEX",
  KRX: "KRX",
  TSE: "TSE",
  TWSE: "TWSE",
  TWO: "TWSE",
  SSE: "SSE",
  XETRA: "XETR",
  EURONEXT: "EURONEXT",
  SIX: "SIX",
  MOEX: "MOEX"
};

const quoteKey = (exchange, symbol) => `${String(exchange || "").toUpperCase()}:${String(symbol || "").toUpperCase()}`;

const chunk = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const toTvExchange = (exchange) => {
  const normalized = String(exchange || "").trim().toUpperCase();
  return EXCHANGE_TO_TV[normalized] || normalized;
};

const buildUnavailableQuote = (symbol, errorMessage) => ({
  source: "unavailable",
  freshness: "Stale",
  error: errorMessage || `No quote available for ${symbol}`,
  errorDetail: {
    code: "QUOTE_UNAVAILABLE",
    source: "market-data-provider",
    message: errorMessage || `No quote available for ${symbol}`,
    retryable: false
  },
  price: null,
  usdPrice: null,
  changePercent: null,
  marketCap: null,
  peRatio: null,
  psRatio: null,
  regularMarketTime: null
});

const normalizeProviderError = (error, source) => ({
  code: error?.code || "PROVIDER_ERROR",
  source,
  message: error?.message || "Provider request failed",
  retryable: Boolean(error?.retryable)
});

const withErrorDetail = (symbol, detail) => ({
  source: "unavailable",
  freshness: "Stale",
  error: detail?.message || `No quote available for ${symbol}`,
  errorDetail: detail || {
    code: "QUOTE_UNAVAILABLE",
    source: "market-data-provider",
    message: `No quote available for ${symbol}`,
    retryable: false
  },
  price: null,
  usdPrice: null,
  changePercent: null,
  marketCap: null,
  peRatio: null,
  psRatio: null,
  regularMarketTime: null
});

const buildTradingViewSymbols = (symbol, exchange) => {
  const tvExchange = toTvExchange(exchange);
  const raw = String(symbol || "").trim().toUpperCase();
  const [base] = raw.split(".");
  const numericBase = /^\d+$/.test(base) ? String(Number(base)) : base;

  const candidates = [
    `${tvExchange}:${raw}`,
    `${tvExchange}:${base}`,
    `${tvExchange}:${numericBase}`
  ].filter(Boolean);

  return [...new Set(candidates)];
};

const mapTradingViewQuote = (row) => {
  const [price, changePercent, marketCap, peRatio, psRatio] = row?.d || [];
  return {
    source: "tradingview",
    freshness: "Delayed",
    currency: "USD",
    price: Number.isFinite(price) ? Number(price) : null,
    previousClose: null,
    changePercent: Number.isFinite(changePercent) ? Number(changePercent) : null,
    marketCap: Number.isFinite(marketCap) ? Number(marketCap) : null,
    peRatio: Number.isFinite(peRatio) ? Number(peRatio) : null,
    psRatio: Number.isFinite(psRatio) ? Number(psRatio) : null,
    regularMarketTime: new Date().toISOString()
  };
};

const fetchTradingViewBatch = async (entries) => {
  if (entries.length === 0) {
    return new Map();
  }

  const output = new Map();

  for (const group of chunk(entries, 120)) {
    const tickers = [];
    const entryCandidates = new Map();

    for (const entry of group) {
      const candidates = buildTradingViewSymbols(entry.symbol, entry.exchange);
      entryCandidates.set(entry.key, candidates);
      for (const candidate of candidates) {
        if (!tickers.includes(candidate)) {
          tickers.push(candidate);
        }
      }
    }

    const payload = {
      symbols: {
        tickers,
        query: { types: [] }
      },
      columns: ["close", "change", "market_cap_basic", "price_earnings_ttm", "price_sales_ttm"]
    };

    const body = await fetchJsonWithRetry(
      "https://scanner.tradingview.com/global/scan",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0"
        },
        body: JSON.stringify(payload)
      },
      {
        timeoutMs: PROVIDER_TIMEOUT_MS,
        label: "TradingView batch",
        retries: 2
      }
    );

    const rows = new Map((body?.data || []).map((row) => [String(row.s || "").toUpperCase(), row]));

    for (const entry of group) {
      const candidates = entryCandidates.get(entry.key) || [];
      for (const candidate of candidates) {
        const row = rows.get(candidate.toUpperCase());
        const quote = mapTradingViewQuote(row);
        const hasAnyValue = Number.isFinite(quote.price)
          || Number.isFinite(quote.marketCap)
          || Number.isFinite(quote.peRatio)
          || Number.isFinite(quote.changePercent);
        if (hasAnyValue) {
          output.set(entry.key, quote);
          break;
        }
      }
    }
  }

  return output;
};

const mapYahooSparkQuote = (result) => {
  const response = result?.response?.[0] || {};
  const meta = response?.meta || {};
  const closes = response?.indicators?.quote?.[0]?.close || [];
  const lastClose = closes.length > 0 ? closes.at(-1) : null;

  const price = Number.isFinite(meta.regularMarketPrice)
    ? Number(meta.regularMarketPrice)
    : Number.isFinite(lastClose)
      ? Number(lastClose)
      : null;

  const previousClose = Number.isFinite(meta.previousClose)
    ? Number(meta.previousClose)
    : Number.isFinite(meta.chartPreviousClose)
      ? Number(meta.chartPreviousClose)
      : null;

  const changePercent = Number.isFinite(price) && Number.isFinite(previousClose) && previousClose > 0
    ? ((price - previousClose) / previousClose) * 100
    : null;

  const ts = Array.isArray(response?.timestamp) && response.timestamp.length > 0
    ? Number(response.timestamp.at(-1))
    : null;

  return {
    source: "yahoo-spark",
    freshness: "Delayed",
    currency: meta.currency || "USD",
    price: Number.isFinite(price) ? price : null,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    marketCap: null,
    peRatio: null,
    psRatio: null,
    regularMarketTime: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : new Date().toISOString()
  };
};

const HISTORY_PERIODS = {
  "1d": { range: "1d", interval: "5m" },
  "1w": { range: "5d", interval: "15m" },
  "1m": { range: "1mo", interval: "1d" },
  "3m": { range: "3mo", interval: "1d" },
  "6m": { range: "6mo", interval: "1d" },
  "1y": { range: "1y", interval: "1d" },
  "2y": { range: "2y", interval: "1wk" },
  "3y": { range: "3y", interval: "1wk" },
  "5y": { range: "5y", interval: "1wk" }
};

const buildHistoryFromYahooChart = (body, period) => {
  const result = body?.chart?.result?.[0] || {};
  const meta = result?.meta || {};
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = Array.isArray(quote?.close) ? quote.close : [];

  const points = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = Number(timestamps[i]);
    const close = Number(closes[i]);
    if (!Number.isFinite(ts) || !Number.isFinite(close)) {
      continue;
    }
    points.push({
      time: new Date(ts * 1000).toISOString(),
      close
    });
  }

  return {
    period,
    currency: meta.currency || "USD",
    points,
    metrics: {
      regularMarketPrice: Number.isFinite(meta.regularMarketPrice) ? Number(meta.regularMarketPrice) : null,
      previousClose: Number.isFinite(meta.previousClose) ? Number(meta.previousClose) : null,
      chartPreviousClose: Number.isFinite(meta.chartPreviousClose) ? Number(meta.chartPreviousClose) : null,
      regularMarketOpen: Number.isFinite(meta.regularMarketOpen) ? Number(meta.regularMarketOpen) : null,
      regularMarketDayLow: Number.isFinite(meta.regularMarketDayLow) ? Number(meta.regularMarketDayLow) : null,
      regularMarketDayHigh: Number.isFinite(meta.regularMarketDayHigh) ? Number(meta.regularMarketDayHigh) : null,
      fiftyTwoWeekLow: Number.isFinite(meta.fiftyTwoWeekLow) ? Number(meta.fiftyTwoWeekLow) : null,
      fiftyTwoWeekHigh: Number.isFinite(meta.fiftyTwoWeekHigh) ? Number(meta.fiftyTwoWeekHigh) : null,
      regularMarketVolume: Number.isFinite(meta.regularMarketVolume) ? Number(meta.regularMarketVolume) : null,
      averageDailyVolume3Month: Number.isFinite(meta.averageDailyVolume3Month)
        ? Number(meta.averageDailyVolume3Month)
        : null,
      regularMarketTime: Number.isFinite(meta.regularMarketTime)
        ? new Date(Number(meta.regularMarketTime) * 1000).toISOString()
        : null
    }
  };
};

export const getPublicPriceHistory = async (symbol, period = "1m") => {
  const normalizedPeriod = HISTORY_PERIODS[period] ? period : "1m";
  const cacheKey = `history:${String(symbol || "").toUpperCase()}:${normalizedPeriod}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const config = HISTORY_PERIODS[normalizedPeriod];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(config.range)}&interval=${encodeURIComponent(config.interval)}`;
  const body = await fetchJsonWithRetry(
    url,
    {
      headers: { "User-Agent": "Mozilla/5.0" }
    },
    {
      timeoutMs: PROVIDER_TIMEOUT_MS,
      label: "Yahoo history",
      retries: 2
    }
  );

  const history = buildHistoryFromYahooChart(body, normalizedPeriod);
  cache.set(cacheKey, history);
  return history;
};

const fetchYahooSparkBatch = async (entries) => {
  const output = new Map();

  for (const group of chunk(entries, 40)) {
    const symbolList = group.map((entry) => entry.symbol).join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbolList)}&range=1d&interval=5m`;
    const body = await fetchJsonWithRetry(
      url,
      {
        headers: { "User-Agent": "Mozilla/5.0" }
      },
      {
        timeoutMs: PROVIDER_TIMEOUT_MS,
        label: "Yahoo spark",
        retries: 2
      }
    );

    const results = body?.spark?.result || [];
    const resultMap = new Map(results.map((r) => [String(r.symbol || "").toUpperCase(), r]));

    for (const entry of group) {
      const res = resultMap.get(String(entry.symbol || "").toUpperCase());
      if (!res) {
        continue;
      }
      const quote = mapYahooSparkQuote(res);
      if (Number.isFinite(quote.price) && quote.price > 0) {
        output.set(entry.key, quote);
      }
    }
  }

  return output;
};

const fetchAlphaVantageQuote = async (symbol) => {
  if (!hasAlphaVantageKey()) {
    return null;
  }

  const key = process.env.ALPHAVANTAGE_API_KEY;
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
  const body = await fetchJsonWithRetry(url, {}, {
    timeoutMs: PROVIDER_TIMEOUT_MS,
    label: "AlphaVantage quote",
    retries: 1
  });

  const q = body?.["Global Quote"];
  const price = Number(q?.["05. price"]);
  const previousClose = Number(q?.["08. previous close"]);
  const changePercentRaw = String(q?.["10. change percent"] || "").replace("%", "");
  const changePercent = Number(changePercentRaw);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`AlphaVantage quote invalid for ${symbol}`);
  }

  return {
    source: "alphavantage",
    freshness: "Delayed",
    currency: "USD",
    price,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    changePercent: Number.isFinite(changePercent)
      ? changePercent
      : Number.isFinite(previousClose) && previousClose > 0
        ? ((price - previousClose) / previousClose) * 100
        : null,
    marketCap: null,
    peRatio: null,
    psRatio: null,
    regularMarketTime: new Date().toISOString()
  };
};

const fetchFinnhubQuote = async (symbol) => {
  if (!hasFinnhubKey()) {
    return null;
  }
  const token = process.env.FINNHUB_API_KEY;
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`;
  const body = await fetchJsonWithRetry(url, {}, {
    timeoutMs: PROVIDER_TIMEOUT_MS,
    label: "Finnhub quote",
    retries: 1
  });

  const price = Number(body?.c);
  const prevClose = Number(body?.pc);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Finnhub quote invalid for symbol ${symbol}`);
  }

  const pct = Number.isFinite(prevClose) && prevClose > 0
    ? ((price - prevClose) / prevClose) * 100
    : null;

  return {
    source: "finnhub",
    freshness: "Live",
    currency: "USD",
    price,
    previousClose: Number.isFinite(prevClose) ? prevClose : null,
    changePercent: Number.isFinite(pct) ? pct : null,
    marketCap: null,
    peRatio: null,
    psRatio: null,
    regularMarketTime: Number.isFinite(body?.t)
      ? new Date(Number(body.t) * 1000).toISOString()
      : new Date().toISOString()
  };
};

const mergeQuotes = (primary, secondary) => {
  if (!primary && !secondary) {
    return null;
  }
  if (!primary) {
    return secondary;
  }
  if (!secondary) {
    return primary;
  }

  return {
    ...secondary,
    ...primary,
    marketCap: Number.isFinite(secondary.marketCap) ? secondary.marketCap : primary.marketCap,
    peRatio: Number.isFinite(secondary.peRatio) ? secondary.peRatio : primary.peRatio,
    psRatio: Number.isFinite(secondary.psRatio) ? secondary.psRatio : primary.psRatio,
    regularMarketTime: primary.regularMarketTime || secondary.regularMarketTime,
    source: `${primary.source}+${secondary.source}`
  };
};

const getUsdFxRate = async (currency) => {
  const from = String(currency || "USD").toUpperCase();
  if (from === "USD") {
    return 1;
  }

  const cacheKey = `fx:${from}:USD`;
  const cached = fxCache.get(cacheKey);
  if (Number.isFinite(cached) && cached > 0) {
    return cached;
  }

  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=USD`;
  const body = await fetchJsonWithRetry(url, {}, {
    timeoutMs: PROVIDER_TIMEOUT_MS,
    label: `FX ${from}/USD`,
    retries: 1
  });
  const rate = Number(body?.rates?.USD);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid FX rate for ${from}/USD`);
  }

  fxCache.set(cacheKey, rate);
  return rate;
};

const withUsdPrice = async (quote) => {
  if (!quote || !Number.isFinite(quote.price)) {
    return { ...quote, usdPrice: null };
  }

  const currency = String(quote.currency || "USD").toUpperCase();
  if (currency === "USD") {
    return { ...quote, currency, usdPrice: Number(quote.price) };
  }

  try {
    const rate = await getUsdFxRate(currency);
    return {
      ...quote,
      currency,
      usdPrice: Number(quote.price) * rate
    };
  } catch {
    return {
      ...quote,
      currency,
      usdPrice: null
    };
  }
};

export const getPublicQuote = async (symbol, exchange) => {
  const key = quoteKey(exchange, symbol);
  const cached = cache.get(key);
  if (cached) {
    return { ...cached, freshness: "Cached" };
  }

  const batch = await getPublicQuotesBatch([{ ticker: symbol, exchange }]);
  return batch.get(key) || buildUnavailableQuote(symbol);
};

export const getPublicQuotesBatch = async (companies) => {
  const result = new Map();
  const misses = [];

  for (const company of companies) {
    const key = quoteKey(company.exchange, company.ticker);
    const cached = cache.get(key);
    if (cached) {
      result.set(key, { ...cached, freshness: "Cached" });
    } else {
      misses.push({ key, symbol: company.ticker, exchange: company.exchange });
    }
  }

  if (misses.length === 0) {
    return result;
  }

  let sparkQuotes = new Map();
  let tradingViewQuotes = new Map();
  const sourceErrors = [];

  try {
    sparkQuotes = await fetchYahooSparkBatch(misses);
  } catch (error) {
    sourceErrors.push(normalizeProviderError(error, "yahoo-spark"));
    sparkQuotes = new Map();
  }

  try {
    tradingViewQuotes = await fetchTradingViewBatch(misses);
  } catch (error) {
    sourceErrors.push(normalizeProviderError(error, "tradingview"));
    tradingViewQuotes = new Map();
  }

  for (const miss of misses) {
    const spark = sparkQuotes.get(miss.key) || null;
    const tv = tradingViewQuotes.get(miss.key) || null;
    const merged = mergeQuotes(spark, tv);
    if (merged && Number.isFinite(merged.price) && merged.price > 0) {
      const normalized = await withUsdPrice(merged);
      result.set(miss.key, normalized);
      cache.set(miss.key, normalized);
    }
  }

  const unresolved = misses.filter((miss) => !result.has(miss.key));
  for (const miss of unresolved) {
    let quote = null;
    let sourceError = null;

    try {
      quote = await fetchFinnhubQuote(miss.symbol);
    } catch (error) {
      sourceError = normalizeProviderError(error, "finnhub");
    }

    if (!quote) {
      try {
        quote = await fetchAlphaVantageQuote(miss.symbol);
      } catch (error) {
        sourceError = normalizeProviderError(error, "alphavantage");
      }
    }

    if (quote) {
      const normalized = await withUsdPrice(quote);
      result.set(miss.key, normalized);
      cache.set(miss.key, normalized);
      continue;
    }

    const detail = sourceError || sourceErrors.at(0) || null;
    result.set(miss.key, withErrorDetail(miss.symbol, detail));
  }

  return result;
};
