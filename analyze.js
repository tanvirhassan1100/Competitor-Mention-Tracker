const express = require('express');
const router = express.Router();
const { fetchAllCompetitors } = require('../src/fetchers');
const { generateBriefingWithClaude } = require('../src/claude');


/**
 * POST /api/analyze
 *
 * Body: { competitors: string[] }
 * Returns: { briefing, mentionStats, fetchErrors, generatedAt }
 */
router.post('/analyze', async (req, res) => {
  const { competitors } = req.body;

  // --- Input validation ---
  if (!competitors || !Array.isArray(competitors) || competitors.length === 0) {
    return res.status(400).json({ error: 'Provide a non-empty "competitors" array in the request body.' });
  }

  const sanitized = competitors
    .map(c => String(c).trim())
    .filter(c => c.length > 0 && c.length <= 80)
    .slice(0, 8); // cap at 8 to avoid runaway API calls

  if (sanitized.length === 0) {
    return res.status(400).json({ error: 'No valid competitor names after sanitisation.' });
  }

  console.log(`[Analyze] Request for: ${sanitized.join(', ')}`);

  // --- Step 1: Fetch mentions ---
  let allMentions, allErrors;
  try {
    ({ allMentions, allErrors } = await fetchAllCompetitors(sanitized));
  } catch (err) {
    console.error('[Analyze] Unexpected fetch error:', err.message);
    return res.status(502).json({
      error: 'Failed to fetch competitor mentions.',
      details: err.message
    });
  }

  console.log(`[Analyze] Fetched ${allMentions.length} mentions. Errors: ${allErrors.length}`);

  if (allMentions.length === 0) {
    return res.status(200).json({
      briefing: null,
      mentionStats: buildStats(allMentions, sanitized),
      fetchErrors: allErrors,
      generatedAt: new Date().toISOString(),
      message: 'No mentions found for the specified competitors. Try different names or check back later.'
    });
  }

  // --- Step 2: Generate briefing via Claude ---
  let briefing;
  try {
    briefing = await generateBriefingWithClaude(sanitized, allMentions, allErrors);
  } catch (err) {
    console.error('[Analyze] Claude error:', err.message);
    return res.status(502).json({
      error: 'LLM analysis failed.',
      details: err.message,
      // Still return raw mentions so the caller can show partial results
      rawMentions: allMentions.slice(0, 50),
      fetchErrors: allErrors
    });
  }

  // --- Step 3: Return enriched response ---
  return res.status(200).json({
    briefing,
    mentionStats: buildStats(allMentions, sanitized),
    fetchErrors: allErrors,
    generatedAt: new Date().toISOString()
  });
});

/**
 * Build a summary of how many mentions were found per competitor and source.
 */
function buildStats(mentions, competitorNames) {
  const stats = {
    total: mentions.length,
    bySource: {
      HN: mentions.filter(m => m.source === 'HN').length,
      Reddit: mentions.filter(m => m.source === 'Reddit').length
    },
    byCompetitor: {}
  };

  competitorNames.forEach(name => {
    const ms = mentions.filter(m => m.competitor === name);
    stats.byCompetitor[name] = {
      total: ms.length,
      HN: ms.filter(m => m.source === 'HN').length,
      Reddit: ms.filter(m => m.source === 'Reddit').length
    };
  });

  return stats;
}

module.exports = router;
