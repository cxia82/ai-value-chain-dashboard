const state = {
  expandedSubsegments: new Set(),
  fullSubsegmentData: new Map(),
  latestPayload: null,
  filters: {
    stage: "all",
    listing: "all",
    region: "all",
    search: ""
  }
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

  const topGainer = sorted[0];
  const topDecliner = sorted[sorted.length - 1];

  const cards = [
    {
      title: "Top Gainer",
      item: topGainer,
      metric: `${topGainer.valuationIndex.valuationChangePercent.toFixed(2)}%`
    },
    {
      title: "Top Decliner",
      item: topDecliner,
      metric: `${topDecliner.valuationIndex.valuationChangePercent.toFixed(2)}%`
    }
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

    content.innerHTML = `
      <h2 class="drawer-title">${company.name}</h2>
      <p class="drawer-meta">${subsegmentName} | Public (${company.exchange}:${company.ticker})</p>
      <section class="drawer-section">
        <div class="drawer-kv"><span>Price</span><strong>${fmtDisplayPrice(market)}</strong></div>
        <div class="drawer-kv"><span>1D Change</span><strong class="change ${formatChangeClass(market.changePercent)}">${Number.isFinite(market.changePercent) ? `${market.changePercent.toFixed(2)}%` : "N/A"}</strong></div>
        <div class="drawer-kv"><span>Market Cap</span><strong>${fmtMarketCap(market.marketCap)}</strong></div>
        <div class="drawer-kv"><span>P/E</span><strong>${fmtNumber(market.peRatio)}</strong></div>
        <div class="drawer-kv"><span>Price Refresh</span><strong>${fmtDateTime(market.regularMarketTime)}</strong></div>
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
    render(state.latestPayload);
  };
};

const render = (payload) => {
  state.latestPayload = payload;
  renderMeta(payload.asOf);
  renderLeaderboard(payload);
  renderFilters(payload.segments);

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

  setInterval(async () => {
    try {
      await load();
    } catch {
      // Keep existing data visible when refresh fails.
    }
  }, 60_000);
};

boot();
