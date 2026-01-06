# Pull Command Implementation - API Integration

This document describes the implementation of the Bizmanage CLI pull command with actual API integration.

## Current Status

### ✅ Implemented
- **Authentication**: Full authentication system with API key management
- **Project Structure**: Complete project file system structure implementation
- **Tables/Objects API**: Integration with `/cust-fields/tables?custom_fields=true` endpoint
- **Error Handling**: Comprehensive error handling with helpful guidance
- **Project Initialization**: `bizmanage init` command to create new projects
- **Status Commands**: Both simple and detailed status reporting

### 🚧 In Progress
- **Field Definitions**: Need API endpoint to get detailed field information for tables
- **Custom Actions**: Need API endpoints to fetch actual JavaScript actions for objects

### ⏳ Pending API Endpoints
- **Backend Scripts**: API endpoint to fetch server-side scripts
- **Reports**: API endpoint to fetch custom SQL reports  
- **Pages**: API endpoint to fetch custom HTML pages

## API Endpoints

### Current Implementation

#### Tables/Objects
- **Endpoint**: `GET /cust-fields/tables?custom_fields=true`
- **Status**: ✅ Implemented
- **Response**: Array of table objects with metadata, filters, and configuration
- **Mapped To**: Project structure under `src/objects/`

### Future Endpoints Needed

#### Table Fields
- **Endpoint**: `GET /cust-fields/tables/{tableId}/fields` (TBD)
- **Purpose**: Get detailed field definitions for each table
- **Will Map To**: `definition.json` field definitions

#### Custom Actions
- **Endpoint**: `GET /custom-actions?table={tableName}` (TBD)
- **Purpose**: Get JavaScript actions associated with tables
- **Will Map To**: `src/objects/{table}/actions/` directory

#### Backend Scripts
- **Endpoint**: `GET /backend-scripts` (TBD)
- **Purpose**: Get server-side scripts with triggers and metadata
- **Will Map To**: `src/backend/` directory

#### Reports
- **Endpoint**: `GET /custom-reports` (TBD)
- **Purpose**: Get custom SQL reports with parameters and scheduling
- **Will Map To**: `src/reports/` directory

#### Pages
- **Endpoint**: `GET /custom-pages` (TBD)
- **Purpose**: Get custom HTML pages with navigation and permissions
- **Will Map To**: `src/pages/` directory

## Project Structure

When you run `bizmanage pull`, it creates this structure:

```
/my-bizmanage-project
├── bizmanage.config.json       # Project configuration
└── /src
    ├── /objects                # Tables/views with their actions
    │   ├── /customers
    │   │   ├── definition.json
    │   │   └── /actions
    │   │       ├── validate-vat.js
    │   │       └── validate-vat.meta.json
    │   └── /orders
    │       ├── definition.json
    │       └── /actions
    │           ├── approve.js
    │           └── approve.meta.json
    ├── /backend                # Server-side scripts (when API available)
    ├── /reports                # SQL reports (when API available)  
    └── /pages                  # HTML pages (when API available)
```

## Commands Available

### `bizmanage init`
Initialize a new project structure
```bash
bizmanage init my-project
cd my-project
```

### `bizmanage pull`
Pull customizations from Bizmanage instance
```bash
# Pull into current directory  
bizmanage pull --init

# Pull into specific directory
bizmanage pull -o ./my-project --init
```

### `bizmanage status-detail`
Show detailed status including API endpoint tests
```bash
# Test API endpoints
bizmanage status-detail --api

# Show project status
bizmanage status-detail --project

# Both
bizmanage status-detail --api --project
```

## Testing

### Test Real API Integration
```bash
node examples/test-pull-demo.js
```

This will test the actual API integration and show what data is available.

## Error Handling

The CLI provides helpful error messages for common issues:

- **Authentication (403/401)**: Guides to check API key and permissions  
- **Not Found (404)**: Suggests API endpoint changes or feature availability
- **Timeout**: Recommends checking connection and retrying
- **Network Errors**: Provides connection troubleshooting

## Next Steps

1. **Get Field Details API**: Need endpoint to fetch detailed field definitions
2. **Get Actions API**: Need endpoint to fetch JavaScript actions for tables
3. **Implement Remaining Endpoints**: Backend scripts, reports, pages
4. **Add Push Command**: Implement deployment of local changes back to platform
5. **Add Diff/Sync**: Compare local vs remote and show differences

## Example Usage

```bash
# 1. Authenticate
bizmanage login

# 2. Create new project  
bizmanage init my-bizmanage-project
cd my-bizmanage-project

# 3. Pull from platform
bizmanage pull

# 4. Check what was pulled
bizmanage status-detail --project

# 5. Edit files in src/
# ... make your customizations ...

# 6. Push back to platform (when implemented)
bizmanage push
```
