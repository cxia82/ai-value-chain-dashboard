import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getSegments,
  getSubsegmentById,
  getSubsegments
} from "./data/valueChainData.js";
import { getPublicQuotesBatch } from "./providers/marketDataProvider.js";
import { getPrivateValuation } from "./providers/valuationProvider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 12000);

const unavailableMarket = (message = "Quote unavailable") => ({
  source: "unavailable",
  freshness: "Stale",
  error: message,
  errorDetail: {
    code: "QUOTE_UNAVAILABLE",
    source: "server-fallback",
    message,
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

const validateCompanyUniqueness = () => {
  const seen = new Map();
  const duplicates = [];

  for (const subsegment of getSubsegments()) {
    for (const company of subsegment.companies) {
      const key = String(company.name || "").trim().toLowerCase();
      if (!key) {
        continue;
      }

      if (seen.has(key)) {
        duplicates.push({
          name: company.name,
          firstSubsegmentId: seen.get(key),
          duplicateSubsegmentId: subsegment.id
        });
      } else {
        seen.set(key, subsegment.id);
      }
    }
  }

  if (duplicates.length > 0) {
    const details = duplicates
      .map((d) => `${d.name} [${d.firstSubsegmentId} -> ${d.duplicateSubsegmentId}]`)
      .join(", ");
    throw new Error(`Duplicate companies across subsegments: ${details}`);
  }
};

const validateSubsegmentCompanyCount = () => {
  const invalid = getSubsegments().filter((subsegment) => subsegment.companies.length !== 20);
  if (invalid.length > 0) {
    const details = invalid.map((s) => `${s.id}:${s.companies.length}`).join(", ");
    throw new Error(`Invalid company count per subsegment (expected 20): ${details}`);
  }
};

const validatePublicListingShape = () => {
  const tickerPattern = /^[A-Z0-9.\-]+$/i;
  const invalid = [];

  for (const subsegment of getSubsegments()) {
    for (const company of subsegment.companies) {
      if (!company.isPublic) {
        continue;
      }

      const ticker = String(company.ticker || "").trim();
      const exchange = String(company.exchange || "").trim();
      if (!ticker || !exchange || !tickerPattern.test(ticker)) {
        invalid.push(`${company.name} [${subsegment.id}]`);
      }
    }
  }

  if (invalid.length > 0) {
    throw new Error(`Invalid public ticker/exchange shape: ${invalid.join(", ")}`);
  }
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const elapsedMs = Date.now() - startedAt;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsedMs}ms)`);
  });
  next();
});

app.use((req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (res.headersSent) {
      return;
    }
    res.status(504).json({
      message: "Request timed out",
      timeoutMs: REQUEST_TIMEOUT_MS,
      path: req.originalUrl
    });
  });
  next();
});

const enrichCompanies = async (companies) => {
  const output = new Array(companies.length);
  const publicCompanies = [];
  const publicIndexMap = new Map();

  companies.forEach((company, index) => {
    if (company.isPublic) {
      publicCompanies.push(company);
      const key = `${String(company.exchange || "").toUpperCase()}:${String(company.ticker || "").toUpperCase()}`;
      if (!publicIndexMap.has(key)) {
        publicIndexMap.set(key, []);
      }
      publicIndexMap.get(key).push(index);
    }
  });

  if (publicCompanies.length > 0) {
    const quotes = await getPublicQuotesBatch(publicCompanies);
    for (const [key, indices] of publicIndexMap.entries()) {
      const market = quotes.get(key) || unavailableMarket();
      for (const index of indices) {
        output[index] = {
          ...companies[index],
          market
        };
      }
    }
  }

  await Promise.all(
    companies.map(async (company, index) => {
      if (company.isPublic) {
        return;
      }
      const valuation = await getPrivateValuation(company);
      output[index] = {
        ...company,
        valuation
      };
    })
  );

  return output;
};

const computeSubsegmentValuationIndex = (companies) => {
  const publicCompanies = companies.filter((company) => company.isPublic);
  const tracked = publicCompanies.filter((company) => Number.isFinite(company.market?.marketCap));
  const trackedWithChange = tracked.filter((company) => Number.isFinite(company.market?.changePercent));
  const changedPublicCompanies = publicCompanies.filter((company) => Number.isFinite(company.market?.changePercent));

  const totalPublicValuation = tracked.reduce((sum, company) => sum + Number(company.market.marketCap), 0);
  const previousValuation = trackedWithChange.reduce((sum, company) => {
    const cap = Number(company.market.marketCap);
    const pct = Number(company.market.changePercent);
    const denominator = 1 + pct / 100;
    if (!Number.isFinite(cap) || !Number.isFinite(denominator) || denominator <= 0) {
      return sum;
    }
    return sum + cap / denominator;
  }, 0);

  const valuationChange = Number.isFinite(previousValuation)
    ? totalPublicValuation - previousValuation
    : null;

  let valuationChangePercent = previousValuation > 0
    ? (valuationChange / previousValuation) * 100
    : null;

  if (!Number.isFinite(valuationChangePercent) && changedPublicCompanies.length > 0) {
    const avgChange = changedPublicCompanies.reduce(
      (sum, company) => sum + Number(company.market.changePercent),
      0
    ) / changedPublicCompanies.length;
    valuationChangePercent = Number.isFinite(avgChange) ? avgChange : null;
  }

  const latestQuoteTime = tracked
    .map((company) => company.market?.regularMarketTime)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    totalPublicCompanies: publicCompanies.length,
    trackedPublicCompanies: tracked.length,
    changedPublicCompanies: changedPublicCompanies.length,
    totalPublicValuation,
    valuationChange,
    valuationChangePercent,
    latestQuoteTime
  };
};

const asCsv = (columns, rows) => {
  const escape = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    const str = String(value);
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map(escape).join(",");
  const body = rows.map((row) => columns.map((col) => escape(row[col])).join(",")).join("\n");
  return `${header}\n${body}`;
};

const formatSubsegmentExportRows = (subsegment, companies) => companies.map((company) => ({
  segmentId: subsegment.segmentId,
  subsegmentId: subsegment.id,
  subsegmentName: subsegment.name,
  rank: company.rank,
  companyName: company.name,
  listingStatus: company.isPublic ? "Public" : "Private",
  ticker: company.isPublic ? company.ticker : "",
  exchange: company.isPublic ? company.exchange : "",
  price: company.isPublic ? company.market?.price : "",
  priceChangePercent: company.isPublic ? company.market?.changePercent : "",
  marketCap: company.isPublic ? company.market?.marketCap : "",
  peRatio: company.isPublic ? company.market?.peRatio : "",
  valuationUsdBn: company.isPublic ? "" : company.valuation?.latestValuationUsdBn,
  valuationDate: company.isPublic ? "" : company.valuation?.valuationDate,
  dataFreshness: company.isPublic ? company.market?.freshness : company.valuation?.freshness,
  updatedAt: company.isPublic ? company.market?.regularMarketTime : company.valuation?.valuationDate
}));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    now: new Date().toISOString(),
    marketProvider: process.env.FINNHUB_API_KEY ? "TradingView+Finnhub+Yahoo" : "TradingView+Yahoo"
  });
});

if (process.env.ENABLE_TEST_TIMEOUT_ROUTE === "true") {
  app.get("/api/_test/slow", async (req, res) => {
    const waitMs = Number(req.query.ms || 100);
    await new Promise((resolve) => {
      setTimeout(resolve, waitMs);
    });
    res.json({ ok: true, waitedMs: waitMs });
  });
}

app.get("/api/value-chain", async (_req, res) => {
  const segments = getSegments();
  const allSubsegments = getSubsegments();

  const payload = await Promise.all(
    segments.map(async (segment) => {
      const segmentSubs = allSubsegments.filter((s) => s.segmentId === segment.id);
      const subsegments = await Promise.all(
        segmentSubs.map(async (subsegment) => {
          const enrichedCompanies = await enrichCompanies(subsegment.companies);
          const topFive = enrichedCompanies.slice(0, 5);
          const valuationIndex = computeSubsegmentValuationIndex(enrichedCompanies);

          return {
            id: subsegment.id,
            name: subsegment.name,
            description: subsegment.description,
            totalCompanies: subsegment.companies.length,
            hiddenCompanies: Math.max(subsegment.companies.length - 5, 0),
            topCompanies: topFive,
            valuationIndex
          };
        })
      );

      return {
        id: segment.id,
        name: segment.name,
        stage: segment.stage,
        summary: segment.summary,
        subsegments
      };
    })
  );

  res.json({
    asOf: new Date().toISOString(),
    segments: payload
  });
});

app.get("/api/subsegments/:id/companies", async (req, res) => {
  const subsegment = getSubsegmentById(req.params.id);
  if (!subsegment) {
    res.status(404).json({ message: "Subsegment not found" });
    return;
  }

  const enriched = await enrichCompanies(subsegment.companies);
  const valuationIndex = computeSubsegmentValuationIndex(enriched);
  res.json({
    asOf: new Date().toISOString(),
    subsegment: {
      id: subsegment.id,
      name: subsegment.name,
      description: subsegment.description
    },
    valuationIndex,
    companies: enriched
  });
});

app.get("/api/subsegments/:id/export", async (req, res) => {
  const subsegment = getSubsegmentById(req.params.id);
  if (!subsegment) {
    res.status(404).json({ message: "Subsegment not found" });
    return;
  }

  const format = String(req.query.format || "json").toLowerCase();
  const view = String(req.query.view || "all").toLowerCase();

  if (!["json", "csv"].includes(format)) {
    res.status(400).json({ message: "Invalid format. Use json or csv." });
    return;
  }
  if (!["all", "top5"].includes(view)) {
    res.status(400).json({ message: "Invalid view. Use all or top5." });
    return;
  }

  const enriched = await enrichCompanies(subsegment.companies);
  const selected = view === "top5" ? enriched.slice(0, 5) : enriched;
  const rows = formatSubsegmentExportRows(subsegment, selected);

  if (format === "json") {
    res.json({
      asOf: new Date().toISOString(),
      view,
      subsegment: {
        id: subsegment.id,
        name: subsegment.name,
        description: subsegment.description
      },
      rows
    });
    return;
  }

  const columns = [
    "segmentId",
    "subsegmentId",
    "subsegmentName",
    "rank",
    "companyName",
    "listingStatus",
    "ticker",
    "exchange",
    "price",
    "priceChangePercent",
    "marketCap",
    "peRatio",
    "valuationUsdBn",
    "valuationDate",
    "dataFreshness",
    "updatedAt"
  ];
  const csv = asCsv(columns, rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=${subsegment.id}-${view}.csv`);
  res.send(csv);
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

validateCompanyUniqueness();
validateSubsegmentCompanyCount();
validatePublicListingShape();

app.listen(port, () => {
  console.log(`AI Value Chain Dashboard running on http://localhost:${port}`);
});
