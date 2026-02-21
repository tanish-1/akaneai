const express = require('express');
const router = express.Router();
const Memory = require('../models/Memory');

// GET /api/memory/:userId
router.get('/:userId', async (req, res) => {
    try {
        const memories = await Memory.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.json(memories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/memory
router.post('/', async (req, res) => {
    try {
        const { userId, type, content, title, category, tags, priority, deadline, progress, datetime, repeat } = req.body;
        const newMemory = new Memory({
            userId,
            type,
            title,
            category,
            content,
            tags,
            priority,
            deadline,
            progress,
            datetime,
            repeat
        });
        await newMemory.save();
        res.status(201).json(newMemory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/memory/:id/status
router.patch('/:id/status', async (req, res) => {
    try {
        const memory = await Memory.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status, updatedAt: Date.now() },
            { new: true }
        );
        if (!memory) return res.status(404).json({ error: 'Memory not found' });
        res.json(memory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/memory/:id
router.delete('/:id', async (req, res) => {
    try {
        await Memory.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
