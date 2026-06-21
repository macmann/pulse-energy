import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chatHandler } from './api/chat.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const isProd = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '1mb' }));

// Enable CORS in development (Vite dev server runs on a different port)
if (!isProd) {
  app.use(cors());
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

app.post('/api/chat', chatHandler);

// Health-check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: isProd ? 'production' : 'development',
    apiKey: !!process.env.OPENAI_API_KEY,
  });
});

// ---------------------------------------------------------------------------
// Production: serve built Vite app
// ---------------------------------------------------------------------------

if (isProd) {
  const distPath = join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // SPA fallback — all non-API GET requests serve index.html
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`
┌─────────────────────────────────────────────┐
│  ⚡ Pulse Energy Server                     │
├─────────────────────────────────────────────┤
│  Mode:     ${isProd ? 'production ' : 'development'}                       │
│  Port:     ${String(PORT).padEnd(33)}│
│  API Key:  ${process.env.OPENAI_API_KEY ? '✓ configured' : '✗ NOT SET — chat will return 503'}${process.env.OPENAI_API_KEY ? '                      ' : '  '}│
└─────────────────────────────────────────────┘
  `);
});
