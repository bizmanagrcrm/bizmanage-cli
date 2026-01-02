# Bizmanage API Authentication Service

This document describes the new `BizmanageService` class that provides authentication testing and API connectivity for the Bizmanage CLI.

## Overview

The `BizmanageService` class is designed to handle authentication testing and API communication with the Bizmanage platform. It provides methods to validate credentials, test connectivity, and generate detailed status reports.

## Key Features

- **Authentication Testing**: Uses the `/restapi/ping` endpoint to test authentication
- **Connection Diagnostics**: Provides detailed connection information including response times
- **Configuration Validation**: Validates instance URLs and API keys
- **Status Reporting**: Generates comprehensive status reports
- **Error Handling**: Proper error handling with user-friendly messages

## API Endpoint

The service tests authentication using:
- **Endpoint**: `GET /restapi/ping`
- **Expected Responses**:
  - `200` - Authenticated successfully
  - `403` - Authentication failed (invalid credentials)
  - `401` - Unauthorized (missing/invalid API key)
  - `404` - Endpoint not found (check instance URL)

## Usage

### Basic Authentication Test

```typescript
import { BizmanageService } from './services/bizmanage.js';

const service = new BizmanageService({
  instanceUrl: 'https://your-instance.bizmanage.com',
  apiKey: 'your-api-key'
});

// Simple ping test
const pingResult = await service.ping();

if (pingResult.authenticated) {
  console.log('✅ Authenticated successfully!');
} else {
  console.log(`❌ Authentication failed: ${pingResult.message}`);
}
```

### Connection Test with Diagnostics

```typescript
// Test with response time measurement
const connectionTest = await service.testConnection();

console.log(`Success: ${connectionTest.success}`);
console.log(`Response Time: ${connectionTest.responseTime}ms`);
console.log(`Status: ${connectionTest.status}`);
console.log(`Message: ${connectionTest.message}`);
```

### Configuration Validation

```typescript
// Validate configuration before testing
const validation = service.validateConfig();

if (!validation.valid) {
  console.log('Configuration errors:');
  validation.errors.forEach(error => console.log(`- ${error}`));
  return;
}
```

### Full Status Report

```typescript
// Generate a comprehensive status report
const report = await service.getStatusReport();
console.log(report);
```

## CLI Usage

The service is integrated into the CLI through the following commands:

### Login Command

The `bizmanage login` command now uses the `BizmanageService` to validate credentials during the login process:

```bash
bizmanage login
# Prompts for instance URL and API key
# Tests authentication using /restapi/ping
# Saves configuration only if authentication succeeds
```

### Test Command

The new `bizmanage test` command provides authentication testing:

```bash
# Test default configuration
bizmanage test

# Test specific alias
bizmanage test --alias production

# Quick ping test only
bizmanage test --ping-only

# Verbose output
bizmanage test --verbose
```

## Response Types

### PingResponse

```typescript
interface BizmanagePingResponse {
  authenticated: boolean;
  status: number;
  message: string;
  timestamp: Date;
}
```

### ConnectionTest

```typescript
interface BizmanageConnectionTest {
  success: boolean;
  status: number;
  message: string;
  responseTime: number;
}
```

## Error Handling

The service provides specific error messages for common scenarios:

- **403 Forbidden**: Invalid or expired credentials
- **401 Unauthorized**: Missing or invalid API key
- **404 Not Found**: Endpoint not found (check instance URL)
- **Network Errors**: Connection timeouts, DNS issues, etc.

## Integration with Existing Commands

The `BizmanageService` is integrated with existing CLI commands:

1. **Login Command**: Uses real API authentication instead of mock validation
2. **Pull/Push Commands**: Can be extended to use the service for authentication verification
3. **Test Command**: New command specifically for testing authentication

## Testing

The service includes comprehensive unit tests covering:

- Successful authentication (200 responses)
- Authentication failures (403, 401 responses)
- Network errors
- Configuration validation
- API key masking
- Response time measurements

Run tests with:

```bash
npm run test:real
```

## Example Integration

See the complete example in `examples/auth-test-example.js` for a full demonstration of how to use the `BizmanageService` programmatically.

## Security Considerations

- API keys are masked in logs and status reports
- Configuration files are stored in the user's home directory
- Network timeouts prevent hanging connections
- Proper error handling prevents credential leakage
