import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getSubsegments, getSegments } from "../data/valueChainData.js";
import { replacementCandidates } from "../data/replacementCandidates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REFRESH_HISTORY_FILE = path.join(__dirname, "../../data/refresh-history.json");
const MAX_HISTORY_ENTRIES = 50;

const loadRefreshHistory = () => {
  try {
    if (fs.existsSync(REFRESH_HISTORY_FILE)) {
      const content = fs.readFileSync(REFRESH_HISTORY_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch {
    // Fall back to empty history on read error
  }
  return {
    lastRefreshDate: null,
    addedCompanies: [],
    removedCompanies: []
  };
};

const saveRefreshHistory = (history) => {
  try {
    const dir = path.dirname(REFRESH_HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REFRESH_HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error("Failed to save refresh history:", error.message);
  }
};

const isCompanyNonTradable = (company) => {
  if (!company.isPublic) {
    // Private companies: inactive if no valuation update in 1 year
    if (company.valuation?.valuationDate) {
      const daysSince = (Date.now() - new Date(company.valuation.valuationDate).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 365;
    }
    return false;
  }

  // Public companies: non-tradable if provider returned an error (404 / unavailable)
  const source = String(company.market?.source || "").toLowerCase();
  if (source === "unavailable") {
    return true;
  }

  // Also flag if market data is completely missing or price is null
  if (!company.market || !Number.isFinite(company.market.price)) {
    return true;
  }

  return false;
};

export const analyzeAndRefreshCompanies = (enrichedCompanies, subsegment) => {
  const history = loadRefreshHistory();
  const now = new Date().toISOString();
  const removedInThisRefresh = [];

  // Detect non-tradable companies (provider returns unavailable / price is null)
  const active = enrichedCompanies.filter((company) => {
    if (isCompanyNonTradable(company)) {
      removedInThisRefresh.push({
        name: company.name,
        ticker: company.isPublic ? company.ticker : null,
        subsegmentName: subsegment.name,
        reason: company.isPublic ? "non-tradable" : "inactive",
        removedDate: now
      });
      return false;
    }
    return true;
  });

  // Update history only for detected removals (replacements tracked separately)
  if (removedInThisRefresh.length > 0) {
    history.removedCompanies = [
      ...removedInThisRefresh,
      ...history.removedCompanies
    ].slice(0, MAX_HISTORY_ENTRIES);
    history.lastRefreshDate = now;
    saveRefreshHistory(history);
  }

  return {
    activeCompanies: active,
    removedCount: removedInThisRefresh.length,
    removedCompanies: removedInThisRefresh
  };
};

const recordAdditions = (addedEntries) => {
  if (addedEntries.length === 0) {
    return;
  }
  const history = loadRefreshHistory();
  const now = new Date().toISOString();
  history.addedCompanies = [
    ...addedEntries.map((entry) => ({ ...entry, addedDate: now })),
    ...(history.addedCompanies || [])
  ].slice(0, MAX_HISTORY_ENTRIES);
  history.lastRefreshDate = now;
  saveRefreshHistory(history);
};

// Track which candidates have already been used across the current server session
// so the same replacement isn't picked twice.
const usedCandidateNames = new Set();

const pickReplacement = (subsegmentId, existingNames) => {
  const pool = replacementCandidates[subsegmentId] || [];
  const blocked = new Set([...existingNames].map((n) => n.trim().toLowerCase()));

  for (const candidate of pool) {
    const key = String(candidate.name || "").trim().toLowerCase();
    if (!blocked.has(key) && !usedCandidateNames.has(key)) {
      usedCandidateNames.add(key);
      return { ...candidate, rank: 0 };
    }
  }
  return null; // Pool exhausted
};

export const getLastAddedCompanies = (limit = 10) => {
  const history = loadRefreshHistory();
  return history.addedCompanies?.slice(0, limit) || [];
};

export const getLastRemovedCompanies = (limit = 10) => {
  const history = loadRefreshHistory();
  return history.removedCompanies.slice(0, limit);
};

export const scheduleWeeklyRefresh = (enrichCompaniesFunc) => {
  const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;

  const performRefresh = async () => {
    console.log("[Company Refresh] Starting weekly company refresh...");
    try {
      const allSubsegments = getSubsegments();
      let totalRemoved = 0;
      let totalAdded = 0;
      const addedHistory = [];

      for (const subsegment of allSubsegments) {
        // Enrich companies with live market data to detect non-tradable ones
        const enriched = await enrichCompaniesFunc(subsegment.companies);
        const result = analyzeAndRefreshCompanies(enriched, subsegment);

        if (result.removedCount === 0) {
          continue;
        }

        totalRemoved += result.removedCount;

        // Remove non-tradable entries from the live in-memory array
        const removedNames = new Set(result.removedCompanies.map((r) => r.name.trim().toLowerCase()));
        const remaining = subsegment.companies.filter(
          (company) => !removedNames.has(String(company.name || "").trim().toLowerCase())
        );

        // Try to add one replacement per removed company
        const replacements = [];
        const existingNames = remaining.map((c) => c.name);
        for (let i = 0; i < result.removedCount; i += 1) {
          const replacement = pickReplacement(subsegment.id, [
            ...existingNames,
            ...replacements.map((r) => r.name)
          ]);
          if (replacement) {
            replacements.push(replacement);
            addedHistory.push({
              name: replacement.name,
              ticker: replacement.isPublic ? replacement.ticker : null,
              subsegmentName: subsegment.name
            });
          }
        }

        // Mutate the in-memory companies array so all subsequent requests see updated data
        const updated = [...remaining, ...replacements];
        subsegment.companies.length = 0;
        updated.forEach((company) => subsegment.companies.push(company));

        totalAdded += replacements.length;
        console.log(
          `[Company Refresh] Subsegment '${subsegment.name}': Removed ${result.removedCount}, Added ${replacements.length}`
        );
      }

      if (addedHistory.length > 0) {
        recordAdditions(addedHistory);
      }

      console.log(`[Company Refresh] Completed. Removed: ${totalRemoved}, Added: ${totalAdded}`);
    } catch (error) {
      console.error("[Company Refresh] Error during refresh:", error.message);
    }
  };

  // Initial refresh after 1 minute, then weekly
  setTimeout(performRefresh, 60_000);
  setInterval(performRefresh, WEEKLY_MS);

  console.log("[Company Refresh] Weekly refresh scheduler initialized (every 7 days)");
};
