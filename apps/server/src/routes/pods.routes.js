const express = require('express');
const Podman = require('../services/podman.service');
const asyncHandler = require('../middlewares/async-handler.middleware');

const router = express.Router();

// GET /api/pods
router.get('/', asyncHandler(async (req, res) => {
  const pods = await Podman.listPods();
  res.json({ success: true, data: pods });
}));

// GET /api/pods/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const data = await Podman.inspectPod(req.params.id);
  res.json({ success: true, data });
}));

// POST /api/pods
router.post('/', asyncHandler(async (req, res) => {
  const result = await Podman.createPod(req.body);
  res.json({ success: true, message: 'Pod created', ...result });
}));

// POST /api/pods/:id/start
router.post('/:id/start', asyncHandler(async (req, res) => {
  const result = await Podman.startPod(req.params.id);
  res.json({ success: true, message: 'Pod started', ...result });
}));

// POST /api/pods/:id/stop
router.post('/:id/stop', asyncHandler(async (req, res) => {
  const result = await Podman.stopPod(req.params.id);
  res.json({ success: true, message: 'Pod stopped', ...result });
}));

// POST /api/pods/:id/restart
router.post('/:id/restart', asyncHandler(async (req, res) => {
  const result = await Podman.restartPod(req.params.id);
  res.json({ success: true, message: 'Pod restarted', ...result });
}));

// DELETE /api/pods/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const force = req.query.force === 'true';
  const result = await Podman.removePod(req.params.id, force);
  res.json({ success: true, message: 'Pod removed', ...result });
}));

module.exports = router;
