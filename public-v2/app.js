/* ═══════════════════════════════════════════════════════════════
   AI Value Chain Dashboard v2 — app.js
   Vanilla JS ES module. Shares all /api/* routes with v1 server.
   ═══════════════════════════════════════════════════════════════ */

// ── Exchange → Region map ────────────────────────────────────
const EXCHANGE_REGION = {
  NASDAQ: "north-america", NYSE: "north-america", AMEX: "north-america",
  TSX: "north-america", TSE: "asia", SSE: "asia", SZSE: "asia",
  HKEX: "asia", KRX: "asia", TWSE: "asia", TWO: "asia",
  XETRA: "europe", Euronext: "europe", SIX: "europe",
  LSE: "europe", MOEX: "europe"
};

// ── State ────────────────────────────────────────────────────
const state = {
  expandedSubsegments: new Set(),
  fullSubsegmentData: new Map(),
  latestPayload: null,
  companyIndex: [],
  drawerRequestSeq: 0,
  drawerActiveTab: "overview",
  drawerCurrentCompany: null,
  drawerCurrentSubsegmentName: "",
  drawerChart: null,
  filters: {
    listing: "all",
    region: "all",
    search: "",
    minMarketCapBn: 0
  },
  activeSegmentTab: "all",
  sidebarCollapsed: false,
  watchlist: new Set(),
  portfolioHoldings: new Map(),
  comparisonSet: new Set(),
  layout: "v2",
  theme: "light",
  refreshInFlight: false
};

// ── Formatters ───────────────────────────────────────────────
const fmtNumber = (v) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "N/A";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);
};

const fmtCompactNumber = (v) => {
  if (!Number.isFinite(v)) return "N/A";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(v);
};

const fmtCurrency = (v, currency = "USD") => {
  if (v === null || v === undefined || Number.isNaN(v)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
    maximumFractionDigits: v >= 100 ? 0 : 2
  }).format(v);
};

const fmtDisplayPrice = (market = {}) => {
  const currency = String(market.currency || "USD").toUpperCase();
  const main = fmtCurrency(market.price, currency);
  if (currency === "USD") return main;
  if (!Number.isFinite(market.usdPrice)) return main;
  return `${main} (${fmtCurrency(market.usdPrice, "USD")})`;
};

const fmtMarketCap = (v) => {
  if (!Number.isFinite(v)) return "N/A";
  return `${fmtNumber(v / 1_000_000_000)}B`;
};

const fmtDateTime = (v) => {
  if (!v) return "N/A";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleString();
};

const fmtRemovalDate = (iso) => {
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }); }
  catch { return "N/A"; }
};

const formatChangeClass = (pct) => {
  if (!Number.isFinite(pct)) return "flat";
  if (pct > 0) return "gain";
  if (pct < 0) return "loss";
  return "flat";
};

const stateClass = (freshness) => {
  const k = (freshness || "stale").toLowerCase();
  if (k.includes("live"))    return "state-live";
  if (k.includes("delayed")) return "state-delayed";
  if (k.includes("cached"))  return "state-cached";
  if (k.includes("snapshot"))return "state-snapshot";
  return "state-stale";
};

const getRegion = (company) => {
  if (!company.isPublic) return "other";
  return EXCHANGE_REGION[company.exchange] || "other";
};

// ── localStorage helpers ─────────────────────────────────────
const loadPersistedState = () => {
  try {
    const wl = JSON.parse(localStorage.getItem("v2-watchlist") || "[]");
    state.watchlist = new Set(wl);
    const ph = JSON.parse(localStorage.getItem("v2-portfolio") || "[]");
    state.portfolioHoldings = new Map(ph.map(({ name, qty }) => [name, Number(qty)]));
    state.sidebarCollapsed = localStorage.getItem("v2-sidebar-collapsed") === "true";
    const userSetTheme = localStorage.getItem("v2-theme-user-set") === "true";
    const storedTheme = localStorage.getItem("v2-theme");
    state.theme = userSetTheme && (storedTheme === "dark" || storedTheme === "light")
      ? storedTheme
      : "light";
    const storedLayout = localStorage.getItem("v2-layout-mode");
    state.layout = storedLayout === "v1" ? "v1" : "v2";
  } catch { /* ignore */ }
};

const persistWatchlist    = () => localStorage.setItem("v2-watchlist",          JSON.stringify([...state.watchlist]));
const persistPortfolio    = () => localStorage.setItem("v2-portfolio",          JSON.stringify([...state.portfolioHoldings.entries()].map(([name,qty])=>({name,qty}))));
const persistSidebar      = () => localStorage.setItem("v2-sidebar-collapsed",  String(state.sidebarCollapsed));
const persistTheme        = () => localStorage.setItem("v2-theme",              state.theme);
const persistLayout       = () => localStorage.setItem("v2-layout-mode",        state.layout);

