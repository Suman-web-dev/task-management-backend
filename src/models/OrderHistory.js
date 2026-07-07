const mongoose = require('mongoose');

const orderHistorySchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  fromStatus: {
    type: String,
    required: true,
  },
  toStatus: {
    type: String,
    required: true,
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  changedByRole: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Index for order history lookups
orderHistorySchema.index({ order: 1, createdAt: -1 });

// Index for user activity tracking
orderHistorySchema.index({ changedBy: 1, createdAt: -1 });

module.exports = mongoose.model('OrderHistory', orderHistorySchema);
