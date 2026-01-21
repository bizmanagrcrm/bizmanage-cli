/**
 * Page Push Demo
 * 
 * Demonstrates how to push custom pages to the Bizmanage platform.
 * 
 * Prerequisites:
 * - Run `bizmanage login` first
 * - Have pages in src/pages/ directory
 * - Each page should have:
 *   - {page-name}.html - The HTML content
 *   - {page-name}.json - The page metadata
 * 
 * Usage:
 * node examples/page-push-demo.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock demo showing the expected structure for pages
async function demoPagePush() {
  console.log('📄 Page Push Demo\n');
  
  console.log('Page Structure:');
  console.log('===============\n');
  
  // Show the expected file structure
  console.log('src/pages/');
  console.log('  ├── dashboard.html    (HTML content)');
  console.log('  ├── dashboard.json    (page metadata)');
  console.log('  ├── settings.html');
  console.log('  └── settings.json\n');
  
  // Show example metadata structure
  console.log('Example Metadata (dashboard.json):');
  console.log('----------------------------------');
  const exampleMetadata = {
    url: "custom-dashboard",
    name: "Custom Dashboard Page"
  };
  console.log(JSON.stringify(exampleMetadata, null, 2));
  console.log();
  
  // Show example HTML structure
  console.log('Example Content (dashboard.html):');
  console.log('--------------------------------');
  const exampleHTML = `<!DOCTYPE html>
<html>
<head>
  <title>Custom Dashboard</title>
  <style>
    .dashboard { padding: 20px; }
    .widget { margin: 10px; padding: 15px; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <div class="dashboard">
    <h1>Welcome to Custom Dashboard</h1>
    <div class="widget">
      <h2>Widget 1</h2>
      <p>Dashboard content goes here...</p>
    </div>
  </div>
  
  <script>
    console.log('Custom page loaded');
  </script>
</body>
</html>`;
  console.log(exampleHTML);
  console.log();
  
  // Show API payload structure
  console.log('API Payload Structure:');
  console.log('--------------------');
  const apiPayload = {
    url: "custom-dashboard",
    name: "Custom Dashboard Page",
    content: "<!DOCTYPE html><html>...</html>"
  };
  console.log(JSON.stringify(apiPayload, null, 2));
  console.log();
  
  // Show push command
  console.log('Commands:');
  console.log('--------');
  console.log('# Push changed pages only:');
  console.log('bizmanage push\n');
  console.log('# Push all pages:');
  console.log('bizmanage push --all\n');
  console.log('# Push with specific alias:');
  console.log('bizmanage push --alias production\n');
  
  // Show the flow
  console.log('Push Flow:');
  console.log('---------');
  console.log('1. Detect changed .html or .json files in src/pages/');
  console.log('2. Load corresponding metadata and HTML files');
  console.log('3. Validate required fields (url, name)');
  console.log('4. Build payload with url, name, content');
  console.log('5. POST to /restapi/custom-pages/by-url');
  console.log('6. Update hash cache on success\n');
  
  // Check if pages directory exists
  const projectPath = path.resolve(process.cwd());
  const pagesPath = path.join(projectPath, 'src', 'pages');
  
  if (await fs.pathExists(pagesPath)) {
    console.log('✅ Pages directory found:', pagesPath);
    const files = await fs.readdir(pagesPath);
    
    if (files.length > 0) {
      console.log('Files:', files.join(', '));
      console.log();
      
      // Count pages (pairs of .html and .json)
      const htmlFiles = files.filter(f => f.endsWith('.html'));
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      console.log(`Found ${htmlFiles.length} HTML files and ${jsonFiles.length} JSON files`);
      
      // Check for complete pairs
      const completePairs = htmlFiles.filter(htmlFile => {
        const baseName = htmlFile.replace('.html', '');
        return jsonFiles.includes(`${baseName}.json`);
      });
      
      if (completePairs.length > 0) {
        console.log(`✅ ${completePairs.length} complete page(s) found:`);
        completePairs.forEach(html => {
          console.log(`  - ${html.replace('.html', '')}`);
        });
        console.log('\nYou can now run:');
        console.log('  bizmanage push\n');
      } else {
        console.log('⚠️  No complete pages found (need both .html and .json files)');
      }
    } else {
      console.log('⚠️  Pages directory is empty.');
      console.log('Create a page by adding .html and .json files in src/pages/');
    }
  } else {
    console.log('⚠️  Pages directory not found. Run "bizmanage init" first.');
  }
  
  console.log('\nAccessing Pages:');
  console.log('---------------');
  console.log('After pushing, access your page at:');
  console.log('https://your-instance.bizmanage.com/custom-pages/custom-dashboard');
}

// Run the demo
demoPagePush().catch(console.error);
