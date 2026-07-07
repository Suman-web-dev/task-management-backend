const productService = require('../services/productService');

const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

const getProducts = async (req, res, next) => {
  try {
    const result = await productService.getProducts(req.query);
    res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

const getLowStockProducts = async (req, res, next) => {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold) : 10;
    const products = await productService.getLowStockProducts(threshold);
    res.status(200).json({
      success: true,
      message: 'Low stock products retrieved successfully',
      data: { products },
    });
  } catch (error) {
    next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await productService.getCategories();
    res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  updateProduct,
  getProducts,
  getProductById,
  getLowStockProducts,
  getCategories,
};
