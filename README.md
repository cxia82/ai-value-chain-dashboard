# AI Value Chain Dashboard

Browser-compatible full-stack dashboard to map the AI value chain and monitor stock/valuation moves.

## Features
- Value-chain map with upstream to downstream segments.
- Top 20 companies per sub-segment.
- Default view shows top 5 companies; click to expand remaining 15.
- Best-effort real-time public stock quotes with fallback and freshness labels.
- Private company valuation snapshots (seeded + optional Crunchbase enrichment).

## Quick Start
1. Install dependencies:
   npm install
2. Configure environment:
   copy .env.example .env
3. Run app:
   npm run dev
4. Open:
   http://localhost:3000

## Easy Cross-Computer Use (Windows + Mac)

### Option A: Run directly from this folder
- Windows:
  - Double-click `start-dashboard.bat`
- macOS:
  - Open Terminal in this folder
  - Run: `chmod +x start-dashboard.command start-dashboard.sh`
  - Run: `./start-dashboard.command`

What these launchers do automatically:
- Install dependencies on first run
- Create `.env` from `.env.example` if missing
- Start the dashboard on `http://localhost:3000`

### Option B: Create a clean portable bundle for transfer
1. Build bundle:
   npm run bundle:portable
2. Copy this folder to another machine:
   dist/ai-value-chain-dashboard-portable
3. On destination machine, run:
   - Windows: `start-dashboard.bat`
   - macOS: `chmod +x start-dashboard.command start-dashboard.sh && ./start-dashboard.command`

Requirements on destination machine:
- Node.js 20+
- npm

## API Endpoints
- GET /api/health
- GET /api/value-chain
- GET /api/subsegments/:id/companies

## Notes
- Real-time quote coverage depends on free-tier provider limits and symbol support.
- For best results, add FINNHUB_API_KEY in .env.
- Private valuations are snapshots, not real-time marks.
