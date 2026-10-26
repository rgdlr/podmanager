/**
 * Centralized error handling middleware
 */
function errorHandler(err, req, res, next) {
  console.error('API Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message,
    stderr: err.stderr || null
  });
}

module.exports = errorHandler;
