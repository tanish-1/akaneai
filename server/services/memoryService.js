const Memory = require('../models/Memory');

/**
 * Fetches user memories and formats them for injection into the AI system prompt
 */
async function getFormattedMemories(userId) {
    try {
        const memories = await Memory.find({ userId, status: 'active' }).sort({ createdAt: -1 }).limit(20);

        if (!memories.length) return '';

        const grouped = {
            goal: [],
            project: [],
            note: [],
            preference: [],
            fact: []
        };

        memories.forEach(m => {
            if (grouped[m.type]) grouped[m.type].push(m.content);
        });

        let formatted = '\n\n📋 USER MEMORY CONTEXT:\n';

        if (grouped.goal.length) {
            formatted += `\n🎯 Goals:\n${grouped.goal.map(g => `  - ${g}`).join('\n')}`;
        }
        if (grouped.project.length) {
            formatted += `\n🚀 Active Projects:\n${grouped.project.map(p => `  - ${p}`).join('\n')}`;
        }
        if (grouped.preference.length) {
            formatted += `\n⚙️ Preferences:\n${grouped.preference.map(p => `  - ${p}`).join('\n')}`;
        }
        if (grouped.fact.length) {
            formatted += `\n📌 Key Facts:\n${grouped.fact.map(f => `  - ${f}`).join('\n')}`;
        }
        if (grouped.note.length) {
            formatted += `\n📝 Notes:\n${grouped.note.map(n => `  - ${n}`).join('\n')}`;
        }

        return formatted;
    } catch (err) {
        console.error('Memory fetch error:', err.message);
        return '';
    }
}

module.exports = { getFormattedMemories };
