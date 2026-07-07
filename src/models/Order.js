const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative'],
  },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative'],
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
  },
  discountType: {
    type: String,
    enum: ['automatic', 'coupon', 'none'],
    default: 'none',
  },
  couponCode: {
    type: String,
    default: null,
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'Total cannot be negative'],
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING',
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED'],
    default: 'PENDING',
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  cancellationReason: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Index for user orders
orderSchema.index({ user: 1, createdAt: -1 });

// Index for status-based queries
orderSchema.index({ status: 1, createdAt: -1 });

// Index for auto-cancellation job
orderSchema.index({ status: 1, paymentStatus: 1, createdAt: 1 });

// Index for reporting
orderSchema.index({ createdAt: -1 });
orderSchema.index({ total: -1 });

module.exports = mongoose.model('Order', orderSchema);