// ── Filters ──────────────────────────────────────────────────
const passesCompanyFilters = (company) => {
  const q = String(state.filters.search || "").trim().toLowerCase();
  if (q) {
    const hay = `${company.name || ""} ${company.ticker || ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  // In v1 layout mode, sidebar-only filters are hidden, so apply search-only filtering.
  if (state.layout === "v1") {
    return true;
  }

  const listingOk = state.filters.listing === "all"
    || (state.filters.listing === "public"  && company.isPublic)
    || (state.filters.listing === "private" && !company.isPublic);
  if (!listingOk) return false;

  if (state.filters.region !== "all" && getRegion(company) !== state.filters.region) return false;

  if (state.filters.minMarketCapBn > 0 && company.isPublic) {
    const capBn = (company.market?.marketCap || 0) / 1e9;
    if (capBn < state.filters.minMarketCapBn) return false;
  }
  return true;
};

// ── Theme ────────────────────────────────────────────────────
const applyTheme = () => {
  document.documentElement.setAttribute("data-theme", state.theme);
  const btn = document.querySelector("#theme-toggle");
  if (btn) btn.textContent = state.theme === "dark" ? "☀" : "☾";
};

const applyLayout = () => {
  document.documentElement.setAttribute("data-layout", state.layout);
  const btn = document.querySelector("#layout-toggle");
  if (btn) {
    btn.textContent = state.layout;
    btn.setAttribute("aria-label", `Switch to ${state.layout === "v2" ? "v1" : "v2"} layout`);
    btn.title = `Switch to ${state.layout === "v2" ? "v1" : "v2"} layout`;
  }

  const sidebar = document.querySelector("#sidebar");
  if (state.layout === "v1") {
    sidebar?.classList.remove("mobile-open");
  }
};

// ── Sidebar collapse ─────────────────────────────────────────
const applySidebarCollapse = () => {
  const sidebar  = document.querySelector("#sidebar");
  const main     = document.querySelector("#main");
  const statsBar = document.querySelector("#stats-bar");
  const compPanel = document.querySelector("#comparison-panel");
  if (state.sidebarCollapsed) {
    sidebar.classList.add("collapsed");
    main.classList.add("sidebar-collapsed");
    statsBar.classList.add("sidebar-collapsed");
    compPanel && compPanel.classList.add("sidebar-collapsed");
  } else {
    sidebar.classList.remove("collapsed");
    main.classList.remove("sidebar-collapsed");
    statsBar.classList.remove("sidebar-collapsed");
    compPanel && compPanel.classList.remove("sidebar-collapsed");
  }
};

// ── Company index ────────────────────────────────────────────
const buildCompanyIndex = (companies) => {
  const seen = new Set();
  const index = [];
  companies.forEach((c) => {
    const key = String(c.name || "").trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    index.push(c);
  });
  return index.sort((a, b) => a.name.localeCompare(b.name));
};

const loadCompanyIndex = async () => {
  try {
    const r = await fetch("/api/companies");
    if (!r.ok) return;
    const body = await r.json();
    state.companyIndex = buildCompanyIndex(body.companies || []);
  } catch { /* best-effort */ }
};

// ── Search dropdown ──────────────────────────────────────────
const getSearchMatches = () => {
  const q = String(state.filters.search || "").trim().toLowerCase();
  if (!q) return [];
  return state.companyIndex
    .filter((c) => String(c.name || "").toLowerCase().includes(q) || String(c.ticker || "").toLowerCase().includes(q))
    .slice(0, 12);
};

let dropdownSelectedIndex = -1;

const renderSearchDropdown = () => {
  const dropdown = document.querySelector("#search-dropdown");
  if (!dropdown) return;
  const matches = getSearchMatches();
  dropdownSelectedIndex = -1;
  if (!matches.length) { dropdown.hidden = true; dropdown.innerHTML = ""; return; }

  dropdown.innerHTML = matches.map((c, i) => {
    const meta = c.isPublic && c.ticker ? `${c.exchange}:${c.ticker}` : "Private";
    return `<div class="search-dropdown-item" data-index="${i}">
      <div class="search-dropdown-item-name">${c.name}</div>
      <div class="search-dropdown-item-meta">${meta}</div>
    </div>`;
  }).join("");

  dropdown.hidden = false;
  dropdown.querySelectorAll(".search-dropdown-item").forEach((item) => {
    item.addEventListener("click", () => {
      const c = matches[parseInt(item.dataset.index, 10)];
      if (c) {
        document.querySelector("#filter-search").value = c.name;
        state.filters.search = c.name;
        renderSearchDropdown();
        renderSearchPerformance();
        if (state.latestPayload) render(state.latestPayload);
      }
    });
  });
};

const updateDropdownSelection = (newIdx) => {
  const dropdown = document.querySelector("#search-dropdown");
  const matches = getSearchMatches();
  if (newIdx < -1 || newIdx >= matches.length) return;
  dropdown.querySelectorAll(".search-dropdown-item").forEach((item, i) => {
    item.classList.toggle("selected", i === newIdx);
    if (i === newIdx) item.scrollIntoView({ block: "nearest" });
  });
  dropdownSelectedIndex = newIdx;
};

const handleSearchKeydown = (e) => {
  const matches = getSearchMatches();
  if (e.key === "ArrowDown")  { e.preventDefault(); updateDropdownSelection(dropdownSelectedIndex + 1); }
  else if (e.key === "ArrowUp")  { e.preventDefault(); updateDropdownSelection(dropdownSelectedIndex - 1); }
  else if (e.key === "Enter") {
    if (dropdownSelectedIndex >= 0 && dropdownSelectedIndex < matches.length) {
      e.preventDefault();
      const c = matches[dropdownSelectedIndex];
      document.querySelector("#filter-search").value = c.name;
      state.filters.search = c.name;
      renderSearchDropdown();
      renderSearchPerformance();
      if (state.latestPayload) render(state.latestPayload);
    }
  } else if (e.key === "Escape") {
    const dd = document.querySelector("#search-dropdown");
    if (dd) dd.hidden = true;
  }
};

const renderSearchPerformance = () => {
  const panel = document.querySelector("#search-performance");
  if (!panel) return;
  const trimmed = String(state.filters.search || "").trim().toLowerCase();
  if (!trimmed) { panel.hidden = true; panel.innerHTML = ""; return; }

  const company = state.companyIndex.find(
    (c) => String(c.name || "").toLowerCase() === trimmed || String(c.ticker || "").toLowerCase() === trimmed
  );
  if (!company) { panel.hidden = true; panel.innerHTML = ""; return; }

  if (company.isPublic) {
    const market = company.market || {};
    const pct = Number.isFinite(market.changePercent) ? `${market.changePercent.toFixed(2)}%` : "N/A";
    panel.innerHTML = `
      <span class="sp-name">${company.name} <span class="sp-meta">${company.exchange}:${company.ticker}</span></span>
      <div class="sp-row"><span class="sp-price">${fmtDisplayPrice(market)}</span>
        <span class="${formatChangeClass(market.changePercent)}">${pct}</span></div>
      <span class="sp-meta">MCap ${fmtMarketCap(market.marketCap)} | P/E ${fmtNumber(market.peRatio)} | ${market.freshness || "Stale"}</span>`;
  } else {
    const val = company.valuation || {};
    panel.innerHTML = `
      <span class="sp-name">${company.name} <span class="sp-meta">Private</span></span>
      <div class="sp-row"><span class="sp-price">${fmtCurrency((val.latestValuationUsdBn || 0) * 1e9)}</span></div>
      <span class="sp-meta">As of ${val.valuationDate || "N/A"} | ${val.freshness || "Snapshot"}</span>`;
  }
  panel.hidden = false;
  panel.style.cursor = "pointer";
  panel.title = "Click to view company details";
  panel.onclick = () => openDrawer(company, company.subsegmentName || "");
};

// ════════════════════════════════════════════════════════════
// STATS BAR
// ════════════════════════════════════════════════════════════
const renderStatsBar = (payload) => {
  const bar = document.querySelector("#stats-bar");
  if (!bar) return;

  const allCompanies = payload.segments.flatMap((s) =>
    s.subsegments.flatMap((ss) => (ss.topCompanies || []).concat([]))
  );

  let totalCap = 0;
  let upCount = 0;
  let downCount = 0;
  let topMover = null;
  let topMoverPct = 0;

  allCompanies.forEach((c) => {
    if (!c.isPublic) return;
    const m = c.market || {};
    if (Number.isFinite(m.marketCap)) totalCap += m.marketCap;
    if (Number.isFinite(m.changePercent)) {
      if (m.changePercent > 0) upCount++;
      else if (m.changePercent < 0) downCount++;
      if (Math.abs(m.changePercent) > Math.abs(topMoverPct)) {
        topMoverPct = m.changePercent;
        topMover = c;
      }
    }
  });

  const topMoverHtml = topMover
    ? `<div class="stat-item">
        <span class="stat-label">Top Mover</span>
        <span class="stat-value">${topMover.ticker || topMover.name}</span>
        <span class="stat-change ${formatChangeClass(topMoverPct)}">${topMoverPct.toFixed(2)}%</span>
       </div>`
    : "";

  bar.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">Total Tracked MCap</span>
      <span class="stat-value">${fmtMarketCap(totalCap)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Up</span>
      <span class="stat-value gain">${upCount}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Down</span>
      <span class="stat-value loss">${downCount}</span>
    </div>
    ${topMoverHtml}
    <div class="stat-item">
      <span class="stat-label">Updated</span>
      <span class="stat-value" style="font-size:0.72rem">${new Date(payload.asOf).toLocaleString()}</span>
    </div>`;
};

// ════════════════════════════════════════════════════════════
// HEADER BADGES
// ════════════════════════════════════════════════════════════
const renderHeaderBadges = (payload) => {
  const container = document.querySelector("#header-badges");
  if (!container) return;

  const counts = { live: 0, delayed: 0, cached: 0, stale: 0 };
  payload.segments.forEach((s) =>
    s.subsegments.forEach((ss) =>
      (ss.topCompanies || []).forEach((c) => {
        if (!c.isPublic) return;
        const f = (c.market?.freshness || "stale").toLowerCase();
        if (f.includes("live"))    counts.live++;
        else if (f.includes("delayed")) counts.delayed++;
        else if (f.includes("cached"))  counts.cached++;
        else counts.stale++;
      })
    )
  );

  container.innerHTML = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([type, n]) => {
      const dot = type === "live" ? '<span class="status-dot pulse"></span>' : '<span class="status-dot"></span>';
      return `<span class="header-badge ${type}">${dot} ${n} ${type.charAt(0).toUpperCase() + type.slice(1)}</span>`;
    }).join("");
};

