# Bizmanage CLI

A command-line interface tool for building customizations for the Bizmanage SaaS platform locally. The CLI helps developers sync code between their local filesystem and the Bizmanage platform API.

## Features

- 🔐 **Authentication Management** - Login/logout with support for multiple environment aliases
- ⬇️ **Pull Customizations** - Download customizations from the platform to local files
- ⬆️ **Push Customizations** - Upload local customizations with validation and testing
- 📋 **Metadata Validation** - Strict schema validation using Zod
- 🧪 **Testing Integration** - Automatic test execution before deployment
- 📁 **Organized Structure** - Clean file organization with metadata files

## Installation

### From npm
```bash
npm install -g bizmanage-cli
```

### Using npx (no installation required)
```bash
npx bizmanage-cli --help
npx bizmanage-cli login
```

### Local Development
```bash
git clone https://github.com/yourusername/bizmanage-cli.git
cd bizmanage-cli
npm install
npm run build
npm link
```

## Quick Start

1. **Login to your Bizmanage instance:**
   ```bash
   bizmanage login
   ```

2. **Pull existing customizations:**
   ```bash
   bizmanage pull
   ```

3. **Make changes to your code in the `./src` directory**

4. **Push changes back to the platform:**
   ```bash
   bizmanage push
   ```

## Commands

### `bizmanage login`

Save your API key and test authentication with the Bizmanage platform.

```bash
bizmanage login [options]
```

**How it works:**
1. Prompts for your Instance URL and API Key
2. Tests authentication using `GET /restapi/ping`
3. Saves API key securely only if authentication succeeds

**Options:**
- `-a, --alias <alias>` - Configuration alias (default: "default")

**Example:**
```bash
# Login with default alias
bizmanage login

# Login with custom alias for different environments
bizmanage login --alias production
bizmanage login --alias development
```

### `bizmanage logout`

Delete saved API key and authentication configuration.

```bash
bizmanage logout [options]
```

**How it works:**
1. Removes the saved API key from secure storage
2. Deletes all associated configuration data

**Options:**
- `-a, --alias <alias>` - Configuration alias to remove (default: "default")
- `--all` - Remove all saved API keys and configurations

**Examples:**
```bash
# Logout from default configuration
bizmanage logout

# Logout from specific alias
bizmanage logout --alias production

# Remove all saved API keys
bizmanage logout --all
```

### `bizmanage status`

Show current login status and saved API keys.

```bash
bizmanage status
```

**Shows:**
- All saved configuration aliases
- Instance URLs for each alias
- Masked API keys (for security)

**Example:**
```bash
bizmanage status
```

### `bizmanage test`

Test authentication and connection to the Bizmanage API.

```bash
bizmanage test [options]
```

**Options:**
- `-a, --alias <alias>` - Test specific alias configuration (default: "default")
- `--ping-only` - Only run the ping test without detailed report
- `--verbose` - Show verbose output

**Examples:**
```bash
# Test default configuration
bizmanage test

# Test specific alias
bizmanage test --alias production

# Quick ping test only
bizmanage test --ping-only

# Verbose output with configuration details
bizmanage test --verbose
```

**API Endpoint Tested:**
- `GET /restapi/ping` - Returns 200 if authenticated, 403 if not authenticated

### `bizmanage pull`

Download customizations from the platform to your local filesystem.

```bash
bizmanage pull [options]
```

**Options:**
- `-a, --alias <alias>` - Configuration alias to use (default: "default")
- `-o, --output <path>` - Output directory (default: "./src")

**Example:**
```bash
# Pull to default ./src directory
bizmanage pull

# Pull to custom directory
bizmanage pull --output ./my-customizations

# Pull using specific environment
bizmanage pull --alias production
```

### `bizmanage push`

Upload local customizations to the platform with validation and testing.

```bash
bizmanage push [options]
```

**Options:**
- `-a, --alias <alias>` - Configuration alias to use (default: "default")
- `-s, --source <path>` - Source directory (default: "./src")
- `--skip-tests` - Skip running tests before deploy
- `--skip-validation` - Skip metadata validation

**Examples:**
```bash
# Standard push with validation and testing
bizmanage push

# Push skipping tests (not recommended for production)
bizmanage push --skip-tests

# Push from custom source directory
bizmanage push --source ./my-customizations
```

## Project Structure

After running `bizmanage pull`, your local directory will be organized as follows:

```
./src/
├── reports/
│   ├── meta.json                 # Metadata for all reports
│   ├── sales-report.sql          # Report SQL code
│   └── user-analytics.sql
├── pages/
│   ├── meta.json                 # Metadata for all pages
│   ├── dashboard.html            # Page HTML/JS code
│   └── settings-page.html
├── backend-scripts/
│   ├── meta.json                 # Metadata for all scripts
│   ├── data-processor.js         # Backend script code
│   └── email-scheduler.js
└── fields/
    ├── meta.json                 # Metadata for all fields
    ├── custom-field-1.json       # Field configuration
    └── validation-field.json
```

Each `meta.json` file contains:
- Scope information (reports, pages, backend-scripts, fields)
- List of items with their metadata
- Generation timestamp
- File mappings

## Metadata Schema

### Backend Script Metadata Example

