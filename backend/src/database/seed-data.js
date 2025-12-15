import db from './db.js';
import { initDatabase } from './db.js';

console.log('\n========================================');
console.log('  Seeding Database with Sample Data');
console.log('========================================\n');

// Initialize database first
initDatabase();

// Get admin and freelancer user IDs
const admin = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
const freelancer = db.prepare("SELECT id FROM users WHERE role = 'freelancer'").get();

if (!admin || !freelancer) {
  console.error('❌ Error: Admin or freelancer user not found');
  process.exit(1);
}

// Sample data
const sampleTemplates = [
  // Marketing Department
  {
    use_case: 'Email Marketing Campaign Automation',
    flow_name: 'Marketing Email Flow',
    short_description: 'Automate email campaigns with personalization',
    description: 'Complete email marketing automation with segmentation, personalization, and analytics tracking.',
    department: 'Marketing',
    tags: 'email, automation, marketing, campaigns',
    status: 'published',
    price: 150,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Social Media Post Scheduler',
    flow_name: 'Social Media Automation',
    short_description: 'Schedule posts across multiple platforms',
    description: 'Schedule and publish content across Facebook, Twitter, LinkedIn, and Instagram.',
    department: 'Marketing',
    tags: 'social media, scheduling, automation',
    status: 'in_progress',
    price: 120,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Lead Scoring System',
    flow_name: 'Lead Score Calculator',
    short_description: 'Automatically score and qualify leads',
    description: 'Score leads based on behavior, demographics, and engagement.',
    department: 'Marketing',
    tags: 'leads, scoring, crm',
    status: 'new',
    price: 200,
    assigned_to: null
  },

  // Sales Department
  {
    use_case: 'Automated Proposal Generator',
    flow_name: 'Proposal Creation Flow',
    short_description: 'Generate customized proposals automatically',
    description: 'Create professional proposals with pricing, terms, and product details.',
    department: 'Sales',
    tags: 'proposals, sales, automation, documents',
    status: 'published',
    price: 180,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Sales Pipeline Dashboard',
    flow_name: 'Pipeline Tracker',
    short_description: 'Real-time sales pipeline visualization',
    description: 'Track deals through each stage with automated updates and notifications.',
    department: 'Sales',
    tags: 'pipeline, dashboard, sales, tracking',
    status: 'submitted',
    price: 220,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Quote Follow-up Automation',
    flow_name: 'Quote Follow-up Flow',
    short_description: 'Automatically follow up on sent quotes',
    description: 'Send timely follow-ups for pending quotes with personalized messages.',
    department: 'Sales',
    tags: 'quotes, follow-up, automation',
    status: 'in_progress',
    price: 130,
    assigned_to: freelancer.id
  },

  // HR Department
  {
    use_case: 'Employee Onboarding Workflow',
    flow_name: 'Onboarding Automation',
    short_description: 'Streamline new employee onboarding',
    description: 'Complete onboarding workflow with document collection, training schedules, and welcome emails.',
    department: 'HR',
    tags: 'onboarding, hr, employees, workflow',
    status: 'published',
    price: 160,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Time Off Request System',
    flow_name: 'PTO Request Flow',
    short_description: 'Manage employee time off requests',
    description: 'Submit, approve, and track vacation and sick leave requests.',
    department: 'HR',
    tags: 'pto, time off, hr, approval',
    status: 'reviewed',
    price: 140,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Performance Review Scheduler',
    flow_name: 'Review Schedule Flow',
    short_description: 'Automate performance review scheduling',
    description: 'Schedule and track employee performance reviews with reminders.',
    department: 'HR',
    tags: 'reviews, performance, hr, scheduling',
    status: 'new',
    price: 170,
    assigned_to: null
  },

  // Finance Department
  {
    use_case: 'Invoice Processing Automation',
    flow_name: 'Invoice Processor',
    short_description: 'Automate invoice creation and sending',
    description: 'Generate, send, and track invoices with payment reminders.',
    department: 'Finance',
    tags: 'invoices, finance, automation, payments',
    status: 'published',
    price: 190,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Expense Report Workflow',
    flow_name: 'Expense Report Flow',
    short_description: 'Submit and approve expense reports',
    description: 'Complete expense reporting with receipt uploads and multi-level approvals.',
    department: 'Finance',
    tags: 'expenses, finance, approval, reports',
    status: 'needs_fixes',
    price: 150,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Budget Tracking Dashboard',
    flow_name: 'Budget Monitor',
    short_description: 'Real-time budget tracking and alerts',
    description: 'Track spending against budgets with automatic alerts for overruns.',
    department: 'Finance',
    tags: 'budget, tracking, finance, dashboard',
    status: 'in_progress',
    price: 210,
    assigned_to: freelancer.id
  },

  // Customer Support
  {
    use_case: 'Ticket Assignment System',
    flow_name: 'Smart Ticket Router',
    short_description: 'Automatically route support tickets',
    description: 'Route tickets to appropriate agents based on skills, workload, and priority.',
    department: 'Customer Support',
    tags: 'support, tickets, routing, automation',
    status: 'published',
    price: 175,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Customer Satisfaction Survey',
    flow_name: 'CSAT Survey Flow',
    short_description: 'Automated post-interaction surveys',
    description: 'Send satisfaction surveys after support interactions and collect feedback.',
    department: 'Customer Support',
    tags: 'surveys, feedback, support, csat',
    status: 'published',
    price: 125,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Knowledge Base Article Creator',
    flow_name: 'KB Article Generator',
    short_description: 'Create and publish help articles',
    description: 'Generate knowledge base articles from common support tickets.',
    department: 'Customer Support',
    tags: 'knowledge base, articles, support, documentation',
    status: 'new',
    price: 145,
    assigned_to: null
  },

  // Operations
  {
    use_case: 'Inventory Alert System',
    flow_name: 'Inventory Monitor',
    short_description: 'Low stock alerts and reordering',
    description: 'Monitor inventory levels and trigger reorder alerts automatically.',
    department: 'Operations',
    tags: 'inventory, alerts, operations, stock',
    status: 'in_progress',
    price: 165,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Vendor Management System',
    flow_name: 'Vendor Tracker',
    short_description: 'Track vendor relationships and orders',
    description: 'Manage vendor information, orders, and performance metrics.',
    department: 'Operations',
    tags: 'vendors, operations, management, tracking',
    status: 'new',
    price: 185,
    assigned_to: null
  },
  // Dedicated QA / Test Templates (for internal testing)
  {
    use_case: 'Regression Test Automation',
    flow_name: 'Nightly Regression Flow',
    short_description: 'Test template for verifying nightly builds',
    description: 'Run a full regression suite each night, collect failures, and notify stakeholders automatically.',
    department: 'QA',
    tags: 'qa,regression,test,automation',
    status: 'new',
    price: 90,
    assigned_to: null
  },
  {
    use_case: 'Stress Simulation Test',
    flow_name: 'Load Test Flow',
    short_description: 'Test template for high load simulations',
    description: 'Generate diverse traffic patterns to validate autoscaling and stability under pressure.',
    department: 'QA',
    tags: 'stress,performance,testing',
    status: 'in_progress',
    price: 120,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Security Scan Pipeline',
    flow_name: 'Vulnerability Sweep',
    short_description: 'Test template for automated security checks',
    description: 'Combine dependency scanning, static analysis, and secret detection once per sprint.',
    department: 'Security',
    tags: 'security,scan,automation,test',
    status: 'reviewed',
    price: 140,
    assigned_to: freelancer.id
  },
  {
    use_case: 'Test Data Provisioning',
    flow_name: 'Masked Data Builder',
    short_description: 'Test template for generating compliant test data',
    description: 'Automate creation of production-like data sets with masking rules for downstream test suites.',
    department: 'QA',
    tags: 'test-data,data,automation',
    status: 'submitted',
    price: 110,
    assigned_to: null
  },
  {
    use_case: 'Feature Flag Rollout Practice',
    flow_name: 'Flag Release Flow',
    short_description: 'Test template for gradual flag rollout',
    description: 'Coordinate feature flag rollout, monitoring, and rollback drills before production releases.',
    department: 'Engineering',
    tags: 'feature flag,release,testing',
    status: 'needs_fixes',
    price: 130,
    assigned_to: freelancer.id
  }
];