// ════════════════════════════════════════════════════════════
// SIDEBAR: Stage nav
// ════════════════════════════════════════════════════════════
const renderSidebarStageNav = (payload) => {
  const nav = document.querySelector("#sidebar-stage-nav");
  if (!nav) return;

  const stages = payload.segments.map((s) => ({
    stage: s.stage,
    name: s.name,
    count: s.subsegments.reduce((acc, ss) => acc + (ss.totalCompanies || 0), 0)
  }));

  const allCount = stages.reduce((a, s) => a + s.count, 0);

  const items = [
    { value: "all", label: "All Stages", count: allCount },
    ...stages.map((s) => ({ value: s.stage, label: s.name, count: s.count }))
  ];

  nav.innerHTML = items.map((item) => {
    const isActive = state.activeSegmentTab === item.value;
    return `<div class="sidebar-nav-item ${isActive ? "active" : ""}" data-stage="${item.value}">
      <span class="nav-icon"></span>
      <span class="nav-label">${item.label}</span>
      <span class="nav-count">${item.count}</span>
    </div>`;
  }).join("");

  nav.querySelectorAll(".sidebar-nav-item").forEach((el) => {
    el.addEventListener("click", () => {
      state.activeSegmentTab = el.dataset.stage;
      renderSidebarStageNav(payload);
      renderSegmentTabs(payload.segments);
      renderMap(payload);
    });
  });
};

// ════════════════════════════════════════════════════════════
// SIDEBAR: Watchlist
// ════════════════════════════════════════════════════════════
const renderSidebarWatchlist = () => {
  const container = document.querySelector("#sidebar-watchlist");
  if (!container) return;

  if (state.watchlist.size === 0) {
    container.innerHTML = '<div class="sidebar-empty">Pin companies using the ★ on any row.</div>';
    return;
  }

  const items = [...state.watchlist].map((name) => {
    const company = state.companyIndex.find((c) => c.name === name);
    if (!company) return `<div class="wl-item"><div class="wl-info"><div class="wl-name">${name}</div></div></div>`;

    const market = company.market || {};
    const val = company.valuation || {};
    const priceStr = company.isPublic ? fmtDisplayPrice(market) : fmtCurrency((val.latestValuationUsdBn || 0) * 1e9);
    const changeStr = company.isPublic && Number.isFinite(market.changePercent) ? `${market.changePercent.toFixed(2)}%` : "";
    const changeClass = formatChangeClass(market.changePercent);
    const ticker = company.isPublic ? `${company.exchange}:${company.ticker}` : "Private";

    return `<div class="wl-item" data-company-name="${encodeURIComponent(name)}">
      <div class="wl-info">
        <div class="wl-name">${company.name}</div>
        <div class="wl-ticker">${ticker}</div>
      </div>
      <div class="wl-price-block">
        <div class="wl-price">${priceStr}</div>
        ${changeStr ? `<div class="wl-change ${changeClass}">${changeStr}</div>` : ""}
      </div>
    </div>`;
  });

  container.innerHTML = items.join("");
  container.querySelectorAll(".wl-item").forEach((el) => {
    el.addEventListener("click", () => {
      const name = decodeURIComponent(el.dataset.companyName || "");
      const company = state.companyIndex.find((c) => c.name === name);
      if (company) openDrawer(company, company.subsegmentName || "");
    });
  });
};

// ════════════════════════════════════════════════════════════
// SIDEBAR: Portfolio summary
// ════════════════════════════════════════════════════════════
const renderSidebarPortfolioSummary = () => {
  const el = document.querySelector("#sidebar-portfolio-summary");
  if (!el) return;
  if (state.portfolioHoldings.size === 0) {
    el.innerHTML = '<div class="sidebar-empty">No holdings yet.</div>';
    return;
  }

  let totalValue = 0;
  let totalPnl = 0;
  state.portfolioHoldings.forEach((qty, name) => {
    const company = state.companyIndex.find((c) => c.name === name);
    if (!company?.isPublic) return;
    const market = company.market || {};
    const price = market.price || 0;
    const pct = market.changePercent || 0;
    const value = price * qty;
    totalValue += value;
    totalPnl += value - (value / (1 + pct / 100));
  });

  const pnlClass = formatChangeClass(totalPnl);
  el.innerHTML = `
    <div class="portfolio-total">${fmtCurrency(totalValue)}</div>
    <div class="${pnlClass}" style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;font-weight:600;">
      ${totalPnl >= 0 ? "+" : ""}${fmtCurrency(totalPnl)} today
    </div>`;
};

// ════════════════════════════════════════════════════════════
// SEGMENT TABS
// ════════════════════════════════════════════════════════════
const renderSegmentTabs = (segments) => {
  const container = document.querySelector("#segment-tabs");
  if (!container) return;

  const tabs = [{ value: "all", label: "All" }, ...segments.map((s) => ({ value: s.stage, label: s.name }))];

  container.innerHTML = tabs.map((t) => {
    const isActive = state.activeSegmentTab === t.value;
    return `<button class="segment-tab ${isActive ? "active" : ""}" data-stage="${t.value}" role="tab" aria-selected="${isActive}">${t.label}</button>`;
  }).join("");

  container.querySelectorAll(".segment-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeSegmentTab = btn.dataset.stage;
      renderSegmentTabs(segments);
      renderSidebarStageNav(state.latestPayload);
      renderMap(state.latestPayload);
    });
  });
};

// ════════════════════════════════════════════════════════════
// LEADERBOARD
// ════════════════════════════════════════════════════════════
const renderLeaderboard = (payload) => {
  const leaderboard = document.querySelector("#leaderboard");
  if (!leaderboard) return;

  const allSubsegments = payload.segments.flatMap((seg) =>
    seg.subsegments.map((ss) => ({ ...ss, segmentName: seg.name }))
  );

  const withChange = allSubsegments.filter((ss) => Number.isFinite(ss.valuationIndex?.valuationChangePercent));
  if (!withChange.length) { leaderboard.innerHTML = ""; return; }

  const sortedDesc = [...withChange].sort(
    (a, b) => b.valuationIndex.valuationChangePercent - a.valuationIndex.valuationChangePercent
  );
  const sortedAsc = [...withChange].sort(
    (a, b) => a.valuationIndex.valuationChangePercent - b.valuationIndex.valuationChangePercent
  );

  const topGainers = sortedDesc.slice(0, 5);
  const topDecliners = sortedAsc.slice(0, 5);

  const renderCards = (items, titlePrefix) => items.map((ss, i) => {
    const pct = ss.valuationIndex.valuationChangePercent;
    const changeClass = formatChangeClass(pct);
    return `<article class="leader-card" data-segment-stage="${ss.segmentId || ""}">
      <p class="leader-title">${titlePrefix} #${i + 1}</p>
      <p class="leader-subsegment">${ss.name}</p>
      <p class="leader-metric ${changeClass}">${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%</p>
      <p class="leader-segment-label">${ss.segmentName}</p>
    </article>`;
  }).join("");

  const gainHtml = renderCards(topGainers, "Top Gainer");
  const declineHtml = renderCards(topDecliners, "Top Decliner");

  leaderboard.innerHTML = `
    <div class="section-heading">Top Movers — Subsegment Valuation Index</div>
    <div class="leader-row">
      <div class="leader-row-title gain">Top 5 Gainers</div>
      <div class="leaderboard-grid" aria-label="Top 5 gainers subsegments">${gainHtml}</div>
    </div>
    <div class="leader-row">
      <div class="leader-row-title loss">Top 5 Decliners</div>
      <div class="leaderboard-grid" aria-label="Top 5 decliners subsegments">${declineHtml}</div>
    </div>`;
};

// ════════════════════════════════════════════════════════════
// MAP (Segments + Subsegments)
// ════════════════════════════════════════════════════════════
const renderValuationIndexInline = (vi) => {
  if (!vi) return "";
  const changeClass = formatChangeClass(vi.valuationChangePercent);
  const changeTxt = Number.isFinite(vi.valuationChangePercent) ? `${vi.valuationChangePercent.toFixed(2)}%` : "N/A";
  return `
    <div class="index-item"><div class="index-label">Index MCap</div><div class="index-value">${fmtMarketCap(vi.totalPublicValuation)}</div></div>
    <div class="index-item"><div class="index-label">1D Change</div><div class="index-value ${changeClass}">${changeTxt}</div></div>
    <div class="index-item"><div class="index-label">Tracked</div><div class="index-value">${vi.trackedPublicCompanies}/${vi.totalPublicCompanies}</div></div>`;
};

