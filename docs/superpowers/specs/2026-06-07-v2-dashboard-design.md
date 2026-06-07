# AI Value Chain Dashboard — v2 Design Spec

**Date:** 2026-06-07  
**Status:** Approved  
**Approach:** Vanilla JS / HTML / CSS (Approach A) — progressive enhancement of existing stack

---

## 1. Architecture & File Structure

### File layout

```
src/           ← unchanged (server.js, data/, providers/, utils/)
public/        ← unchanged (v1 — original files stay untouched)
public-v2/
  index.html
  styles.css
  app.js
docs/
  superpowers/
    specs/
      2026-06-07-v2-dashboard-design.md   ← this file
```

### Server changes

`src/server.js` gets one addition: serve `public-v2/` when the request path starts with `/v2`. All existing API routes are shared with no duplication:

- `GET /api/data`
- `GET /api/companies`
- `GET /api/subsegments/:id/companies`
- `GET /api/stock-history?ticker=&period=`

### State model

```js
const state = {
  // ── carried from v1 ──────────────────────────────────
  expandedSubsegments: new Set(),
  fullSubsegmentData: new Map(),
  latestPayload: null,
  companyIndex: [],
  drawerRequestSeq: 0,
  filters: { stage: "all", listing: "all", region: "all", search: "", minMarketCapBn: 0 },

  // ── new in v2 ────────────────────────────────────────
  sidebarCollapsed: false,          // persisted to localStorage
  activeSegmentTab: "all",          // replaces the Stage dropdown
  watchlist: new Set(),             // Set<companyName>, persisted to localStorage
  portfolioHoldings: new Map(),     // Map<companyName, qty>, persisted to localStorage
  comparisonSet: new Set(),         // Set<companyName>, max 3
  theme: "dark",                    // "dark" | "light", persisted to localStorage
  drawerActiveTab: "overview",      // "overview" | "chart" | "fundamentals"
};
```

### Data flow

Identical to v1: `fetch("/api/data")` → `render(payload)` → DOM updates. Watchlist, portfolio, and comparison features read/write `localStorage` only; no new server endpoints needed.

---

## 2. Layout & Navigation

### Shell structure

