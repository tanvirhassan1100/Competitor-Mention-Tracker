const fetch = require('node-fetch');

const HN_BASE = 'https://hn.algolia.com/api/v1/search';
const REDDIT_BASE = 'https://www.reddit.com/search.json';

/**
 * Fetch recent Hacker News stories and comments mentioning a competitor.
 * Uses the Algolia-powered HN API — no key required.
 */
async function fetchHackerNews(competitorName) {
  const url = `${HN_BASE}?query=${encodeURIComponent(competitorName)}&tags=(story,comment)&hitsPerPage=15`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'DeskflowIntel/1.0' },
    timeout: 10000
  });

  if (!res.ok) {
    throw new Error(`HN API responded with ${res.status} for "${competitorName}"`);
  }

  const data = await res.json();

  return (data.hits || []).map(h => ({
    source: 'HN',
    competitor: competitorName,
    title: h.title || null,
    text: h.comment_text || h.story_text || null,
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    points: h.points || 0,
    author: h.author || null,
    created_at: h.created_at || null
  }));
}

/**
 * Fetch recent Reddit posts mentioning a competitor.
 * Uses the public Reddit JSON API — no key required.
 */
async function fetchReddit(competitorName) {
  const url = `${REDDIT_BASE}?q=${encodeURIComponent(competitorName)}&sort=new&limit=15&t=month`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'DeskflowIntel/1.0 (competitive research tool)',
      'Accept': 'application/json'
    },
    timeout: 10000
  });

  if (!res.ok) {
    throw new Error(`Reddit API responded with ${res.status} for "${competitorName}"`);
  }

  const data = await res.json();
  const posts = (data.data?.children || []).map(c => c.data);

  return posts.map(p => ({
    source: 'Reddit',
    competitor: competitorName,
    title: p.title || null,
    text: p.selftext || null,
    url: `https://reddit.com${p.permalink}`,
    points: p.score || 0,
    author: p.author || null,
    subreddit: p.subreddit || null,
    created_at: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null
  }));
}

/**
 * Fetch from both sources for a single competitor.
 * Returns { mentions, errors } — never throws.
 */
async function fetchAllForCompetitor(competitorName) {
  const results = await Promise.allSettled([
    fetchHackerNews(competitorName),
    fetchReddit(competitorName)
  ]);

  const mentions = [];
  const errors = [];

  results.forEach((r, i) => {
    const sourceName = i === 0 ? 'Hacker News' : 'Reddit';
    if (r.status === 'fulfilled') {
      mentions.push(...r.value);
    } else {
      errors.push(`${sourceName}/${competitorName}: ${r.reason?.message || 'unknown error'}`);
      console.warn(`[Fetch] ${sourceName} failed for "${competitorName}":`, r.reason?.message);
    }
  });

  return { mentions, errors };
}

/**
 * Fetch mentions for all competitors in parallel.
 */
async function fetchAllCompetitors(competitorNames) {
  const settled = await Promise.allSettled(
    competitorNames.map(name => fetchAllForCompetitor(name))
  );

  const allMentions = [];
  const allErrors = [];

  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      allMentions.push(...r.value.mentions);
      allErrors.push(...r.value.errors);
    } else {
      allErrors.push(`All sources failed for "${competitorNames[i]}": ${r.reason?.message}`);
    }
  });

  return { allMentions, allErrors };
}

module.exports = { fetchAllCompetitors };
