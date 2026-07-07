const rateLimit = require('express-rate-limit');

const orderPlacementLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 5 requests per minute
  message: {
    success: false,
    message: 'Too many order placement attempts, please try again later',
    errors: [],
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 5 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    errors: [],
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { orderPlacementLimiter, authLimiter };
