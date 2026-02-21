const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');

// GET /api/conversations/:userId
router.get('/:userId', async (req, res) => {
    try {
        const conversations = await Conversation.find({ userId: req.params.userId })
            .sort({ updatedAt: -1 })
            .limit(10)
            .select('_id updatedAt messages');
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/conversations/:userId
router.delete('/:userId', async (req, res) => {
    try {
        await Conversation.deleteMany({ userId: req.params.userId });
        res.json({ success: true, message: 'Conversation history cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
