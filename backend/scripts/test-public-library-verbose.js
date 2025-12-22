/**
 * Verbose Test Script for Public Library API
 * 
 * Shows full request/response details for debugging
 * 
 * Usage:
 *   node scripts/test-public-library-verbose.js
 */

const API_BASE = 'http://localhost:3001/api';
const PUBLIC_LIBRARY_API = 'https://cloud.activepieces.com/api/v1/admin/templates';
const API_KEY = process.env.PUBLIC_LIBRARY_API_KEY || 'ZUuXPWgRsM9SK9LW8v9pkFxsJyXHB3gn';

// Test credentials
const TEST_USER = {
  username: 'admin',
  password: 'admin123'
};

// Helper to log request/response
function logRequest(method, url, headers, body) {
  console.log('\n' + '═'.repeat(70));
  console.log('📤 REQUEST');
  console.log('═'.repeat(70));
  console.log(`Method: ${method}`);
  console.log(`URL: ${url}`);
  console.log('Headers:');
  Object.entries(headers).forEach(([k, v]) => {
    // Mask API key for security
    const value = k.toLowerCase().includes('api-key') ? v.substring(0, 8) + '...' : v;
    console.log(`  ${k}: ${value}`);
  });
  if (body) {
    console.log('Body:');
    console.log(JSON.stringify(body, null, 2));
  }
}

function logResponse(status, statusText, headers, body) {
  console.log('\n' + '─'.repeat(70));
  console.log('📥 RESPONSE');
  console.log('─'.repeat(70));
  console.log(`Status: ${status} ${statusText}`);
  if (headers) {
    console.log('Headers:');
    if (typeof headers.forEach === 'function') {
      headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
    }
  }
  console.log('Body:');
  if (typeof body === 'object') {
    console.log(JSON.stringify(body, null, 2));
  } else {
    console.log(body);
  }
  console.log('═'.repeat(70));
}

async function login() {
  console.log('\n🔐 Step 1: Login to get auth token...');
  
  const url = `${API_BASE}/auth/login`;
  const headers = { 'Content-Type': 'application/json' };
  const body = TEST_USER;
  
  logRequest('POST', url, headers, body);
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  logResponse(response.status, response.statusText, response.headers, data);
  
  if (!response.ok) {
    throw new Error(`Login failed: ${data.error}`);
  }
  
  return data.token;
}

async function getTemplateWithFlow(token) {
  console.log('\n📋 Step 2: Find a template with flow JSON...');
  
  const url = `${API_BASE}/ideas`;
  const headers = { 'Authorization': `Bearer ${token}` };
  
  logRequest('GET', url, headers, null);
  
  const response = await fetch(url, { headers });
  const templates = await response.json();
  
  // Just show count, not all templates
  console.log('\n' + '─'.repeat(70));
  console.log('📥 RESPONSE');
  console.log('─'.repeat(70));
  console.log(`Status: ${response.status} ${response.statusText}`);
  console.log(`Found ${templates.length} templates`);
  
  const withFlow = templates.filter(t => t.flow_json);
  console.log(`Templates with flow JSON: ${withFlow.length}`);
  withFlow.forEach(t => {
    console.log(`  [${t.id}] ${t.title || '(no title)'} - status: ${t.status}, public_library_id: ${t.public_library_id || 'none'}`);
  });
  console.log('═'.repeat(70));
  
  return withFlow[0];
}

