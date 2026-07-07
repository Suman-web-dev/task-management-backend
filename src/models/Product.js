const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  stock: {
    type: Number,
    required: [true, 'Stock is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Text index for search on name and description
productSchema.index({ name: 'text', description: 'text' });

// Index for category filter
productSchema.index({ category: 1, isActive: 1 });

// Index for price range filter
productSchema.index({ price: 1, isActive: 1 });

// Index for sorting by various fields
productSchema.index({ createdAt: -1 });
productSchema.index({ price: 1 });

// Index for low stock queries
productSchema.index({ stock: 1, isActive: 1 });

module.exports = mongoose.model('Product', productSchema);