// Insert sample templates
let insertedCount = 0;
const insertStmt = db.prepare(`
  INSERT INTO ideas (
    use_case, flow_name, short_description, description,
    department, tags, status, price, assigned_to, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const template of sampleTemplates) {
  try {
    insertStmt.run(
      template.use_case,
      template.flow_name,
      template.short_description,
      template.description,
      template.department,
      template.tags,
      template.status,
      template.price,
      template.assigned_to,
      admin.id
    );
    insertedCount++;
  } catch (error) {
    console.error(`❌ Error inserting template: ${template.use_case}`);
    console.error(error.message);
  }
}

console.log(`\n✅ Successfully inserted ${insertedCount} sample templates`);

// Add some sample comments
const templates = db.prepare('SELECT id FROM ideas LIMIT 5').all();
const commentStmt = db.prepare(`
  INSERT INTO comments (idea_id, user_id, comment)
  VALUES (?, ?, ?)
`);

const sampleComments = [
  'Great work on this template!',
  'Please update the documentation section.',
  'The automation flow looks good, just needs testing.',
  'Can we add more error handling?',
  'This is ready for review.'
];

let commentCount = 0;
templates.forEach((template, idx) => {
  if (idx < sampleComments.length) {
    try {
      commentStmt.run(template.id, admin.id, sampleComments[idx]);
      commentCount++;
    } catch (error) {
      console.error('Error inserting comment:', error.message);
    }
  }
});

console.log(`✅ Added ${commentCount} sample comments`);

// Add some activity log entries
const activityStmt = db.prepare(`
  INSERT INTO activity_log (idea_id, user_id, action, details)
  VALUES (?, ?, ?, ?)
`);

let activityCount = 0;
templates.forEach((template, idx) => {
  const actions = [
    { action: 'created', details: 'Template created' },
    { action: 'assigned', details: 'Assigned to freelancer' },
    { action: 'status_changed', details: 'Status updated to in_progress' },
    { action: 'commented', details: 'Added review comment' }
  ];
  
  const action = actions[idx % actions.length];
  try {
    activityStmt.run(template.id, admin.id, action.action, action.details);
    activityCount++;
  } catch (error) {
    console.error('Error inserting activity:', error.message);
  }
});

console.log(`✅ Added ${activityCount} activity log entries`);

// Display summary
console.log('\n========================================');
console.log('  Summary of Seeded Data');
console.log('========================================\n');

const stats = {
  totalTemplates: db.prepare('SELECT COUNT(*) as count FROM ideas').get().count,
  departments: db.prepare('SELECT COUNT(DISTINCT department) as count FROM ideas WHERE department IS NOT NULL').get().count,
  published: db.prepare("SELECT COUNT(*) as count FROM ideas WHERE status = 'published'").get().count,
  inProgress: db.prepare("SELECT COUNT(*) as count FROM ideas WHERE status = 'in_progress'").get().count,
  totalValue: db.prepare('SELECT SUM(price) as total FROM ideas').get().total,
  comments: db.prepare('SELECT COUNT(*) as count FROM comments').get().count,
  activities: db.prepare('SELECT COUNT(*) as count FROM activity_log').get().count
};

console.log(`   📝 Total Templates: ${stats.totalTemplates}`);
console.log(`   🏢 Departments: ${stats.departments}`);
console.log(`   ✅ Published: ${stats.published}`);
console.log(`   🔄 In Progress: ${stats.inProgress}`);
console.log(`   💰 Total Value: $${stats.totalValue}`);
console.log(`   💬 Comments: ${stats.comments}`);
console.log(`   📊 Activity Logs: ${stats.activities}`);

console.log('\n========================================');
console.log('  ✅ Database Seeded Successfully!');
console.log('========================================\n');

console.log('💡 Next steps:');
console.log('   1. Start the server: npm run dev');
console.log('   2. Test the views: node backend/src/database/test-views.js');
console.log('   3. Access the API endpoints at http://localhost:3001/api/views/\n');