const renderSubsegmentStatsRow = (subsegment) => {
  const vi = subsegment.valuationIndex || {};
  const changeClass = formatChangeClass(vi.valuationChangePercent);
  const changeTxt = Number.isFinite(vi.valuationChangePercent) ? `${vi.valuationChangePercent >= 0 ? "+" : ""}${vi.valuationChangePercent.toFixed(2)}%` : "N/A";
  const publicCount = (subsegment.topCompanies || []).filter((c) => c.isPublic).length + (subsegment.totalCompanies ? 0 : 0);
  const privateCount = (subsegment.topCompanies || []).filter((c) => !c.isPublic).length;

  return `
    <div class="ss-stat"><span class="ss-stat-label">MCap</span><span class="ss-stat-val">${fmtMarketCap(vi.totalPublicValuation)}</span></div>
    <div class="ss-stat"><span class="ss-stat-label">Δ Today</span><span class="ss-stat-val ${changeClass}">${changeTxt}</span></div>
    <div class="ss-stat"><span class="ss-stat-label">Total</span><span class="ss-stat-val">${subsegment.totalCompanies || "?"}</span></div>
    <div class="ss-stat"><span class="ss-stat-label">Tracked</span><span class="ss-stat-val">${vi.trackedPublicCompanies || 0}</span></div>`;
};

const rowHtml = (company, subsegmentId) => {
  const isWatched = state.watchlist.has(company.name);
  const isInComparison = state.comparisonSet.has(company.name);
  const starClass = isWatched ? "active" : "";
  const compareClass = isInComparison ? "in-set" : "";
  const nameEnc = encodeURIComponent(company.name);

  const infoBlock = `
    <div class="company-info">
      <div class="name">${company.name}</div>
      <div class="meta">${company.isPublic ? `${company.exchange}:${company.ticker}` : "Private"}</div>
    </div>`;

  if (company.isPublic) {
    const market = company.market || {};
    const pct = Number.isFinite(market.changePercent) ? `${market.changePercent.toFixed(2)}%` : "N/A";
    const changeClass = formatChangeClass(market.changePercent);
    return `<div class="company-row" data-subsegment-id="${subsegmentId}" data-company-name="${nameEnc}">
      <span class="rank">${company.rank}</span>
      ${infoBlock}
      <div class="value-block">
        <div class="price">${fmtDisplayPrice(market)}</div>
        <span class="change-pill ${changeClass}">${pct}
          <span class="state-pill ${stateClass(market.freshness)}">${(market.freshness || "Stale").substring(0, 1)}</span>
        </span>
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.62rem;color:var(--text-muted);">
          ${fmtMarketCap(market.marketCap)}
        </div>
      </div>
      <button class="star-btn ${starClass}" data-company-name="${nameEnc}" title="${isWatched ? "Remove from watchlist" : "Add to watchlist"}">★</button>
      <button class="compare-btn ${compareClass}" data-company-name="${nameEnc}" title="Compare">${isInComparison ? "✓ In Set" : "+ Compare"}</button>
    </div>`;
  }

  const valuation = company.valuation || {};
  return `<div class="company-row" data-subsegment-id="${subsegmentId}" data-company-name="${nameEnc}">
    <span class="rank">${company.rank}</span>
    ${infoBlock}
    <div class="value-block">
      <div class="price">${fmtCurrency((valuation.latestValuationUsdBn || 0) * 1e9)}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:0.62rem;color:var(--text-muted);">
        As of ${valuation.valuationDate || "N/A"}
        <span class="state-pill ${stateClass(valuation.freshness)}">${(valuation.freshness || "Snap").substring(0, 1)}</span>
      </div>
    </div>
    <button class="star-btn ${starClass}" data-company-name="${nameEnc}" title="${isWatched ? "Remove from watchlist" : "Add to watchlist"}">★</button>
    <button class="compare-btn ${compareClass}" data-company-name="${nameEnc}" title="Compare">${isInComparison ? "✓ In Set" : "+ Compare"}</button>
  </div>`;
};

const setCompanyRows = (container, companies, subsegment) => {
  const filtered = companies.filter(passesCompanyFilters);
  if (!filtered.length) {
    container.innerHTML = '<div class="no-companies">No companies match current filters.</div>';
    return;
  }
  container.innerHTML = filtered.map((c) => rowHtml(c, subsegment.id)).join("");
  bindCompanyRowClicks(container, filtered, subsegment);
};

const bindCompanyRowClicks = (container, companies, subsegment) => {
  container.querySelectorAll(".company-row").forEach((row) => {
    // Main row click → open drawer
    row.addEventListener("click", (e) => {
      if (e.target.classList.contains("star-btn") || e.target.classList.contains("compare-btn")) return;
      const name = decodeURIComponent(row.dataset.companyName || "");
      const company = companies.find((c) => c.name === name);
      if (company) openDrawer(company, subsegment.name);
    });

    // Star button
    const starBtn = row.querySelector(".star-btn");
    if (starBtn) {
      starBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleWatchlist(decodeURIComponent(starBtn.dataset.companyName || ""));
      });
    }

    // Compare button
    const compareBtn = row.querySelector(".compare-btn");
    if (compareBtn) {
      compareBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleComparison(decodeURIComponent(compareBtn.dataset.companyName || ""), companies);
      });
    }
  });
};

const attachToggleHandler = (button, subsegment, companiesContainer) => {
  const hidden = Math.max((subsegment.totalCompanies || 0) - 5, 0);
  const setLabel = (expanded) => {
    button.textContent = expanded ? "⊖ Collapse additional companies" : `⊕ Show ${hidden} more companies`;
  };
  setLabel(state.expandedSubsegments.has(subsegment.id));

  button.addEventListener("click", async () => {
    const isExpanded = state.expandedSubsegments.has(subsegment.id);
    if (isExpanded) {
      state.expandedSubsegments.delete(subsegment.id);
      setCompanyRows(companiesContainer, subsegment.topCompanies.slice(0, 5), subsegment);
      setLabel(false);
      return;
    }
    if (!state.fullSubsegmentData.has(subsegment.id)) {
      button.textContent = "Loading…";
      try {
        const r = await fetch(`/api/subsegments/${subsegment.id}/companies`);
        const body = await r.json();
        state.fullSubsegmentData.set(subsegment.id, body.companies || []);
      } catch {
        button.textContent = "Error loading. Try again.";
        return;
      }
    }
    state.expandedSubsegments.add(subsegment.id);
    setCompanyRows(companiesContainer, state.fullSubsegmentData.get(subsegment.id) || [], subsegment);
    setLabel(true);
  });
};

