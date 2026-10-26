const express = require('express');
const Podman = require('../services/podman.service');
const asyncHandler = require('../middlewares/async-handler.middleware');

const router = express.Router();

// GET /api/volumes
router.get('/', asyncHandler(async (req, res) => {
  const volumes = await Podman.listVolumes();
  res.json({ success: true, data: volumes });
}));

// GET /api/volumes/:name
router.get('/:name', asyncHandler(async (req, res) => {
  const data = await Podman.inspectVolume(req.params.name);
  res.json({ success: true, data });
}));

// POST /api/volumes
router.post('/', asyncHandler(async (req, res) => {
  const { name, driver } = req.body;
  const result = await Podman.createVolume(name, driver);
  res.json({ success: true, message: 'Volume created', ...result });
}));

// DELETE /api/volumes/:name
router.delete('/:name', asyncHandler(async (req, res) => {
  const force = req.query.force === 'true';
  const result = await Podman.removeVolume(req.params.name, force);
  res.json({ success: true, message: 'Volume removed', ...result });
}));

module.exports = router;
