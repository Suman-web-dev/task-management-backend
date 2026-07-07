const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateCreateCoupon, validateUpdateCoupon, validateGetCoupons } = require('../validators/couponValidator');

// Admin-only routes
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validateCreateCoupon,
  couponController.createCoupon
);
router.get(
  '/',
  authenticate,
  authorize('admin'),
  validateGetCoupons,
  couponController.getCoupons
);
router.get(
  '/:id',
  authenticate,
  authorize('admin'),
  couponController.getCouponById
);
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validateUpdateCoupon,
  couponController.updateCoupon
);
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  couponController.deleteCoupon
);

module.exports = router;