const renderMap = (payload) => {
  const map = document.querySelector("#map");
  if (!map) return;
  map.innerHTML = "";

  const segmentTemplate = document.querySelector("#segment-template");
  const subTemplate = document.querySelector("#subsegment-template");

  const segments = state.activeSegmentTab === "all"
    ? payload.segments
    : payload.segments.filter((s) => s.stage === state.activeSegmentTab);

  segments.forEach((segment, segIdx) => {
    const segNode = segmentTemplate.content.cloneNode(true);
    const article = segNode.querySelector(".segment-card");
    article.style.animationDelay = `${segIdx * 0.06}s`;
    segNode.querySelector(".stage-pill").textContent = segment.stage;
    segNode.querySelector(".segment-name").textContent = segment.name;
    segNode.querySelector(".segment-summary").textContent = segment.summary;

    const viHtml = renderValuationIndexInline(segment.valuationIndex);
    segNode.querySelector(".segment-index").innerHTML = viHtml;

    const subsegmentsWrap = segNode.querySelector(".subsegments-grid");

    segment.subsegments.forEach((subsegment) => {
      const subNode = subTemplate.content.cloneNode(true);
      subNode.querySelector(".subsegment-name").textContent = `${subsegment.name} (${subsegment.totalCompanies})`;
      subNode.querySelector(".subsegment-desc").textContent = subsegment.description;
      subNode.querySelector(".subsegment-stats-row").innerHTML = renderSubsegmentStatsRow(subsegment);

      const jsonLink = subNode.querySelector(".export-json");
      const csvLink  = subNode.querySelector(".export-csv");
      jsonLink.href  = `/api/subsegments/${subsegment.id}/export?format=json&view=top5`;
      csvLink.href   = `/api/subsegments/${subsegment.id}/export?format=csv&view=all`;

      const companiesContainer = subNode.querySelector(".companies");
      const button = subNode.querySelector(".expand-btn");

      const isExpanded = state.expandedSubsegments.has(subsegment.id);
      const initialCompanies = isExpanded
        ? (state.fullSubsegmentData.get(subsegment.id) || subsegment.topCompanies)
        : subsegment.topCompanies;

      setCompanyRows(companiesContainer, initialCompanies, subsegment);
      attachToggleHandler(button, subsegment, companiesContainer);

      subsegmentsWrap.appendChild(subNode);
    });

    map.appendChild(segNode);
  });
};

// ════════════════════════════════════════════════════════════
// WATCHLIST TOGGLE
// ════════════════════════════════════════════════════════════
const toggleWatchlist = (companyName) => {
  if (state.watchlist.has(companyName)) {
    state.watchlist.delete(companyName);
  } else {
    state.watchlist.add(companyName);
  }
  persistWatchlist();
  renderSidebarWatchlist();

  // Update star buttons in current DOM without full re-render
  document.querySelectorAll(`.star-btn[data-company-name="${CSS.escape(encodeURIComponent(companyName))}"]`)
    .forEach((btn) => btn.classList.toggle("active", state.watchlist.has(companyName)));

  // Update drawer watchlist button if it's showing this company
  if (state.drawerCurrentCompany?.name === companyName) {
    updateDrawerWatchlistBtn();
  }
};

const updateDrawerWatchlistBtn = () => {
  const btn = document.querySelector("#drawer-watchlist-btn");
  if (!btn || !state.drawerCurrentCompany) return;
  const isWatched = state.watchlist.has(state.drawerCurrentCompany.name);
  btn.textContent = isWatched ? "★ In Watchlist" : "★ Add to Watchlist";
  btn.classList.toggle("active", isWatched);
};

// ════════════════════════════════════════════════════════════
// COMPARISON PANEL
// ════════════════════════════════════════════════════════════
const toggleComparison = (companyName, companyList) => {
  if (state.comparisonSet.has(companyName)) {
    state.comparisonSet.delete(companyName);
  } else if (state.comparisonSet.size < 3) {
    state.comparisonSet.add(companyName);
    // Store company data for later reference
    const company = companyList?.find((c) => c.name === companyName)
      || state.companyIndex.find((c) => c.name === companyName);
    if (company) {
      state.comparisonData = state.comparisonData || new Map();
      state.comparisonData.set(companyName, company);
    }
  }
  renderComparisonPanel();

  // Update compare buttons in DOM
  document.querySelectorAll(`.compare-btn[data-company-name="${CSS.escape(encodeURIComponent(companyName))}"]`)
    .forEach((btn) => {
      const inSet = state.comparisonSet.has(companyName);
      btn.classList.toggle("in-set", inSet);
      btn.textContent = inSet ? "✓ In Set" : "+ Compare";
    });
};

const renderComparisonPanel = () => {
  const panel = document.querySelector("#comparison-panel");
  if (!panel) return;

  if (state.comparisonSet.size === 0) {
    panel.classList.add("hidden");
    return;
  }

  const cols = [...state.comparisonSet].map((name) => {
    const company = (state.comparisonData?.get(name)) || state.companyIndex.find((c) => c.name === name);
    if (!company) return `<div class="comparison-col"><div class="comparison-col-name">${name}</div>
      <button class="comparison-col-close" data-name="${encodeURIComponent(name)}">✕</button></div>`;

    const market = company.market || {};
    const val    = company.valuation || {};
    const changeClass = formatChangeClass(market.changePercent);
    const price = company.isPublic ? fmtDisplayPrice(market) : fmtCurrency((val.latestValuationUsdBn || 0) * 1e9);

    return `<div class="comparison-col">
      <button class="comparison-col-close" data-name="${encodeURIComponent(name)}" title="Remove">✕</button>
      <div class="comparison-col-name">${company.name}</div>
      <div class="comparison-col-ticker">${company.isPublic ? `${company.exchange}:${company.ticker}` : "Private"}</div>
      <div class="comparison-kv">
        <span class="ckv-label">Price</span><span class="ckv-value">${price}</span>
        <span class="ckv-label">1D</span><span class="ckv-value ${changeClass}">${Number.isFinite(market.changePercent) ? `${market.changePercent.toFixed(2)}%` : "N/A"}</span>
        <span class="ckv-label">MCap</span><span class="ckv-value">${fmtMarketCap(market.marketCap)}</span>
        <span class="ckv-label">P/E</span><span class="ckv-value">${fmtNumber(market.peRatio)}</span>
        <span class="ckv-label">P/S</span><span class="ckv-value">${fmtNumber(market.psRatio)}</span>
      </div>
    </div>`;
  }).join("");

  panel.innerHTML = `
    <div class="comparison-header">
      <span class="comparison-title">Comparing ${state.comparisonSet.size} companies</span>
      <button class="comparison-clear-btn">Clear All</button>
    </div>
    <div class="comparison-cols">${cols}</div>`;

  panel.classList.remove("hidden");
  if (state.sidebarCollapsed) panel.classList.add("sidebar-collapsed");

  panel.querySelector(".comparison-clear-btn").addEventListener("click", () => {
    state.comparisonSet.clear();
    renderComparisonPanel();
    document.querySelectorAll(".compare-btn.in-set").forEach((btn) => {
      btn.classList.remove("in-set");
      btn.textContent = "+ Compare";
    });
  });

  panel.querySelectorAll(".comparison-col-close").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleComparison(decodeURIComponent(btn.dataset.name || ""));
    });
  });
};

// ════════════════════════════════════════════════════════════
// COMPANY DRAWER
// ════════════════════════════════════════════════════════════
const DRAWER_PERIODS = [
  { value: "1d", label: "1D" }, { value: "1w", label: "1W" }, { value: "1m", label: "1M" },
  { value: "3m", label: "3M" }, { value: "6m", label: "6M" }, { value: "1y", label: "1Y" },
  { value: "2y", label: "2Y" }, { value: "3y", label: "3Y" }, { value: "5y", label: "5Y" }
];

const getChartColors = () => {
  return state.theme === "dark"
    ? { bg: "#112035", text: "#7f98b8", grid: "#162845", border: "rgba(255,255,255,0.07)" }
    : { bg: "#ffffff", text: "#5d6d71", grid: "#f4f8f7", border: "#d8d3c5" };
};

