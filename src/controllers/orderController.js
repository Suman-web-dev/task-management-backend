const orderService = require('../services/orderService');

const createOrder = async (req, res, next) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    const { items, couponCode, simulatePayment } = req.body;
    
    const result = await orderService.createOrder(
      req.user._id,
      { items, couponCode, simulatePayment },
      idempotencyKey
    );

    const statusCode = result.isIdempotent ? 200 : 201;
    res.status(statusCode).json({
      success: true,
      message: result.isIdempotent 
        ? 'Order retrieved (idempotent request)' 
        : 'Order created successfully',
      data: { order: result.order, isIdempotent: result.isIdempotent },
    });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(
      req.params.id,
      req.user._id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

const getUserOrders = async (req, res, next) => {
  try {
    const result = await orderService.getUserOrders(req.user._id, req.query);
    res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const order = await orderService.updateOrderStatus(
      req.params.id,
      status,
      req.user._id,
      req.user.role,
      reason
    );
    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await orderService.updateOrderStatus(
      req.params.id,
      'CANCELLED',
      req.user._id,
      req.user.role,
      reason || 'Customer requested cancellation'
    );
    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

const getOrderHistory = async (req, res, next) => {
  try {
    const history = await orderService.getOrderHistory(
      req.params.id,
      req.user._id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      message: 'Order history retrieved successfully',
      data: { history },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
  cancelOrder,
  getOrderHistory,
};
