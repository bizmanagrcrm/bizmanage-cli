# Bizmanage CLI - Project Structure

This document outlines the complete folder structure for the bizmanage-cli project.

## Root Structure

```
bizmanage-cli/
├── .github/
│   └── copilot-instructions.md     # Copilot custom instructions
├── .vscode/
│   └── tasks.json                  # VS Code tasks configuration
├── bin/
│   └── index.js                    # CLI entry point (executable)
├── src/
│   ├── commands/                   # CLI command implementations
│   │   ├── login.ts               # Login command
│   │   ├── logout.ts              # Logout command
│   │   ├── pull.ts                # Pull customizations command
│   │   └── push.ts                # Push customizations command (with validation)
│   ├── services/                   # Business logic services
│   │   ├── auth.ts                # Authentication configuration management
│   │   ├── api.ts                 # API communication service
│   │   ├── filesystem.ts          # File system operations
│   │   └── validation.ts          # Zod schema validation service
│   ├── schemas/                    # Zod schema definitions
│   │   └── backend-script.ts      # Backend script metadata schema example
│   ├── utils/                      # Utility functions
│   │   └── helpers.ts             # Common helper functions
│   └── index.ts                   # Main CLI entry point
├── tests/                          # Test files
│   ├── validation.test.ts         # Validation service tests
│   └── helpers.test.ts            # Utility function tests
├── examples/                       # Example project structures
│   └── sample-project/            # Sample project showing generated structure
│       └── src/
│           └── backend-scripts/
│               ├── meta.json      # Example metadata file
│               └── data-processor.js  # Example backend script
├── dist/                          # Compiled JavaScript (generated)
├── node_modules/                  # Dependencies (generated)
├── package.json                   # Project configuration
├── tsconfig.json                  # TypeScript configuration
├── jest.config.js                 # Jest testing configuration
├── .eslintrc.js                   # ESLint configuration
├── .gitignore                     # Git ignore rules
└── README.md                      # Project documentation
```

## Key Directories Explained

### `/src/commands/`
Contains all CLI command implementations using Commander.js:
- **login.ts**: Handles authentication with instance URL and API key
- **logout.ts**: Removes stored authentication credentials
- **pull.ts**: Downloads customizations from the platform API
- **push.ts**: Uploads local customizations with validation and testing

### `/src/services/`
Business logic separated from CLI interface:
- **auth.ts**: Manages authentication configuration storage using Conf
- **api.ts**: Handles all API communication with axios (mocked for development)
- **filesystem.ts**: Manages local file operations using fs-extra
- **validation.ts**: Validates metadata files using Zod schemas

### `/src/schemas/`
Zod schema definitions for metadata validation:
- **backend-script.ts**: Comprehensive schema example for backend scripts

### Generated Project Structure (after pull)
When users run `bizmanage pull`, the CLI generates this structure:

```
./src/
├── reports/
│   ├── meta.json                  # Reports metadata
│   ├── sales-report.sql          # SQL report files
│   └── user-analytics.sql
├── pages/
│   ├── meta.json                  # Pages metadata  
│   ├── dashboard.html            # HTML/JS page files
│   └── settings-page.html
├── backend-scripts/
│   ├── meta.json                  # Scripts metadata
│   ├── data-processor.js         # JavaScript backend scripts
│   └── email-scheduler.js
└── fields/
    ├── meta.json                  # Fields metadata
    ├── custom-field-1.json       # JSON field configurations
    └── validation-field.json
```

## Configuration Storage

Authentication configurations are stored in:
```
~/.bizmanage/
└── config.json                   # User authentication configs
```

This allows multiple environment configurations:
```json
{
  "default": {
    "instanceUrl": "https://api.bizmanage.com",
    "apiKey": "your-api-key"
  },
  "production": {
    "instanceUrl": "https://prod-api.bizmanage.com", 
    "apiKey": "prod-api-key"
  }
}
```

## Development Files

- **tsconfig.json**: TypeScript compilation settings
- **jest.config.js**: Test runner configuration  
- **.eslintrc.js**: Code linting rules
- **package.json**: Dependencies and scripts

## Build Output

- **dist/**: Compiled JavaScript files (TypeScript → JS)
- **bin/index.js**: Executable entry point that imports from dist/
