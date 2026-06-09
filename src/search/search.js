const axios = require('axios');

async function searchWeb(query) {
  try {
    const response = await axios.post(
      'https://google.serper.dev/search',
      { q: query, num: 3, gl: 'in', hl: 'hi' },
      {
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );

    const data = response.data;
    let result = '';

    // Answer box — best result
    if (data.answerBox) {
      result += `DIRECT ANSWER: ${data.answerBox.answer || data.answerBox.snippet}\n\n`;
    }

    // Knowledge graph
    if (data.knowledgeGraph?.description) {
      result += `${data.knowledgeGraph.description}\n\n`;
    }

    // Organic results
    if (data.organic) {
      result += data.organic.slice(0, 3).map((r, i) =>
        `${i + 1}. ${r.title}\n${r.snippet}`
      ).join('\n\n');
    }

    return result || null;

  } catch (error) {
    console.error('Search error:', error.message);
    return null;
  }
}

function needsSearch(message) {
  const triggers = [
    'aaj', 'kal', 'abhi', 'time', 'kitna', 'kya hai',
    'news', 'latest', 'price', 'kitne', 'bata', 'batao',
    'kaun', 'kab', 'kahan', 'weather', 'mausam', 'score',
    'result', 'today', 'current', '2026', 'new', 'update',
    'jeeta', 'haar', 'winner', 'ipl', 'match', 'election',
    'search kro', 'search kar', 'dhundh', 'pata karo'
  ];
  const lower = message.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

module.exports = { searchWeb, needsSearch };
