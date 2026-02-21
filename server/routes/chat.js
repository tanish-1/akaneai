const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const { getFormattedMemories } = require('../services/memoryService');

// ─── Lazy-load AI clients ─────────────────────────────────────────────────────
let groqClient = null;
let geminiClient = null;
let openaiClient = null;

function isKeySet(key) {
    return key && !key.startsWith('your_') && key.length > 10;
}

function getGroqClient() {
    if (!groqClient) {
        const Groq = require('groq-sdk');
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groqClient;
}

function getGeminiClient() {
    if (!geminiClient) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return geminiClient;
}

function getOpenAIClient() {
    if (!openaiClient) {
        const OpenAI = require('openai');
        openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openaiClient;
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(memoryContext, tone = 'professional') {
    let prompt = `You are Akane-chan, a highly intelligent, warm, and proactive personal AI assistant.
You are like a high-end personal manager — sharp, aware, and always one step ahead.
You track the user's goals, projects, preferences, and life context.
You respond concisely but with depth. You occasionally reference the user's goals to show awareness.
You are not just a chatbot — you are a personal intelligence center.

${memoryContext}

Guidelines:
- Keep responses focused and actionable.
- IMPORTANT: IF AND ONLY IF the user's LATEST message explicitly shares a BRAND NEW goal, note, or learning, append a special tag at the VERY END of your response.
- CRITICAL: DO NOT extract, repeat, or save anything that is already present in the "USER MEMORY CONTEXT".
- CRITICAL: If the user is just chatting, asking a question, or discussing an existing goal, DO NOT output the <memory_update> tag.
- The JSON inside MUST follow this schema:
  <memory_update>[{
    "type": "goal|note|learning",
    "category": "career|health|personal|mood|learning",
    "title": "short descriptive title",
    "content": "detailed context",
    "priority": "low|medium|high",
    "deadline": "YYYY-MM-DD (optional)",
    "progress": 0-100 (optional)
  }]</memory_update>
- Reference past context when relevant.`;

    if (tone === 'genz') {
        prompt += '\n- Tone: Act like a super chill, down-to-earth Gen Z bestie. Use modern slang gracefully, emojis, and keep it high-energy and positive. No cap, fr fr! ✨😎';
    } else if (tone === 'savage') {
        prompt += '\n- Tone: You are my savage AI assistant. Be brutally honest, highly sarcastic, and roast me if I am slacking. No sugarcoating, just facts and a little shade, but still be helpful. 💅🔥';
    } else {
        prompt += '\n- Tone: Be encouraging, professional, and supportive.';
    }

    return prompt;
}

// ─── AI provider calls ────────────────────────────────────────────────────────

async function callGroq(systemPrompt, messages) {
    const groq = getGroqClient();
    const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // fast, free, high quality
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages
        ],
        max_tokens: 600,
        temperature: 0.75
    });
    return response.choices[0].message.content;
}

async function callGemini(systemPrompt, messages) {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const history = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({ history, systemInstruction: systemPrompt });
    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
}

async function callOpenAI(systemPrompt, messages) {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 500,
        temperature: 0.7
    });
    return response.choices[0].message.content;
}

