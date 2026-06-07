const state = {
  expandedSubsegments: new Set(),
  fullSubsegmentData: new Map(),
  latestPayload: null,
  companyIndex: [],
  drawerRequestSeq: 0,
  filters: {
    stage: "all",
    listing: "all",
    region: "all",
    search: ""
  },
  refreshInFlight: false
};

const EXCHANGE_REGION = {
  NASDAQ: "north-america",
  NYSE: "north-america",
  AMEX: "north-america",
  TSX: "north-america",
  TSE: "asia",
  SSE: "asia",
  SZSE: "asia",
  HKEX: "asia",
  KRX: "asia",
  TWSE: "asia",
  TWO: "asia",
  XETRA: "europe",
  Euronext: "europe",
  SIX: "europe",
  LSE: "europe",
  MOEX: "europe"
};

const fmtNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
};

const fmtCompactNumber = (value) => {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value);
};

const fmtCurrency = (value, currency = "USD") => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
};

const fmtDisplayPrice = (market = {}) => {
  const currency = String(market.currency || "USD").toUpperCase();
  const main = fmtCurrency(market.price, currency);
  if (currency === "USD") {
    return main;
  }
  if (!Number.isFinite(market.usdPrice)) {
    return main;
  }
  return `${main} (${fmtCurrency(market.usdPrice, "USD")})`;
};

const fmtMarketCap = (value) => {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  const bn = value / 1_000_000_000;
  return `${fmtNumber(bn)}B`;
};

const fmtDateTime = (value) => {
  if (!value) {
    return "N/A";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }
  return date.toLocaleString();
};

const fmtRemovalDate = (isoDate) => {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  } catch {
    return "N/A";
  }
};

const formatChangeClass = (pct) => {
  if (!Number.isFinite(pct)) {
    return "flat";
  }
  if (pct > 0) {
    return "up";
  }
  if (pct < 0) {
    return "down";
  }
  return "flat";
};

const stateClass = (freshness) => {
  const key = (freshness || "stale").toLowerCase();
  if (key.includes("live")) return "state-live";
  if (key.includes("delayed")) return "state-delayed";
  if (key.includes("cached")) return "state-cached";
  if (key.includes("snapshot")) return "state-snapshot";
  return "state-stale";
};

const getRegion = (company) => {
  if (!company.isPublic) {
    return "other";
  }
  return EXCHANGE_REGION[company.exchange] || "other";
};

const passesCompanyFilters = (company) => {
  const searchQuery = String(state.filters.search || "").trim().toLowerCase();
  if (searchQuery) {
    const haystack = `${String(company.name || "")} ${String(company.ticker || "")}`.toLowerCase();
    if (!haystack.includes(searchQuery)) {
      return false;
    }
  }

  const listingOk = state.filters.listing === "all"
    || (state.filters.listing === "public" && company.isPublic)
    || (state.filters.listing === "private" && !company.isPublic);
  if (!listingOk) {
    return false;
  }

  if (state.filters.region === "all") {
    return true;
  }

  return getRegion(company) === state.filters.region;
};

const rowHtml = (company, subsegmentId) => {
  const header = `
    <div>
      <div class="company-name">${company.name}</div>
      <div class="company-meta">
        ${company.isPublic ? `${company.exchange}:${company.ticker}` : "Private"}
      </div>
    </div>
  `;

  if (company.isPublic) {
    const market = company.market || {};
    const pct = Number.isFinite(market.changePercent) ? `${market.changePercent.toFixed(2)}%` : "N/A";
    return `
      <div class="company-row" data-subsegment-id="${subsegmentId}" data-company-name="${encodeURIComponent(company.name)}">
        <div class="rank">#${company.rank}</div>
        ${header}
        <div class="value-block">
          <div class="price">${fmtDisplayPrice(market)}</div>
          <div class="change ${formatChangeClass(market.changePercent)}">${pct}
            <span class="state-pill ${stateClass(market.freshness)}">${market.freshness || "Stale"}</span>
          </div>
          <div class="company-meta">MCap ${fmtMarketCap(market.marketCap)} | P/E ${fmtNumber(market.peRatio)}</div>
        </div>
      </div>
    `;
  }

  const valuation = company.valuation || {};
  return `
    <div class="company-row" data-subsegment-id="${subsegmentId}" data-company-name="${encodeURIComponent(company.name)}">
      <div class="rank">#${company.rank}</div>
      ${header}
      <div class="value-block">
        <div class="price">Valuation ${fmtCurrency((valuation.latestValuationUsdBn || 0) * 1_000_000_000, "USD")}</div>
        <div class="company-meta">
          As of ${valuation.valuationDate || "N/A"}
          <span class="state-pill ${stateClass(valuation.freshness)}">${valuation.freshness || "Snapshot"}</span>
        </div>
      </div>
    </div>
  `;
};

