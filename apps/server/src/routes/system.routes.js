const express = require('express');
const Podman = require('../services/podman.service');
const asyncHandler = require('../middlewares/async-handler.middleware');

const router = express.Router();

// GET /api/system/info
router.get('/info', asyncHandler(async (req, res) => {
  const info = await Podman.getSystemInfo();
  res.json({ success: true, data: info });
}));

// GET /api/system/df
router.get('/df', asyncHandler(async (req, res) => {
  const df = await Podman.getSystemDf();
  res.json({ success: true, data: df });
}));

// POST /api/system/prune
router.post('/prune', asyncHandler(async (req, res) => {
  const { type = 'all' } = req.body;
  const result = await Podman.prune(type);
  res.json({ success: true, message: `Pruned ${type}`, ...result });
}));

module.exports = router;
