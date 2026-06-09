// BroCode Telegram Bot 🤖
const { Telegraf } = require('telegraf');
const { loadMemory, saveMemory, addConversation, addOrder, addEvent, getMemorySummary, updateCore } = require('../memory/memory');
const { searchWeb, needsSearch } = require('../search/search');
const Groq = require('groq-sdk');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// BroCode ki personality
const BROCODE_PERSONALITY = `
Tu BroCode hai — ek personal AI dost jo sirf is user ka hai.

PERSONALITY:
- Tu seedha bolta hai — sach bolta hai, chahe sunne mein kadwa lage
- Tu dost ki tarah baat karta hai — formal nahi, real hai
- Tu kabhi haan mein haan nahi milata — galat cheez galat bolta hai
- Tu judge nahi karta — but sach zaroor bolta hai
- Tu caring hai — user ki genuine parwah karta hai
- Tu Hindi/Hinglish mein baat karta hai — jaise dost karta hai
- Tu memory use karta hai — "tune pehle bola tha..." wali approach
- Tu proactive hai — patterns dekhta hai, khud suggest karta hai

RULES:
1. Kabhi fake positivity mat de
2. Memory mein jo hai usse connect kar
3. Agar search result hai toh use karo — accurate raho
4. Short replies — dost jaisa, essay nahi
5. Emoji use karo — but zyada nahi
6. User ki feelings validate karo — but reality bhi batao
`;

// Groq se reply lao
async function getBroCodeReply(userId, userMessage, searchResult = null) {
  const memory = getMemorySummary(userId);
  const mem = loadMemory(userId);
  
  const recentChats = mem.conversations.slice(-10).map(c => ({
    role: c.role === 'user' ? 'user' : 'assistant',
    content: c.message
  }));

  let systemPrompt = BROCODE_PERSONALITY + '\n\n' + memory;
  
  if (searchResult) {
    systemPrompt += `\n\nREAL TIME SEARCH RESULT:\n${searchResult}\nYeh fresh info use kar apne jawab mein.`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentChats,
    { role: 'user', content: userMessage }
  ];

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 500,
    messages: messages
  });

  return response.choices[0].message.content;
}

// /start command
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

// /order command
bot.command('order', async (ctx) => {
  const userId = ctx.from.id.toString();
  const order = ctx.message.text.replace('/order ', '');
  
  if (!order || order === '/order') {
    ctx.reply('Bhai order kya hai? Likh — /order roz subah 7 baje uthao');
    return;
  }
  
  addOrder(userId, order);
  ctx.reply(`Order note kar liya bhai! ✅\n"${order}"\nYeh main hamesha follow karunga! 💪`);
});

// /memory command
bot.command('memory', async (ctx) => {
  const userId = ctx.from.id.toString();
  const mem = loadMemory(userId);
  
  const summary = `
🧠 *Meri Memory — ${mem.core.name}*

👤 *Core*
Naam: ${mem.core.name || '?'}
Age: ${mem.core.age || '?'}
City: ${mem.core.city || '?'}

📅 *Orders* (${mem.orders.length})
${mem.orders.slice(-3).map(o => `• ${o.instruction}`).join('\n') || 'Koi order nahi'}

📌 *Events* (${mem.events.length})
${mem.events.slice(-3).map(e => `• ${e.title} — ${e.date}`).join('\n') || 'Koi event nahi'}

💬 *Conversations saved:* ${mem.conversations.length}
  `.trim();
  
  ctx.replyWithMarkdown(summary);
});

// /event command
bot.command('event', async (ctx) => {
  const userId = ctx.from.id.toString();
  const text = ctx.message.text.replace('/event ', '');
  const parts = text.split('|');
  
  if (parts.length < 2) {
    ctx.reply('Format: /event Exam|2026-06-15');
    return;
  }
  
  addEvent(userId, { title: parts[0].trim(), date: parts[1].trim() });
  ctx.reply(`Event note kar liya! ✅\n📅 ${parts[0].trim()} — ${parts[1].trim()}`);
});

// Main message handler
bot.on('text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userMessage = ctx.message.text;
  const mem = loadMemory(userId);

  // Onboarding flow
  if (mem.core.onboarding === 'name') {
    updateCore(userId, { name: userMessage, onboarding: 'age' });
    ctx.reply(`${userMessage}! Accha naam hai! 😄\n\nKitne saal ka hai tu?`);
    return;
  }
  
  if (mem.core.onboarding === 'age') {
    updateCore(userId, { age: userMessage, onboarding: 'city' });
    ctx.reply(`Theek hai! Kaunse city mein hai?`);
    return;
  }
  
  if (mem.core.onboarding === 'city') {
    updateCore(userId, { city: userMessage, onboarding: 'occupation' });
    ctx.reply(`${userMessage}! Cool!\n\nKya karta hai — student hai ya job?`);
    return;
  }

  if (mem.core.onboarding === 'occupation') {
    updateCore(userId, { occupation: userMessage, onboarding: 'goal' });
    ctx.reply(`Nice! Ek cheez bata — abhi life mein sabse bada goal kya hai?`);
    return;
  }

  if (mem.core.onboarding === 'goal') {
    const goals = mem.core.goals || [];
    goals.push(userMessage);
    updateCore(userId, { goals, onboarding: 'done' });
    ctx.reply(`Goal note kar liya! 🎯\n\n"${userMessage}"\n\nBhai main yaad rakhunga — aur remind bhi karunga!\n\nAb baat kar — kuch bhi puch, kuch bhi bol. Main hoon! 💪`);
    return;
  }

  ctx.sendChatAction('typing');

  try {
    let searchResult = null;
    if (needsSearch(userMessage)) {
      searchResult = await searchWeb(userMessage);
    }

    const reply = await getBroCodeReply(userId, userMessage, searchResult);

    addConversation(userId, 'user', userMessage);
    addConversation(userId, 'assistant', reply);

    ctx.reply(reply);

  } catch (error) {
    console.error('Bot error:', error);
    ctx.reply('Bhai thoda dikkat aa gayi — ek minute mein wapas aata hoon! 🔧');
  }
});

module.exports = bot;