const express = require('express');
const router = express.Router();
const Memory = require('../models/Memory');
const { callAI } = require('./chat');

// Helper to get start of day for accurate comparison
const getStartOfDay = (date) => new Date(date.setHours(0, 0, 0, 0));

// GET /api/analytics/:userId
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const days = parseInt(req.query.days) || 7;

        const now = new Date();
        const pastDate = new Date(now);
        pastDate.setDate(now.getDate() - days);

        // Fetch user's goals
        const allGoals = await Memory.find({ userId, type: 'goal' }).sort({ createdAt: -1 });

        // ─── Streaks and Completion Math ──────────────────────────────
        let currentStreak = 0;
        let longestStreak = 0;
        let completedGoalsCount = 0;
        let totalGoalsCount = allGoals.length;

        // Find completed goals to calculate streaks based on status or progress
        const completedGoals = allGoals.filter(g => g.progress >= 100 || g.status === 'completed');
        completedGoalsCount = completedGoals.length;

        // Streak calculation (consecutive days with at least one completed goal)
        const completionDates = [...new Set(completedGoals.map(g => getStartOfDay(new Date(g.updatedAt)).getTime()))].sort((a, b) => b - a);

        let tempStreak = 0;
        let lastDateChecked = getStartOfDay(new Date()).getTime();

        for (let i = 0; i < completionDates.length; i++) {
            const date = completionDates[i];
            const diffInDays = Math.floor((lastDateChecked - date) / (1000 * 60 * 60 * 24));

            if (diffInDays === 0 || diffInDays === 1) {
                // Same day or consecutive
                if (diffInDays === 1 || tempStreak === 0) tempStreak++;
                lastDateChecked = date;
            } else {
                // Streak broken
                longestStreak = Math.max(longestStreak, tempStreak);
                if (i === 0 || (i > 0 && Math.floor((getStartOfDay(new Date()).getTime() - completionDates[0]) / 86400000) <= 1)) {
                    // Current streak is valid if the last completed goal was today or yesterday
                } else {
                    tempStreak = 0;
                }
                break;
            }
        }
        currentStreak = tempStreak;
        longestStreak = Math.max(longestStreak, currentStreak);

        const completionRate = totalGoalsCount > 0 ? Math.round((completedGoalsCount / totalGoalsCount) * 100) : 0;

        // ─── Chart Data (Last N days) ─────────────────────────────────
        const chartData = [];
        for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setDate(d.getDate() - (days - 1) + i);
            const startDay = getStartOfDay(new Date(d));
            const endDay = new Date(startDay.getTime() + 86400000);

            // Count goals completed on this day
            const dailyCompleted = completedGoals.filter(g => {
                const updated = new Date(g.updatedAt);
                return updated >= startDay && updated < endDay;
            });

            chartData.push({
                date: d.toLocaleDateString('en-US', { weekday: 'short' }),
                completed: dailyCompleted.length
            });
        }

        res.json({
            currentStreak,
            longestStreak,
            completionRate,
            totalGoals: totalGoalsCount,
            completedGoals: completedGoalsCount,
            chartData
        });

    } catch (err) {
        console.error('Analytics fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// GET /api/analytics/:userId/insights
router.get('/:userId/insights', async (req, res) => {
    try {
        const { userId } = req.params;

        // Fetch recent memories to generate insights
        const recentMemories = await Memory.find({ userId }).sort({ createdAt: -1 }).limit(30);

        if (recentMemories.length === 0) {
            return res.json({ insight: "You haven't logged any goals or notes yet. Let's get started!" });
        }

        const contextStr = recentMemories.map(m => `[${new Date(m.createdAt).toLocaleDateString()}] Type: ${m.type}, Category: ${m.category}, Title: "${m.title}", Status: ${(m.progress >= 100 || m.status === 'completed') ? 'Completed' : 'Pending'}`).join('\n');

        const systemPrompt = `You are Akane-chan, analyzing the user's weekly productivity. 
Based on these recent records, write a short, personalized, 2-3 sentence insight paragraph. 
Identify patterns, like what categories they focus on, if they are neglecting health, or praise them for high completion.
Keep it encouraging, modern, and in a "Gen Z bestie" tone with emojis. No cap.

CRITICAL INSTRUCTION: ONLY mention goals or notes that are explicitly present in the User Records below. Do NOT invent new goals or tell them to do something that is not in the list. Praise them especially for any completed tasks! DO NOT use any markdown links.

User Records:
${contextStr}`;

        const { reply } = await callAI(systemPrompt, [{ role: 'user', content: "Generate my weekly insight based on my records." }]);
        res.json({ insight: reply });

    } catch (err) {
        console.error('Insight generation error:', err);
        res.status(500).json({ error: 'Failed to generate insights' });
    }
});

module.exports = router;
