const { Telegraf } = require('telegraf');
const { loadMemory, saveMemory, addConversation, addOrder, addEvent, getMemorySummary, updateCore } = require('../memory/memory');
const { searchWeb, needsSearch } = require('../search/search');
const Groq = require('groq-sdk');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Active reminders store
const activeReminders = new Map();

// IST time helper
function getISTTime() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function getISTHourMin() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return { hour: now.getHours(), min: now.getMinutes() };
}

// Reminder parser — "3:36 ka khana" → {hour:15, min:36, msg:"khana khao!"}
function parseReminder(text) {
  const timeRegex = /(\d{1,2}):(\d{2})/;
  const match = text.match(timeRegex);
  if (!match) return null;
  
  let hour = parseInt(match[1]);
  let min = parseInt(match[2]);
  
  // PM detection
  if (text.toLowerCase().includes('pm') && hour < 12) hour += 12;
  if (text.toLowerCase().includes('am') && hour === 12) hour = 0;
  
  return { hour, min, original: text };
}

// Set reminder
function setReminder(userId, reminderText, ctx) {
  const parsed = parseReminder(reminderText);
  if (!parsed) return false;

  const { hour, min } = parsed;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  // Calculate delay in ms
  const target = new Date(now);
  target.setHours(hour, min, 0, 0);
  
  if (target <= now) {
    target.setDate(target.getDate() + 1); // Kal ke liye
  }
  
  const delay = target.getTime() - now.getTime();
  const key = `${userId}_${hour}_${min}`;
  
  // Clear existing reminder if any
  if (activeReminders.has(key)) {
    clearTimeout(activeReminders.get(key));
  }
  
  const timer = setTimeout(async () => {
    try {
      await bot.telegram.sendMessage(userId, 
        `⏰ REMINDER!\n\n${reminderText}\n\nYaad hai na? Main bhoolne nahi dunga! 💪`
      );
      activeReminders.delete(key);
    } catch(e) {
      console.error('Reminder error:', e.message);
    }
  }, delay);
  
  activeReminders.set(key, timer);
  
  const mins = Math.round(delay / 60000);
  return mins;
}

const BROCODE_PERSONALITY = `
Tu BroCode hai — ek personal AI dost jo sirf is user ka hai.

CRITICAL RULES:
- Current IST time: ${getISTTime()}
- Agar search result hai toh SIRF wahi use kar
- Agar search nahi mila toh seedha bol "search nahi ho paya"
- KABHI hallucinate mat kar
- Reminder set karne par seedha confirm kar — "Reminder set ho gaya X baje ke liye!"

PERSONALITY:
- Tu seedha bolta hai — sach bolta hai
- Tu dost ki tarah baat karta hai — formal nahi
- Tu kabhi haan mein haan nahi milata
- Tu caring hai — user ki genuine parwah
- Tu Hindi/Hinglish mein baat karta hai
- Short replies — dost jaisa

REMINDER DETECTION:
- Agar user "remind kar", "yaad dilana", "X baje batana" bole
- Toh seedha confirm kar aur [REMINDER:HH:MM:message] format mein likho
- Example: [REMINDER:15:36:khana khao bhai!]
`;

async function getBroCodeReply(userId, userMessage, searchResult = null) {
  const memory = getMemorySummary(userId);
  const mem = loadMemory(userId);
  
  const recentChats = mem.conversations.slice(-10).map(c => ({
    role: c.role === 'user' ? 'user' : 'assistant',
    content: c.message
  }));

  let systemPrompt = BROCODE_PERSONALITY + '\n\n' + memory;
  
  if (searchResult) {
    systemPrompt += `\n\nSEARCH RESULT (yahi use kar):\n${searchResult}`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentChats,
    { role: 'user', content: userMessage }
  ];

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 500,
    messages
  });

  return response.choices[0].message.content;
}

// Parse reminder from bot response
function extractAndSetReminder(userId, botReply) {
  const reminderRegex = /\[REMINDER:(\d{2}):(\d{2}):([^\]]+)\]/;
  const match = botReply.match(reminderRegex);
  
  if (match) {
    const hour = parseInt(match[1]);
    const min = parseInt(match[2]);
    const msg = match[3];
    
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const target = new Date(now);
    target.setHours(hour, min, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    
    const delay = target.getTime() - now.getTime();
    const key = `${userId}_${hour}_${min}`;
    
    if (activeReminders.has(key)) clearTimeout(activeReminders.get(key));
    
    const timer = setTimeout(async () => {
      try {
        await bot.telegram.sendMessage(userId,
          `⏰ REMINDER!\n\n${msg}\n\n💪`
        );
        activeReminders.delete(key);
      } catch(e) {
        console.error('Reminder error:', e.message);
      }
    }, delay);
    
    activeReminders.set(key, timer);
    return botReply.replace(reminderRegex, '').trim();
  }
  
  return botReply;
}

