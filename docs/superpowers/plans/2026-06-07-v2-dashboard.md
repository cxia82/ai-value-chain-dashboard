# AI Value Chain Dashboard v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a v2 of the AI Value Chain Dashboard in `public-v2/` with a dark terminal aesthetic, collapsible sidebar, watchlist, portfolio tracker, comparison mode, lightweight-charts price chart, and dark/light theme toggle — while keeping `public/` (v1) completely untouched.

**Architecture:** Vanilla JS ES modules + plain HTML/CSS in `public-v2/`. The existing Express server in `src/server.js` is extended to also serve `public-v2/` at the `/v2` path prefix. All existing API routes are shared. New client-side features (watchlist, portfolio, comparison) use `localStorage` only — no new server endpoints.

**Tech Stack:** Node.js/Express (existing), Vanilla JS ES modules, CSS custom properties, `lightweight-charts` v4 (TradingView) via CDN for the drawer price chart.

**Design spec:** `docs/superpowers/specs/2026-06-07-v2-dashboard-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/server.js` | Modify (2 lines) | Add `/v2` static route and fallback |
| `public-v2/index.html` | Create | Shell markup: header, sidebar, stats bar, main, drawer, templates |
| `public-v2/styles.css` | Create | All styling: design tokens (dark+light), layout, components |
| `public-v2/app.js` | Create | All client logic: state, render, filters, watchlist, portfolio, comparison, theme |

`public/` is **never touched**.

---

## Task 1: Server — serve public-v2 at /v2

**Files:**
- Modify: `src/server.js` (around line 114 — the `express.static` call)

- [ ] **Step 1:** Open `src/server.js`. Locate the two lines:
  ```js
  app.use(express.static(path.join(__dirname, "..", "public")));
  ```
  and near the bottom (line ~598):
  ```js
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  ```

- [ ] **Step 2:** After the existing `express.static` line, add the v2 static middleware and its SPA fallback. The v2 static must be registered **before** the v1 static so `/v2/...` asset requests are intercepted first:
  ```js
  // v2 UI — served at /v2
  app.use("/v2", express.static(path.join(__dirname, "..", "public-v2")));
  app.get("/v2", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "public-v2", "index.html"));
  });
  ```

