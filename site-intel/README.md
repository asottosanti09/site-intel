# Site Intel — Location Scoring Engine
**Back-House / Sottosanti LLC — Internal Tool**

AI-powered location intelligence for restaurant and retail concepts. Enter an address and business concept, get a scored analysis across 7 weighted dimensions using live web search, census data, competitive research, transit access, and location history.

---

## Stack
- React 18 + Vite
- Vercel (hosting + serverless API proxy)
- Anthropic Claude API (claude-sonnet-4-20250514 + web search tool)

---

## Setup

### 1. Clone and install
```bash
git clone https://github.com/YOUR_USERNAME/site-intel.git
cd site-intel
npm install
```

### 2. Local development
Create `.env.local` in the root (already gitignored):
```
ANTHROPIC_API_KEY=sk-ant-...
```
Run locally:
```bash
npm run dev
```
Note: the Vercel serverless function (`/api/anthropic.js`) only runs in production on Vercel. For local dev, you can temporarily point the fetch URL in `src/App.jsx` back to `https://api.anthropic.com/v1/messages` and add your key directly — but never commit that.

### 3. Deploy to Vercel
1. Push repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your GitHub repo
3. In Vercel project settings → Environment Variables → add:
   - `ANTHROPIC_API_KEY` = your key
4. Deploy. Done.

### 4. Custom domain (optional)
In Vercel → Domains → add `intel.back-house.co` or similar.
Point your DNS CNAME to `cname.vercel-dns.com`.

### 5. Squarespace embed (optional)
Once deployed, add an Embed block to any Squarespace page:
```html
<iframe src="https://your-vercel-url.vercel.app" width="100%" height="900px" frameborder="0"></iframe>
```

---

## Scoring Model

### Concept Categories & Adaptive Weights

| Dimension | Neighborhood Bar | Destination Restaurant | Fast Casual | Cafe/Coffee | Nightlife |
|---|---|---|---|---|---|
| Customer Profile | 25% | 20% | 18% | 20% | 20% |
| Competition | 22% | 18% | 20% | 20% | 20% |
| Foot Traffic | 15% | 12% | 25% | 22% | 14% |
| Trajectory | 12% | 14% | 10% | 10% | 10% |
| Real Estate | 10% | 12% | 12% | 10% | 10% |
| Location History | 10% | 8% | 8% | 8% | 8% |
| Transit | 6% | 16% | 7% | 10% | 18% |

### Score interpretation
- **75–100** — Strong location for this concept. Go.
- **55–74** — Viable with the right execution and POV.
- **Below 55** — Structural problems. Flag for client.

---

## System Prompt (v2.0)

The full scoring prompt lives in `src/App.jsx` as `SYSTEM_PROMPT`. Key instructions:

1. Classify concept into category → select weight table
2. Web search: prior tenants at exact address, subway proximity, census data, competitors with price points, retail rent PSF, neighborhood trajectory
3. Score 7 dimensions 0–100 with specific data signals
4. Calculate weighted composite
5. Return structured JSON with: scores, location history, transit snapshot, census snapshot, comparables, risks, opportunities

### Research checklist the model runs on every analysis:
- All prior tenants at exact address (name, tenure, closure reason)
- Nearest subway entrance walk time + lines + night service
- Census/ACS: median HHI, avg HHI, median age, education %, professional workforce %
- Named competitors within 0.5 miles with price points ($–$$$$)
- Retail rent PSF for that specific corridor
- Neighborhood trajectory (recent openings/closures, investment signals, press)

---

## File Structure
```
site-intel/
├── api/
│   └── anthropic.js      # Vercel serverless proxy (keeps API key server-side)
├── src/
│   ├── main.jsx           # React entry point
│   └── App.jsx            # Full application (UI + scoring logic + system prompt)
├── index.html
├── package.json
├── vite.config.js
├── vercel.json            # Vercel config (function timeout, rewrites)
└── .gitignore
```

---

## Updating the Scoring Logic
To change weights, add a new concept category, or update research instructions — edit `SYSTEM_PROMPT` in `src/App.jsx`. The weight tables are documented in plain English in the prompt, easy to modify without touching the UI code.

---

*Built for Back-House internal use. For client-facing deployment, add auth layer before exposing publicly.*
