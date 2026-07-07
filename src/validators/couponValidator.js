const Joi = require('joi');

const createCouponSchema = Joi.object({
  code: Joi.string().trim().min(3).max(50).required(),
  type: Joi.string().valid('flat', 'percentage').required(),
  value: Joi.number().positive().required(),
  maxCap: Joi.number().min(0).optional(),
  expiryDate: Joi.date().iso().greater('now').required(),
  maxUsage: Joi.number().integer().min(1).required(),
  perUserUsage: Joi.number().integer().min(1).required(),
  minOrderValue: Joi.number().min(0).optional(),
  isActive: Joi.boolean().optional(),
}).custom((value, helpers) => {
  if (value.type === 'percentage' && value.value > 100) {
    return helpers.error('any.invalid');
  }
  return value;
}).messages({
  'any.invalid': 'Percentage discount cannot exceed 100%',
});

const updateCouponSchema = Joi.object({
  code: Joi.string().trim().min(3).max(50).optional(),
  type: Joi.string().valid('flat', 'percentage').optional(),
  value: Joi.number().positive().optional(),
  maxCap: Joi.number().min(0).optional(),
  expiryDate: Joi.date().iso().optional(),
  maxUsage: Joi.number().integer().min(1).optional(),
  perUserUsage: Joi.number().integer().min(1).optional(),
  minOrderValue: Joi.number().min(0).optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

const getCouponsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  isActive: Joi.string().valid('true', 'false').optional(),
});

const validateCreateCoupon = (req, res, next) => {
  const { error } = createCouponSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.details.map(d => d.message),
    });
  }
  next();
};

const validateUpdateCoupon = (req, res, next) => {
  const { error } = updateCouponSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.details.map(d => d.message),
    });
  }
  next();
};

const validateGetCoupons = (req, res, next) => {
  const { error } = getCouponsSchema.validate(req.query);
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
  validateCreateCoupon,
  validateUpdateCoupon,
  validateGetCoupons,
};
