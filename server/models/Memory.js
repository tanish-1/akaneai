const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    type: {
        type: String,
        required: true,
        enum: ['goal', 'project', 'note', 'preference', 'fact', 'reminder'],
        default: 'note'
    },
    title: { type: String }, // For structured cards
    category: {
        type: String,
        enum: ['career', 'health', 'personal', 'mood', 'learning', 'other'],
        default: 'personal'
    },
    content: { type: String, required: true },
    tags: [{ type: String }],
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
    deadline: { type: Date }, // For goals
    progress: { type: Number, default: 0 }, // 0-100 for goals
    datetime: { type: Date }, // For reminders
    repeat: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
    notified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

memorySchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Memory', memorySchema);
