const express = require('express');
const router = express.Router();
const DailyReport = require('../models/DailyReport');
const Memory = require('../models/Memory');

// GET /api/report/:userId/:date
router.get('/:userId/:date', async (req, res) => {
    try {
        const { userId, date } = req.params;
        let report = await DailyReport.findOne({ userId, date });

        if (!report) {
            // If no report exists, return empty or trigger generation
            return res.json({ message: 'No report for this date' });
        }

        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/report/generate (Manual trigger for now)
router.post('/generate', async (req, res) => {
    try {
        const { userId, date } = req.body; // date format YYYY-MM-DD

        // 1. Aggregrate Activity
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        const memories = await Memory.find({
            userId,
            createdAt: { $gte: start, $lte: end }
        });

        const stats = {
            goalsUpdated: memories.filter(m => m.type === 'goal').length,
            tasksCompleted: memories.filter(m => m.status === 'completed').length,
            notesAdded: memories.filter(m => m.type === 'note').length,
            deadlinesApproaching: await Memory.countDocuments({
                userId,
                type: 'goal',
                deadline: { $lte: new Date(Date.now() + 86400000 * 3) },
                status: 'active'
            })
        };

        // 2. Generate AI Summary (Mock for now, would use OpenAI/Gemini)
        const summary = `You've had a productive day! You added ${stats.notesAdded} new notes and updated ${stats.goalsUpdated} goals. Don't forget your upcoming deadline for your career projects.`;

        let report = await DailyReport.findOneAndUpdate(
            { userId, date },
            {
                summary,
                stats,
                suggestions: ['Review your React patterns', 'Set a deadline for the design doc']
            },
            { upsert: true, new: true }
        );

        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
