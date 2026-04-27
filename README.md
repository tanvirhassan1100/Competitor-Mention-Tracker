# Deskflow Intel Hub

Automated competitive intelligence briefing tool. Pulls real-time competitor mentions from **Hacker News** and **Reddit**, then uses **Claude AI** to generate a structured weekly briefing — replacing the 2.5-hour Monday manual sweep.

![Screenshot](https://placeholder.for/screenshot.png)

---

## Features

- **Two live data sources** — Hacker News (Algolia API) and Reddit (public JSON API), both free and keyless
- **Claude-powered analysis** — sentiment per competitor, top recurring themes, notable quotes, threats, and positioning opportunities
- **Clean, readable UI** — competitor cards, sentiment badges, quote callouts, and an opportunities panel
- **Markdown export** — download the full briefing as a `.md` file
- **Robust error handling** — partial failures are surfaced clearly; the tool degrades gracefully if one source goes down

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Node.js + Express |
| Frontend | Vanilla HTML/CSS/JS (no framework, no build step) |
| LLM | Anthropic Claude (claude-sonnet-4) |
| Data source 1 | [HN Algolia API](https://hn.algolia.com/api) — no key needed |
| Data source 2 | [Reddit JSON API](https://www.reddit.com/dev/api/) — no key needed |

---

## Prerequisites

- Node.js 18 or later
- An [Anthropic API key](https://console.anthropic.com)

---

## Setup

### 1. Clone or unzip the project

```bash
cd deskflow-intel
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and replace `your_anthropic_api_key_here` with your actual key:

```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

### 4. Start the server

```bash
npm start
```

Or for development with auto-restart on file changes:

```bash
npm run dev
```

### 5. Open in browser

```
http://localhost:3000
```

---

## Usage

1. The tool launches with three default competitors pre-loaded: **Freshservice**, **Jira Service Management**, and **SysAid**
2. Click any competitor chip to toggle it on/off; type a new name in the text field to add one
3. Click **Generate Briefing** — the tool fetches mentions (~15 per competitor per source) and sends them to Claude
4. The briefing renders with sentiment, themes, quotes, threats, and positioning opportunities
5. Click **Download .md** to save the full briefing as a Markdown file

---

## Project structure

```
deskflow-intel/
├── public/
│   └── index.html          # Frontend (single-file, no build step)
├── routes/
│   └── analyze.js          # POST /api/analyze endpoint
├── src/
│   ├── server.js           # Express entry point
│   ├── fetchers.js         # HN + Reddit data fetching
│   └── claude.js           # Anthropic API integration
├── .env.example            # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

---

## API reference

### `POST /api/analyze`

**Request body:**
```json
{
  "competitors": ["Freshservice", "Jira Service Management", "SysAid"]
}
```

**Response (success):**
```json
{
  "briefing": {
    "headline": "...",
    "executive_summary": "...",
    "competitors": [...],
    "positioning_opportunities": [...],
    "analyst_note": "..."
  },
  "mentionStats": {
    "total": 42,
    "bySource": { "HN": 18, "Reddit": 24 },
    "byCompetitor": { "Freshservice": { "total": 15, "HN": 7, "Reddit": 8 } }
  },
  "fetchErrors": [],
  "generatedAt": "2025-04-26T08:00:00.000Z"
}
```

**Response (no mentions found):**
```json
{
  "briefing": null,
  "message": "No mentions found for the specified competitors.",
  ...
}
```

**Response (error):**
```json
{
  "error": "LLM analysis failed.",
  "details": "...",
  "rawMentions": [...]
}
```

### `GET /api/health`

Returns server status and whether the Anthropic API key is configured.

---

## Error handling

| Scenario | Behaviour |
|---|---|
| One data source (HN or Reddit) fails | Tool continues with the other source; error noted in UI |
| Both sources fail | Returns 502 with clear error message |
| No mentions found | Returns 200 with `briefing: null` and empty-state UI |
| Claude returns malformed JSON | Caught and re-thrown with raw output excerpt |
| Missing API key | Returns descriptive error pointing to `.env` setup |
| Claude rate limit (429) | Returns user-friendly message to retry shortly |

---

## Extending the tool

**Add a new data source** — implement a new async function in `src/fetchers.js` following the same `{ source, competitor, title, text, url, ... }` shape, then call it from `fetchAllCompetitors`.

**Swap the LLM** — the prompt lives in `src/claude.js` in `buildPrompt()`. To use OpenAI, replace the fetch call in `generateBriefingWithClaude()` with the OpenAI `/v1/chat/completions` endpoint; the prompt and JSON schema stay the same.

**Schedule weekly runs** — wrap the `/api/analyze` call in a cron job (e.g. using `node-cron`) and pipe the output to email or Slack.

---

## License

MIT
