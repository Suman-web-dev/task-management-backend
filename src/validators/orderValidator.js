const Joi = require('joi');

const createOrderSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      product: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
    })
  ).min(1).required(),
  couponCode: Joi.string().trim().optional(),
  simulatePayment: Joi.boolean().optional(),
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')
   .required(),
  reason: Joi.string().trim().optional(),
});

const cancelOrderSchema = Joi.object({
  reason: Joi.string().trim().optional(),
});

const getUserOrdersSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string()
    .valid('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')
    .optional(),
});

const validateCreateOrder = (req, res, next) => {
  const { error } = createOrderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.details.map(d => d.message),
    });
  }
  next();
};

const validateUpdateOrderStatus = (req, res, next) => {
  const { error } = updateOrderStatusSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.details.map(d => d.message),
    });
  }
  next();
};

const validateCancelOrder = (req, res, next) => {
  const { error } = cancelOrderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.details.map(d => d.message),
    });
  }
  next();
};

const validateGetUserOrders = (req, res, next) => {
  const { error } = getUserOrdersSchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.details.map(d => d.message),
    });
  }
  next();
};

module.exports = {
  validateCreateOrder,
  validateUpdateOrderStatus,
  validateCancelOrder,
  validateGetUserOrders,
};
