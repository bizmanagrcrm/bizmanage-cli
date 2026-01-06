// VAT validation action
async function validateVAT(record) {
  if (!record.vat_number) {
    alert('No VAT number to validate');
    return;
  }
  
  showSpinner('Validating VAT number...');
  
  try {
    const response = await fetch('/api/validate-vat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vat: record.vat_number })
    });
    
    const result = await response.json();
    
    if (result.valid) {
      showNotification('VAT number is valid', 'success');
      updateRecord(record.id, { vat_validated: true });
    } else {
      showNotification('VAT number is invalid', 'error');
    }
  } catch (error) {
    showNotification('VAT validation failed', 'error');
  } finally {
    hideSpinner();
  }
}