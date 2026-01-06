# Git Ignore Strategy for Bizmanage CLI

This document explains why and how we ignore pulled data from Bizmanage instances.

## Why Ignore Pulled Data?

The Bizmanage CLI pulls customizations from your platform instance using `bizmanage pull`. These files should **NOT** be committed to version control for several important reasons:

### 1. Instance-Specific Content
- Each developer should pull from their own Bizmanage instance
- Different instances may have different customizations
- What works in development may not exist in production

### 2. Sensitive Information
- Configuration files may contain instance URLs
- Business logic might be proprietary
- API keys and sensitive data could be embedded

### 3. Generated Content  
- Files are automatically generated from the platform
- Manual edits to these files would be lost on next pull
- The source of truth is the Bizmanage platform, not the local files

### 4. Development Workflow
- Developers should pull fresh data from their own instances
- Changes should be made through the platform or pushed back via CLI
- Local files are temporary working copies

## What Gets Ignored

### Pulled Content Directories
```
src/objects/     # Table/view definitions and actions
src/backend/     # Server-side scripts
src/reports/     # SQL reports  
src/pages/       # HTML pages
```

### Configuration Files
```
bizmanage.config.json  # Project configuration with instance URLs
```

## What Gets Committed

### Directory Structure
```
src/objects/.gitkeep    # Preserves directory structure
src/backend/.gitkeep    # Empty placeholder files
src/reports/.gitkeep    
src/pages/.gitkeep      
```

### CLI Source Code
```
src/commands/     # CLI command implementations
src/services/     # API and utility services  
src/schemas/      # Data validation schemas
src/utils/        # Helper utilities
```

### Documentation & Examples
```
docs/            # Documentation files
examples/        # Usage examples
templates/       # Template files
README.md        # Project documentation
```

## Recommended Workflows

### Team Development

Each team member should:

```bash
# 1. Clone the repository (gets CLI source code)
git clone your-bizmanage-cli-repo
cd your-bizmanage-cli-repo
npm install && npm run build

# 2. Login to their own instance
bizmanage login --alias my-instance

# 3. Create/pull their own project data  
mkdir my-project && cd my-project
bizmanage init my-project
bizmanage pull

# 4. Work with the pulled data
# Edit files in src/objects/, src/backend/, etc.

# 5. Push changes back to their instance
bizmanage push
```

### CI/CD Pipeline

For automated deployments:

```bash
# In your CI/CD script
bizmanage login --alias production
bizmanage pull  # Get current production state
# Apply your deployment scripts
bizmanage push  # Deploy changes
```

## File Structure Examples

### What's in Git (✅ Committed)
```
bizmanage-cli/
├── .gitignore                 # Ignores pulled data
├── README.md                  # Documentation  
├── package.json               # Dependencies
├── src/
│   ├── commands/              # CLI commands
│   ├── services/              # Core services
│   ├── schemas/               # Validation schemas
│   ├── objects/.gitkeep       # Directory placeholder
│   ├── backend/.gitkeep       # Directory placeholder  
│   ├── reports/.gitkeep       # Directory placeholder
│   └── pages/.gitkeep         # Directory placeholder
├── docs/                      # Documentation
├── examples/                  # Usage examples
└── templates/                 # Template files
```

### What's Ignored (❌ Not Committed)
```
my-project/
├── bizmanage.config.json      # Instance-specific config
└── src/
    ├── objects/
    │   ├── customers/
    │   │   ├── definition.json     # Generated table schema
    │   │   └── actions/
    │   │       ├── validate.js     # Custom JavaScript
    │   │       └── validate.meta.json
    │   └── orders/
    │       └── definition.json
    ├── backend/
    │   ├── sync-script.js          # Generated server script
    │   └── sync-script.meta.json   # Script metadata
    ├── reports/
    │   ├── revenue.sql             # Generated SQL report
    │   └── revenue.meta.json       # Report metadata  
    └── pages/
        ├── dashboard.html          # Generated HTML page
        └── dashboard.meta.json     # Page metadata
```

## Troubleshooting

### "My files aren't being ignored"

Check that your `.gitignore` includes:
```gitignore
src/objects/
src/backend/  
src/reports/
src/pages/
bizmanage.config.json
```

### "I accidentally committed pulled data"

Remove from git but keep locally:
```bash
git rm -r --cached src/objects/
git rm -r --cached src/backend/
git rm -r --cached src/reports/  
git rm -r --cached src/pages/
git rm --cached bizmanage.config.json
git commit -m "Remove pulled data from version control"
```

### "How do I share customizations with my team?"

Don't share the pulled files. Instead:
1. Each team member pulls from their own instance
2. Use the platform's export/import features if available
3. Share customization scripts or deployment procedures
4. Use the CLI's push/pull commands for syncing

## Security Considerations

- **Never commit API keys** - They're in ignored config files
- **Review business logic** - Custom code might contain proprietary information  
- **Instance isolation** - Keep dev/staging/prod instances separate
- **Access control** - Ensure team members have appropriate platform permissions

## Best Practices

1. **Always pull before editing** - Get latest data from platform
2. **Use descriptive commit messages** - For CLI improvements and documentation
3. **Test in development** - Before pushing to production instances  
4. **Document customizations** - In comments and separate documentation
5. **Use aliases for environments** - Keep different instances organized
