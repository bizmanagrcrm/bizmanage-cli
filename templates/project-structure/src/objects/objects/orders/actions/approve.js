// Approve order action
function approveOrder(record) {
  if (record.status !== 'pending') {
    alert('Only pending orders can be approved');
    return;
  }
  
  // Update order status
  updateRecord(record.id, { status: 'processing' });
  showNotification('Order approved successfully', 'success');
}