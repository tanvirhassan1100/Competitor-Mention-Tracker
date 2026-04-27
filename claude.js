const fetch = require('node-fetch');

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * Build the prompt for the competitive intelligence briefing.
 */
function buildPrompt(competitorNames, allMentions, fetchErrors) {
  const mentionsByComp = {};
  competitorNames.forEach(name => {
    mentionsByComp[name] = allMentions
      .filter(m => m.competitor === name)
      .slice(0, 20); // cap per competitor to stay within token budget
  });

  const context = competitorNames.map(name => {
    const ms = mentionsByComp[name] || [];
    const lines = ms.map(m => {
      const title = m.title ? `"${m.title}"` : '(comment/thread)';
      const body = m.text ? ` — ${m.text.slice(0, 250)}` : '';
      const meta = [m.source, m.subreddit ? `r/${m.subreddit}` : null, m.points ? `${m.points}pts` : null]
        .filter(Boolean).join(' | ');
      return `[${meta}] ${title}${body}`;
    });
    return `## ${name} (${ms.length} mentions)\n${lines.join('\n') || '(no mentions found)'}`;
  }).join('\n\n');

  const errorNote = fetchErrors.length > 0
    ? `\nNote: Some data fetches had partial failures: ${fetchErrors.join('; ')}\n`
    : '';

  return `You are a competitive intelligence analyst for Deskflow, a B2B IT service management (ITSM) SaaS platform targeting mid-market companies (200–2,000 employees).

Deskflow's key strengths vs competitors:
- Fastest onboarding in the ITSM market (avg 3 days vs industry 2–4 weeks)
- Transparent flat-rate pricing (no per-agent upsells)
- 24/7 human support included on all plans
- Native no-code automation builder
- Purpose-built for mid-market (not enterprise bloat, not SMB-lite)

I've collected the following recent online mentions of our competitors from Hacker News and Reddit. Analyse them and return a structured JSON competitive briefing.
${errorNote}
COMPETITOR MENTIONS:
${context}

Return ONLY valid JSON — no markdown fences, no preamble, no trailing text. Use this exact schema:

{
  "headline": "A punchy 8-12 word headline summarising this week's competitive landscape",
  "executive_summary": "2-3 sentences covering the most important competitive developments",
  "competitors": [
    {
      "name": "exact competitor name as provided",
      "mention_count": <number of mentions found>,
      "sentiment": "positive|neutral|negative|mixed",
      "sentiment_score": <float from -1.0 (very negative) to 1.0 (very positive)>,
      "sentiment_summary": "2-3 sentences explaining the overall sentiment and key drivers",
      "top_themes": ["theme1", "theme2", "theme3", "theme4"],
      "notable_quotes": [
        {
          "text": "verbatim quote or close paraphrase of a discussion point worth flagging",
          "source": "HN or Reddit",
          "context": "brief 1-sentence context about where/why this appeared"
        }
      ],
      "threats": [
        "specific threat or competitive risk for Deskflow based on this competitor's activity"
      ]
    }
  ],
  "positioning_opportunities": [
    {
      "title": "Short 4-6 word opportunity title",
      "description": "2-3 sentences explaining the gap and exactly how Deskflow's strengths can exploit it"
    }
  ],
  "analyst_note": "1-2 sentences with the single most important action item for Deskflow's marketing team this week"
}`;
}

/**
 * Call the Claude API and return a parsed briefing object.
 * Throws a descriptive error if anything goes wrong.
 */
async function generateBriefingWithClaude(competitorNames, allMentions, fetchErrors) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Copy .env.example to .env and add your key.');
  }

  const prompt = buildPrompt(competitorNames, allMentions, fetchErrors);

  const response = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    }),
    timeout: 60000
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const snippet = body.slice(0, 300);
    if (response.status === 401) throw new Error('Invalid Anthropic API key. Check your .env file.');
    if (response.status === 429) throw new Error('Anthropic rate limit hit. Wait a moment and try again.');
    throw new Error(`Anthropic API error ${response.status}: ${snippet}`);
  }

  const data = await response.json();
  const rawText = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  if (!rawText) {
    throw new Error('Claude returned an empty response.');
  }

  // Strip any accidental markdown fences before parsing
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse Claude's response as JSON. Raw output: ${cleaned.slice(0, 400)}`);
  }

  // Basic schema validation
  if (!parsed.competitors || !Array.isArray(parsed.competitors)) {
    throw new Error('Claude response is missing the "competitors" array.');
  }

  return parsed;
}

module.exports = { generateBriefingWithClaude };
