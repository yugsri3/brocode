require('dotenv').config();
const express = require('express');
const bot = require('./bot/telegram');
const { startScheduler } = require('./scheduler/proactive');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    status: 'BroCode is alive! 🔥',
    version: '1.0.0'
  });
});

// Scheduler shuru karo
startScheduler(bot);

// Bot shuru karo
bot.launch();
console.log('BroCode bot launched! 🚀');

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BroCode server on port ${PORT} 💪`);
});
