/**
 * Backend Script Push Demo
 * 
 * Demonstrates how to push backend scripts to the Bizmanage platform.
 * 
 * Prerequisites:
 * - Run `bizmanage login` first
 * - Have backend scripts in src/backend/ directory
 * - Each backend script should have:
 *   - {name}.js - The script code
 *   - {name}.json - The script metadata
 * 
 * Usage:
 * node examples/backend-script-push-demo.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock demo showing the expected structure for backend scripts
async function demoBackendScriptPush() {
  console.log('🔧 Backend Script Push Demo\n');
  
  console.log('Backend Script Structure:');
  console.log('========================\n');
  
  // Show the expected file structure
  console.log('src/backend/');
  console.log('  ├── test.js       (script code)');
  console.log('  └── test.json     (script metadata)\n');
  
  // Show example metadata structure
  console.log('Example Metadata (test.json):');
  console.log('----------------------------');
  const exampleMetadata = {
    name: "test",
    description: "Test script for demo",
    method: "POST",
    is_public: false,
    active: true,
    timeout: null,
    crontab: null,
    modules: []
  };
  console.log(JSON.stringify(exampleMetadata, null, 2));
  console.log();
  
  // Show example code structure
  console.log('Example Code (test.js):');
  console.log('----------------------');
  const exampleCode = `module.exports = async function(env) {
  // env.user: Contains the user details
  // env.query: Contains the query parameters
  // env.body: Contains the request body
  
  try {
    console.log('Script executed by:', env.user);
    return { 
      success: true,
      data: 'Hello from backend script!'
    };
  } catch (ex) {
    throw new Error(ex);
  }
};`;
  console.log(exampleCode);
  console.log();
  
  // Show API payload structure
  console.log('API Payload Structure:');
  console.log('--------------------');
  const apiPayload = {
    name: "test",
    script: "module.exports = async function(env) { return { success: true }; }",
    method: "POST",
    active: true,
    description: "Test script for demo",
    is_public: false,
    crontab: null,
    timeout: null,
    modules: []
  };
  console.log(JSON.stringify(apiPayload, null, 2));
  console.log();
  
  // Show push command
  console.log('Commands:');
  console.log('--------');
  console.log('# Push changed backend scripts only:');
  console.log('bizmanage push\n');
  console.log('# Push all backend scripts:');
  console.log('bizmanage push --all\n');
  console.log('# Push with specific alias:');
  console.log('bizmanage push --alias production\n');
  
  // Show the flow
  console.log('Push Flow:');
  console.log('---------');
  console.log('1. Detect changed .js or .json files in src/backend/');
  console.log('2. Load corresponding metadata and code files');
  console.log('3. Validate required fields (name, method, active)');
  console.log('4. Build payload with name, script, method, active');
  console.log('5. POST to /restapi/be-scripts/script-by-internal-name');
  console.log('6. Update hash cache on success\n');
  
  // Check if test backend script exists
  const projectPath = path.resolve(process.cwd());
  const backendPath = path.join(projectPath, 'src', 'backend');
  
  if (await fs.pathExists(backendPath)) {
    console.log('✅ Backend directory found:', backendPath);
    const files = await fs.readdir(backendPath);
    console.log('Files:', files.join(', '));
    console.log();
    
    // Check for test.js and test.json
    const hasTestJs = files.includes('test.js');
    const hasTestJson = files.includes('test.json');
    
    if (hasTestJs && hasTestJson) {
      console.log('✅ Test backend script found (test.js + test.json)');
      console.log('\nYou can now run:');
      console.log('  bizmanage push\n');
    } else {
      console.log('⚠️  Test backend script incomplete:');
      console.log('  test.js:', hasTestJs ? '✅' : '❌');
      console.log('  test.json:', hasTestJson ? '✅' : '❌');
    }
  } else {
    console.log('⚠️  Backend directory not found. Run "bizmanage init" first.');
  }
}

// Run the demo
demoBackendScriptPush().catch(console.error);
