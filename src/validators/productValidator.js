const Joi = require('joi');

const createProductSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(1000).optional(),
  price: Joi.number().positive().required(),
  stock: Joi.number().integer().min(0).required(),
  category: Joi.string().trim().min(1).max(100).required(),
  isActive: Joi.boolean().optional(),
});

const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().max(1000).optional(),
  price: Joi.number().positive().optional(),
  stock: Joi.number().integer().min(0).optional(),
  category: Joi.string().trim().min(1).max(100).optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

const getProductsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  category: Joi.string().trim().optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  search: Joi.string().trim().optional(),
  sortBy: Joi.string().valid('name', 'price', 'createdAt', 'stock').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional(),
});

const validateCreateProduct = (req, res, next) => {
  const { error } = createProductSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.details.map(d => d.message),
    });
  }
  next();
};

const validateUpdateProduct = (req, res, next) => {
  const { error } = updateProductSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.details.map(d => d.message),
    });
  }
  next();
};

const validateGetProducts = (req, res, next) => {
  const { error } = getProductsSchema.validate(req.query);
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
  validateCreateProduct,
  validateUpdateProduct,
  validateGetProducts,
};
