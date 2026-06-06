# AI Value Chain Dashboard

Browser-compatible full-stack dashboard to map the AI value chain and monitor stock and valuation moves across upstream silicon, cloud platforms, foundation models, and downstream applications.

## Features
- Value-chain map with upstream to downstream segments.
- Up to 20 companies per sub-segment, ranked by market cap descending.
- Default view shows top 5 companies; expand to see remaining 15.
- Best-effort real-time public stock quotes with source and freshness labels.
- Private company valuation snapshots (seeded + optional Crunchbase enrichment).
- Company search with autocomplete dropdown and live performance panel.
- Detailed stock drawer with price chart, period selector, and extended metrics.
- Leaderboard showing top 5 gainers and top 5 decliners across sub-segments.
- Weekly automated company refresh: removes non-tradable companies, adds replacements.
- Company Updates log showing last 10 added and last 10 removed companies with dates.

## Quick Start
1. Install dependencies:
   ```
   npm install
   ```
2. Configure environment:
   ```
   copy .env.example .env
   ```
3. Run app:
   ```
   npm run dev
   ```
4. Open: http://localhost:3000

## Easy Cross-Computer Use (Windows + Mac)

### Option A: Run directly from this folder
- Windows: Double-click `start-dashboard.bat`
- macOS:
  ```
  chmod +x start-dashboard.command start-dashboard.sh
  ./start-dashboard.command
  ```

What the launchers do automatically:
- Install dependencies on first run
- Create `.env` from `.env.example` if missing
- Start the dashboard on `http://localhost:3000`

### Option B: Create a portable bundle for transfer
1. Build bundle:
   ```
   npm run bundle:portable
   ```
2. Copy to another machine: `dist/ai-value-chain-dashboard-portable`
3. On destination, run the appropriate launcher script.

Requirements on destination machine: Node.js 20+, npm

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Server health check |
| GET | /api/value-chain | Full value chain with top 5 companies per sub-segment |
| GET | /api/subsegments/:id/companies | All companies in a sub-segment |
| GET | /api/companies | Flat list of all companies with segment context |
| GET | /api/stock-history?ticker=X&period=Y | Price history for chart (periods: 1d, 1w, 1m, 3m, 6m, 1y, 2y, 3y, 5y) |
| GET | /api/refresh-history | Last 10 added and removed companies from weekly refresh |
| GET | /api/subsegments/:id/export | Export companies as JSON or CSV |

## Notes
- Real-time quote coverage depends on free-tier provider limits and symbol support.
- For best results, add `FINNHUB_API_KEY` in `.env`.
- Private valuations are snapshots, not real-time marks.

---

## Changelog

### v1.5 — 2026-06-06

#### Company Data & Taxonomy
- Introduced granular upstream and core platform sub-segment taxonomy: 12 upstream sub-segments under compute-infrastructure, 6 cloud platform sub-segments, 4 foundation model sub-segments.
- Companies are ranked by live market cap (descending) across all sub-segments.
- Server-side augmentation fills targeted sub-segments (compute-infrastructure, cloud-platforms, foundation-models) to 20 unique companies using a curated real-company candidate pool (`src/data/augmentedPrimaryCandidates.js`). Each company is assigned to exactly one primary sub-segment with no duplicates.
- Updated dataset: replaced Western Digital (WDC) with Sandisk (SNDK).

#### Weekly Company Refresh (`src/utils/companyRefresh.js`, `src/data/replacementCandidates.js`)
- New weekly scheduler runs 60 seconds after server start, then every 7 days.
- Detects non-tradable public companies (provider returns 404 / unavailable source) and inactive private companies (no valuation update in 1+ year).
- Removes detected companies from the live in-memory dataset immediately.
- Draws real replacement companies from `src/data/replacementCandidates.js` — one candidate per removed company per sub-segment, no cross-sub-segment duplicates.
- Logs all removals and additions to `data/refresh-history.json` (last 50 entries each).

#### Company Updates Dashboard Section
- New "Company Updates" section at the bottom of the dashboard with two columns.
- Left column: last 10 added companies with name, sub-segment, and add date.
- Right column: last 10 removed companies with name, sub-segment, and removal date.
- Powered by new `/api/refresh-history` endpoint.

#### Leaderboard
- Expanded Top Gainer / Top Decliner leaderboard to show **top 5 gainers** and **top 5 decliners** (previously 1 each), sorted by sub-segment valuation index change percent.

#### Company Search Autocomplete
- Replaced native `<datalist>` with a custom dropdown that appears automatically as the user types.
- Matches by company name or ticker symbol (case-insensitive partial match).
- Keyboard navigation: arrow keys to select, Enter to confirm, Escape to close.
- Clicking a suggestion fills the search box and shows the live performance panel.

#### Search Performance Panel
- New panel to the right of the search box showing the matched company's live price, 1-day % change (colour-coded), market cap, P/E, and data freshness.
- Clicking the performance panel opens the full stock detail drawer.

#### Stock Detail Drawer (enhanced)
- Extended metrics: Previous Close, Open, Day Range, 52-Week Range, Volume, 3M Average Volume, P/S ratio.
- New **Price Movement chart** — inline SVG line chart with adaptive x-axis date labels.
- **Period selector** with 9 options: 1D, 1 Week, 1 Month, 3 Months (default), 6 Months, 1 Year, 2 Years, 3 Years, 5 Years.
- Chart data sourced from Yahoo Finance chart API via new server endpoint `/api/stock-history`.
- Out-of-order request cancellation when switching periods rapidly.

#### Bug Fixes
- Fixed `ERR_HTTP_HEADERS_SENT` server crash when `/api/value-chain` timed out and the handler attempted a second response.
- Fixed autocomplete not showing suggestions reliably when company index was still loading at page open.

---

### v1.0.1 — Initial release
- Full value-chain dashboard with upstream/downstream segments.
- Real-time quote support via TradingView, Yahoo Finance, Finnhub, and AlphaVantage.
- Private company valuation snapshots.
- Portable bundle build script.
