# Contributing to Bizmanage CLI

Thank you for your interest in contributing to Bizmanage CLI! This document provides guidelines and instructions for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please treat all community members with respect and create a welcoming environment for everyone.

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Git

### Setting up the development environment

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/yourusername/bizmanage-cli.git
   cd bizmanage-cli
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Link for local testing**:
   ```bash
   npm link
   ```

5. **Run tests**:
   ```bash
   npm test
   ```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**:
   ```bash
   npm test
   npm run lint
   npm run build
   ```

4. **Test CLI functionality**:
   ```bash
   bizmanage --help
   bizmanage login --help
   # Test actual commands if possible
   ```

5. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `docs:` - Documentation changes
   - `style:` - Code style changes
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

6. **Push and create a pull request**:
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all source code
- Enable strict mode in `tsconfig.json`
- Add proper type annotations
- Use interfaces for complex objects
- Prefer `const` over `let` where possible

### Formatting

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Maximum line length: 100 characters

### Naming Conventions

- Use `camelCase` for variables and functions
- Use `PascalCase` for classes and interfaces
- Use `UPPER_SNAKE_CASE` for constants
- Use descriptive names

### Documentation

- Add JSDoc comments for all public APIs
- Include parameter types and descriptions
- Add usage examples where helpful

```typescript
/**
 * Validates user authentication credentials
 * @param instanceUrl - The Bizmanage instance URL
 * @param apiKey - The API key for authentication
 * @returns Promise that resolves to validation result
 * @example
 * const isValid = await validateCredentials('https://api.bizmanage.com', 'key123');
 */
async function validateCredentials(instanceUrl: string, apiKey: string): Promise<boolean> {
  // Implementation
}
```

## Testing

### Writing Tests

- Write tests for all new functionality
- Use Jest as the testing framework
- Follow the AAA pattern (Arrange, Act, Assert)
- Test both success and error cases

```typescript
describe('AuthService', () => {
  describe('saveConfig', () => {
    it('should save configuration with valid data', async () => {
      // Arrange
      const authService = new AuthService();
      const config = { instanceUrl: 'https://test.com', apiKey: 'key123' };
      
      // Act
      await authService.saveConfig('test', config);
      
      // Assert
      const saved = await authService.getConfig('test');
      expect(saved).toEqual(config);
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Documentation

### README Updates

When adding new features:
- Update the README.md with new command usage
- Add examples for new functionality
- Update the feature list

### Code Comments

- Add comments for complex logic
- Explain the "why" not just the "what"
- Keep comments up-to-date with code changes

## Submitting Changes

### Pull Request Process

1. **Ensure your PR**:
   - Has a clear title and description
   - References related issues
   - Includes tests for new functionality
   - Updates documentation as needed
   - Passes all CI checks

2. **PR Template**:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Tests pass locally
   - [ ] New tests added for new functionality
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows project style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No breaking changes (or clearly documented)
   ```

3. **Review Process**:
   - Maintainers will review your PR
   - Address any requested changes
   - Once approved, your PR will be merged

## Release Process

Releases are handled by maintainers:

1. Version bumping using semantic versioning
2. Automated publishing via GitHub Actions
3. Release notes generation

## Getting Help

- **Issues**: Create a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact maintainers directly for sensitive issues

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Project documentation

Thank you for contributing to Bizmanage CLI!