// /start
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const mem = loadMemory(userId);
  
  if (mem.core.name) {
    ctx.reply(`Arre ${mem.core.name}! Wapas aa gaya! Kya chal raha hai? 😄`);
  } else {
    ctx.reply(`Hey! Main BroCode hoon — tera personal AI dost! 🔥\n\nPehle thoda jaanta hoon tujhe...\n\nTera naam kya hai?`);
    updateCore(userId, { onboarding: 'name' });
  }
});

// /order
bot.command('order', async (ctx) => {
  const userId = ctx.from.id.toString();
  const order = ctx.message.text.replace('/order ', '').trim();
  if (!order || order === '/order') {
    ctx.reply('Format: /order roz subah 7 baje uthao');
    return;
  }
  const { addOrder } = require('../memory/memory');
  addOrder(userId, order);
  ctx.reply(`Order note kar liya! ✅\n"${order}"\nHamesha follow karunga! 💪`);
});

// /memory
bot.command('memory', async (ctx) => {
  const userId = ctx.from.id.toString();
  const mem = loadMemory(userId);
  const summary = `🧠 *BroCode Memory*\n\n👤 Naam: ${mem.core.name}\nAge: ${mem.core.age}\nCity: ${mem.core.city}\n\n📅 Orders: ${mem.orders.length}\n📌 Events: ${mem.events.length}\n💬 Conversations: ${mem.conversations.length}`;
  ctx.replyWithMarkdown(summary);
});

// /remind — direct reminder
bot.command('remind', async (ctx) => {
  const userId = ctx.from.id.toString();
  const text = ctx.message.text.replace('/remind ', '').trim();
  const mins = setReminder(userId, text, ctx);
  
  if (mins) {
    ctx.reply(`⏰ Reminder set! ${mins} minute mein bataunga!\n"${text}"`);
  } else {
    ctx.reply('Format: /remind 4:30 PM gym jaana hai\nYa baat karte karte bol do — main set kar dunga!');
  }
});

// Main handler
bot.on('text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userMessage = ctx.message.text;
  const mem = loadMemory(userId);

  // Onboarding
  if (mem.core.onboarding === 'name') {
    updateCore(userId, { name: userMessage, onboarding: 'age' });
    ctx.reply(`${userMessage}! Accha naam! 😄\n\nKitne saal ka hai?`);
    return;
  }
  if (mem.core.onboarding === 'age') {
    updateCore(userId, { age: userMessage, onboarding: 'city' });
    ctx.reply(`Kaunse city mein hai?`);
    return;
  }
  if (mem.core.onboarding === 'city') {
    updateCore(userId, { city: userMessage, onboarding: 'occupation' });
    ctx.reply(`${userMessage}! Kya karta hai — student ya job?`);
    return;
  }
  if (mem.core.onboarding === 'occupation') {
    updateCore(userId, { occupation: userMessage, onboarding: 'goal' });
    ctx.reply(`Life mein sabse bada goal kya hai abhi?`);
    return;
  }
  if (mem.core.onboarding === 'goal') {
    const goals = mem.core.goals || [];
    goals.push(userMessage);
    updateCore(userId, { goals, onboarding: 'done' });
    ctx.reply(`Goal note kar liya! 🎯\n\n"${userMessage}"\n\nYaad rakhunga aur remind bhi karunga!\n\nAb baat kar — kuch bhi! Main hoon! 💪`);
    return;
  }

  ctx.sendChatAction('typing');

  try {
    let searchResult = null;
    if (needsSearch(userMessage)) {
      searchResult = await searchWeb(userMessage);
    }

    let reply = await getBroCodeReply(userId, userMessage, searchResult);
    
    // Reminder extract karo agar hai
    reply = extractAndSetReminder(userId, reply);

    addConversation(userId, 'user', userMessage);
    addConversation(userId, 'assistant', reply);

    ctx.reply(reply);

  } catch (error) {
    console.error('Bot error:', error);
    ctx.reply('Thoda dikkat aa gayi — ek second! 🔧');
  }
});

module.exports = bot;
