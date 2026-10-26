const express = require('express');
const Podman = require('../services/podman.service');
const asyncHandler = require('../middlewares/async-handler.middleware');

const router = express.Router();

// GET /api/networks
router.get('/', asyncHandler(async (req, res) => {
  const networks = await Podman.listNetworks();
  res.json({ success: true, data: networks });
}));

// GET /api/networks/:name
router.get('/:name', asyncHandler(async (req, res) => {
  const data = await Podman.inspectNetwork(req.params.name);
  res.json({ success: true, data });
}));

// POST /api/networks
router.post('/', asyncHandler(async (req, res) => {
  const result = await Podman.createNetwork(req.body);
  res.json({ success: true, message: 'Network created', ...result });
}));

// DELETE /api/networks/:name
router.delete('/:name', asyncHandler(async (req, res) => {
  const result = await Podman.removeNetwork(req.params.name);
  res.json({ success: true, message: 'Network removed', ...result });
}));

module.exports = router;
