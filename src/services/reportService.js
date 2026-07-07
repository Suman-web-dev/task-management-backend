const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');

/**
 * Get last 30 days summary: total revenue, total orders, average order value
 * Using $facet to compute multiple metrics in a single pipeline
 */
const getLast30DaysSummary = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await Order.aggregate([
    {
      $match: {
        status: { $ne: 'CANCELLED' },
        createdAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $facet: {
        totalRevenue: [
          {
            $group: {
              _id: null,
              total: { $sum: '$total' },
            },
          },
        ],
        totalOrders: [
          {
            $count: 'count',
          },
        ],
        averageOrderValue: [
          {
            $group: {
              _id: null,
              avgValue: { $avg: '$total' },
            },
          },
        ],
      },
    },
    {
      $project: {
        totalRevenue: { $arrayElemAt: ['$totalRevenue.total', 0] },
        totalOrders: { $arrayElemAt: ['$totalOrders.count', 0] },
        averageOrderValue: { $arrayElemAt: ['$averageOrderValue.avgValue', 0] },
      },
    },
  ]);

  return result[0] || {
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
  };
};

/**
 * Get daily revenue trend for the last 30 days
 * Using $dateTrunc (MongoDB 5.0+) or $dateToString for older versions
 */
const getDailyRevenueTrend = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await Order.aggregate([
    {
      $match: {
        status: { $ne: 'CANCELLED' },
        createdAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
          },
        },
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
    {
      $project: {
        date: '$_id',
        revenue: 1,
        orders: 1,
        _id: 0,
      },
    },
  ]);

  return result;
};

/**
 * Get top 5 best-selling products by quantity
 * Using $lookup to get product details
 */
const getTopSellingProducts = async () => {
  const result = await Order.aggregate([
    {
      $match: {
        status: { $ne: 'CANCELLED' },
      },
    },
    {
      $unwind: '$items',
    },
    {
      $group: {
        _id: '$items.product',
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    {
      $sort: { totalQuantity: -1 },
    },
    {
      $limit: 5,
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    {
      $unwind: '$product',
    },
    {
      $project: {
        productId: '$_id',
        productName: '$product.name',
        category: '$product.category',
        totalQuantity: 1,
        totalRevenue: 1,
        _id: 0,
      },
    },
  ]);

  return result;
};

/**
 * Get category-wise sales breakdown with percentage share
 */
const getCategorySalesBreakdown = async () => {
  const result = await Order.aggregate([
    {
      $match: {
        status: { $ne: 'CANCELLED' },
      },
    },
    {
      $unwind: '$items',
    },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product',
      },
    },
    {
      $unwind: '$product',
    },
    {
      $group: {
        _id: '$product.category',
        totalRevenue: {
          $sum: { $multiply: ['$items.price', '$items.quantity'] },
        },
        totalQuantity: { $sum: '$items.quantity' },
      },
    },
    {
      $sort: { totalRevenue: -1 },
    },
  ]);

  // Calculate total revenue for percentage calculation
  const totalRevenue = result.reduce((sum, cat) => sum + cat.totalRevenue, 0);

  const resultWithPercentage = result.map(cat => ({
    category: cat._id,
    totalRevenue: cat.totalRevenue,
    totalQuantity: cat.totalQuantity,
    percentageShare: totalRevenue > 0 ? (cat.totalRevenue / totalRevenue) * 100 : 0,
  }));

  return resultWithPercentage;
};

/**
 * Get top 5 customers by lifetime spend
 */
const getTopCustomers = async () => {
  const result = await Order.aggregate([
    {
      $match: {
        status: { $ne: 'CANCELLED' },
      },
    },
    {
      $group: {
        _id: '$user',
        totalSpend: { $sum: '$total' },
        totalOrders: { $sum: 1 },
      },
    },
    {
      $sort: { totalSpend: -1 },
    },
    {
      $limit: 5,
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: '$user',
    },
    {
      $project: {
        userId: '$_id',
        userName: '$user.name',
        userEmail: '$user.email',
        totalSpend: 1,
        totalOrders: 1,
        _id: 0,
      },
    },
  ]);

  return result;
};

module.exports = {
  getLast30DaysSummary,
  getDailyRevenueTrend,
  getTopSellingProducts,
  getCategorySalesBreakdown,
  getTopCustomers,
};
