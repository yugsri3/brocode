// BroCode Search System 🔍
// Real-time web search — zero hallucination

const axios = require('axios');

async function searchWeb(query) {
  try {
    // Tavily API se real time search
    const response = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        max_results: 3
      }
    );

    const results = response.data.results;
    
    if (!results || results.length === 0) {
      return 'Koi result nahi mila bhai.';
    }

    // Results format karo
    const formatted = results.map((r, i) => 
      `${i + 1}. ${r.title}\n${r.content}`
    ).join('\n\n');

    return formatted;

  } catch (error) {
    console.error('Search error:', error.message);
    return null;
  }
}

// Check karo ki search chahiye ya nahi
function needsSearch(message) {
  const searchTriggers = [
    'aaj', 'today', 'abhi', 'latest', 'news',
    'price', 'kitna', 'kya hai', 'kaise', 'best',
    'recommend', 'weather', 'score', 'result',
    'new', 'naya', 'update', '2026', 'current'
  ];
  
  const lower = message.toLowerCase();
  return searchTriggers.some(trigger => lower.includes(trigger));
}

module.exports = { searchWeb, needsSearch };
