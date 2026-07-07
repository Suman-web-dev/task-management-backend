const Product = require('../models/Product');

const createProduct = async (productData) => {
  const product = await Product.create(productData);
  return product;
};

const updateProduct = async (productId, productData) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    productData,
    { new: true, runValidators: true }
  );
  
  if (!product) {
    const error = new Error('Product not found');
    error.name = 'CustomError';
    error.statusCode = 404;
    error.errors = [];
    throw error;
  }
  
  return product;
};

const getProducts = async (filters) => {
  const {
    page = 1,
    limit = 10,
    category,
    minPrice,
    maxPrice,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;

  const query = { isActive: true };

  // Category filter
  if (category) {
    query.category = category;
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined) query.price.$gte = parseFloat(minPrice);
    if (maxPrice !== undefined) query.price.$lte = parseFloat(maxPrice);
  }

  // Text search
  if (search) {
    query.$text = { $search: search };
  }

  // Sorting
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Pagination
  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query),
  ]);

  return {
    products,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit),
    },
  };
};

const getProductById = async (productId) => {
  const product = await Product.findOne({ _id: productId, isActive: true });
  
  if (!product) {
    const error = new Error('Product not found');
    error.name = 'CustomError';
    error.statusCode = 404;
    error.errors = [];
    throw error;
  }
  
  return product;
};

const getLowStockProducts = async (threshold) => {
  const products = await Product.find({
    isActive: true,
    stock: { $lt: threshold },
  }).sort({ stock: 1 });
  
  return products;
};

const getCategories = async () => {
  const categories = await Product.distinct('category', { isActive: true });
  return categories;
};

module.exports = {
  createProduct,
  updateProduct,
  getProducts,
  getProductById,
  getLowStockProducts,
  getCategories,
};