```
┌─────────────────────────────────────────────────────────┐
│  TOP HEADER (fixed, 56px)                               │
│  [Logo + collapse toggle] [Search]   [Badges] [Theme]   │
├──────────┬──────────────────────────────────────────────┤
│          │  STATS TICKER BAR (fixed, 44px)              │
│ SIDEBAR  │  Total MCap · Up count · Down count · Mover  │
│ (240px   ├──────────────────────────────────────────────┤
│ or 56px  │  CONTENT AREA (scrollable)                   │
│ rail)    │  Page title row + action buttons             │
│          │  Leaderboard (gainers/decliners cards)        │
│  Stage   │  Segment pill tabs                           │
│  nav     │  Segment cards → Subsegment panels           │
│          │  Update log                                  │
│  Filters │                                              │
│          │                                              │
│  Watch-  │                                              │
│  list    │                                              │
│          │                                              │
│  Port-   │                                              │
│  folio   │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### Sidebar behavior

- **Expanded (default):** 240px, labels + company counts visible
- **Collapsed:** 56px icon rail, labels hidden, tooltips on hover
- Toggle button at bottom of sidebar; state saved to `localStorage` as `sidebarCollapsed`
- **Viewport < 900px:** sidebar becomes a full-height overlay triggered by a hamburger button in the header; hidden by default on mobile

### Segment tabs

- Pill-style horizontal tabs in the content area, generated from `payload.segments`
- "All" tab always first; remaining tabs match stage values
- Clicking a tab: (1) sets `state.activeSegmentTab`, (2) filters segment cards to show only the matching segment, (3) scrolls to the top of the content area
- Replaces the Stage `<select>` — which is removed from the sidebar filters in v2

### Stats ticker bar

All values computed client-side from `payload` on each `render()` call:
- **Total tracked MCap:** sum of `market.marketCap` for all public companies with valid data
- **Up / Down counts:** count of companies where `market.changePercent > 0` / `< 0`
- **Top mover:** company with the highest absolute `|changePercent|`, showing name + %

---

## 3. Core Components

### Leaderboard cards

- Same top-5 gainers / top-5 decliners logic as v1
- Each card gains:
  - Colored 2px top border stripe (green for gainers, red for decliners)
  - **Sparkline:** 28px-tall SVG drawn from company price points already in `payload` (no new fetch); uses the top company in each subsegment
  - Rank label, subsegment name, parent segment name, change % in `JetBrains Mono`
- Clicking a card scrolls to and highlights that subsegment

### Segment cards

- Header row shows aggregate **valuation index stats** inline: total public MCap, 1D Δ%, tracked count — from `subsegment.valuationIndex` already in payload (no change to server)
- Subsegments switch from individual bordered cards to a **flush grid** separated by 1px divider lines

### Subsegment panels

Each subsegment panel contains:
1. Name + description
2. **Stats row:** MCap · Δ · public count · private count (compact info bar)
3. Company rows (top 5 by default)
4. Expand/collapse button (styled as icon button)
5. Export buttons (JSON top-5, CSV all) — styled as icon buttons instead of text links

### Company rows

Each row gains two new interactive elements:
- **★ watchlist toggle** — icon on the right side of each row; filled when pinned
- **+ compare button** — visible on hover; adds company to comparison set (max 3)

### Company drawer (tabbed)

Three tabs:
1. **Overview** — current KV grid (price, 1D change, MCap, P/E, P/S, notes)
2. **Chart** — `lightweight-charts` area series (loaded lazily on first tab open); period pill buttons (1D 1W 1M 3M 6M 1Y 2Y 3Y 5Y)
3. **Fundamentals** — prev close, open, day range, 52W range, volume, avg volume

Chart details:
- Library: `lightweight-charts` v4 via CDN `<script>` tag (≈45KB, loaded once)
- Area series with gradient fill matching gain/loss color
- Crosshair with price tooltip
- Same `/api/stock-history` endpoint as v1

Private company drawer retains current layout (no chart), gains the same tabbed KV grid styling for consistency.

Header of drawer gains:
- **★ Add to Watchlist** button (top-left)
- Company name in `Syne` font, large
- Ticker badge in accent color
- Price hero: large price + 1D change

### Watchlist (sidebar section)

- Pinned companies listed in sidebar with live price + 1D change
- Updated on every `render()` call by reading `state.watchlist` and looking up companies in `state.companyIndex`
- Persisted to `localStorage` as JSON array of company names
- Clicking a watchlist entry opens the company drawer

---

## 4. New Features

### Portfolio tracker

- **Sidebar section:** "Portfolio" nav item below the stage nav items
- Clicking opens a dedicated **portfolio panel** that replaces the main content area (or slides in as a page-level section)
- **Add holding form:** company search (reuses existing search logic) + quantity input + "Add" button
- **Holdings table:** company name, ticker, qty, current price, current value, 1D P&L ($), 1D P&L (%)
- **Summary row:** total portfolio value, total 1D P&L ($), total 1D P&L (%)
- All math computed client-side from `state.latestPayload` on each render
- Persisted to `localStorage` as `[{ name, qty }]`

### Comparison mode

- Up to 3 companies can be added to the comparison set via the hover "+ Compare" button on company rows
- When set is non-empty: a **comparison panel** slides up from the bottom (fixed, ~220px, z-index above content)
- Panel layout: companies side-by-side, columns showing price, 1D Δ, MCap, P/E, P/S
- "✕" on each company removes it; panel hides when set is empty
- Companies from different subsegments can be compared

### Market cap filter

- "Min Market Cap" dropdown in sidebar filters: No minimum / $1B+ / $10B+ / $100B+
- Stores as `state.filters.minMarketCapBn` (number in billions)
- Applied in `passesCompanyFilters()` — private companies always pass regardless

### Dark / light theme toggle

- Button in header (sun/moon icon)
- Sets `data-theme="dark"` or `data-theme="light"` on `<html>`
- `styles.css` defines two sets of CSS custom properties (`:root` for dark, `[data-theme="light"]` overrides for light)
- Light theme reuses the warm parchment palette from v1 (`--bg-base: #f6f4ef`, etc.) applied to the new layout
- Preference saved to `localStorage` as `theme`

---

## 5. Aesthetic Specification

| Token | Dark value | Light value |
|-------|-----------|-------------|
| `--bg-base` | `#09111f` | `#f6f4ef` |
| `--bg-raised` | `#0e1a2e` | `#fffdf8` |
| `--bg-card` | `#112035` | `#ffffff` |
| `--text-primary` | `#e8edf5` | `#102022` |
| `--text-secondary` | `#7f98b8` | `#3d5357` |
| `--text-muted` | `#4a6080` | `#5d6d71` |
| `--accent` | `#00d4c8` | `#0f766e` |
| `--gain` | `#22c97b` | `#0f8f57` |
| `--loss` | `#ff4757` | `#bf2f4a` |
| `--border` | `rgba(255,255,255,0.07)` | `#d8d3c5` |

**Typography:**
- Headlines: `Syne` (700–800 weight) — geometric, editorial
- Numbers / tickers / prices: `JetBrains Mono` (400–600)
- Body / labels: `Outfit` (300–600)
- All three loaded via Google Fonts in `<head>`

---

## 6. What Is Not Changing

- `src/server.js` logic (only route addition for `/v2`)
- All API endpoints and their response shapes
- `src/data/valueChainData.js`, `augmentedPrimaryCandidates.js`, `replacementCandidates.js`
- `src/providers/` and `src/utils/`
- `public/` (v1 remains fully intact)
- `tests/` (existing tests continue to pass against the shared server)
