// BroCode Memory System 🧠
// Teen layers — Core, Event, Emotional

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data');

// Data folder banao agar nahi hai
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

// User ki memory file path
function getUserFile(userId) {
  return path.join(DB_PATH, `${userId}.json`);
}

// Default empty memory
function defaultMemory(userId) {
  return {
    userId,
    core: {
      name: '',
      age: '',
      city: '',
      occupation: '',
      wakeTime: '07:00',
      sleepTime: '23:00',
      goals: [],
      personality: ''
    },
    events: [],        // Exams, meetings, deadlines
    emotional: [],     // Mood patterns
    orders: [],        // Permanent orders — "roz 7 baje uthao"
    conversations: [], // Last 50 messages
    financial: {
      monthlyBudget: 0,
      spent: 0,
      savings: 0,
      goals: []
    },
    academics: {
      subjects: [],
      exams: [],
      weakAreas: []
    },
    career: {
      goals: [],
      skills: [],
      internships: []
    },
    sports: {
      activities: [],
      schedule: []
    },
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };
}

// Memory load karo
function loadMemory(userId) {
  const file = getUserFile(userId);
  if (!fs.existsSync(file)) {
    const mem = defaultMemory(userId);
    saveMemory(userId, mem);
    return mem;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Memory save karo
function saveMemory(userId, data) {
  data.lastSeen = new Date().toISOString();
  fs.writeFileSync(getUserFile(userId), JSON.stringify(data, null, 2));
}

// Conversation add karo — last 50 rakho
function addConversation(userId, role, message) {
  const mem = loadMemory(userId);
  mem.conversations.push({
    role,
    message,
    timestamp: new Date().toISOString()
  });
  // Sirf last 50 conversations rakho
  if (mem.conversations.length > 50) {
    mem.conversations = mem.conversations.slice(-50);
  }
  saveMemory(userId, mem);
}

// Event add karo
function addEvent(userId, event) {
  const mem = loadMemory(userId);
  mem.events.push({
    ...event,
    addedAt: new Date().toISOString()
  });
  saveMemory(userId, mem);
}

// Order add karo — permanent instructions
function addOrder(userId, order) {
  const mem = loadMemory(userId);
  mem.orders.push({
    instruction: order,
    addedAt: new Date().toISOString(),
    active: true
  });
  saveMemory(userId, mem);
}

// Core info update karo
function updateCore(userId, updates) {
  const mem = loadMemory(userId);
  mem.core = { ...mem.core, ...updates };
  saveMemory(userId, mem);
}

// Memory summary banao — Claude ko dene ke liye
function getMemorySummary(userId) {
  const mem = loadMemory(userId);
  
  return `
=== BROCODE MEMORY — ${mem.core.name || 'User'} ===

CORE INFO:
- Naam: ${mem.core.name || 'Unknown'}
- Age: ${mem.core.age || 'Unknown'}  
- City: ${mem.core.city || 'Unknown'}
- Occupation: ${mem.core.occupation || 'Unknown'}
- Wake time: ${mem.core.wakeTime}
- Sleep time: ${mem.core.sleepTime}
- Goals: ${mem.core.goals.join(', ') || 'None set'}

PERMANENT ORDERS:
${mem.orders.filter(o => o.active).map(o => `- ${o.instruction}`).join('\n') || 'None'}

UPCOMING EVENTS:
${mem.events.slice(-5).map(e => `- ${e.title} on ${e.date}`).join('\n') || 'None'}

FINANCIAL:
- Budget: ₹${mem.financial.monthlyBudget}/month
- Spent: ₹${mem.financial.spent}
- Savings goal: ₹${mem.financial.savings}

ACADEMICS:
- Subjects: ${mem.academics.subjects.join(', ') || 'None'}
- Weak areas: ${mem.academics.weakAreas.join(', ') || 'None'}

CAREER GOALS:
${mem.career.goals.join(', ') || 'None set'}

RECENT MOOD PATTERNS:
${mem.emotional.slice(-3).map(e => `- ${e.mood} on ${e.date}: ${e.note}`).join('\n') || 'No patterns yet'}

LAST SEEN: ${mem.lastSeen}
=== END OF MEMORY ===
  `.trim();
}

module.exports = {
  loadMemory,
  saveMemory,
  addConversation,
  addEvent,
  addOrder,
  updateCore,
  getMemorySummary
};