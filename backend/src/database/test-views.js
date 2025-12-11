import db from './db.js';
import { initDatabase } from './db.js';

console.log('\n========================================');
console.log('  Testing Database Views');
console.log('========================================\n');

// Initialize database to ensure views are created
initDatabase();

// Helper function to display results
function displayResults(title, results, limit = 5) {
  console.log(`\n📊 ${title}`);
  console.log('─'.repeat(60));
  
  if (!results || (Array.isArray(results) && results.length === 0)) {
    console.log('   No data available');
    return;
  }
  
  if (Array.isArray(results)) {
    const displayCount = Math.min(results.length, limit);
    for (let i = 0; i < displayCount; i++) {
      console.log(`\n   Item ${i + 1}:`);
      Object.entries(results[i]).forEach(([key, value]) => {
        console.log(`      ${key}: ${value}`);
      });
    }
    if (results.length > limit) {
      console.log(`\n   ... and ${results.length - limit} more`);
    }
    console.log(`\n   Total: ${results.length} records`);
  } else {
    Object.entries(results).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  }
}

try {
  // Test 1: Department Summary
  const departments = db.prepare('SELECT * FROM department_summary').all();
  displayResults('1. DEPARTMENT SUMMARY', departments);

  // Test 2: Status Summary
  const statuses = db.prepare('SELECT * FROM status_summary').all();
  displayResults('2. STATUS SUMMARY', statuses);

  // Test 3: Freelancer Workload
  const freelancers = db.prepare('SELECT * FROM freelancer_workload').all();
  displayResults('3. FREELANCER WORKLOAD', freelancers);

  // Test 4: Templates Detailed (limit 3)
  const templatesDetailed = db.prepare('SELECT * FROM templates_detailed LIMIT 3').all();
  displayResults('4. DETAILED TEMPLATES (First 3)', templatesDetailed, 3);

  // Test 5: Recent Activity (limit 5)
  const recentActivity = db.prepare('SELECT * FROM recent_activity_dashboard LIMIT 5').all();
  displayResults('5. RECENT ACTIVITY (Last 5)', recentActivity, 5);

  // Test 6: Unassigned Templates
  const unassigned = db.prepare('SELECT * FROM unassigned_templates').all();
  displayResults('6. UNASSIGNED TEMPLATES', unassigned, 3);

  // Test 7: High-Value Templates (limit 3)
  const highValue = db.prepare('SELECT * FROM high_value_templates LIMIT 3').all();
  displayResults('7. HIGH-VALUE TEMPLATES (Top 3)', highValue, 3);

  // Test 8: Tags Summary (limit 5)
  const tags = db.prepare('SELECT * FROM tags_summary LIMIT 5').all();
  displayResults('8. TAGS SUMMARY (Top 5)', tags, 5);

  // Test 9: Department Performance
  const deptPerformance = db.prepare('SELECT * FROM department_performance').all();
  displayResults('9. DEPARTMENT PERFORMANCE METRICS', deptPerformance);

  // Summary Statistics
  console.log('\n\n========================================');
  console.log('  SUMMARY STATISTICS');
  console.log('========================================\n');

  const totalTemplates = db.prepare('SELECT COUNT(*) as count FROM ideas').get();
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const totalDepartments = db.prepare('SELECT COUNT(DISTINCT department) as count FROM ideas WHERE department IS NOT NULL').get();
  const totalValue = db.prepare('SELECT SUM(price) as total FROM ideas').get();
  const publishedCount = db.prepare("SELECT COUNT(*) as count FROM ideas WHERE status = 'published'").get();

  console.log(`   📝 Total Templates: ${totalTemplates.count}`);
  console.log(`   👥 Total Users: ${totalUsers.count}`);
  console.log(`   🏢 Total Departments: ${totalDepartments.count}`);
  console.log(`   💰 Total Value: $${totalValue.total || 0}`);
  console.log(`   ✅ Published Templates: ${publishedCount.count}`);

  console.log('\n\n========================================');
  console.log('  ✅ All Views Working Successfully!');
  console.log('========================================\n');

} catch (error) {
  console.error('\n❌ Error testing views:', error.message);
  console.error(error);
  process.exit(1);
}

