# Bizmanage CLI Authentication Implementation

## Overview

The Bizmanage CLI now implements a simple and secure authentication system that:

1. **Saves API keys** securely in the user's home directory
2. **Tests authentication** using the `/restapi/ping` endpoint  
3. **Deletes API keys** completely on logout

## Commands

### `bizmanage login`
- Prompts for Instance URL and API Key
- Tests authentication with `GET /restapi/ping`
- Saves configuration **only if authentication succeeds**
- Provides helpful error messages for failed authentication

**Flow:**
```
1. Prompt for credentials
2. Test with /restapi/ping
3. If 200: Save API key ✅
4. If 403: Show error, don't save ❌
```

### `bizmanage logout`  
- Deletes saved API key and configuration
- Supports removing specific aliases or all configurations
- Shows what was removed and what remains

### `bizmanage status`
- Shows all saved configurations
- Displays masked API keys for security
- Lists available aliases

### `bizmanage test`
- Tests current authentication without saving anything
- Provides detailed connection diagnostics
- Shows response times and error details

## Authentication Endpoint

**Endpoint:** `GET /restapi/ping`
- **200** = Authenticated successfully ✅
- **403** = Not authenticated / invalid credentials ❌
- **401** = Unauthorized / missing API key ❌
- **404** = Endpoint not found / check URL ❌

## Security Features

1. **API Key Masking**: Keys are masked in all output (e.g., `abcd***5678`)
2. **Secure Storage**: Keys stored in `~/.bizmanage/config.json`  
3. **Authentication Required**: Keys only saved after successful auth test
4. **Complete Deletion**: Logout removes all traces of API keys

## Multi-Environment Support

```bash
# Different environments
bizmanage login --alias production
bizmanage login --alias staging  
bizmanage login --alias development

# Test specific environment
bizmanage test --alias production

# Remove specific environment
bizmanage logout --alias staging

# Remove all environments  
bizmanage logout --all
```

## Error Handling

The CLI provides specific guidance for different error scenarios:

- **403 Forbidden**: Check API key validity and permissions
- **404 Not Found**: Verify instance URL and endpoint availability  
- **Network Errors**: Check connectivity and URL reachability

## File Structure

```
~/.bizmanage/
└── config.json  # Encrypted configuration storage
```

## Implementation Details

### Core Services

1. **BizmanageService** (`src/services/bizmanage.ts`)
   - Handles API communication
   - Tests authentication via `/restapi/ping`
   - Provides connection diagnostics

2. **AuthService** (`src/services/auth.ts`) 
   - Manages configuration storage
   - Handles multiple aliases
   - Secure file operations

### Commands

1. **Login** (`src/commands/login.ts`)
   - Interactive prompts
   - Real-time authentication testing
   - Conditional saving based on auth success

2. **Logout** (`src/commands/logout.ts`)
   - Safe deletion of configurations
   - Support for partial or complete removal
   - User-friendly status messages

3. **Status** (`src/commands/status.ts`)
   - Overview of saved configurations
   - Security-conscious display of sensitive data

4. **Test** (`src/commands/test.ts`)
   - Non-destructive authentication verification
   - Detailed diagnostics and performance metrics

## Usage Examples

### Basic Login/Logout
```bash
# Login
bizmanage login
# Prompts for URL and API key, tests auth, saves if successful

# Check status  
bizmanage status
# Shows saved configurations

# Test connection
bizmanage test  
# Verifies current authentication

# Logout
bizmanage logout
# Deletes saved API key
```

### Multi-Environment Workflow
```bash
# Setup multiple environments
bizmanage login --alias prod
bizmanage login --alias dev

# Work with specific environment
bizmanage test --alias prod
bizmanage pull --alias dev

# Cleanup
bizmanage logout --alias dev
bizmanage logout --all
```

## Benefits

✅ **Simple**: Just save API key and test auth  
✅ **Secure**: Keys masked and stored safely  
✅ **Reliable**: Real authentication testing  
✅ **User-Friendly**: Clear error messages and guidance  
✅ **Flexible**: Multi-environment support  
✅ **Clean**: Complete removal on logout
