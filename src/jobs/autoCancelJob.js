const cron = require('node-cron');
const orderService = require('../services/orderService');

/**
 * Auto-cancel pending orders every 5 minutes
 * Orders that are PENDING and unpaid for more than 15 minutes will be cancelled
 */
const startAutoCancelJob = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running auto-cancel job for pending orders...');
    try {
      const result = await orderService.autoCancelPendingOrders();
      console.log(`Auto-cancel job completed: ${result.cancelled} orders cancelled`);
    } catch (error) {
      console.error('Auto-cancel job failed:', error);
    }
  });

  console.log('Auto-cancel job scheduled to run every 5 minutes');
};

module.exports = { startAutoCancelJob };
