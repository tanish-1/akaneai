const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    summary: { type: String }, // AI generated text
    stats: {
        goalsUpdated: { type: Number, default: 0 },
        tasksCompleted: { type: Number, default: 0 },
        notesAdded: { type: Number, default: 0 },
        deadlinesApproaching: { type: Number, default: 0 }
    },
    suggestions: [{ type: String }],
    learningHours: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

dailyReportSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
