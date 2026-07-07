const Coupon = require('../models/Coupon');

const createCoupon = async (couponData) => {
  const coupon = await Coupon.create(couponData);
  return coupon;
};

const updateCoupon = async (couponId, couponData) => {
  const coupon = await Coupon.findByIdAndUpdate(
    couponId,
    couponData,
    { new: true, runValidators: true }
  );

  if (!coupon) {
    const error = new Error('Coupon not found');
    error.name = 'CustomError';
    error.statusCode = 404;
    error.errors = [];
    throw error;
  }

  return coupon;
};

const getCoupons = async (filters) => {
  const { page = 1, limit = 10, isActive } = filters;
  const query = {};

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  const skip = (page - 1) * limit;

  const [coupons, total] = await Promise.all([
    Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Coupon.countDocuments(query),
  ]);

  return {
    coupons,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit),
    },
  };
};

const getCouponById = async (couponId) => {
  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    const error = new Error('Coupon not found');
    error.name = 'CustomError';
    error.statusCode = 404;
    error.errors = [];
    throw error;
  }

  return coupon;
};

const deleteCoupon = async (couponId) => {
  const coupon = await Coupon.findByIdAndDelete(couponId);

  if (!coupon) {
    const error = new Error('Coupon not found');
    error.name = 'CustomError';
    error.statusCode = 404;
    error.errors = [];
    throw error;
  }

  return { message: 'Coupon deleted successfully' };
};

module.exports = {
  createCoupon,
  updateCoupon,
  getCoupons,
  getCouponById,
  deleteCoupon,
};