const buildCompanyIndex = (companies) => {
  const seen = new Set();
  const index = [];
  companies.forEach((company) => {
    const name = String(company.name || "").trim();
    if (!name) {
      return;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    index.push(company);
  });
  index.sort((a, b) => a.name.localeCompare(b.name));
  return index;
};

const loadCompanyIndex = async () => {
  try {
    const response = await fetch("/api/companies");
    if (!response.ok) {
      return;
    }
    const body = await response.json();
    state.companyIndex = buildCompanyIndex(body.companies || []);
  } catch {
    // Index is a best-effort enhancement; ignore failures.
  }
};

const getSearchMatches = () => {
  const query = String(state.filters.search || "").trim().toLowerCase();
  if (query.length === 0) {
    return [];
  }
  return state.companyIndex
    .filter((company) => {
      const name = String(company.name || "").toLowerCase();
      const ticker = String(company.ticker || "").toLowerCase();
      return name.includes(query) || ticker.includes(query);
    })
    .slice(0, 12);
};

let dropdownSelectedIndex = -1;

const renderSearchDropdown = () => {
  const dropdown = document.querySelector("#search-dropdown");
  if (!dropdown) {
    return;
  }
  const matches = getSearchMatches();
  dropdownSelectedIndex = -1;

  if (matches.length === 0) {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
    return;
  }

  dropdown.innerHTML = matches
    .map((company, index) => {
      const meta = company.isPublic && company.ticker
        ? `${company.exchange}:${company.ticker}`
        : "Private";
      return `
        <div class="search-dropdown-item" data-index="${index}">
          <div class="search-dropdown-item-name">${company.name}</div>
          <div class="search-dropdown-item-meta">${meta}</div>
        </div>
      `;
    })
    .join("");

  dropdown.hidden = false;

  dropdown.querySelectorAll(".search-dropdown-item").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.getAttribute("data-index"), 10);
      const company = matches[idx];
      if (company) {
        document.querySelector("#filter-search").value = company.name;
        state.filters.search = company.name;
        renderSearchDropdown();
        renderSearchPerformance();
        render(state.latestPayload);
      }
    });
  });
};

const updateDropdownSelection = (newIndex) => {
  const dropdown = document.querySelector("#search-dropdown");
  const matches = getSearchMatches();

  if (newIndex < -1 || newIndex >= matches.length) {
    return;
  }

  dropdown.querySelectorAll(".search-dropdown-item").forEach((item, idx) => {
    if (idx === newIndex) {
      item.classList.add("selected");
      item.scrollIntoView({ block: "nearest" });
    } else {
      item.classList.remove("selected");
    }
  });

  dropdownSelectedIndex = newIndex;
};

