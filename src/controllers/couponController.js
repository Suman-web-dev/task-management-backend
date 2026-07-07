const couponManagementService = require('../services/couponManagementService');

const createCoupon = async (req, res, next) => {
  try {
    const coupon = await couponManagementService.createCoupon(req.body);
    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: { coupon },
    });
  } catch (error) {
    next(error);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await couponManagementService.updateCoupon(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      data: { coupon },
    });
  } catch (error) {
    next(error);
  }
};

const getCoupons = async (req, res, next) => {
  try {
    const result = await couponManagementService.getCoupons(req.query);
    res.status(200).json({
      success: true,
      message: 'Coupons retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getCouponById = async (req, res, next) => {
  try {
    const coupon = await couponManagementService.getCouponById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Coupon retrieved successfully',
      data: { coupon },
    });
  } catch (error) {
    next(error);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    const result = await couponManagementService.deleteCoupon(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCoupon,
  updateCoupon,
  getCoupons,
  getCouponById,
  deleteCoupon,
};
