const Coupon = require('../models/Coupon');
const mongoose = require('mongoose');

/**
 * Validate and apply coupon with concurrency safety
 * Uses atomic updates to prevent over-usage
 */
const validateAndApplyCoupon = async (couponCode, userId, orderTotal) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
      expiryDate: { $gt: new Date() },
    }).session(session);

    if (!coupon) {
      throw new Error('Invalid or expired coupon');
    }

    if (orderTotal < coupon.minOrderValue) {
      throw new Error(`Minimum order value ₹${coupon.minOrderValue} required for this coupon`);
    }

    // Check global usage limit atomically
    const couponUpdate = await Coupon.findOneAndUpdate(
      {
        _id: coupon._id,
        currentUsage: { $lt: coupon.maxUsage },
      },
      {
        $inc: { currentUsage: 1 },
      },
      { session, new: true }
    );

    if (!couponUpdate) {
      throw new Error('Coupon usage limit exceeded');
    }

    // Check per-user usage limit atomically
    const userUsageEntry = couponUpdate.userUsage.find(
      u => u.userId.toString() === userId.toString()
    );

    if (userUsageEntry && userUsageEntry.count >= coupon.perUserUsage) {
      // Rollback global usage increment
      await Coupon.findByIdAndUpdate(
        coupon._id,
        { $inc: { currentUsage: -1 } },
        { session }
      );
      throw new Error('You have reached the maximum usage limit for this coupon');
    }

    // Increment user usage
    if (userUsageEntry) {
      await Coupon.findOneAndUpdate(
        {
          _id: coupon._id,
          'userUsage.userId': userId,
        },
        {
          $inc: { 'userUsage.$.count': 1 },
        },
        { session }
      );
    } else {
      await Coupon.findByIdAndUpdate(
        coupon._id,
        {
          $push: {
            userUsage: {
              userId: userId,
              count: 1,
            },
          },
        },
        { session }
      );
    }

    await session.commitTransaction();
    return couponUpdate;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Revert coupon usage (for order cancellation/payment failure)
 */
const revertCouponUsage = async (couponCode, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
    }).session(session);

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    // Decrement global usage
    await Coupon.findByIdAndUpdate(
      coupon._id,
      {
        $inc: { currentUsage: -1 },
      },
      { session }
    );

    // Decrement user usage
    const userUsageEntry = coupon.userUsage.find(
      u => u.userId.toString() === userId.toString()
    );

    if (userUsageEntry && userUsageEntry.count > 0) {
      if (userUsageEntry.count === 1) {
        // Remove the entry if count reaches 0
        await Coupon.findByIdAndUpdate(
          coupon._id,
          {
            $pull: {
              userUsage: { userId: userId },
            },
          },
          { session }
        );
      } else {
        await Coupon.findOneAndUpdate(
          {
            _id: coupon._id,
            'userUsage.userId': userId,
          },
          {
            $inc: { 'userUsage.$.count': -1 },
          },
          { session }
        );
      }
    }

    await session.commitTransaction();
    return { message: 'Coupon usage reverted successfully' };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get coupon by code (for validation before order)
 */
const getCouponByCode = async (couponCode) => {
  const coupon = await Coupon.findOne({
    code: couponCode.toUpperCase(),
    isActive: true,
    expiryDate: { $gt: new Date() },
  });

  return coupon;
};

module.exports = {
  validateAndApplyCoupon,
  revertCouponUsage,
  getCouponByCode,
};
