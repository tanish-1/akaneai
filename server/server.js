require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const chatRoutes = require('./routes/chat');
const memoryRoutes = require('./routes/memory');
const conversationRoutes = require('./routes/conversations');
const reportRoutes = require('./routes/report');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/report', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Nova is online', timestamp: new Date().toISOString() });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/novaai')
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Nova server running on port ${PORT}`);
      console.log(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'gemini'}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    // Start server anyway for testing without DB
    app.listen(PORT, () => {
      console.log(`🚀 Nova server running on port ${PORT} (without DB)`);
    });
  });

module.exports = app;