const renderLightweightChart = (container, history, gainLoss) => {
  if (typeof LightweightCharts === "undefined") {
    container.innerHTML = '<div class="drawer-chart-empty">Chart library not loaded.</div>';
    return null;
  }

  container.innerHTML = "";
  const colors = getChartColors();
  const lineColor = gainLoss === "gain" ? "#22c97b" : gainLoss === "loss" ? "#ff4757" : "#7f98b8";
  const topColor  = gainLoss === "gain" ? "rgba(34,201,123,0.28)" : gainLoss === "loss" ? "rgba(255,71,87,0.28)" : "rgba(127,152,184,0.18)";

  const chart = LightweightCharts.createChart(container, {
    width: container.offsetWidth || 380,
    height: 200,
    layout: { background: { color: colors.bg }, textColor: colors.text },
    grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
    rightPriceScale: { borderColor: colors.border },
    timeScale: { borderColor: colors.border, timeVisible: true },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    handleScroll: false,
    handleScale: false
  });

  const series = chart.addAreaSeries({
    lineColor, topColor, bottomColor: "rgba(0,0,0,0)",
    lineWidth: 2, priceLineVisible: false
  });

  const points = (history?.points || [])
    .map((p) => ({ time: String(p.time).substring(0, 10), value: Number(p.close) }))
    .filter((p) => Number.isFinite(p.value) && p.time);

  if (points.length >= 2) {
    series.setData(points);
    chart.timeScale().fitContent();
  } else {
    container.innerHTML = '<div class="drawer-chart-empty">No chart data for this period.</div>';
    chart.remove();
    return null;
  }

  return chart;
};

const renderDrawerHeader = (company, subsegmentName) => {
  const el = document.querySelector("#drawer-header-content");
  if (!el) return;

  if (company.isPublic) {
    const market = company.market || {};
    const pct = Number.isFinite(market.changePercent) ? `${market.changePercent.toFixed(2)}%` : "N/A";
    const changeClass = formatChangeClass(market.changePercent);
    el.innerHTML = `
      <div class="drawer-company-name">${company.name}</div>
      <div class="drawer-company-meta">
        <span class="drawer-ticker">${company.exchange}:${company.ticker}</span>
        ${subsegmentName}
      </div>
      <div class="drawer-price-hero">
        <span class="drawer-price-big">${fmtDisplayPrice(market)}</span>
        <span class="drawer-change-big ${changeClass}">${pct} today</span>
      </div>`;
  } else {
    const val = company.valuation || {};
    el.innerHTML = `
      <div class="drawer-company-name">${company.name}</div>
      <div class="drawer-company-meta">
        <span class="drawer-ticker private-tag">Private</span>
        ${subsegmentName}
      </div>
      <div class="drawer-price-hero">
        <span class="drawer-price-big">${fmtCurrency((val.latestValuationUsdBn || 0) * 1e9)}</span>
        <span class="drawer-change-big" style="color:var(--text-muted)">As of ${val.valuationDate || "N/A"}</span>
      </div>`;
  }
};

const renderDrawerOverviewTab = (company) => {
  if (company.isPublic) {
    const market = company.market || {};
    const pct = Number.isFinite(market.changePercent) ? `${market.changePercent.toFixed(2)}%` : "N/A";
    const changeClass = formatChangeClass(market.changePercent);
    return `<div class="kv-grid">
      <div class="kv-item"><div class="kv-label">Price</div><div class="kv-value">${fmtDisplayPrice(market)}</div></div>
      <div class="kv-item"><div class="kv-label">1D Change</div><div class="kv-value ${changeClass}">${pct}</div></div>
      <div class="kv-item"><div class="kv-label">Market Cap</div><div class="kv-value">${fmtMarketCap(market.marketCap)}</div></div>
      <div class="kv-item"><div class="kv-label">P/E Ratio</div><div class="kv-value">${fmtNumber(market.peRatio)}</div></div>
      <div class="kv-item"><div class="kv-label">P/S Ratio</div><div class="kv-value">${fmtNumber(market.psRatio)}</div></div>
      <div class="kv-item"><div class="kv-label">Freshness</div><div class="kv-value"><span class="state-pill ${stateClass(market.freshness)}">${market.freshness || "Stale"}</span></div></div>
    </div>
    ${company.notes ? `<div class="notes-box">${company.notes}</div>` : ""}`;
  }

  const val = company.valuation || {};
  return `<div class="kv-grid">
    <div class="kv-item"><div class="kv-label">Latest Valuation</div><div class="kv-value">${fmtCurrency((val.latestValuationUsdBn || 0) * 1e9)}</div></div>
    <div class="kv-item"><div class="kv-label">As Of</div><div class="kv-value">${val.valuationDate || "N/A"}</div></div>
    <div class="kv-item"><div class="kv-label">Freshness</div><div class="kv-value"><span class="state-pill ${stateClass(val.freshness)}">${val.freshness || "Snapshot"}</span></div></div>
    <div class="kv-item"><div class="kv-label">Type</div><div class="kv-value">Private</div></div>
  </div>
  ${company.notes ? `<div class="notes-box">${company.notes}</div>` : ""}`;
};

const renderDrawerFundamentalsTab = () => {
  return `<div class="kv-grid">
    <div class="kv-item"><div class="kv-label">Prev Close</div><div class="kv-value" id="drawer-prev-close">—</div></div>
    <div class="kv-item"><div class="kv-label">Open</div><div class="kv-value" id="drawer-open">—</div></div>
    <div class="kv-item"><div class="kv-label">Day Range</div><div class="kv-value" id="drawer-day-range">—</div></div>
    <div class="kv-item"><div class="kv-label">52W Range</div><div class="kv-value" id="drawer-52w-range">—</div></div>
    <div class="kv-item"><div class="kv-label">Volume</div><div class="kv-value" id="drawer-volume">—</div></div>
    <div class="kv-item"><div class="kv-label">Avg Vol (3M)</div><div class="kv-value" id="drawer-avg-volume">—</div></div>
    <div class="kv-item"><div class="kv-label">Price Refresh</div><div class="kv-value" id="drawer-price-refresh">—</div></div>
    <div class="kv-item"><div class="kv-label">Exchange</div><div class="kv-value" id="drawer-exchange">—</div></div>
  </div>`;
};

const renderDrawerChartTab = (company) => {
  return `<div class="chart-period-bar" id="drawer-period-bar">
    ${DRAWER_PERIODS.map((p) => `<button class="period-btn${p.value === "3m" ? " active" : ""}" data-period="${p.value}">${p.label}</button>`).join("")}
  </div>
  <div class="chart-container" id="drawer-chart-container">
    <div class="drawer-chart-empty">Loading chart…</div>
  </div>`;
};

const switchDrawerTab = (tab, company) => {
  state.drawerActiveTab = tab;
  const body = document.querySelector("#drawer-body");
  if (!body) return;

  // Update tab button states
  document.querySelectorAll(".drawer-tab").forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });

  // Destroy existing chart if switching away from chart tab
  if (state.drawerChart) {
    try { state.drawerChart.remove(); } catch { /* ignore */ }
    state.drawerChart = null;
  }

  if (tab === "overview") {
    body.innerHTML = renderDrawerOverviewTab(company);
  } else if (tab === "chart") {
    if (!company.isPublic) {
      body.innerHTML = '<div class="drawer-chart-empty" style="padding:2rem 0">No chart data available for private companies.</div>';
      return;
    }
    body.innerHTML = renderDrawerChartTab(company);
    const container = document.querySelector("#drawer-chart-container");
    loadAndRenderChart(company, "3m", container);

    document.querySelectorAll(".period-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".period-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (state.drawerChart) { try { state.drawerChart.remove(); } catch { /* ignore */ } state.drawerChart = null; }
        loadAndRenderChart(company, btn.dataset.period, container);
      });
    });
  } else if (tab === "fundamentals") {
    if (!company.isPublic) {
      body.innerHTML = '<div class="drawer-chart-empty" style="padding:2rem 0">No fundamentals data for private companies.</div>';
      return;
    }
    body.innerHTML = renderDrawerFundamentalsTab();
    const reqSeq = state.drawerRequestSeq + 1;
    state.drawerRequestSeq = reqSeq;
    loadPublicDrawerDetails(company, reqSeq);
  }
};