```json
{
  "description": "A script that processes user data",
  "version": "1.0.0",
  "author": "developer@company.com",
  "tags": ["data-processing", "automation"],
  "entryPoint": "processUserData",
  "dependencies": ["lodash", "moment"],
  "permissions": ["read", "write"],
  "schedule": {
    "enabled": true,
    "cron": "0 2 * * *",
    "timezone": "UTC"
  },
  "timeout": 300,
  "memory": 512,
  "retryPolicy": {
    "maxRetries": 3,
    "retryDelay": 1000,
    "exponentialBackoff": true
  }
}
```

## Development

### Setup for Development

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd bizmanage-cli
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development mode:**
   ```bash
   npm run dev
   ```

4. **Link for local testing:**
   ```bash
   npm run build
   npm link
   ```

### Available Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Watch mode for development
- `npm start` - Run the CLI locally
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint the code
- `npm run lint:fix` - Fix linting issues

### Testing

Create tests in the `tests/` directory:

```bash
npm test
```

For continuous testing during development:

```bash
npm run test:watch
```

## Publishing

### Prerequisites

1. **Create npm account**: Sign up at [npmjs.com](https://www.npmjs.com/)

2. **Login to npm**:
   ```bash
   npm login
   ```

3. **Verify your email** with npm if you haven't already

4. **Update package.json**:
   - Set your name and email in the "author" field
   - Update repository URLs to match your GitHub repo
   - Verify the package name is available on npm

### Publication Steps

1. **Run pre-publish validation**:
   ```bash
   npm run publish-check
   ```

2. **Update version** (choose appropriate bump):
   ```bash
   npm version patch  # Bug fixes (1.0.0 → 1.0.1)
   npm version minor  # New features (1.0.0 → 1.1.0)  
   npm version major  # Breaking changes (1.0.0 → 2.0.0)
   ```

3. **Publish to npm**:
   ```bash
   npm publish
   ```

4. **Verify publication**:
   ```bash
   npm info bizmanage-cli
   ```

### Automated Publishing with GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Beta/Alpha Releases

For pre-release versions:

```bash
# Create beta version
npm version prerelease --preid=beta  # 1.0.0 → 1.0.1-beta.0
npm publish --tag beta

# Install beta version
npm install -g bizmanage-cli@beta
```

## Configuration

The CLI stores authentication configurations in `~/.bizmanage/config.json`. This allows you to manage multiple environments:

```json
{
  "default": {
    "instanceUrl": "https://api.bizmanage.com",
    "apiKey": "your-api-key"
  },
  "development": {
    "instanceUrl": "https://dev-api.bizmanage.com",
    "apiKey": "dev-api-key"
  },
  "production": {
    "instanceUrl": "https://prod-api.bizmanage.com",
    "apiKey": "prod-api-key"
  }
}
```

## API Integration

The CLI communicates with the Bizmanage platform through REST API endpoints:

- `GET /api/customizations/{scope}` - Fetch customizations
- `POST /api/customizations/deploy` - Deploy customizations
- `GET /api/auth/validate` - Validate authentication

## Validation

All metadata files are validated using Zod schemas before deployment:

- **Required fields:** description, version, author, tags
- **Version format:** Must follow semver (e.g., "1.0.0")
- **Type-specific validation:** Each customization type has its own schema
- **File integrity:** Ensures all referenced files exist

## Error Handling

The CLI provides detailed error messages for common issues:

- Authentication failures
- Network connectivity problems
- Validation errors with specific field information
- Test failures with output
- File system errors

## Troubleshooting

### Common Issues

1. **Authentication Error:**
   ```bash
   # Re-authenticate
   bizmanage logout
   bizmanage login
   ```

2. **Validation Failures:**
   ```bash
   # Check metadata format
   bizmanage push --skip-tests  # To isolate validation issues
   ```

3. **Test Failures:**
   ```bash
   # Run tests separately
   npm test
   ```

4. **Network Issues:**
   - Check your internet connection
   - Verify the instance URL is correct
   - Ensure API endpoints are accessible

### Getting Help

- Check the command help: `bizmanage <command> --help`
- Review error messages for specific guidance
- Ensure all dependencies are properly installed

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `npm test`
6. Run the linter: `npm run lint`
7. Commit your changes: `git commit -am 'Add some feature'`
8. Push to the branch: `git push origin feature-name`
9. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Add JSDoc comments for public APIs
- Write tests for new features
- Update documentation as needed
- Follow the existing code style

### Code Style

This project uses ESLint and TypeScript for code quality. Run:

```bash
npm run lint        # Check for issues
npm run lint:fix    # Fix auto-fixable issues
```

## Changelog

### v1.0.0
- Initial release
- Login/logout functionality with multi-alias support
- Pull customizations from platform
- Push customizations with validation and testing
- Comprehensive Zod schema validation
- CLI with colored output and loading indicators

## Support

- 📧 **Issues**: [GitHub Issues](https://github.com/yourusername/bizmanage-cli/issues)
- 📖 **Documentation**: [README.md](https://github.com/yourusername/bizmanage-cli#readme)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/bizmanage-cli/discussions)

## Security

If you discover a security vulnerability, please send an email to security@yourcompany.com instead of using the issue tracker.

## Acknowledgments

- Built with [Commander.js](https://github.com/tj/commander.js/) for CLI framework
- Uses [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/) for interactive prompts
- Validation powered by [Zod](https://github.com/colinhacks/zod)
- File operations with [fs-extra](https://github.com/jprichardson/node-fs-extra)
