# Copilot Instructions for bizmanage-cli

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is a Node.js CLI tool project called `bizmanage-cli` built with TypeScript. The tool helps developers build customizations for a SaaS platform locally by syncing code between the developer's local filesystem and the platform's API.

## Project Structure
- Uses ES modules (`"type": "module"`)
- TypeScript for type safety
- Commander.js for CLI framework
- Modular architecture: commands, services, and utils

## Key Dependencies
- `commander` - CLI framework
- `inquirer` - Interactive prompts
- `axios` - API requests
- `zod` - Schema validation
- `fs-extra` - File operations
- `chalk` - Colored output
- `ora` - Loading spinners
- `conf` - Configuration storage

## Architecture Guidelines
- Separate commands (CLI interface) from services (business logic) 
- Use services for API interactions and file operations
- Validate all metadata with Zod schemas
- Mock API calls with setTimeout for development
- Store auth tokens in user's home directory with alias support