const loadAndRenderChart = async (company, period, container) => {
  container.innerHTML = '<div class="drawer-chart-empty">Loading chart…</div>';
  try {
    const r = await fetch(`/api/stock-history?ticker=${encodeURIComponent(company.ticker)}&period=${encodeURIComponent(period)}`);
    if (!r.ok) throw new Error("Unable to load price history");
    const history = await r.json();

    const points = (history.points || []).map((p) => Number(p.close)).filter(Number.isFinite);
    const first = points[0]; const last = points[points.length - 1];
    const gainLoss = formatChangeClass(first > 0 ? ((last - first) / first) * 100 : null);

    state.drawerChart = renderLightweightChart(container, history, gainLoss);
  } catch (err) {
    container.innerHTML = `<div class="drawer-chart-empty">${err.message}</div>`;
  }
};

const loadPublicDrawerDetails = async (company, requestSeq) => {
  try {
    const r = await fetch(`/api/stock-history?ticker=${encodeURIComponent(company.ticker)}&period=1d`);
    if (!r.ok) throw new Error("Unable to load details");
    const history = await r.json();
    if (state.drawerRequestSeq !== requestSeq) return;

    const metrics = history.metrics || {};
    const currency = history.currency || "USD";
    const prevClose = Number.isFinite(metrics.previousClose) ? metrics.previousClose : metrics.chartPreviousClose;

    const setVal = (id, val) => { const el = document.querySelector(id); if (el) el.textContent = val; };

    setVal("#drawer-prev-close",  fmtCurrency(prevClose, currency));
    setVal("#drawer-open",        fmtCurrency(metrics.regularMarketOpen, currency));
    setVal("#drawer-day-range",
      Number.isFinite(metrics.regularMarketDayLow) && Number.isFinite(metrics.regularMarketDayHigh)
        ? `${fmtCurrency(metrics.regularMarketDayLow, currency)} — ${fmtCurrency(metrics.regularMarketDayHigh, currency)}`
        : "N/A");
    setVal("#drawer-52w-range",
      Number.isFinite(metrics.fiftyTwoWeekLow) && Number.isFinite(metrics.fiftyTwoWeekHigh)
        ? `${fmtCurrency(metrics.fiftyTwoWeekLow, currency)} — ${fmtCurrency(metrics.fiftyTwoWeekHigh, currency)}`
        : "N/A");
    setVal("#drawer-volume",      fmtCompactNumber(metrics.regularMarketVolume));
    setVal("#drawer-avg-volume",  fmtCompactNumber(metrics.averageDailyVolume3Month));
    setVal("#drawer-price-refresh", fmtDateTime(metrics.regularMarketTime));
    setVal("#drawer-exchange",    company.exchange || "N/A");
  } catch { /* details are best-effort */ }
};

const openDrawer = (company, subsegmentName) => {
  state.drawerCurrentCompany = company;
  state.drawerCurrentSubsegmentName = subsegmentName;

  const drawer = document.querySelector("#company-drawer");
  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");

  renderDrawerHeader(company, subsegmentName);
  updateDrawerWatchlistBtn();

  // Hide chart/fundamentals tabs for private companies
  document.querySelectorAll(".drawer-tab[data-tab='chart'], .drawer-tab[data-tab='fundamentals']").forEach((btn) => {
    btn.style.display = company.isPublic ? "" : "none";
  });

  // Reset to overview tab
  state.drawerActiveTab = "overview";
  if (state.drawerChart) { try { state.drawerChart.remove(); } catch { /* ignore */ } state.drawerChart = null; }
  switchDrawerTab("overview", company);
};

const closeDrawer = () => {
  const drawer = document.querySelector("#company-drawer");
  state.drawerRequestSeq += 1;
  if (state.drawerChart) { try { state.drawerChart.remove(); } catch { /* ignore */ } state.drawerChart = null; }
  state.drawerCurrentCompany = null;
  drawer.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
};

// ════════════════════════════════════════════════════════════
// PORTFOLIO MODAL
// ════════════════════════════════════════════════════════════
const renderPortfolioModal = () => {
  const body = document.querySelector("#portfolio-modal-body");
  if (!body) return;

  const holdings = [...state.portfolioHoldings.entries()];
  let totalValue = 0;
  let totalPnl = 0;

  const rows = holdings.map(([name, qty]) => {
    const company = state.companyIndex.find((c) => c.name === name);
    if (!company?.isPublic) {
      return `<tr><td>${name}</td><td>Private</td><td class="mono">${qty}</td><td>N/A</td><td>N/A</td><td>N/A</td>
        <td><button class="portfolio-remove-btn" data-name="${encodeURIComponent(name)}" title="Remove">✕</button></td></tr>`;
    }
    const market = company.market || {};
    const price = market.price || 0;
    const pct = market.changePercent || 0;
    const value = price * qty;
    const pnl = value - (value / (1 + pct / 100));
    totalValue += value;
    totalPnl += pnl;
    const pnlClass = formatChangeClass(pnl);
    return `<tr>
      <td>${company.name}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--accent)">${company.exchange}:${company.ticker}</td>
      <td class="mono">${qty}</td>
      <td class="mono">${fmtCurrency(price)}</td>
      <td class="mono">${fmtCurrency(value)}</td>
      <td class="mono ${pnlClass}">${pnl >= 0 ? "+" : ""}${fmtCurrency(pnl)} (${pct.toFixed(2)}%)</td>
      <td><button class="portfolio-remove-btn" data-name="${encodeURIComponent(name)}" title="Remove">✕</button></td>
    </tr>`;
  });

  const tableHtml = holdings.length === 0
    ? `<div class="portfolio-empty">No holdings yet.<br>Add a company below to start tracking your portfolio.</div>`
    : `<table class="portfolio-table">
        <thead><tr>
          <th>Company</th><th>Ticker</th><th>Qty</th><th>Price</th><th>Value</th><th>1D P&amp;L</th><th></th>
        </tr></thead>
        <tbody>${rows.join("")}</tbody>
       </table>
       <div class="portfolio-summary-row">
         <div class="portfolio-summary-item">
           <div class="psi-label">Total Value</div>
           <div class="psi-value">${fmtCurrency(totalValue)}</div>
         </div>
         <div class="portfolio-summary-item">
           <div class="psi-label">1D P&amp;L</div>
           <div class="psi-value ${formatChangeClass(totalPnl)}">${totalPnl >= 0 ? "+" : ""}${fmtCurrency(totalPnl)}</div>
         </div>
       </div>`;

  body.innerHTML = `
    <div class="portfolio-add-form">
      <input type="text" id="portfolio-company-input" class="portfolio-input portfolio-company-input" placeholder="Company name or ticker…" autocomplete="off" />
      <input type="number" id="portfolio-qty-input" class="portfolio-input portfolio-qty-input" placeholder="Qty" min="1" step="1" />
      <button id="portfolio-add-btn" class="btn btn-accent" type="button">+ Add Holding</button>
    </div>
    ${tableHtml}`;

  // Bind add button
  document.querySelector("#portfolio-add-btn")?.addEventListener("click", () => {
    const nameInput = document.querySelector("#portfolio-company-input");
    const qtyInput  = document.querySelector("#portfolio-qty-input");
    const rawName = String(nameInput?.value || "").trim();
    const qty = parseInt(qtyInput?.value || "0", 10);
    if (!rawName || qty <= 0) return;

    const company = state.companyIndex.find(
      (c) => c.name.toLowerCase() === rawName.toLowerCase() || (c.ticker && c.ticker.toLowerCase() === rawName.toLowerCase())
    );
    if (!company) { alert(`Company "${rawName}" not found in the index. Try the full company name.`); return; }

    state.portfolioHoldings.set(company.name, (state.portfolioHoldings.get(company.name) || 0) + qty);
    persistPortfolio();
    renderSidebarPortfolioSummary();
    renderPortfolioModal();
  });

  // Bind remove buttons
  body.querySelectorAll(".portfolio-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.portfolioHoldings.delete(decodeURIComponent(btn.dataset.name || ""));
      persistPortfolio();
      renderSidebarPortfolioSummary();
      renderPortfolioModal();
    });
  });
};