- [ ] **Step 3:** Run `npm start` (or the existing start command) and verify:
  - `http://localhost:3000/` still loads v1
  - `http://localhost:3000/v2` returns a 404 (expected — `public-v2/` doesn't exist yet)

- [ ] **Step 4:** Commit: `feat: serve public-v2 at /v2 path`

---

## Task 2: HTML shell — index.html

**Files:**
- Create: `public-v2/index.html`

This file provides all the structural markup. JavaScript in `app.js` will populate the dynamic sections. Keep markup semantic and minimal — do not inline any styles.

- [ ] **Step 1:** Create `public-v2/index.html` with the following structure. Include Google Fonts (`Syne`, `JetBrains Mono`, `Outfit`) in `<head>`. Include `lightweight-charts` v4 CDN script before `app.js`:

  ```html
  <!doctype html>
  <html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Value Chain Dashboard v2</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/v2/styles.css" />
  </head>
  <body>

    <!-- TOP HEADER -->
    <header class="top-header">
      <div class="header-logo">
        <button id="sidebar-toggle" class="sidebar-toggle" type="button" aria-label="Toggle sidebar">☰</button>
        <div class="logo-mark">AI</div>
        <span class="logo-text">Value Chain <span class="logo-sub">Dashboard</span></span>
      </div>
      <div class="header-search">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input id="filter-search" type="text" placeholder="Search company or ticker…" autocomplete="off" />
        <div id="search-dropdown" class="search-dropdown" hidden></div>
        <div id="search-performance" class="search-performance" hidden></div>
      </div>
      <div class="header-right">
        <div id="header-badges" class="header-badges"></div>
        <button id="theme-toggle" class="theme-toggle" type="button" title="Toggle theme">☀</button>
      </div>
    </header>

    <!-- SIDEBAR -->
    <aside id="sidebar" class="sidebar">
      <!-- Stage nav -->
      <div class="sidebar-section">
        <div class="sidebar-section-label">Value Chain</div>
        <nav id="sidebar-stage-nav" class="sidebar-stage-nav"></nav>
      </div>
      <div class="sidebar-divider"></div>
      <!-- Filters -->
      <div class="sidebar-section">
        <div class="sidebar-section-label">Filters</div>
        <div class="sidebar-filters">
          <div class="filter-group">
            <label for="filter-listing">Company Type</label>
            <select id="filter-listing" class="filter-select">
              <option value="all">All Companies</option>
              <option value="public">Public Only</option>
              <option value="private">Private Only</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="filter-region">Region</label>
            <select id="filter-region" class="filter-select">
              <option value="all">All Regions</option>
              <option value="north-america">North America</option>
              <option value="europe">Europe</option>
              <option value="asia">Asia</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="filter-mincap">Min Market Cap</label>
            <select id="filter-mincap" class="filter-select">
              <option value="0">No minimum</option>
              <option value="1">$1B+</option>
              <option value="10">$10B+</option>
              <option value="100">$100B+</option>
            </select>
          </div>
        </div>
      </div>
      <div class="sidebar-divider"></div>
      <!-- Watchlist -->
      <div class="sidebar-section">
        <div class="sidebar-section-label">Watchlist ★</div>
        <div id="sidebar-watchlist" class="sidebar-watchlist">
          <div class="sidebar-empty">Pin companies using the ★ on any row.</div>
        </div>
      </div>
      <div class="sidebar-divider"></div>
      <!-- Portfolio -->
      <div class="sidebar-section">
        <div class="sidebar-section-label">Portfolio</div>
        <div id="sidebar-portfolio-summary" class="sidebar-portfolio-summary"></div>
        <button id="portfolio-manage-btn" class="btn btn-ghost btn-sm">Manage holdings</button>
      </div>
    </aside>

    <!-- STATS BAR -->
    <div id="stats-bar" class="stats-bar"></div>

    <!-- MAIN CONTENT -->
    <main id="main" class="main">
      <div class="content-area">
        <div class="page-title-row">
          <div>
            <h1 class="page-title">AI Value Chain Dashboard</h1>
            <p id="page-subtitle" class="page-subtitle">Loading…</p>
          </div>
          <div class="page-actions">
            <button id="export-all-btn" class="btn btn-ghost">⬇ Export All</button>
          </div>
        </div>

        <section id="leaderboard" class="leaderboard-section"></section>

        <div id="segment-tabs" class="segment-tabs"></div>

        <section id="map" class="map"></section>

        <section id="refresh-log" class="refresh-log"></section>
      </div>
    </main>

    <!-- COMPANY DRAWER -->
    <aside id="company-drawer" class="company-drawer hidden" aria-hidden="true">
      <div class="drawer-card">
        <div class="drawer-top">
          <div class="drawer-close-row">
            <button id="drawer-watchlist-btn" class="watchlist-btn" type="button">★ Watchlist</button>
            <button id="drawer-close" class="drawer-close" type="button">✕ Close</button>
          </div>
          <div id="drawer-header-content"></div>
          <div class="drawer-tabs" id="drawer-tabs">
            <button class="drawer-tab active" data-tab="overview">Overview</button>
            <button class="drawer-tab" data-tab="chart">Chart</button>
            <button class="drawer-tab" data-tab="fundamentals">Fundamentals</button>
          </div>
        </div>
        <div id="drawer-body" class="drawer-body"></div>
      </div>
    </aside>

    <!-- COMPARISON PANEL -->
    <div id="comparison-panel" class="comparison-panel hidden"></div>

    <!-- PORTFOLIO MODAL -->
    <div id="portfolio-modal" class="modal-overlay hidden" aria-hidden="true">
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">Portfolio Holdings</h2>
          <button id="portfolio-modal-close" class="drawer-close" type="button">✕ Close</button>
        </div>
        <div id="portfolio-modal-body" class="modal-body"></div>
      </div>
    </div>

    <!-- HTML TEMPLATES -->
    <template id="segment-template">
      <article class="segment-card">
        <div class="segment-header">
          <div class="segment-header-left">
            <span class="stage-pill"></span>
            <div>
              <div class="segment-name"></div>
              <div class="segment-summary"></div>
            </div>
          </div>
          <div class="segment-index"></div>
        </div>
        <div class="subsegments-grid"></div>
      </article>
    </template>

    <template id="subsegment-template">
      <div class="subsegment-panel">
        <div class="subsegment-head">
          <div class="subsegment-name"></div>
          <div class="subsegment-desc"></div>
        </div>
        <div class="subsegment-stats-row"></div>
        <div class="companies"></div>
        <button class="expand-btn" type="button"></button>
        <div class="export-row">
          <a class="export-btn export-json" href="#">⬇ JSON (top 5)</a>
          <a class="export-btn export-csv" href="#">⬇ CSV (all)</a>
        </div>
      </div>
    </template>

    <script src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"></script>
    <script type="module" src="/v2/app.js"></script>
  </body>
  </html>
  ```

- [ ] **Step 2:** Verify the file is valid HTML (no unclosed tags). Open `http://localhost:3000/v2` — should load a blank page with correct fonts (check Network tab for font requests).

- [ ] **Step 3:** Commit: `feat(v2): add index.html shell`

---

## Task 3: CSS — design tokens and layout

**Files:**
- Create: `public-v2/styles.css`

Build the stylesheet in logical sections. Use CSS custom properties for all colors and dimensions. The light theme override is a separate `:root[data-theme="light"]` block at the top.

- [ ] **Step 1:** Create `public-v2/styles.css`. Start with the design token blocks:

  ```css
  /* Dark theme (default) */
  :root {
    --bg-base:       #09111f;
    --bg-raised:     #0e1a2e;
    --bg-card:       #112035;
    --bg-card-alt:   #0d1829;
    --bg-hover:      #162845;
    --border:        rgba(255,255,255,0.07);
    --border-bright: rgba(0,212,200,0.25);
    --text-primary:  #e8edf5;
    --text-secondary:#7f98b8;
    --text-muted:    #4a6080;
    --accent:        #00d4c8;
    --accent-dim:    rgba(0,212,200,0.12);
    --gain:          #22c97b;
    --gain-bg:       rgba(34,201,123,0.10);
    --loss:          #ff4757;
    --loss-bg:       rgba(255,71,87,0.10);
    --gold:          #f5a623;
    --gold-bg:       rgba(245,166,35,0.10);
    --sidebar-w:     240px;
    --sidebar-w-collapsed: 56px;
    --header-h:      56px;
    --statsbar-h:    44px;
  }

  /* Light theme override */
  [data-theme="light"] {
    --bg-base:       #f6f4ef;
    --bg-raised:     #fffdf8;
    --bg-card:       #ffffff;
    --bg-card-alt:   #f4f8f7;
    --bg-hover:      #eff5f1;
    --border:        #d8d3c5;
    --border-bright: rgba(15,118,110,0.35);
    --text-primary:  #102022;
    --text-secondary:#3d5357;
    --text-muted:    #5d6d71;
    --accent:        #0f766e;
    --accent-dim:    rgba(15,118,110,0.10);
    --gain:          #0f8f57;
    --gain-bg:       rgba(15,143,87,0.10);
    --loss:          #bf2f4a;
    --loss-bg:       rgba(191,47,74,0.10);
    --gold:          #a16207;
    --gold-bg:       rgba(161,98,7,0.10);
  }
  ```

- [ ] **Step 2:** Add global reset and body styles:
  ```css
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Outfit", system-ui, sans-serif;
    background: var(--bg-base);
    color: var(--text-primary);
    min-height: 100vh;
    transition: background 0.2s, color 0.2s;
  }
  h1, h2, h3 { font-family: "Syne", sans-serif; }
  ```

- [ ] **Step 3:** Add layout styles for: `.top-header`, `.header-logo`, `.header-search`, `.header-right`, `.sidebar`, `.sidebar.collapsed` (uses `--sidebar-w-collapsed`), `.stats-bar`, `.main`, `.content-area`. The main content area uses `margin-left: var(--sidebar-w)` and `padding-top: calc(var(--header-h) + var(--statsbar-h))`. Both values update when sidebar collapses.

- [ ] **Step 4:** Add component styles for each section in this order:
  1. Header badges, theme toggle
  2. Sidebar: section labels, nav items (`.sidebar-nav-item`, `.active` state), filter selects, watchlist items, portfolio summary
  3. Stats bar: stat items
  4. Page title row, action buttons (`.btn`, `.btn-ghost`, `.btn-accent`, `.btn-sm`)
  5. Leaderboard: `.leader-card`, gain/loss variants, sparkline
  6. Segment tabs: `.segment-tabs`, `.segment-tab`, `.active`
  7. Segment cards: `.segment-card`, `.segment-header`, `.stage-pill`, `.segment-index`
  8. Subsegment panels: `.subsegment-panel`, `.subsegment-stats-row`, `.ss-stat`
  9. Company rows: `.company-row`, `.rank`, `.company-info`, `.value-block`, `.change-pill`, `.compare-btn` (visible on hover), `.star-btn`
  10. Expand button, export buttons
  11. Company drawer: `.company-drawer`, `.drawer-card`, `.drawer-top`, `.drawer-tabs`, `.drawer-body`, `.drawer-close-row`; KV grid: `.kv-grid`, `.kv-item`; chart: `.chart-period-bar`, `.period-btn`, `.chart-area`
  12. Comparison panel: `.comparison-panel` (fixed bottom, slides up), `.comparison-col`
  13. Portfolio modal: `.modal-overlay`, `.modal-card`, `.modal-header`, `.modal-body`; holdings table styles
  14. Utility: `.hidden`, `.gain`, `.loss`, `.flat`, `@keyframes fadeUp`, `@keyframes slideUp` (for comparison panel)
  15. Responsive: `@media (max-width: 900px)` — sidebar becomes overlay

- [ ] **Step 5:** Open `http://localhost:3000/v2` and verify the layout skeleton renders without JS errors in the console. Fonts should be correct, dark background visible.

- [ ] **Step 6:** Commit: `feat(v2): add styles.css with dark/light design tokens and layout`

---

## Task 4: app.js — state, utilities, and data loading

**Files:**
- Create: `public-v2/app.js`

Port the v1 utility functions and state model, then extend with new v2 state. This task covers **only** the non-render logic — no DOM manipulation yet.

- [ ] **Step 1:** Create `public-v2/app.js`. Copy these sections verbatim from `public/app.js`:
  - `EXCHANGE_REGION` constant
  - `fmtNumber`, `fmtCompactNumber`, `fmtCurrency`, `fmtDisplayPrice`, `fmtMarketCap`, `fmtDateTime`, `fmtRemovalDate`
  - `formatChangeClass`, `stateClass`, `getRegion`

- [ ] **Step 2:** Define the v2 state object:
  ```js
  const state = {
    expandedSubsegments: new Set(),
    fullSubsegmentData: new Map(),
    latestPayload: null,
    companyIndex: [],
    drawerRequestSeq: 0,
    drawerActiveTab: "overview",
    drawerCurrentCompany: null,
    drawerCurrentSubsegmentName: "",
    filters: {
      stage: "all",   // replaced by activeSegmentTab but kept for compat
      listing: "all",
      region: "all",
      search: "",
      minMarketCapBn: 0
    },
    activeSegmentTab: "all",
    sidebarCollapsed: false,
    watchlist: new Set(),
    portfolioHoldings: new Map(),   // Map<companyName, number (qty)>
    comparisonSet: new Set(),       // max 3
    theme: "dark"
  };
  ```

- [ ] **Step 3:** Add localStorage helpers:
  ```js
  const loadPersistedState = () => {
    try {
      const wl = JSON.parse(localStorage.getItem("v2-watchlist") || "[]");
      state.watchlist = new Set(wl);
      const ph = JSON.parse(localStorage.getItem("v2-portfolio") || "[]");
      state.portfolioHoldings = new Map(ph.map(({ name, qty }) => [name, qty]));
      state.sidebarCollapsed = localStorage.getItem("v2-sidebar-collapsed") === "true";
      state.theme = localStorage.getItem("v2-theme") || "dark";
    } catch { /* ignore parse errors */ }
  };

  const persistWatchlist = () => {
    localStorage.setItem("v2-watchlist", JSON.stringify([...state.watchlist]));
  };

  const persistPortfolio = () => {
    const arr = [...state.portfolioHoldings.entries()].map(([name, qty]) => ({ name, qty }));
    localStorage.setItem("v2-portfolio", JSON.stringify(arr));
  };

  const persistSidebar = () => {
    localStorage.setItem("v2-sidebar-collapsed", String(state.sidebarCollapsed));
  };

  const persistTheme = () => {
    localStorage.setItem("v2-theme", state.theme);
  };
  ```

- [ ] **Step 4:** Port `passesCompanyFilters` from v1, adding the new `minMarketCapBn` check:
  ```js
  const passesCompanyFilters = (company) => {
    // existing search / listing / region checks (copy from v1)
    // ...
    // new: market cap filter (public only)
    if (state.filters.minMarketCapBn > 0 && company.isPublic) {
      const capBn = (company.market?.marketCap || 0) / 1e9;
      if (capBn < state.filters.minMarketCapBn) return false;
    }
    return true;
  };
  ```

- [ ] **Step 5:** Port `buildCompanyIndex`, `loadCompanyIndex`, `getSearchMatches`, `renderSearchDropdown`, `updateDropdownSelection`, `handleSearchKeydown`, `renderSearchPerformance` from v1 verbatim.

- [ ] **Step 6:** Add the theme initializer (called before first render):
  ```js
  const applyTheme = () => {
    document.documentElement.setAttribute("data-theme", state.theme);
    const btn = document.querySelector("#theme-toggle");
    if (btn) btn.textContent = state.theme === "dark" ? "☀" : "☾";
  };
  ```

- [ ] **Step 7:** Commit: `feat(v2): add app.js state, utilities, and localStorage persistence`

---

## Task 5: app.js — layout rendering (header, sidebar, stats bar)

**Files:**
- Modify: `public-v2/app.js`

- [ ] **Step 1:** Add sidebar collapse/expand logic:
  ```js
  const applySidebarCollapse = () => {
    const sidebar = document.querySelector("#sidebar");
    const main = document.querySelector("#main");
    const statsBar = document.querySelector(".stats-bar");
    if (state.sidebarCollapsed) {
      sidebar.classList.add("collapsed");
      main.classList.add("sidebar-collapsed");
      statsBar.classList.add("sidebar-collapsed");
    } else {
      sidebar.classList.remove("collapsed");
      main.classList.remove("sidebar-collapsed");
      statsBar.classList.remove("sidebar-collapsed");
    }
  };
  ```

  Add a CSS rule for `.sidebar-collapsed` on main/stats-bar that uses `--sidebar-w-collapsed` instead of `--sidebar-w`.

- [ ] **Step 2:** Add `renderStatsBar(payload)`:
  - Flatten all companies from `payload.segments`
  - Compute: total public MCap (sum of `market.marketCap` where finite), up count, down count, top mover (max `|changePercent|`)
  - Render into `#stats-bar` with the 5 stat-item layout from the design preview

- [ ] **Step 3:** Add `renderSidebarStageNav(payload)`:
  - Render one nav item per segment in `#sidebar-stage-nav` plus an "All Stages" item at top
  - Each item shows the segment name and total company count
  - `.active` class applied to the item matching `state.activeSegmentTab`
  - Clicking updates `state.activeSegmentTab` and calls `render(state.latestPayload)`

- [ ] **Step 4:** Add `renderSidebarWatchlist()`:
  - For each name in `state.watchlist`, find the company in `state.companyIndex`
  - Render name, ticker/exchange, price, 1D change into `#sidebar-watchlist`
  - Show the "Pin companies…" empty state when watchlist is empty
  - Each item is clickable → opens the company drawer

- [ ] **Step 5:** Add `renderHeaderBadges(payload)`:
  - Count how many companies have Live / Delayed / Cached / Stale `freshness` values
  - Render badges only for freshness states that have at least 1 company
  - Live badge gets a pulsing dot

- [ ] **Step 6:** Add `renderSegmentTabs(segments)`:
  - Render into `#segment-tabs`
  - "All" tab always first
  - Active tab gets `.active` class
  - Clicking updates `state.activeSegmentTab` and calls `render(state.latestPayload)`

- [ ] **Step 7:** Commit: `feat(v2): add sidebar, stats bar, segment tab rendering`

---

## Task 6: app.js — leaderboard with sparklines

**Files:**
- Modify: `public-v2/app.js`

- [ ] **Step 1:** Add `buildSparklinePath(companies)` — takes up to 5 company objects, extracts their `market.changePercent` values (or a mock trend), builds a tiny SVG polyline path string for a 100×28 viewBox. If insufficient data, returns `null`.

- [ ] **Step 2:** Add `renderLeaderboard(payload)`:
  - Same top-5 gainers / top-5 decliners logic as v1 (based on `valuationIndex.valuationChangePercent`)
  - Each leader card renders: colored top border stripe, rank label, subsegment name, parent segment name, change %, sparkline SVG
  - Clicking a card sets `state.activeSegmentTab` to the card's segment and scrolls to that segment card in `#map`

- [ ] **Step 3:** Verify leaderboard renders correctly with real API data by loading `http://localhost:3000/v2`.

- [ ] **Step 4:** Commit: `feat(v2): add leaderboard with sparklines`

---

## Task 7: app.js — segment and subsegment rendering

**Files:**
- Modify: `public-v2/app.js`

- [ ] **Step 1:** Add `renderValuationIndexInline(valuationIndex)` — returns an HTML string for the 3-column segment header stats (MCap, Δ, tracked). Mirrors v1's `renderValuationIndex` but formatted for the inline header layout.

- [ ] **Step 2:** Add `renderSubsegmentStatsRow(subsegment)` — returns an HTML string for the 4-column stats bar (MCap, Δ today, public count, private count).

- [ ] **Step 3:** Add `rowHtml(company, subsegmentId)` — port from v1, with two additions:
  - A `★` button on each row (`data-company-name` attribute, class `star-btn`; filled style if in `state.watchlist`)
  - A `+ Compare` button (`class="compare-btn"`, visible on CSS `:hover` of the row)

- [ ] **Step 4:** Add `renderMap(payload)` — the main segment rendering loop. For each segment in `payload.segments`:
  - Skip if `state.activeSegmentTab !== "all"` and segment's stage doesn't match
  - Clone `#segment-template`, fill: stage pill, segment name, summary, valuation index stats
  - For each subsegment, clone `#subsegment-template`, fill: name, desc, stats row, company rows (top 5, filtered)
  - Attach expand/collapse handler and export link hrefs

- [ ] **Step 5:** Port `attachToggleHandler`, `setCompanyRows`, `bindCompanyRowClicks` from v1, updating them to call the new v2 `rowHtml`.

- [ ] **Step 6:** Commit: `feat(v2): add segment and subsegment rendering`

---

## Task 8: app.js — company drawer with tabs

**Files:**
- Modify: `public-v2/app.js`

- [ ] **Step 1:** Port `DRAWER_PERIODS`, `formatAxisDateLabel`, `buildAxisLabels`, `buildChartPath` from v1.

- [ ] **Step 2:** Add `renderDrawerHeader(company, subsegmentName)` — renders into `#drawer-header-content`:
  - Company name in `Syne` font (large)
  - Ticker badge (for public) or "Private" tag
  - Subsegment + segment breadcrumb
  - Price hero: large price + 1D change pill (for public) or valuation (for private)

- [ ] **Step 3:** Add `renderDrawerOverviewTab(company)` — renders the KV grid for the Overview tab:
  - Public: Price, 1D Change, Market Cap, P/E, P/S, Notes
  - Private: Latest Valuation, As Of, Freshness, Notes
  - Returns an HTML string

- [ ] **Step 4:** Add `renderDrawerFundamentalsTab(company)` — renders the extended KV grid for the Fundamentals tab (Prev Close, Open, Day Range, 52W Range, Volume, 3M Avg Volume). Uses placeholder "Loading…" values that get filled by `loadPublicDrawerDetails`.

- [ ] **Step 5:** Add `renderLightweightChart(container, history)` — replaces v1's hand-rolled SVG chart:
  - Uses `LightweightCharts.createChart(container, options)` with dark/light theme options from `state.theme`
  - Adds an `AreaSeries` with line and top/bottom fill colors matching gain/loss state
  - Maps `history.points` to `{ time: string, value: number }` objects
  - Calls `chart.timeScale().fitContent()`
  - Returns the chart instance (stored on `state.drawerChart` for cleanup)

- [ ] **Step 6:** Add `openDrawer(company, subsegmentName)` and `closeDrawer()`. The drawer now:
  - Renders the header via `renderDrawerHeader`
  - Sets `state.drawerActiveTab = "overview"` and renders the overview tab into `#drawer-body`
  - Updates the `★ Watchlist` button label/style based on `state.watchlist`
  - Attaches tab-click handlers to `.drawer-tab` buttons; switching to "chart" lazily creates the lightweight-charts chart; switching away destroys it (call `chart.remove()`) to free memory

- [ ] **Step 7:** Port `loadPublicDrawerDetails` from v1, updating it to fill the Fundamentals tab's KV items by ID.

- [ ] **Step 8:** Bind drawer close button and overlay-click-to-close.

- [ ] **Step 9:** Bind the watchlist toggle button in drawer (`#drawer-watchlist-btn`) to add/remove from `state.watchlist`, call `persistWatchlist()`, re-render the sidebar watchlist, and update button style.

- [ ] **Step 10:** Commit: `feat(v2): add tabbed company drawer with lightweight-charts`

---

## Task 9: app.js — watchlist and comparison mode

**Files:**
- Modify: `public-v2/app.js`

- [ ] **Step 1:** Add `toggleWatchlist(companyName)`:
  ```js
  const toggleWatchlist = (companyName) => {
    if (state.watchlist.has(companyName)) {
      state.watchlist.delete(companyName);
    } else {
      state.watchlist.add(companyName);
    }
    persistWatchlist();
    renderSidebarWatchlist();
    // Re-render star buttons in current DOM without full re-render:
    document.querySelectorAll(`.star-btn[data-company-name="${CSS.escape(companyName)}"]`)
      .forEach(btn => btn.classList.toggle("active", state.watchlist.has(companyName)));
  };
  ```

- [ ] **Step 2:** In `bindCompanyRowClicks`, add click handler for `.star-btn` buttons (call `toggleWatchlist`, stop propagation so drawer doesn't open).

- [ ] **Step 3:** Add comparison mode:
  - `toggleComparison(companyName)` — adds/removes from `state.comparisonSet` (max 3; ignore if already at 3 and not removing); calls `renderComparisonPanel()`
  - `renderComparisonPanel()` — renders into `#comparison-panel`:
    - Hidden when `state.comparisonSet.size === 0`
    - Slides up when non-empty (add `.visible` class, CSS `@keyframes slideUp`)
    - Each column: company name, ticker, price, 1D Δ, MCap, P/E, P/S
    - "✕" button on each column calls `toggleComparison(name)`
    - Data sourced from `state.companyIndex` which has the latest market data from the last render
  - In `bindCompanyRowClicks`, add click handler for `.compare-btn` buttons

- [ ] **Step 4:** Commit: `feat(v2): add watchlist persistence and comparison panel`

---

## Task 10: app.js — portfolio tracker

**Files:**
- Modify: `public-v2/app.js`

- [ ] **Step 1:** Add `renderPortfolioModal()` — renders into `#portfolio-modal-body`:
  - Add holding form: company search input + quantity number input + "Add" button
  - Holdings table: name, ticker, qty, current price, current value, 1D P&L ($), 1D P&L (%)
  - Summary row: total portfolio value, total 1D P&L
  - "Remove" button on each row
  - Data sourced from `state.portfolioHoldings` and `state.companyIndex` (for live prices)

- [ ] **Step 2:** Add `renderSidebarPortfolioSummary()` — renders total portfolio value and 1D P&L into `#sidebar-portfolio-summary` on every `render()`.

- [ ] **Step 3:** Add holding add/remove handlers:
  - "Add" button: validate company name exists in `state.companyIndex`, add to `state.portfolioHoldings`, call `persistPortfolio()`, re-render modal and sidebar summary
  - "Remove" button: delete from map, persist, re-render

- [ ] **Step 4:** Bind `#portfolio-manage-btn` to show `#portfolio-modal` (remove `.hidden`, set `aria-hidden="false"`). Bind `#portfolio-modal-close` and overlay click to close.

- [ ] **Step 5:** Commit: `feat(v2): add portfolio tracker with localStorage persistence`

---

## Task 11: app.js — main render loop and initialization

**Files:**
- Modify: `public-v2/app.js`

- [ ] **Step 1:** Add the top-level `render(payload)` function:
  ```js
  const render = (payload) => {
    if (!payload) return;
    state.latestPayload = payload;
    renderStatsBar(payload);
    renderHeaderBadges(payload);
    renderSidebarStageNav(payload);
    renderSidebarWatchlist();
    renderSidebarPortfolioSummary();
    renderLeaderboard(payload);
    renderSegmentTabs(payload.segments);
    renderMap(payload);
    renderRefreshLog(payload);
    renderComparisonPanel();  // keeps comparison panel in sync after filter changes
  };
  ```

- [ ] **Step 2:** Add `renderRefreshLog(payload)` — port from v1, renders the "Company Updates" section.

- [ ] **Step 3:** Add `bindFilters()` — binds `#filter-listing`, `#filter-region`, `#filter-mincap` change events to update `state.filters` and call `render(state.latestPayload)`. Bind search input events (port keyboard handling from v1).

- [ ] **Step 4:** Add the init function and fetch loop:
  ```js
  const init = async () => {
    loadPersistedState();
    applyTheme();
    applySidebarCollapse();
    bindFilters();
    loadCompanyIndex();

    // Sidebar toggle
    document.querySelector("#sidebar-toggle").addEventListener("click", () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      applySidebarCollapse();
      persistSidebar();
    });

    // Theme toggle
    document.querySelector("#theme-toggle").addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      applyTheme();
      persistTheme();
    });

    // Drawer close
    document.querySelector("#drawer-close").addEventListener("click", closeDrawer);
    document.querySelector("#company-drawer").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeDrawer();
    });

    // Initial data fetch
    try {
      const response = await fetch("/api/data");
      const payload = await response.json();
      render(payload);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  };

  document.addEventListener("DOMContentLoaded", init);
  ```

- [ ] **Step 5:** Load `http://localhost:3000/v2` and verify:
  - Stats bar shows real data
  - Segments render with company rows
  - Filters work
  - Company drawer opens (click any row) with Overview tab
  - Chart tab loads lightweight-charts chart

- [ ] **Step 6:** Commit: `feat(v2): add main render loop and initialization`

---

## Task 12: Integration pass and polish

**Files:**
- Modify: `public-v2/app.js`, `public-v2/styles.css`

- [ ] **Step 1:** Test watchlist end-to-end:
  - Pin a company → appears in sidebar → reload → still pinned
  - Unpin → removed from sidebar

- [ ] **Step 2:** Test comparison mode:
  - Add 3 companies → panel slides up
  - Remove one → panel updates
  - Add a 4th → ignored

- [ ] **Step 3:** Test portfolio:
  - Add a holding → appears in modal table with live value
  - Reload → holding persists
  - Sidebar summary updates

- [ ] **Step 4:** Test dark/light toggle:
  - Toggle → colors switch immediately
  - Reload → preference persists
  - Lightweight-charts chart should use matching colors (re-create chart on theme toggle if drawer is open)

- [ ] **Step 5:** Test sidebar collapse:
  - Collapse → icon rail, labels hidden
  - Expand → back to full width
  - Reload → state persists

- [ ] **Step 6:** Test responsive (resize to < 900px):
  - Sidebar hides, hamburger appears
  - Hamburger opens overlay sidebar

- [ ] **Step 7:** Verify `http://localhost:3000/` (v1) is completely unaffected — same appearance and behavior as before.

- [ ] **Step 8:** Run existing tests: `npm test` — all tests should still pass (server logic unchanged).

- [ ] **Step 9:** Clean up the design preview file: `public/design-preview.html` can be deleted (it was a brainstorming artifact, not a production file).

- [ ] **Step 10:** Final commit: `feat: ship AI Value Chain Dashboard v2`

---

## Testing Notes

- No new unit tests are required for purely presentational code (HTML/CSS rendering). The existing `tests/` suite covers server logic which is unchanged.
- If any new utility functions in `app.js` contain non-trivial logic (e.g. portfolio P&L math, market cap filter), add quick manual smoke tests in the browser console before committing.
- The `lightweight-charts` library is loaded from CDN — if offline, the Chart tab will show an empty container. This is acceptable for the free-tier architecture.

---

## What Is Not Changing

- `src/server.js` — only the 3-line v2 static route addition
- `src/data/`, `src/providers/`, `src/utils/` — untouched
- `public/` — v1 fully intact
- `tests/` — all existing tests continue to pass
- `package.json`, `scripts/`, `assets/` — untouched
