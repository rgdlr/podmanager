const express = require('express');
const Podman = require('../services/podman.service');
const asyncHandler = require('../middlewares/async-handler.middleware');

const router = express.Router();

// GET /api/images
router.get('/', asyncHandler(async (req, res) => {
  const images = await Podman.listImages();
  res.json({ success: true, data: images });
}));

// GET /api/images/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const data = await Podman.inspectImage(req.params.id);
  res.json({ success: true, data });
}));

// GET /api/images/pull-stream - Pull image with streaming updates
router.get('/pull-stream', (req, res) => {
  const image = req.query.image;
  if (!image) {
    return res.status(400).send('Image name is required');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  Podman.pullImage(image, text => {
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
  })
    .then(() => {
      res.write(`event: complete\ndata: ${JSON.stringify({ success: true })}\n\n`);
      res.end();
    })
    .catch(err => {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
});

// POST /api/images/pull
router.post('/pull', asyncHandler(async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ success: false, error: 'Image name is required' });
  }
  const result = await Podman.pullImage(image);
  res.json({ success: true, message: `Pulled ${image}`, ...result });
}));

// DELETE /api/images/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const force = req.query.force === 'true';
  const result = await Podman.removeImage(req.params.id, force);
  res.json({ success: true, message: 'Image removed', ...result });
}));

module.exports = router;
