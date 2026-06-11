const axios = require('axios');

async function searchWeb(query) {
  // Pehle You.com try karo
  try {
    const response = await axios.get(
      'https://api.ydc-index.io/search',
      {
        params: {
          query: query,
          num_web_results: 3,
          country: 'IN'
        },
        headers: {
          'X-API-Key': process.env.YOU_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );

    const hits = response.data.hits;
    if (hits && hits.length > 0) {
      return hits.slice(0, 3).map((r, i) =>
        `${i + 1}. ${r.title}\n${r.snippets?.join(' ')?.slice(0, 200)}`
      ).join('\n\n');
    }

  } catch (error) {
    console.error('You.com error:', error.message);
  }

  // You.com fail hua — Groq se try karo
  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `Tu ek search engine hai. User jo pooche uske baare mein jo bhi latest info tujhe pata hai woh de. 
Agar pakka nahi pata toh clearly bol "mujhe is baare mein pakki info nahi hai, Google pe check karo."
KABHI galat info confidently mat de.
Current year: 2026`
        },
        {
          role: 'user',
          content: `Search: ${query}`
        }
      ]
    });

    return `[Groq knowledge] ${response.choices[0].message.content}`;

  } catch (error) {
    console.error('Groq search error:', error.message);
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
