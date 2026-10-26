const express = require('express');
const Podman = require('../services/podman.service');
const asyncHandler = require('../middlewares/async-handler.middleware');

const router = express.Router();

// GET /api/events
router.get('/', asyncHandler(async (req, res) => {
  const since = req.query.since || '24h';
  const events = await Podman.getEvents(since);
  res.json({ success: true, data: events });
}));

// GET /api/events/stream - Real-time events SSE stream
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const proc = Podman.spawnEvents();
  proc.stdout.on('data', chunk => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        res.write(`data: ${JSON.stringify(parsed)}\n\n`);
      } catch {
        res.write(`data: ${JSON.stringify({ raw: line })}\n\n`);
      }
    }
  });

  proc.stderr.on('data', () => {
    // ignore stderr noise
  });

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    try { proc.kill('SIGTERM'); } catch {}
  });
});

module.exports = router;