async function testDirectPublicLibraryAPI(template) {
  console.log('\n🚀 Step 3: Test DIRECT call to Activepieces Public Library API...');
  console.log('(This simulates what happens when you publish a template)\n');
  
  // Build the request body like our backend does
  const requestBody = {
    name: template.title || 'Test Template',
    summary: template.short_description || '',
    description: template.description || '',
    tags: [],
    blogUrl: template.blog_url || '',
    author: 'Activepieces Team',
    categories: ['HR'],  // Default category
    type: 'OFFICIAL',
    flows: []
  };
  
  // Parse flows from template
  if (template.flow_json) {
    try {
      const parsed = JSON.parse(template.flow_json);
      if (parsed._flowCount && parsed.flows) {
        requestBody.flows = Array.isArray(parsed.flows) ? parsed.flows : [parsed.flows];
      } else if (parsed.flows) {
        requestBody.flows = Array.isArray(parsed.flows) ? parsed.flows : [parsed.flows];
      }
    } catch (e) {
      console.log('Error parsing flow JSON:', e.message);
    }
  }
  
  // Parse tags
  if (template.value_generated) {
    requestBody.tags.push({ title: template.value_generated, color: '#e4fded' });
  }
  if (template.time_saved) {
    requestBody.tags.push({ title: template.time_saved, color: '#dbeaff' });
  }
  
  const url = PUBLIC_LIBRARY_API;
  const headers = {
    'Content-Type': 'application/json',
    'templates-api-key': API_KEY
  };
  
  logRequest('POST', url, headers, requestBody);
  
  // Only make the actual call if user confirms
  console.log('\n⚠️  This will CREATE a new template in the Public Library!');
  console.log('    (The request above shows what would be sent)');
  console.log('\n    To actually send this request, set EXECUTE=true environment variable:');
  console.log('    $env:EXECUTE="true"; node scripts/test-public-library-verbose.js\n');
  
  if (process.env.EXECUTE === 'true') {
    console.log('🔥 EXECUTING REAL API CALL...\n');
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    logResponse(response.status, response.statusText, response.headers, data);
    
    return { success: response.ok, data };
  } else {
    console.log('ℹ️  Skipping actual API call (dry run mode)');
    return { success: true, data: 'DRY RUN - No actual call made' };
  }
}

async function testUpdateTemplate(templateId) {
  console.log('\n📝 Step 4: Test UPDATE template in Public Library...');
  
  const url = `${PUBLIC_LIBRARY_API}/${templateId}`;
  const headers = {
    'Content-Type': 'application/json',
    'templates-api-key': API_KEY
  };
  const body = {
    name: 'Updated Template Name',
    summary: 'Updated summary'
  };
  
  logRequest('POST', url, headers, body);
  
  if (process.env.EXECUTE === 'true' && templateId && !templateId.startsWith('pl_')) {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    let data;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }
    
    logResponse(response.status, response.statusText, response.headers, data);
  } else {
    console.log('\nℹ️  Skipping (dry run or mock ID)');
  }
}

async function testChangeStatus(templateId) {
  console.log('\n🔄 Step 5: Test CHANGE STATUS (Archive) in Public Library...');
  
  const url = `${PUBLIC_LIBRARY_API}/${templateId}`;
  const headers = {
    'Content-Type': 'application/json',
    'templates-api-key': API_KEY
  };
  const body = { status: 'ARCHIVED' };
  
  logRequest('POST', url, headers, body);
  
  console.log('\nℹ️  Not executing (would archive the template)');
}

async function testDeleteTemplate(templateId) {
  console.log('\n🗑️  Step 6: Test DELETE template from Public Library...');
  
  const url = `${PUBLIC_LIBRARY_API}/${templateId}`;
  const headers = {
    'templates-api-key': API_KEY
  };
  
  logRequest('DELETE', url, headers, null);
  
  console.log('\nℹ️  Not executing (would delete the template)');
}

async function run() {
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + '  Public Library API - Verbose Request/Response Test  '.padStart(44).padEnd(68) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('\nAPI Endpoint: ' + PUBLIC_LIBRARY_API);
  console.log('API Key: ' + API_KEY.substring(0, 8) + '...');
  console.log('Execute Mode: ' + (process.env.EXECUTE === 'true' ? '🔥 LIVE' : '📋 DRY RUN'));
  
  try {
    // Step 1: Login
    const token = await login();
    
    // Step 2: Get a template with flow
    const template = await getTemplateWithFlow(token);
    
    if (!template) {
      console.log('\n❌ No templates with flow JSON found. Upload a flow first.');
      return;
    }
    
    // Step 3: Test direct API call (create)
    await testDirectPublicLibraryAPI(template);
    
    // Step 4: Test update (if template has real public library ID)
    if (template.public_library_id && !template.public_library_id.startsWith('pl_')) {
      await testUpdateTemplate(template.public_library_id);
      await testChangeStatus(template.public_library_id);
      await testDeleteTemplate(template.public_library_id);
    } else {
      console.log('\n📝 Skipping update/status/delete tests (no real public library ID)');
      console.log('   Template public_library_id:', template.public_library_id || 'none');
    }
    
    console.log('\n' + '═'.repeat(70));
    console.log('✅ Test completed!');
    console.log('═'.repeat(70));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

run();