// Try providers in priority order, auto-fallback
async function callAI(systemPrompt, messages) {
    const provider = process.env.AI_PROVIDER || 'groq';

    // Build ordered list of providers to try
    const order = [provider];
    ['groq', 'gemini', 'openai'].forEach(p => { if (!order.includes(p)) order.push(p); });

    const callers = {
        groq: () => isKeySet(process.env.GROQ_API_KEY) ? callGroq(systemPrompt, messages) : null,
        gemini: () => isKeySet(process.env.GEMINI_API_KEY) ? callGemini(systemPrompt, messages) : null,
        openai: () => isKeySet(process.env.OPENAI_API_KEY) ? callOpenAI(systemPrompt, messages) : null,
    };

    let lastError = null;
    for (const p of order) {
        const caller = callers[p];
        if (!caller) continue;
        try {
            const result = await caller();
            if (result) {
                console.log(`✅ AI response from: ${p}`);
                return { reply: result, provider: p };
            }
        } catch (err) {
            console.error(`❌ ${p} failed:`, err.message);
            lastError = err;
        }
    }

    // Demo mode — no valid API key found
    return {
        reply: `I'm Nova, your personal AI assistant! 🌟 To enable full AI, add a free API key to \`server/.env\`:\n\n**Option 1 (Recommended — Free):** Get a Groq key at https://console.groq.com\n**Option 2 (Free):** Get a Gemini key at https://aistudio.google.com/app/apikey\n\nThen set it in \`server/.env\` and restart the server.`,
        provider: 'demo'
    };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/chat
router.post('/', async (req, res) => {
    try {
        const { userId = 'default', message, tone = 'professional' } = req.body;
        if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

        // Get or create conversation
        let conversation = await Conversation.findOne({ userId }).sort({ updatedAt: -1 });
        if (!conversation) conversation = new Conversation({ userId, messages: [] });

        // Short-term memory: last 10 messages
        const recentMessages = conversation.messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
        }));
        recentMessages.push({ role: 'user', content: message });

        // Long-term memory injection
        const memoryContext = await getFormattedMemories(userId);
        const systemPrompt = buildSystemPrompt(memoryContext, tone);

        // Call AI with auto-fallback
        let { reply, provider } = await callAI(systemPrompt, recentMessages);

        // ─── Memory Extraction ───
        let memoryAdded = false;
        let addedMemoryTypes = [];
        const memoryTagRegex = /<memory_update>([\s\S]*?)<\/memory_update>/;
        const match = reply.match(memoryTagRegex);

        if (match) {
            try {
                const extractedData = JSON.parse(match[1]);
                if (Array.isArray(extractedData)) {
                    const Memory = require('../models/Memory');

                    // Filter down to only allowed types
                    const allowedTypes = ['goal', 'note', 'learning'];
                    const filteredData = extractedData.filter(item => allowedTypes.includes(item.type));

                    for (const item of filteredData) {
                        // Anti-duplication check: Skip if memory with same title and type exists for user
                        const existing = await Memory.findOne({
                            userId,
                            title: item.title,
                            type: item.type
                        });

                        if (existing) {
                            console.log(`⏭️ Skipping duplicate memory: ${item.title}`);
                            continue;
                        }

                        const newMemory = new Memory({
                            userId,
                            type: item.type,
                            title: item.title,
                            category: item.category || 'personal',
                            content: item.content,
                            priority: item.priority || 'medium',
                            deadline: item.deadline ? new Date(item.deadline) : undefined,
                            progress: item.progress || 0,
                            datetime: item.datetime ? new Date(item.datetime) : undefined,
                            repeat: item.repeat || 'none'
                        });
                        await newMemory.save();
                        memoryAdded = true;
                        addedMemoryTypes.push(newMemory.type);
                    }
                    console.log(`🧠 Extracted ${filteredData.length} valid memories (Added ${addedMemoryTypes.length})`);
                }
            } catch (err) {
                console.error('Failed to parse or save extracted memory:', err.message);
            }
            // Clean the reply for the UI
            reply = reply.replace(memoryTagRegex, '').trim();
        }

        // Save conversation
        conversation.messages.push({ role: 'user', content: message });
        conversation.messages.push({ role: 'assistant', content: reply });
        if (conversation.messages.length > 100) {
            conversation.messages = conversation.messages.slice(-100);
        }
        await conversation.save();

        res.json({ reply, conversationId: conversation._id, provider, memoryAdded, addedMemoryTypes });

    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// GET /api/chat/history/:userId
router.get('/history/:userId', async (req, res) => {
    try {
        const conversation = await Conversation.findOne({ userId: req.params.userId }).sort({ updatedAt: -1 });
        if (!conversation) return res.json({ messages: [] });
        res.json({ messages: conversation.messages.slice(-50) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/chat/history/:userId
router.delete('/history/:userId', async (req, res) => {
    try {
        await Conversation.deleteOne({ userId: req.params.userId });
        res.json({ message: 'Chat history cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
module.exports.callAI = callAI;
