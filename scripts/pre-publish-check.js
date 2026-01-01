#!/usr/bin/env node

/**
 * Pre-publish validation script
 * Ensures the package is ready for publication
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import chalk from 'chalk';

console.log(chalk.blue('🔍 Pre-publish validation starting...'));
console.log();

let hasErrors = false;

// Check if required files exist
const requiredFiles = [
  'package.json',
  'README.md',
  'LICENSE',
  'dist/index.js',
  'bin/index.js'
];

console.log(chalk.yellow('📁 Checking required files...'));
for (const file of requiredFiles) {
  if (existsSync(file)) {
    console.log(chalk.green(`✓ ${file}`));
  } else {
    console.log(chalk.red(`✗ ${file} - MISSING`));
    hasErrors = true;
  }
}
console.log();

// Validate package.json
console.log(chalk.yellow('📋 Validating package.json...'));
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  
  const requiredFields = ['name', 'version', 'description', 'main', 'bin', 'author', 'license'];
  for (const field of requiredFields) {
    if (pkg[field] && pkg[field].toString().trim()) {
      console.log(chalk.green(`✓ ${field}: ${typeof pkg[field] === 'object' ? JSON.stringify(pkg[field]) : pkg[field]}`));
    } else {
      console.log(chalk.red(`✗ ${field} - MISSING OR EMPTY`));
      hasErrors = true;
    }
  }

  // Check version format
  if (pkg.version && !/^\d+\.\d+\.\d+(-.*)?$/.test(pkg.version)) {
    console.log(chalk.red(`✗ version format invalid: ${pkg.version}`));
    hasErrors = true;
  }

  // Check if author is still placeholder
  if (pkg.author && pkg.author.includes('your.email@example.com')) {
    console.log(chalk.yellow(`⚠ Author still contains placeholder email`));
  }

} catch (error) {
  console.log(chalk.red(`✗ Invalid package.json: ${error.message}`));
  hasErrors = true;
}
console.log();

// Run tests
console.log(chalk.yellow('🧪 Running tests...'));
try {
  execSync('npm test', { stdio: 'inherit' });
  console.log(chalk.green('✓ Tests passed'));
} catch (error) {
  console.log(chalk.red('✗ Tests failed'));
  hasErrors = true;
}
console.log();

// Run linter
console.log(chalk.yellow('🔍 Running linter...'));
try {
  execSync('npm run lint', { stdio: 'inherit' });
  console.log(chalk.green('✓ Linting passed'));
} catch (error) {
  console.log(chalk.red('✗ Linting failed'));
  hasErrors = true;
}
console.log();

// Build project
console.log(chalk.yellow('🔨 Building project...'));
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log(chalk.green('✓ Build successful'));
} catch (error) {
  console.log(chalk.red('✗ Build failed'));
  hasErrors = true;
}
console.log();

// Test CLI functionality
console.log(chalk.yellow('⚡ Testing CLI functionality...'));
try {
  execSync('node bin/index.js --help', { stdio: 'pipe' });
  console.log(chalk.green('✓ CLI help command works'));

  execSync('node bin/index.js login --help', { stdio: 'pipe' });
  console.log(chalk.green('✓ CLI login command works'));

  execSync('node bin/index.js pull --help', { stdio: 'pipe' });
  console.log(chalk.green('✓ CLI pull command works'));

  execSync('node bin/index.js push --help', { stdio: 'pipe' });
  console.log(chalk.green('✓ CLI push command works'));
} catch (error) {
  console.log(chalk.red('✗ CLI functionality test failed'));
  hasErrors = true;
}
console.log();

// Final result
if (hasErrors) {
  console.log(chalk.red('❌ Pre-publish validation FAILED'));
  console.log(chalk.red('Please fix the above issues before publishing.'));
  process.exit(1);
} else {
  console.log(chalk.green('✅ Pre-publish validation PASSED'));
  console.log(chalk.green('Package is ready for publication!'));
  console.log();
  console.log(chalk.blue('Next steps:'));
  console.log(chalk.dim('  npm version patch|minor|major'));
  console.log(chalk.dim('  npm publish'));
  process.exit(0);
}
