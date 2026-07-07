const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['flat', 'percentage'],
    required: [true, 'Coupon type is required'],
  },
  value: {
    type: Number,
    required: [true, 'Coupon value is required'],
    min: [0, 'Coupon value cannot be negative'],
  },
  maxCap: {
    type: Number,
    default: null, // For percentage discounts, maximum discount amount
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required'],
  },
  maxUsage: {
    type: Number,
    required: [true, 'Max usage limit is required'],
    min: [1, 'Max usage must be at least 1'],
  },
  perUserUsage: {
    type: Number,
    required: [true, 'Per user usage limit is required'],
    min: [1, 'Per user usage must be at least 1'],
  },
  minOrderValue: {
    type: Number,
    default: 0,
  },
  currentUsage: {
    type: Number,
    default: 0,
  },
  userUsage: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    count: {
      type: Number,
      default: 0,
    },
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Index for finding active coupons
couponSchema.index({ isActive: 1, expiryDate: 1 });

// Index for user usage lookups
couponSchema.index({ 'userUsage.userId': 1 });

module.exports = mongoose.model('Coupon', couponSchema);
