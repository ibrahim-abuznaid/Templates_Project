/**
 * Test all Public Library API operations with request/response logging
 * 
 * Usage: node scripts/test-api-operations.js [operation]
 * 
 * Operations:
 *   create   - Test creating a new template
 *   update   - Test updating an existing template  
 *   archive  - Test archiving a template
 *   publish  - Test republishing an archived template
 *   delete   - Test deleting a template
 *   all      - Show all request formats (default, no execution)
 */

const PUBLIC_LIBRARY_API = 'https://cloud.activepieces.com/api/v1/admin/templates';
const API_KEY = process.env.PUBLIC_LIBRARY_API_KEY || 'ZUuXPWgRsM9SK9LW8v9pkFxsJyXHB3gn';

// Real template ID from previous test
const TEST_TEMPLATE_ID = '69r7souXbVFSHf5zsZosc';

function log(msg) { console.log(msg); }
function line(char = '-') { log(char.repeat(70)); }

async function makeRequest(method, url, body = null) {
  log('\n[REQUEST]');
  line('=');
  log(`Method: ${method}`);
  log(`URL: ${url}`);
  log('Headers:');
  log('  Content-Type: application/json');
  log('  templates-api-key: ' + API_KEY.substring(0, 8) + '...');
  if (body) {
    log('Body:');
    log(JSON.stringify(body, null, 2));
  }
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'templates-api-key': API_KEY
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }
  
  log('\n[RESPONSE]');
  line('=');
  log(`Status: ${response.status} ${response.statusText}`);
  log('Body:');
  if (typeof data === 'object') {
    log(JSON.stringify(data, null, 2));
  } else {
    log(data);
  }
  
  return { ok: response.ok, status: response.status, data };
}

async function testCreate() {
  log('\n');
  line('*');
  log('TEST: CREATE NEW TEMPLATE');
  line('*');
  
  const body = {
    name: 'API Test Template',
    summary: 'This is a test template created via API',
    description: 'Full description of the test template',
    tags: [
      { title: '$100/year', color: '#e4fded' },
      { title: '2 hours', color: '#dbeaff' }
    ],
    blogUrl: 'https://example.com/blog',
    author: 'Activepieces Team',
    categories: ['PRODUCTIVITY'],
    type: 'OFFICIAL',
    flows: [
      {
        displayName: 'Test Flow',
        trigger: {
          name: 'trigger',
          valid: false,
          displayName: 'Select Trigger',
          type: 'EMPTY',
          settings: {}
        },
        valid: false,
        schemaVersion: '10'
      }
    ]
  };
  
  return makeRequest('POST', PUBLIC_LIBRARY_API, body);
}

async function testUpdate() {
  log('\n');
  line('*');
  log('TEST: UPDATE TEMPLATE');
  line('*');
  
  const body = {
    name: 'fg - Updated ' + new Date().toISOString(),
    summary: 'Updated summary at ' + new Date().toLocaleTimeString()
  };
  
  return makeRequest('POST', `${PUBLIC_LIBRARY_API}/${TEST_TEMPLATE_ID}`, body);
}

async function testArchive() {
  log('\n');
  line('*');
  log('TEST: ARCHIVE TEMPLATE (Change status to ARCHIVED)');
  line('*');
  
  const body = { status: 'ARCHIVED' };
  
  return makeRequest('POST', `${PUBLIC_LIBRARY_API}/${TEST_TEMPLATE_ID}`, body);
}

async function testPublish() {
  log('\n');
  line('*');
  log('TEST: REPUBLISH TEMPLATE (Change status to PUBLISH)');
  line('*');
  
  const body = { status: 'PUBLISH' };
  
  return makeRequest('POST', `${PUBLIC_LIBRARY_API}/${TEST_TEMPLATE_ID}`, body);
}

