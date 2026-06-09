const cron = require('node-cron');
const { loadMemory, getMemorySummary, addConversation } = require('../memory/memory');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function getAllUsers() {
  const dataPath = path.join(__dirname, '../data');
  if (!fs.existsSync(dataPath)) return [];
  return fs.readdirSync(dataPath)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

async function generateProactiveMessage(userId) {
  const mem = loadMemory(userId);
  if (!mem.core.name || mem.core.onboarding !== 'done') return null;

  const memorySummary = getMemorySummary(userId);
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();

  let timeContext = '';
  if (hour >= 6 && hour < 10) timeContext = 'Subah hai — good morning time';
  else if (hour >= 12 && hour < 14) timeContext = 'Dopahar hai — lunch time';
  else if (hour >= 16 && hour < 19) timeContext = 'Shaam hai';
  else if (hour >= 20 && hour < 23) timeContext = 'Raat hai — din khatam hone wala';
  else return null; // Raat ko mat jagao!

  // Check karo koi order/reminder hai kya
  const activeOrders = mem.orders.filter(o => o.active);
  const upcomingEvents = mem.events.filter(e => {
    const eventDate = new Date(e.date);
    const today = new Date();
    const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
  });

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 150,
    messages: [{
      role: 'system',
      content: `Tu BroCode hai — ek proactive AI dost. Khud message kar raha hai.
      
RULES:
- Short — 1-3 lines max
- Hindi/Hinglish
- Memory se kuch specific mention kar
- Natural lage — forced nahi
- Agar koi upcoming event hai toh uspe focus kar
- Agar koi order hai toh uspe dhyan de
- Sirf message text likho`
    }, {
      role: 'user',
      content: `${memorySummary}

CURRENT TIME: ${now}
TIME CONTEXT: ${timeContext}
ACTIVE ORDERS: ${activeOrders.map(o => o.instruction).join(', ') || 'none'}
UPCOMING EVENTS: ${upcomingEvents.map(e => `${e.title} on ${e.date}`).join(', ') || 'none'}

Ek proactive message bhej.`
    }]
  });

  return response.choices[0].message.content;
}

function startScheduler(bot) {
  // Har 4 ghante IST mein — 7am, 11am, 3pm, 7pm, 11pm
  cron.schedule('0 1,5,9,13,17 * * *', async () => {
    console.log(`BroCode proactive check — ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);

    const users = getAllUsers();
    console.log(`Found ${users.length} users`);

    for (const userId of users) {
      try {
        const message = await generateProactiveMessage(userId);
        if (message) {
          await bot.telegram.sendMessage(userId, message);
          addConversation(userId, 'assistant', `[PROACTIVE] ${message}`);
          console.log(`✅ Sent to ${userId}`);
        }
      } catch (error) {
        console.error(`❌ Error for ${userId}:`, error.message);
      }
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  console.log('BroCode scheduler running! ⚡');
}

module.exports = { startScheduler };
