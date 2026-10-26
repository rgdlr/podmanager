const express = require('express');
const systemRoutes = require('./system.routes');
const eventsRoutes = require('./events.routes');
const containersRoutes = require('./containers.routes');
const podsRoutes = require('./pods.routes');
const imagesRoutes = require('./images.routes');
const volumesRoutes = require('./volumes.routes');
const networksRoutes = require('./networks.routes');

const router = express.Router();

router.use('/system', systemRoutes);
router.use('/events', eventsRoutes);
router.use('/containers', containersRoutes);
router.use('/pods', podsRoutes);
router.use('/images', imagesRoutes);
router.use('/volumes', volumesRoutes);
router.use('/networks', networksRoutes);

module.exports = router;