async function testDelete() {
  log('\n');
  line('*');
  log('TEST: DELETE TEMPLATE');
  line('*');
  
  return makeRequest('DELETE', `${PUBLIC_LIBRARY_API}/${TEST_TEMPLATE_ID}`);
}

function showAllFormats() {
  log('\n');
  line('=');
  log('PUBLIC LIBRARY API - ALL REQUEST FORMATS');
  line('=');
  
  log('\n[1] CREATE NEW TEMPLATE');
  line();
  log('Method: POST');
  log('URL: ' + PUBLIC_LIBRARY_API);
  log('Headers:');
  log('  Content-Type: application/json');
  log('  templates-api-key: <your-api-key>');
  log('Body: {');
  log('  "name": "Template Name",');
  log('  "summary": "Short description",');
  log('  "description": "Full description",');
  log('  "tags": [{ "title": "$100/year", "color": "#e4fded" }],');
  log('  "blogUrl": "https://...",');
  log('  "author": "Activepieces Team",');
  log('  "categories": ["HR", "PRODUCTIVITY", ...],');
  log('  "type": "OFFICIAL",');
  log('  "flows": [{ ... flow objects ... }]');
  log('}');
  
  log('\n[2] UPDATE TEMPLATE');
  line();
  log('Method: POST');
  log('URL: ' + PUBLIC_LIBRARY_API + '/{template-id}');
  log('Headers: (same as create)');
  log('Body: { any fields to update }');
  
  log('\n[3] ARCHIVE TEMPLATE');
  line();
  log('Method: POST');
  log('URL: ' + PUBLIC_LIBRARY_API + '/{template-id}');
  log('Headers: (same as create)');
  log('Body: { "status": "ARCHIVED" }');
  
  log('\n[4] REPUBLISH TEMPLATE');
  line();
  log('Method: POST');
  log('URL: ' + PUBLIC_LIBRARY_API + '/{template-id}');
  log('Headers: (same as create)');
  log('Body: { "status": "PUBLISH" }');
  
  log('\n[5] DELETE TEMPLATE');
  line();
  log('Method: DELETE');
  log('URL: ' + PUBLIC_LIBRARY_API + '/{template-id}');
  log('Headers:');
  log('  templates-api-key: <your-api-key>');
  log('Body: (none)');
  
  log('\n[VALID CATEGORIES]');
  line();
  log('ANALYTICS, COMMUNICATION, CONTENT, CUSTOMER_SUPPORT, DEVELOPMENT,');
  log('E_COMMERCE, FINANCE, HR, IT_OPERATIONS, MARKETING, PRODUCTIVITY, SALES');
  
  log('\n');
}

async function run() {
  const operation = process.argv[2] || 'all';
  
  log('');
  line('=');
  log('Public Library API Test');
  line('=');
  log('API URL: ' + PUBLIC_LIBRARY_API);
  log('API Key: ' + API_KEY.substring(0, 8) + '...');
  log('Test Template ID: ' + TEST_TEMPLATE_ID);
  log('Operation: ' + operation);
  
  try {
    switch (operation) {
      case 'create':
        await testCreate();
        break;
      case 'update':
        await testUpdate();
        break;
      case 'archive':
        await testArchive();
        break;
      case 'publish':
        await testPublish();
        break;
      case 'delete':
        log('\n*** WARNING: This will permanently delete the template! ***');
        log('Run with: node scripts/test-api-operations.js delete --confirm');
        if (process.argv[3] === '--confirm') {
          await testDelete();
        }
        break;
      case 'all':
      default:
        showAllFormats();
        log('To execute a specific operation, run:');
        log('  node scripts/test-api-operations.js create');
        log('  node scripts/test-api-operations.js update');
        log('  node scripts/test-api-operations.js archive');
        log('  node scripts/test-api-operations.js publish');
        log('  node scripts/test-api-operations.js delete --confirm');
        break;
    }
    
    log('\nDone!');
    
  } catch (error) {
    log('\nError: ' + error.message);
    console.error(error);
  }
}

run();
