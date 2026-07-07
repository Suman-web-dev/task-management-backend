const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateCreateProduct, validateUpdateProduct, validateGetProducts } = require('../validators/productValidator');

// Public routes
router.get('/', validateGetProducts, productController.getProducts);
router.get('/categories', productController.getCategories);
router.get('/:id', productController.getProductById);

// Admin-only routes
router.post('/', authenticate, authorize('admin'), validateCreateProduct, productController.createProduct);
router.put('/:id', authenticate, authorize('admin'), validateUpdateProduct, productController.updateProduct);
router.get('/admin/low-stock', authenticate, authorize('admin'), productController.getLowStockProducts);

module.exports = router;
