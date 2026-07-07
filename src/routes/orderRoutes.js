const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');
const { orderPlacementLimiter } = require('../middleware/rateLimiter');
const {
  validateCreateOrder,
  validateUpdateOrderStatus,
  validateCancelOrder,
  validateGetUserOrders,
} = require('../validators/orderValidator');

// Customer routes
router.post(
  '/',
  authenticate,
  authorize('customer'),
  orderPlacementLimiter,
  validateCreateOrder,
  orderController.createOrder
);
router.get(
  '/my-orders',
  authenticate,
  authorize('customer'),
  validateGetUserOrders,
  orderController.getUserOrders
);
router.get(
  '/:id',
  authenticate,
  orderController.getOrderById
);
router.post(
  '/:id/cancel',
  authenticate,
  authorize('customer'),
  validateCancelOrder,
  orderController.cancelOrder
);
router.get(
  '/:id/history',
  authenticate,
  orderController.getOrderHistory
);

// Admin routes
router.patch(
  '/:id/status',
  authenticate,
  authorize('admin'),
  validateUpdateOrderStatus,
  orderController.updateOrderStatus
);

module.exports = router;
