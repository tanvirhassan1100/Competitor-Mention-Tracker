require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const analyzeRouter = require('../routes/analyze');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', analyzeRouter);

// Health check
app.get('/api/health', (req, res) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  res.json({
    status: 'ok',
    anthropicKeyConfigured: hasKey,
    timestamp: new Date().toISOString()
  });
});

// Catch-all: serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀  Deskflow Intel running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️   ANTHROPIC_API_KEY is not set — Claude analysis will fail.');
    console.warn('     Copy .env.example to .env and add your key.\n');
  } else {
    console.log('✅  Anthropic API key loaded\n');
  }
});
