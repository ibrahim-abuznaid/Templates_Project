/**
 * Test script for Public Library API integration
 * 
 * This script tests the publishing flow to the Activepieces Public Library.
 * 
 * Usage:
 *   1. Make sure the server is running (npm run dev)
 *   2. Set your PUBLIC_LIBRARY_API_KEY in the environment or .env file
 *   3. Run: node scripts/test-public-library.js
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';

// Test credentials - adjust these to your admin user
const TEST_USER = {
  username: 'admin',  // Change this to your admin username/handle
  password: 'admin123'  // Change this to your admin password
};

async function login() {
  console.log('🔐 Logging in...');
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Login failed: ${error}`);
  }
  
  const data = await response.json();
  console.log('✅ Logged in as:', data.user.username);
  return data.token;
}

async function getTemplates(token) {
  console.log('\n📋 Fetching templates...');
  const response = await fetch(`${API_BASE}/ideas`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch templates');
  }
  
  return response.json();
}

async function getPublishPreview(token, templateId) {
  console.log(`\n🔍 Getting publish preview for template ${templateId}...`);
  const response = await fetch(`${API_BASE}/ideas/${templateId}/publish-preview`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get publish preview: ${error}`);
  }
  
  return response.json();
}

async function changeStatus(token, templateId, newStatus) {
  console.log(`\n📤 Changing status of template ${templateId} to "${newStatus}"...`);
  const response = await fetch(`${API_BASE}/ideas/${templateId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: newStatus })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to change status: ${error}`);
  }
  
  return response.json();
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 Public Library API Integration Test');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Login
    const token = await login();
    
    // Step 2: Get templates
    const templates = await getTemplates(token);
    console.log(`Found ${templates.length} templates`);
    
    // Find a template with flow JSON that's in 'reviewed' status (ready to publish)
    const readyTemplate = templates.find(t => 
      t.flow_json && t.status === 'reviewed'
    );
    
    // Or find any template with flow JSON
    const anyWithFlow = templates.find(t => t.flow_json);
    
    if (!anyWithFlow) {
      console.log('\n⚠️  No templates with flow JSON found.');
      console.log('   Please upload a flow JSON file to a template first.');
      console.log('\n📋 Available templates:');
      templates.forEach(t => {
        console.log(`   - [${t.id}] ${t.title} (status: ${t.status}, has flow: ${!!t.flow_json})`);
      });
      return;
    }
    
    // Step 3: Get publish preview
    const testTemplate = readyTemplate || anyWithFlow;
    console.log(`\n📝 Using template: [${testTemplate.id}] ${testTemplate.title}`);
    console.log(`   Status: ${testTemplate.status}`);
    console.log(`   Has Public Library ID: ${testTemplate.public_library_id || 'No'}`);
    
    const preview = await getPublishPreview(token, testTemplate.id);
    console.log('\n📋 Publish Preview:');
    console.log(JSON.stringify(preview, null, 2));
    
    // Step 4: Check if we can test publishing
    if (testTemplate.status === 'reviewed' && !testTemplate.public_library_id) {
      console.log('\n🚀 Template is ready to publish!');
      console.log('   To test actual publishing, change status to "published" via the UI');
      console.log('   or run the following command:');
      console.log(`\n   node -e "fetch('${API_BASE}/ideas/${testTemplate.id}', { method: 'PUT', headers: { 'Authorization': 'Bearer ${token}', 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'published' }) }).then(r => r.json()).then(console.log)"`);
    } else if (testTemplate.public_library_id) {
      console.log('\n✅ Template is already published to Public Library!');
      console.log(`   Public Library ID: ${testTemplate.public_library_id}`);
    }
    
    // Step 5: Check API key
    console.log('\n🔑 API Key Status:');
    if (process.env.PUBLIC_LIBRARY_API_KEY) {
      console.log('   ✅ PUBLIC_LIBRARY_API_KEY is configured');
    } else {
      console.log('   ⚠️  PUBLIC_LIBRARY_API_KEY is NOT configured');
      console.log('   The system is running in MOCK MODE');
      console.log('   To enable actual API calls, set the PUBLIC_LIBRARY_API_KEY environment variable');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
