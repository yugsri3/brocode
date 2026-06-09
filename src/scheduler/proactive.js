// BroCode Proactive Engine ⚡
const cron = require('node-cron');
const { loadMemory, getMemorySummary } = require('../memory/memory');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function getAllUsers() {
  const dataPath = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataPath)) return [];
  return fs.readdirSync(dataPath)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

async function generateProactiveMessage(userId) {
  const mem = loadMemory(userId);
  if (!mem.core.name) return null;

  const memorySummary = getMemorySummary(userId);
  const hour = new Date().getHours();
  
  let timeContext = '';
  if (hour >= 6 && hour < 10) timeContext = 'Subah hai — good morning time';
  else if (hour >= 12 && hour < 14) timeContext = 'Dopahar hai — lunch time';
  else if (hour >= 16 && hour < 19) timeContext = 'Shaam hai';
  else if (hour >= 20 && hour < 23) timeContext = 'Raat hai — din khatam hone wala';

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 150,
    messages: [{
      role: 'system',
      content: `Tu BroCode hai — ek proactive AI dost. User ne message nahi kiya — TU khud message kar raha hai. Short, genuine, Hindi/Hinglish mein. Memory use kar. 1-3 lines max.`
    }, {
      role: 'user',
      content: `${memorySummary}\n\nTIME: ${timeContext}\n\nEk proactive message bhej.`
    }]
  });

  return response.choices[0].message.content;
}

function startScheduler(bot) {
  cron.schedule('0 7,11,15,19,23 * * *', async () => {
    console.log('BroCode thinking... 🧠');
    const users = getAllUsers();
    
    for (const userId of users) {
      try {
        const message = await generateProactiveMessage(userId);
        if (message) {
          await bot.telegram.sendMessage(userId, message);
        }
      } catch (error) {
        console.error(`Error:`, error.message);
      }
    }
  });

  console.log('BroCode scheduler running! ⚡');
}

module.exports = { startScheduler };
