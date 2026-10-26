const express = require('express');
const path = require('path');
const apiRoutes = require('./routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

const WEB_PUBLIC_DIR = path.resolve(__dirname, '../../web/public');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(WEB_PUBLIC_DIR));

// Mount modular API routes
app.use('/api', apiRoutes);

// Fallback to index.html for SPA client-side routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(WEB_PUBLIC_DIR, 'index.html'));
  }
  next();
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;
