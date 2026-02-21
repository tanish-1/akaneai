const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    preferences: {
        language: { type: String, default: 'en' },
        voiceEnabled: { type: Boolean, default: true },
        personalityMode: { type: String, default: 'professional', enum: ['professional', 'friendly', 'concise'] }
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
