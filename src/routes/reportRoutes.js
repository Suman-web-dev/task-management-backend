const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

// Admin-only routes
router.get(
  '/summary',
  authenticate,
  authorize('admin'),
  reportController.getLast30DaysSummary
);
router.get(
  '/daily-revenue',
  authenticate,
  authorize('admin'),
  reportController.getDailyRevenueTrend
);
router.get(
  '/top-products',
  authenticate,
  authorize('admin'),
  reportController.getTopSellingProducts
);
router.get(
  '/category-breakdown',
  authenticate,
  authorize('admin'),
  reportController.getCategorySalesBreakdown
);
router.get(
  '/top-customers',
  authenticate,
  authorize('admin'),
  reportController.getTopCustomers
);

module.exports = router;