const openPortfolioModal = () => {
  const modal = document.querySelector("#portfolio-modal");
  if (!modal) return;
  renderPortfolioModal();
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
};

const closePortfolioModal = () => {
  const modal = document.querySelector("#portfolio-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
};

// ════════════════════════════════════════════════════════════
// REFRESH LOG
// ════════════════════════════════════════════════════════════
const renderRefreshLog = async () => {
  const section = document.querySelector("#refresh-log");
  if (!section) return;

  try {
    const r = await fetch("/api/refresh-history");
    if (!r.ok) { section.innerHTML = ""; return; }
    const body = await r.json();
    const added = body.addedCompanies || [];
    const removed = body.removedCompanies || [];

    if (!added.length && !removed.length) { section.innerHTML = ""; return; }

    const fmtEntry = (item, type) => {
      const date = fmtRemovalDate(type === "added" ? (item.addedDate || item.date) : item.removedDate);
      return `<div class="refresh-log-entry">${item.name} <span style="color:var(--text-muted)">${item.subsegmentName || ""} · ${date}</span></div>`;
    };

    section.innerHTML = `<div class="refresh-log">
      <div class="refresh-log-title">Company Updates</div>
      <div class="refresh-log-columns">
        <div>
          <div class="refresh-log-col-label added">Recently Added</div>
          ${added.length ? added.slice(0, 10).map((i) => fmtEntry(i, "added")).join("") : '<div class="refresh-log-empty">None yet.</div>'}
        </div>
        <div>
          <div class="refresh-log-col-label removed">Recently Removed</div>
          ${removed.length ? removed.slice(0, 10).map((i) => fmtEntry(i, "removed")).join("") : '<div class="refresh-log-empty">None yet.</div>'}
        </div>
      </div>
    </div>`;
  } catch { section.innerHTML = ""; }
};

// ════════════════════════════════════════════════════════════
// MAIN RENDER
// ════════════════════════════════════════════════════════════
const render = (payload) => {
  if (!payload) return;
  state.latestPayload = payload;

  const subtitle = document.querySelector("#page-subtitle");
  if (subtitle) {
    const count = payload.segments.reduce((a, s) => a + s.subsegments.reduce((b, ss) => b + (ss.totalCompanies || 0), 0), 0);
    subtitle.textContent = `${count} companies · ${payload.segments.length} segments · Global coverage · Updated ${new Date(payload.asOf).toLocaleString()}`;
  }

  renderStatsBar(payload);
  renderHeaderBadges(payload);
  renderSidebarStageNav(payload);
  renderSidebarWatchlist();
  renderSidebarPortfolioSummary();
  renderLeaderboard(payload);
  renderSegmentTabs(payload.segments);
  renderMap(payload);
  renderComparisonPanel();
};

// ════════════════════════════════════════════════════════════
// BIND FILTERS
// ════════════════════════════════════════════════════════════
const bindFilters = () => {
  const listingSelect = document.querySelector("#filter-listing");
  if (listingSelect) listingSelect.onchange = () => { state.filters.listing = listingSelect.value; if (state.latestPayload) render(state.latestPayload); };

  const regionSelect = document.querySelector("#filter-region");
  if (regionSelect) regionSelect.onchange = () => { state.filters.region = regionSelect.value; if (state.latestPayload) render(state.latestPayload); };

  const mincapSelect = document.querySelector("#filter-mincap");
  if (mincapSelect) mincapSelect.onchange = () => { state.filters.minMarketCapBn = Number(mincapSelect.value); if (state.latestPayload) render(state.latestPayload); };

  const searchInput = document.querySelector("#filter-search");
  if (searchInput) {
    searchInput.oninput = () => {
      state.filters.search = searchInput.value;
      renderSearchDropdown();
      renderSearchPerformance();
      if (state.latestPayload) render(state.latestPayload);
    };
    searchInput.onkeydown = handleSearchKeydown;
    searchInput.addEventListener("blur", () => {
      setTimeout(() => {
        const dd = document.querySelector("#search-dropdown");
        if (dd) dd.hidden = true;
      }, 200);
    });
  }
};

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
const init = async () => {
  loadPersistedState();
  applyTheme();
  applyLayout();
  applySidebarCollapse();
  bindFilters();

  // Sidebar toggle
  document.querySelector("#sidebar-toggle")?.addEventListener("click", () => {
    if (state.layout === "v1") {
      return;
    }
    const isMobile = window.innerWidth <= 900;
    if (isMobile) {
      document.querySelector("#sidebar")?.classList.toggle("mobile-open");
    } else {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      applySidebarCollapse();
      persistSidebar();
    }
  });

  // Theme toggle
  document.querySelector("#theme-toggle")?.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
    localStorage.setItem("v2-theme-user-set", "true");
    persistTheme();
    // Recreate chart if open with new theme colors
    if (state.drawerCurrentCompany?.isPublic && state.drawerActiveTab === "chart") {
      const container = document.querySelector("#drawer-chart-container");
      if (container && state.drawerChart) {
        const activeperiod = document.querySelector(".period-btn.active")?.dataset.period || "3m";
        if (state.drawerChart) { try { state.drawerChart.remove(); } catch { /* ignore */ } state.drawerChart = null; }
        loadAndRenderChart(state.drawerCurrentCompany, activeperiod, container);
      }
    }
  });

  // Layout toggle
  document.querySelector("#layout-toggle")?.addEventListener("click", () => {
    state.layout = state.layout === "v2" ? "v1" : "v2";
    applyLayout();
    persistLayout();
    if (state.latestPayload) {
      render(state.latestPayload);
    }
  });

  // Drawer close
  document.querySelector("#drawer-close")?.addEventListener("click", closeDrawer);
  document.querySelector("#drawer-backdrop")?.addEventListener("click", closeDrawer);

  // Drawer watchlist button
  document.querySelector("#drawer-watchlist-btn")?.addEventListener("click", () => {
    if (state.drawerCurrentCompany) toggleWatchlist(state.drawerCurrentCompany.name);
  });

  // Drawer tabs
  document.querySelectorAll(".drawer-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.drawerCurrentCompany) switchDrawerTab(btn.dataset.tab, state.drawerCurrentCompany);
    });
  });

  // Portfolio modal
  document.querySelector("#portfolio-manage-btn")?.addEventListener("click", openPortfolioModal);
  document.querySelector("#portfolio-modal-close")?.addEventListener("click", closePortfolioModal);
  document.querySelector("#portfolio-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "portfolio-modal") closePortfolioModal();
  });

  // Export all button
  document.querySelector("#export-all-btn")?.addEventListener("click", () => {
    window.location.href = "/api/export?format=csv&view=all";
  });

  // Initial data fetch
  try {
    const r = await fetch("/api/value-chain");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const payload = await r.json();
    render(payload);
    await renderRefreshLog();
  } catch (err) {
    const map = document.querySelector("#map");
    if (map) map.innerHTML = `<div style="padding:2rem;color:var(--loss)">Failed to load dashboard data: ${err.message}</div>`;
    return;
  }

  await loadCompanyIndex();
  renderSidebarWatchlist();
  renderSidebarPortfolioSummary();

  // Auto-refresh every 60s
  setInterval(async () => {
    if (state.refreshInFlight || document.hidden) {
      return;
    }
    state.refreshInFlight = true;
    try {
      const r = await fetch("/api/value-chain");
      if (!r.ok) return;
      const payload = await r.json();
      render(payload);
      await loadCompanyIndex();
      renderSidebarWatchlist();
      renderSidebarPortfolioSummary();
      if (state.drawerCurrentCompany) renderDrawerHeader(state.drawerCurrentCompany, state.drawerCurrentSubsegmentName);
      await renderRefreshLog();
    } catch { /* keep existing data on refresh failure */ }
    finally {
      state.refreshInFlight = false;
    }
  }, 60_000);
};

document.addEventListener("DOMContentLoaded", init);
