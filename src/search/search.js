const axios = require('axios');

async function searchWeb(query) {
  try {
    const response = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: 'advanced',
        max_results: 5,
        include_answer: true
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data.answer) {
      return `VERIFIED ANSWER: ${response.data.answer}`;
    }

    const results = response.data.results;
    if (!results || results.length === 0) return null;

    return results.slice(0, 3).map((r, i) =>
      `${i + 1}. ${r.title}: ${r.content?.slice(0, 200)}`
    ).join('\n\n');

  } catch (error) {
    console.error('Search error:', error.message);
    return null;
  }
}

function needsSearch(message) {
  const triggers = [
    'aaj', 'kal', 'abhi', 'time', 'kitna', 'kya hai',
    'news', 'latest', 'price', 'kitne', 'bata', 'batao',
    'kaun', 'kab', 'kahan', 'weather', 'score', 'result',
    'today', 'current', '2026', 'new', 'update', 'jeeta',
    'haar', 'winner', 'ipl', 'match', 'election'
  ];
  const lower = message.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

module.exports = { searchWeb, needsSearch };
