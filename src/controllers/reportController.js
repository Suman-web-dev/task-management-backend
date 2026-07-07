const reportService = require('../services/reportService');

const getLast30DaysSummary = async (req, res, next) => {
  try {
    const summary = await reportService.getLast30DaysSummary();
    res.status(200).json({
      success: true,
      message: 'Summary retrieved successfully',
      data: { summary },
    });
  } catch (error) {
    next(error);
  }
};

const getDailyRevenueTrend = async (req, res, next) => {
  try {
    const trend = await reportService.getDailyRevenueTrend();
    res.status(200).json({
      success: true,
      message: 'Daily revenue trend retrieved successfully',
      data: { trend },
    });
  } catch (error) {
    next(error);
  }
};

const getTopSellingProducts = async (req, res, next) => {
  try {
    const products = await reportService.getTopSellingProducts();
    res.status(200).json({
      success: true,
      message: 'Top selling products retrieved successfully',
      data: { products },
    });
  } catch (error) {
    next(error);
  }
};

const getCategorySalesBreakdown = async (req, res, next) => {
  try {
    const breakdown = await reportService.getCategorySalesBreakdown();
    res.status(200).json({
      success: true,
      message: 'Category sales breakdown retrieved successfully',
      data: { breakdown },
    });
  } catch (error) {
    next(error);
  }
};

const getTopCustomers = async (req, res, next) => {
  try {
    const customers = await reportService.getTopCustomers();
    res.status(200).json({
      success: true,
      message: 'Top customers retrieved successfully',
      data: { customers },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLast30DaysSummary,
  getDailyRevenueTrend,
  getTopSellingProducts,
  getCategorySalesBreakdown,
  getTopCustomers,
};
