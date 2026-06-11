const axios = require('axios');

async function searchWeb(query) {
  try {
    const response = await axios({
      method: 'POST',
      url: 'https://api.tavily.com/search',
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 3,
        include_domains: [],
        exclude_domains: []
      },
      timeout: 10000
    });

    const data = response.data;

    // Best case — direct answer
    if (data.answer) {
      return `Answer: ${data.answer}`;
    }

    // Results se banao
    if (data.results && data.results.length > 0) {
      return data.results.slice(0, 3).map((r, i) =>
        `${i + 1}. ${r.title}\n${r.content?.slice(0, 200)}`
      ).join('\n\n');
    }

    return null;

  } catch (error) {
    console.error('Tavily error:', error.response?.data || error.message);
    return null;
  }
}

function needsSearch(message) {
  const triggers = [
    'aaj', 'kal', 'abhi', 'news', 'latest', 'price',
    'kaun', 'kab', 'kahan', 'weather', 'mausam', 'score',
    'result', 'today', 'current', '2026', 'update',
    'jeeta', 'haar', 'winner', 'ipl', 'match', 'election',
    'search kro', 'search kar', 'batao', 'bata', 'kya hua'
  ];
  const lower = message.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

module.exports = { searchWeb, needsSearch };
