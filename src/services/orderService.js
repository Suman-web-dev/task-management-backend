const Order = require('../models/Order');
const Product = require('../models/Product');
const OrderHistory = require('../models/OrderHistory');
const pricingService = require('./pricingService');
const couponService = require('./couponService');
const mongoose = require('mongoose');

// Order state machine - valid transitions
const ORDER_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * Check if a status transition is valid
 */
const isValidTransition = (fromStatus, toStatus) => {
  return ORDER_TRANSITIONS[fromStatus]?.includes(toStatus);
};

/**
 * Deduct stock atomically to prevent overselling
 */
const deductStock = async (items) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const item of items) {
      const result = await Product.findOneAndUpdate(
        {
          _id: item.product,
          isActive: true,
          stock: { $gte: item.quantity },
        },
        {
          $inc: { stock: -item.quantity },
        },
        { session, new: true }
      );

      if (!result) {
        throw new Error(`Insufficient stock for product ${item.product}`);
      }
    }

    await session.commitTransaction();
    return { success: true };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Restore stock (for order cancellation)
 */
const restoreStock = async (items) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.product,
        {
          $inc: { stock: item.quantity },
        },
        { session }
      );
    }

    await session.commitTransaction();
    return { success: true };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Create order with idempotency support
 */
const createOrder = async (userId, orderData, idempotencyKey = null) => {
  const { items, couponCode, simulatePayment = true } = orderData;

  // Check for existing order with same idempotency key
  if (idempotencyKey) {
    const existingOrder = await Order.findOne({ idempotencyKey });
    if (existingOrder) {
      return { order: existingOrder, isIdempotent: true };
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch products and validate
    const productIds = items.map(item => item.product);
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    }).session(session);

    if (products.length !== productIds.length) {
      throw new Error('One or more products are invalid or inactive');
    }

    // Build order items with price snapshot
    const orderItems = items.map(item => {
      const product = products.find(p => p._id.toString() === item.product.toString());
      if (!product) {
        throw new Error(`Product ${item.product} not found`);
      }
      return {
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price, // Price snapshot
      };
    });

    // Validate stock
    for (const item of orderItems) {
      const product = products.find(p => p._id.toString() === item.product.toString());
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
    }

    // Calculate pricing
    let coupon = null;
    if (couponCode) {
      coupon = await couponService.getCouponByCode(couponCode);
      if (!coupon) {
        throw new Error('Invalid or expired coupon');
      }
    }

    const pricing = pricingService.calculateOrderTotal(orderItems, coupon);

    // Apply coupon if it's the best discount
    if (pricing.discountType === 'coupon' && coupon) {
      await couponService.validateAndApplyCoupon(coupon.code, userId, pricing.subtotal);
    }

    // Deduct stock
    await deductStock(orderItems.map(item => ({
      product: item.product,
      quantity: item.quantity,
    })));

    // Simulate payment
    const paymentSuccess = simulatePayment; // In real app, this would call payment gateway

    if (!paymentSuccess) {
      // Rollback stock and coupon usage
      await restoreStock(orderItems.map(item => ({
        product: item.product,
        quantity: item.quantity,
      })));

      if (pricing.discountType === 'coupon' && coupon) {
        await couponService.revertCouponUsage(coupon.code, userId);
      }

      throw new Error('Payment failed');
    }

    // Create order
    const order = await Order.create([{
      user: userId,
      items: orderItems,
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      discountType: pricing.discountType,
      couponCode: pricing.couponCode,
      total: pricing.total,
      status: 'PENDING',
      paymentStatus: 'PAID',
      idempotencyKey,
    }], { session });

    // Create initial history entry
    await OrderHistory.create([{
      order: order[0]._id,
      fromStatus: null,
      toStatus: 'PENDING',
      changedBy: userId,
      changedByRole: 'customer',
      reason: 'Order created',
    }], { session });

    await session.commitTransaction();
    return { order: order[0], isIdempotent: false };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Update order status with state machine validation
 */
const updateOrderStatus = async (orderId, newStatus, userId, role, reason = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new Error('Order not found');
    }

    if (!isValidTransition(order.status, newStatus)) {
      throw new Error(`Cannot transition from ${order.status} to ${newStatus}`);
    }

    const oldStatus = order.status;
    order.status = newStatus;

    // Handle cancellation
    if (newStatus === 'CANCELLED') {
      order.cancelledAt = new Date();
      order.cancellationReason = reason;

      // Restore stock
      await restoreStock(order.items.map(item => ({
        product: item.product,
        quantity: item.quantity,
      })));

      // Revert coupon usage
      if (order.couponCode) {
        await couponService.revertCouponUsage(order.couponCode, order.user);
      }
    }

    await order.save({ session });

    // Record history
    await OrderHistory.create([{
      order: orderId,
      fromStatus: oldStatus,
      toStatus: newStatus,
      changedBy: userId,
      changedByRole: role,
      reason,
    }], { session });

    await session.commitTransaction();
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get order by ID
 */
const getOrderById = async (orderId, userId, role) => {
  const order = await Order.findById(orderId).populate('user', 'name email');

  if (!order) {
    const error = new Error('Order not found');
    error.name = 'CustomError';
    error.statusCode = 404;
    error.errors = [];
    throw error;
  }

  // Customers can only see their own orders
  if (role === 'customer' && order.user._id.toString() !== userId.toString()) {
    const error = new Error('Access denied');
    error.name = 'CustomError';
    error.statusCode = 403;
    error.errors = [];
    throw error;
  }

  return order;
};

/**
 * Get user's orders
 */
const getUserOrders = async (userId, filters) => {
  const { page = 1, limit = 10, status } = filters;
  const query = { user: userId };

  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Order.countDocuments(query),
  ]);

  return {
    orders,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit),
    },
  };
};

/**
 * Get order history
 */
const getOrderHistory = async (orderId, userId, role) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const error = new Error('Order not found');
    error.name = 'CustomError';
    error.statusCode = 404;
    error.errors = [];
    throw error;
  }

  if (role === 'customer' && order.user.toString() !== userId.toString()) {
    const error = new Error('Access denied');
    error.name = 'CustomError';
    error.statusCode = 403;
    error.errors = [];
    throw error;
  }

  const history = await OrderHistory.find({ order: orderId })
    .populate('changedBy', 'name email')
    .sort({ createdAt: -1 });

  return history;
};

/**
 * Auto-cancel pending orders after 15 minutes
 */
const autoCancelPendingOrders = async () => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const pendingOrders = await Order.find({
    status: 'PENDING',
    paymentStatus: 'PENDING',
    createdAt: { $lt: fifteenMinutesAgo },
  });

  for (const order of pendingOrders) {
    try {
      await updateOrderStatus(
        order._id,
        'CANCELLED',
        order.user,
        'system',
        'Auto-cancelled due to payment timeout'
      );
      console.log(`Auto-cancelled order ${order._id}`);
    } catch (error) {
      console.error(`Failed to auto-cancel order ${order._id}:`, error.message);
    }
  }

  return { cancelled: pendingOrders.length };
};

module.exports = {
  createOrder,
  updateOrderStatus,
  getOrderById,
  getUserOrders,
  getOrderHistory,
  autoCancelPendingOrders,
  isValidTransition,
};
