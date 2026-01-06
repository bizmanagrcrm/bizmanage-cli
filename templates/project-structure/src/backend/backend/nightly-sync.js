const { logger, db, api } = require('@bizmanage/runtime');

/**
 * Nightly synchronization script
 * Syncs data between internal systems and external services
 */
async function nightlySync() {
  logger.info('Starting nightly sync process');
  
  try {
    // Sync customer data
    const customers = await db.query('SELECT * FROM customers WHERE updated_at > ?', [
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    ]);
    
    for (const customer of customers) {
      await api.post('/external/customers', customer);
      logger.debug(`Synced customer ${customer.id}`);
    }
    
    // Sync order data
    const orders = await db.query('SELECT * FROM orders WHERE created_at > ?', [
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    ]);
    
    for (const order of orders) {
      await api.post('/external/orders', order);
      logger.debug(`Synced order ${order.id}`);
    }
    
    logger.info(`Nightly sync completed: ${customers.length} customers, ${orders.length} orders`);
  } catch (error) {
    logger.error('Nightly sync failed:', error);
    throw error;
  }
}

module.exports = { nightlySync };