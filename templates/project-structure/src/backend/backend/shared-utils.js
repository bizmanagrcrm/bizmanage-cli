/**
 * Shared utility functions for backend scripts
 */

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

function validateEmail(email) {
  const re = /^[^s@]+@[^s@]+.[^s@]+$/;
  return re.test(email);
}

function generateOrderNumber() {
  const prefix = 'ORD';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

async function sendNotificationEmail(to, subject, body) {
  const { api } = require('@bizmanage/runtime');
  
  return await api.post('/notifications/email', {
    to,
    subject,
    body,
    from: 'noreply@bizmanage.com'
  });
}

module.exports = {
  formatCurrency,
  validateEmail,
  generateOrderNumber,
  sendNotificationEmail
};