const handleSearchKeydown = (event) => {
  const dropdown = document.querySelector("#search-dropdown");
  const matches = getSearchMatches();

  if (event.key === "ArrowDown") {
    event.preventDefault();
    updateDropdownSelection(dropdownSelectedIndex + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    updateDropdownSelection(dropdownSelectedIndex - 1);
  } else if (event.key === "Enter") {
    if (dropdownSelectedIndex >= 0 && dropdownSelectedIndex < matches.length) {
      event.preventDefault();
      const company = matches[dropdownSelectedIndex];
      document.querySelector("#filter-search").value = company.name;
      state.filters.search = company.name;
      renderSearchDropdown();
      renderSearchPerformance();
      render(state.latestPayload);
    }
  } else if (event.key === "Escape") {
    dropdown.hidden = true;
  }
};

const renderSearchPerformance = () => {
  const panel = document.querySelector("#search-performance");
  if (!panel) {
    return;
  }
  const trimmed = String(state.filters.search || "").trim().toLowerCase();
  if (!trimmed) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  const exact = state.companyIndex.find(
    (company) => String(company.name || "").toLowerCase() === trimmed
      || String(company.ticker || "").toLowerCase() === trimmed
  );
  const company = exact || null;

  if (!company) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  if (company.isPublic) {
    const market = company.market || {};
    const pct = Number.isFinite(market.changePercent) ? `${market.changePercent.toFixed(2)}%` : "N/A";
    panel.innerHTML = `
      <span class="sp-name">${company.name} <span class="sp-meta">${company.exchange}:${company.ticker}</span></span>
      <div class="sp-row">
        <span class="sp-price">${fmtDisplayPrice(market)}</span>
        <span class="change ${formatChangeClass(market.changePercent)}">${pct}</span>
      </div>
      <span class="sp-meta">MCap ${fmtMarketCap(market.marketCap)} | P/E ${fmtNumber(market.peRatio)} | ${market.freshness || "Stale"}</span>
    `;
  } else {
    const valuation = company.valuation || {};
    panel.innerHTML = `
      <span class="sp-name">${company.name} <span class="sp-meta">Private</span></span>
      <div class="sp-row">
        <span class="sp-price">${fmtCurrency((valuation.latestValuationUsdBn || 0) * 1_000_000_000, "USD")}</span>
      </div>
      <span class="sp-meta">As of ${valuation.valuationDate || "N/A"} | ${valuation.freshness || "Snapshot"}</span>
    `;
  }
  panel.hidden = false;
  panel.style.cursor = "pointer";
  panel.title = "Click to view detailed stock performance";
  panel.onclick = () => openDrawer(company, company.subsegmentName || "");
};

const renderMeta = (asOf) => {
  const meta = document.querySelector("#meta");
  meta.innerHTML = `
    <strong>Coverage:</strong> Global public + private AI value chain companies
    <span>|</span>
    <strong>Updated:</strong> ${new Date(asOf).toLocaleString()}
    <span>|</span>
    <strong>Mode:</strong> Free-tier best effort real-time
  `;
};

const renderLeaderboard = (payload) => {
  const leaderboard = document.querySelector("#leaderboard");
  const allSubsegments = payload.segments.flatMap((segment) =>
    segment.subsegments.map((subsegment) => ({
      segmentName: segment.name,
      subsegmentName: subsegment.name,
      valuationIndex: subsegment.valuationIndex || {}
    }))
  );

  const withChange = allSubsegments.filter((item) => Number.isFinite(item.valuationIndex.valuationChangePercent));
  if (withChange.length === 0) {
    leaderboard.innerHTML = "";
    return;
  }

  const sorted = [...withChange].sort(
    (a, b) => Number(b.valuationIndex.valuationChangePercent) - Number(a.valuationIndex.valuationChangePercent)
  );

  const topGainers = sorted.slice(0, 5);
  const topDecliners = sorted.slice(-5).reverse();

  const cards = [
    ...topGainers.map((item, index) => ({
      title: `Top Gainer #${index + 1}`,
      item,
      metric: `${item.valuationIndex.valuationChangePercent.toFixed(2)}%`
    })),
    ...topDecliners.map((item, index) => ({
      title: `Top Decliner #${index + 1}`,
      item,
      metric: `${item.valuationIndex.valuationChangePercent.toFixed(2)}%`
    }))
  ];

  leaderboard.innerHTML = cards
    .map((card) => {
      const changeClass = formatChangeClass(card.item.valuationIndex.valuationChangePercent);
      return `
        <article class="leader-card">
          <p class="leader-title">${card.title}</p>
          <p class="leader-subsegment">${card.item.subsegmentName}</p>
          <p class="leader-metric change ${changeClass}">${card.metric}</p>
          <p class="company-meta">${card.item.segmentName}</p>
        </article>
      `;
    })
    .join("");
};

const renderValuationIndex = (valuationIndex) => {
  if (!valuationIndex) {
    return "Valuation index unavailable";
  }

  const changeClass = formatChangeClass(valuationIndex.valuationChangePercent);
  const changeLabel = Number.isFinite(valuationIndex.valuationChangePercent)
    ? `${valuationIndex.valuationChangePercent.toFixed(2)}%`
    : "N/A";

  return `
    <strong>Public Valuation Index:</strong> ${fmtMarketCap(valuationIndex.totalPublicValuation)}
    <span class="change ${changeClass}">(${changeLabel})</span>
    <span>|</span>
    <strong>Delta:</strong> ${fmtMarketCap(valuationIndex.valuationChange)}
    <span>|</span>
    <strong>Tracked:</strong> ${valuationIndex.trackedPublicCompanies}/${valuationIndex.totalPublicCompanies}
  `;
};

const DRAWER_PERIODS = [
  { value: "1d", label: "1D" },
  { value: "1w", label: "1 Week" },
  { value: "1m", label: "1 Month" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "2y", label: "2 Years" },
  { value: "3y", label: "3 Years" },
  { value: "5y", label: "5 Years" }
];

const formatAxisDateLabel = (iso, period) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (period === "1d") {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (period === "1w" || period === "1m" || period === "3m" || period === "6m") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
};

const buildAxisLabels = (history) => {
  const points = Array.isArray(history?.points) ? history.points : [];
  if (points.length === 0) {
    return [];
  }

  const candidateIndexes = [
    0,
    Math.floor((points.length - 1) * (1 / 3)),
    Math.floor((points.length - 1) * (2 / 3)),
    points.length - 1
  ];

  const unique = [...new Set(candidateIndexes)]
    .filter((idx) => idx >= 0 && idx < points.length)
    .sort((a, b) => a - b);

  return unique.map((idx) => formatAxisDateLabel(points[idx].time, history.period));
};

const buildChartPath = (points, width, height, padding) => {
  if (!Array.isArray(points) || points.length < 2) {
    return "";
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 1e-9);
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  return points
    .map((value, index) => {
      const x = padding + (index / (points.length - 1)) * plotWidth;
      const y = padding + (1 - (value - min) / span) * plotHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

const renderPriceChart = (container, history) => {
  if (!container) {
    return;
  }

  const points = (history?.points || []).map((p) => Number(p.close)).filter(Number.isFinite);
  if (points.length < 2) {
    container.innerHTML = '<div class="drawer-chart-empty">No chart data for this period.</div>';
    return;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const delta = last - first;
  const deltaPct = first > 0 ? (delta / first) * 100 : null;
  const width = 420;
  const height = 200;
  const padding = 12;
  const path = buildChartPath(points, width, height, padding);
  const lineClass = formatChangeClass(deltaPct);
  const axisLabels = buildAxisLabels(history);

  container.innerHTML = `
    <div class="drawer-chart-summary">
      <span class="drawer-chart-price">${fmtCurrency(last, history.currency || "USD")}</span>
      <span class="change ${lineClass}">${Number.isFinite(deltaPct) ? `${deltaPct.toFixed(2)}%` : "N/A"}</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" class="drawer-chart-svg" aria-label="Stock price history chart">
      <path d="${path}" class="drawer-chart-line ${lineClass}"></path>
    </svg>
    <div class="drawer-chart-axis">
      ${axisLabels.map((label) => `<span>${label}</span>`).join("")}
    </div>
  `;
};

const updateDrawerMetric = (id, value) => {
  const el = document.querySelector(id);
  if (el) {
    el.textContent = value;
  }
};

const loadPublicDrawerDetails = async (company, period, requestSeq) => {
  const chartWrap = document.querySelector("#drawer-chart-wrap");
  if (chartWrap) {
    chartWrap.innerHTML = '<div class="drawer-chart-empty">Loading chart...</div>';
  }

  try {
    const response = await fetch(`/api/stock-history?ticker=${encodeURIComponent(company.ticker)}&period=${encodeURIComponent(period)}`);
    if (!response.ok) {
      throw new Error("Unable to load price history");
    }
    const history = await response.json();
    if (state.drawerRequestSeq !== requestSeq) {
      return;
    }

    renderPriceChart(chartWrap, history);

    const metrics = history.metrics || {};
    const currency = history.currency || "USD";
    const previousClose = Number.isFinite(metrics.previousClose) ? metrics.previousClose : metrics.chartPreviousClose;

    updateDrawerMetric("#drawer-prev-close", fmtCurrency(previousClose, currency));
    updateDrawerMetric("#drawer-open", fmtCurrency(metrics.regularMarketOpen, currency));
    updateDrawerMetric(
      "#drawer-day-range",
      Number.isFinite(metrics.regularMarketDayLow) && Number.isFinite(metrics.regularMarketDayHigh)
        ? `${fmtCurrency(metrics.regularMarketDayLow, currency)} - ${fmtCurrency(metrics.regularMarketDayHigh, currency)}`
        : "N/A"
    );
    updateDrawerMetric(
      "#drawer-52w-range",
      Number.isFinite(metrics.fiftyTwoWeekLow) && Number.isFinite(metrics.fiftyTwoWeekHigh)
        ? `${fmtCurrency(metrics.fiftyTwoWeekLow, currency)} - ${fmtCurrency(metrics.fiftyTwoWeekHigh, currency)}`
        : "N/A"
    );
    updateDrawerMetric("#drawer-volume", fmtCompactNumber(metrics.regularMarketVolume));
    updateDrawerMetric("#drawer-avg-volume", fmtCompactNumber(metrics.averageDailyVolume3Month));
    updateDrawerMetric("#drawer-price-refresh", fmtDateTime(metrics.regularMarketTime));
  } catch (error) {
    if (state.drawerRequestSeq !== requestSeq) {
      return;
    }
    if (chartWrap) {
      chartWrap.innerHTML = `<div class="drawer-chart-empty">${error.message}</div>`;
    }
  }
};

const openDrawer = (company, subsegmentName) => {
  const drawer = document.querySelector("#company-drawer");
  const content = document.querySelector("#drawer-content");

  if (company.isPublic) {
    const market = company.market || {};
    const currentCap = Number(market.marketCap);
    const pct = Number(market.changePercent);
    const prevCap = Number.isFinite(currentCap) && Number.isFinite(pct) && 1 + pct / 100 > 0
      ? currentCap / (1 + pct / 100)
      : null;

    const requestSeq = state.drawerRequestSeq + 1;
    state.drawerRequestSeq = requestSeq;

    content.innerHTML = `
      <h2 class="drawer-title">${company.name}</h2>
      <p class="drawer-meta">${subsegmentName} | Public (${company.exchange}:${company.ticker})</p>
      <section class="drawer-section">
        <div class="drawer-kv"><span>Price</span><strong>${fmtDisplayPrice(market)}</strong></div>
        <div class="drawer-kv"><span>1D Change</span><strong class="change ${formatChangeClass(market.changePercent)}">${Number.isFinite(market.changePercent) ? `${market.changePercent.toFixed(2)}%` : "N/A"}</strong></div>
        <div class="drawer-kv"><span>Market Cap</span><strong>${fmtMarketCap(market.marketCap)}</strong></div>
        <div class="drawer-kv"><span>P/E</span><strong>${fmtNumber(market.peRatio)}</strong></div>
        <div class="drawer-kv"><span>P/S</span><strong>${fmtNumber(market.psRatio)}</strong></div>
        <div class="drawer-kv"><span>Prev Close</span><strong id="drawer-prev-close">N/A</strong></div>
        <div class="drawer-kv"><span>Open</span><strong id="drawer-open">N/A</strong></div>
        <div class="drawer-kv"><span>Day Range</span><strong id="drawer-day-range">N/A</strong></div>
        <div class="drawer-kv"><span>52W Range</span><strong id="drawer-52w-range">N/A</strong></div>
        <div class="drawer-kv"><span>Volume</span><strong id="drawer-volume">N/A</strong></div>
        <div class="drawer-kv"><span>3M Avg Volume</span><strong id="drawer-avg-volume">N/A</strong></div>
        <div class="drawer-kv"><span>Price Refresh</span><strong id="drawer-price-refresh">${fmtDateTime(market.regularMarketTime)}</strong></div>
      </section>
      <section class="drawer-section">
        <div class="drawer-chart-head">
          <strong>Price Movement</strong>
          <select id="drawer-period-select" class="drawer-period-select">
            ${DRAWER_PERIODS.map((item) => `<option value="${item.value}" ${item.value === "3m" ? "selected" : ""}>${item.label}</option>`).join("")}
          </select>
        </div>
        <div id="drawer-chart-wrap" class="drawer-chart-wrap"></div>
      </section>
      <section class="drawer-section">
        <strong>Valuation History</strong>
        <div class="history-item">Current session: ${fmtMarketCap(currentCap)}</div>
        <div class="history-item">Estimated prior close: ${fmtMarketCap(prevCap)}</div>
      </section>
      <section class="drawer-section">
        <p class="drawer-meta">${company.notes || ""}</p>
      </section>
    `;

    const periodSelect = document.querySelector("#drawer-period-select");
    if (periodSelect) {
      periodSelect.addEventListener("change", () => {
        const nextPeriod = String(periodSelect.value || "3m");
        const nextSeq = state.drawerRequestSeq + 1;
        state.drawerRequestSeq = nextSeq;
        loadPublicDrawerDetails(company, nextPeriod, nextSeq);
      });
    }

    loadPublicDrawerDetails(company, "3m", requestSeq);
  } else {
    const valuation = company.valuation || {};
    content.innerHTML = `
      <h2 class="drawer-title">${company.name}</h2>
      <p class="drawer-meta">${subsegmentName} | Private</p>
      <section class="drawer-section">
        <div class="drawer-kv"><span>Latest Valuation</span><strong>${fmtCurrency((valuation.latestValuationUsdBn || 0) * 1_000_000_000, "USD")}</strong></div>
        <div class="drawer-kv"><span>As Of</span><strong>${valuation.valuationDate || "N/A"}</strong></div>
        <div class="drawer-kv"><span>Snapshot Refresh</span><strong>${valuation.freshness || "Snapshot"}</strong></div>
      </section>
      <section class="drawer-section">
        <strong>Valuation History</strong>
        <div class="history-item">Latest snapshot: ${fmtCurrency((valuation.latestValuationUsdBn || 0) * 1_000_000_000, "USD")} (${valuation.valuationDate || "N/A"})</div>
        <div class="history-item">No prior snapshots available in current dataset.</div>
      </section>
      <section class="drawer-section">
        <p class="drawer-meta">${company.notes || ""}</p>
      </section>
    `;
  }

  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
};

const closeDrawer = () => {
  const drawer = document.querySelector("#company-drawer");
  state.drawerRequestSeq += 1;
  drawer.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
};

const bindCompanyRowClicks = (container, companies, subsegment) => {
  container.querySelectorAll(".company-row").forEach((row) => {
    row.addEventListener("click", () => {
      const encodedName = row.getAttribute("data-company-name") || "";
      const companyName = decodeURIComponent(encodedName);
      const company = companies.find((item) => item.name === companyName);
      if (company) {
        openDrawer(company, subsegment.name);
      }
    });
  });
};

const setCompanyRows = (companiesContainer, companies, subsegment) => {
  const filteredCompanies = companies.filter(passesCompanyFilters);

  if (filteredCompanies.length === 0) {
    companiesContainer.innerHTML = '<div class="no-companies">No companies match current filters.</div>';
    return;
  }

  companiesContainer.innerHTML = filteredCompanies.map((company) => rowHtml(company, subsegment.id)).join("");
  bindCompanyRowClicks(companiesContainer, filteredCompanies, subsegment);
};

const attachToggleHandler = (button, subsegment, companiesContainer) => {
  const setButton = (expanded) => {
    const hidden = Math.max(subsegment.totalCompanies - 5, 0);
    button.textContent = expanded ? "Collapse additional companies" : `Show ${hidden} more companies`;
  };

  setButton(state.expandedSubsegments.has(subsegment.id));

  button.addEventListener("click", async () => {
    const isExpanded = state.expandedSubsegments.has(subsegment.id);
    if (isExpanded) {
      state.expandedSubsegments.delete(subsegment.id);
      const topFive = subsegment.topCompanies.slice(0, 5);
      setCompanyRows(companiesContainer, topFive, subsegment);
      setButton(false);
      return;
    }

    if (!state.fullSubsegmentData.has(subsegment.id)) {
      const response = await fetch(`/api/subsegments/${subsegment.id}/companies`);
      const body = await response.json();
      state.fullSubsegmentData.set(subsegment.id, body.companies || []);
    }

    state.expandedSubsegments.add(subsegment.id);
    const allCompanies = state.fullSubsegmentData.get(subsegment.id) || [];
    setCompanyRows(companiesContainer, allCompanies, subsegment);
    setButton(true);
  });
};

const renderFilters = (segments) => {
  const stageSelect = document.querySelector("#filter-stage");
  const uniqueStages = [...new Set(segments.map((segment) => segment.stage))];

  stageSelect.innerHTML = '<option value="all">All</option>';
  uniqueStages.forEach((stage) => {
    const option = document.createElement("option");
    option.value = stage;
    option.textContent = stage;
    if (state.filters.stage === stage) {
      option.selected = true;
    }
    stageSelect.appendChild(option);
  });

  stageSelect.onchange = () => {
    state.filters.stage = stageSelect.value;
    render(state.latestPayload);
  };

  const listingSelect = document.querySelector("#filter-listing");
  listingSelect.value = state.filters.listing;
  listingSelect.onchange = () => {
    state.filters.listing = listingSelect.value;
    render(state.latestPayload);
  };

  const regionSelect = document.querySelector("#filter-region");
  regionSelect.value = state.filters.region;
  regionSelect.onchange = () => {
    state.filters.region = regionSelect.value;
    render(state.latestPayload);
  };

  const searchInput = document.querySelector("#filter-search");
  searchInput.value = state.filters.search;
  searchInput.oninput = () => {
    state.filters.search = searchInput.value;
    renderSearchDropdown();
    renderSearchPerformance();
    render(state.latestPayload);
  };
  searchInput.onkeydown = handleSearchKeydown;
  searchInput.addEventListener("blur", () => {
    const dropdown = document.querySelector("#search-dropdown");
    setTimeout(() => {
      dropdown.hidden = true;
    }, 200);
  });
};

const render = (payload) => {
  state.latestPayload = payload;
  renderMeta(payload.asOf);
  renderLeaderboard(payload);
  renderFilters(payload.segments);
  renderRefreshLog();

  const map = document.querySelector("#map");
  map.innerHTML = "";

  const segmentTemplate = document.querySelector("#segment-template");
  const subTemplate = document.querySelector("#subsegment-template");

  const segments = state.filters.stage === "all"
    ? payload.segments
    : payload.segments.filter((segment) => segment.stage === state.filters.stage);

  segments.forEach((segment) => {
    const segmentNode = segmentTemplate.content.cloneNode(true);
    segmentNode.querySelector(".stage").textContent = segment.stage;
    segmentNode.querySelector("h2").textContent = segment.name;
    segmentNode.querySelector(".summary").textContent = segment.summary;

    const subsegmentsWrap = segmentNode.querySelector(".subsegments");

    segment.subsegments.forEach((subsegment) => {
      const subNode = subTemplate.content.cloneNode(true);
      subNode.querySelector("h3").textContent = `${subsegment.name} (${subsegment.totalCompanies})`;
      subNode.querySelector(".subsegment-description").textContent = subsegment.description;
      subNode.querySelector(".subsegment-index").innerHTML = renderValuationIndex(subsegment.valuationIndex);

      const jsonLink = subNode.querySelector(".export-json");
      const csvLink = subNode.querySelector(".export-csv");
      jsonLink.href = `/api/subsegments/${subsegment.id}/export?format=json&view=top5`;
      csvLink.href = `/api/subsegments/${subsegment.id}/export?format=csv&view=all`;

      const companiesContainer = subNode.querySelector(".companies");
      const button = subNode.querySelector(".expand-btn");

      const isExpanded = state.expandedSubsegments.has(subsegment.id);
      const initialCompanies = isExpanded
        ? state.fullSubsegmentData.get(subsegment.id) || subsegment.topCompanies
        : subsegment.topCompanies;

      setCompanyRows(companiesContainer, initialCompanies, subsegment);
      attachToggleHandler(button, subsegment, companiesContainer);

      subsegmentsWrap.appendChild(subNode);
    });

    map.appendChild(segmentNode);
  });
};

const renderRefreshLog = async () => {
  const addedSection = document.querySelector("#refresh-log-added");
  const removedSection = document.querySelector("#refresh-log-removed");
  if (!addedSection || !removedSection) {
    return;
  }

  try {
    const response = await fetch("/api/refresh-history");
    if (!response.ok) {
      addedSection.innerHTML = '<div class="refresh-log-empty">Unable to load history.</div>';
      removedSection.innerHTML = '<div class="refresh-log-empty">Unable to load history.</div>';
      return;
    }

    const body = await response.json();
    const added = body.addedCompanies || [];
    const removed = body.removedCompanies || [];

    if (added.length === 0) {
      addedSection.innerHTML = '<div class="refresh-log-empty">No companies added yet.</div>';
    } else {
      addedSection.innerHTML = added
        .slice(0, 10)
        .map(
          (item) => `
        <div class="refresh-log-item">
          <div class="refresh-log-item-name">${item.name}</div>
          <div class="refresh-log-item-subsegment">${item.subsegmentName || "N/A"}</div>
          <div class="refresh-log-item-date">${fmtRemovalDate(item.addedDate || item.date)}</div>
        </div>
      `
        )
        .join("");
    }

    if (removed.length === 0) {
      removedSection.innerHTML = '<div class="refresh-log-empty">No companies removed yet.</div>';
    } else {
      removedSection.innerHTML = removed
        .slice(0, 10)
        .map(
          (item) => `
        <div class="refresh-log-item">
          <div class="refresh-log-item-name">${item.name}</div>
          <div class="refresh-log-item-subsegment">${item.subsegmentName || "N/A"}</div>
          <div class="refresh-log-item-date">${fmtRemovalDate(item.removedDate)}</div>
        </div>
      `
        )
        .join("");
    }
  } catch (error) {
    console.error("Failed to render refresh log:", error);
    addedSection.innerHTML = '<div class="refresh-log-empty">Error loading history.</div>';
    removedSection.innerHTML = '<div class="refresh-log-empty">Error loading history.</div>';
  }
};

const load = async () => {
  const response = await fetch("/api/value-chain");
  if (!response.ok) {
    throw new Error("Failed to fetch value chain data");
  }
  const body = await response.json();
  render(body);
};

const boot = async () => {
  document.querySelector("#drawer-close").addEventListener("click", closeDrawer);
  document.querySelector("#company-drawer").addEventListener("click", (event) => {
    if (event.target.id === "company-drawer") {
      closeDrawer();
    }
  });

  try {
    await load();
  } catch (error) {
    const map = document.querySelector("#map");
    map.innerHTML = `<p>Failed to load dashboard data: ${error.message}</p>`;
    return;
  }

  await loadCompanyIndex();

  setInterval(async () => {
    if (state.refreshInFlight || document.hidden) {
      return;
    }
    state.refreshInFlight = true;
    try {
      await load();
      await loadCompanyIndex();
      renderSearchDropdown();
      renderSearchPerformance();
      await renderRefreshLog();
    } catch {
      // Keep existing data visible when refresh fails.
    }
    finally {
      state.refreshInFlight = false;
    }
  }, 60_000);
};

boot();
