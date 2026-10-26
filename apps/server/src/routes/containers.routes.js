const express = require('express');
const Podman = require('../services/podman.service');
const asyncHandler = require('../middlewares/async-handler.middleware');

const router = express.Router();

// GET /api/containers
router.get('/', asyncHandler(async (req, res) => {
  const all = req.query.all !== 'false';
  const containers = await Podman.listContainers(all);
  res.json({ success: true, data: containers });
}));

// GET /api/containers/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const data = await Podman.inspectContainer(req.params.id);
  res.json({ success: true, data });
}));

// POST /api/containers
router.post('/', asyncHandler(async (req, res) => {
  const result = await Podman.createRunContainer(req.body);
  res.json({ success: true, message: 'Container created successfully', ...result });
}));

// POST /api/containers/:id/start
router.post('/:id/start', asyncHandler(async (req, res) => {
  const result = await Podman.startContainer(req.params.id);
  res.json({ success: true, message: 'Container started', ...result });
}));

// POST /api/containers/:id/stop
router.post('/:id/stop', asyncHandler(async (req, res) => {
  const timeout = req.body.timeout ? parseInt(req.body.timeout, 10) : 10;
  const result = await Podman.stopContainer(req.params.id, timeout);
  res.json({ success: true, message: 'Container stopped', ...result });
}));

// POST /api/containers/:id/restart
router.post('/:id/restart', asyncHandler(async (req, res) => {
  const timeout = req.body.timeout ? parseInt(req.body.timeout, 10) : 10;
  const result = await Podman.restartContainer(req.params.id, timeout);
  res.json({ success: true, message: 'Container restarted', ...result });
}));

// POST /api/containers/:id/kill
router.post('/:id/kill', asyncHandler(async (req, res) => {
  const signal = req.body.signal || 'SIGKILL';
  const result = await Podman.killContainer(req.params.id, signal);
  res.json({ success: true, message: `Sent ${signal} to container`, ...result });
}));

// POST /api/containers/:id/pause
router.post('/:id/pause', asyncHandler(async (req, res) => {
  const result = await Podman.pauseContainer(req.params.id);
  res.json({ success: true, message: 'Container paused', ...result });
}));

// POST /api/containers/:id/unpause
router.post('/:id/unpause', asyncHandler(async (req, res) => {
  const result = await Podman.unpauseContainer(req.params.id);
  res.json({ success: true, message: 'Container unpaused', ...result });
}));

// DELETE /api/containers/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const force = req.query.force === 'true';
  const volumes = req.query.volumes === 'true';
  const result = await Podman.removeContainer(req.params.id, force, volumes);
  res.json({ success: true, message: 'Container removed', ...result });
}));

// GET /api/containers/:id/logs
router.get('/:id/logs', asyncHandler(async (req, res) => {
  const tail = req.query.tail || 100;
  const timestamps = req.query.timestamps === 'true';
  const logs = await Podman.getLogs(req.params.id, tail, timestamps);
  res.json({ success: true, logs });
}));

// GET /api/containers/:id/logs/stream - SSE streaming
router.get('/:id/logs/stream', (req, res) => {
  const tail = req.query.tail || 50;
  const timestamps = req.query.timestamps === 'true';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const proc = Podman.spawnLogs(req.params.id, tail, timestamps);

  const sendChunk = chunk => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line) {
        res.write(`data: ${JSON.stringify({ log: line })}\n\n`);
      }
    }
  };

  proc.stdout.on('data', sendChunk);
  proc.stderr.on('data', sendChunk);

  proc.on('close', code => {
    res.write(`event: end\ndata: ${JSON.stringify({ code })}\n\n`);
    res.end();
  });

  req.on('close', () => {
    try { proc.kill('SIGTERM'); } catch {}
  });
});

// POST /api/containers/:id/exec
router.post('/:id/exec', asyncHandler(async (req, res) => {
  const { command, workdir } = req.body;
  if (!command) {
    return res.status(400).json({ success: false, error: 'Command is required' });
  }
  const result = await Podman.execCommand(req.params.id, command, workdir);
  res.json({ success: true, ...result });
}));

module.exports = router;
