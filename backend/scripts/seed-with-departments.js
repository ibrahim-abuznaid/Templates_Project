/**
 * Enhanced seed data script that uses the new many-to-many department structure
 * Run this AFTER running the migrate-departments.js script
 */

import db, { initDatabase } from '../src/database/db.js';

// Initialize database connection
await initDatabase();

console.log('\n========================================');
console.log('  Seeding Database with Sample Data');
console.log('  (Using new department structure)');
console.log('========================================\n');

try {
  // Get admin and freelancer user IDs
  const admin = await db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  const freelancer = await db.prepare("SELECT id FROM users WHERE role = 'freelancer'").get();

  if (!admin || !freelancer) {
    console.error('❌ Error: Admin or freelancer user not found');
    process.exit(1);
  }

  // Get department IDs for mapping
  const deptMap = {};
  const departments = await db.prepare('SELECT id, name FROM departments').all();
  departments.forEach(dept => {
    deptMap[dept.name] = dept.id;
  });

  console.log('📋 Available departments:', Object.keys(deptMap).join(', '));

  // Sample templates with their department names (can be multiple)
  const sampleTemplates = [
    {
      use_case: 'Email Marketing Campaign Automation',
      flow_name: 'Marketing Email Flow',
      short_description: 'Automate email campaigns with personalization',
      description: 'Complete email marketing automation with segmentation, personalization, and analytics tracking.',
      departments: ['Marketing'],
      tags: 'email, automation, marketing, campaigns',
      status: 'published',
      price: 150,
      assigned_to: freelancer.id
    },
    {
      use_case: 'Employee Onboarding Workflow',
      flow_name: 'Onboarding Automation',
      short_description: 'Streamline new employee onboarding',
      description: 'Complete onboarding workflow with document collection, training schedules, and welcome emails.',
      departments: ['HR', 'Everyone - Everyday'],
      tags: 'onboarding, hr, employees, workflow',
      status: 'published',
      price: 175,
      assigned_to: freelancer.id
    },
    {
      use_case: 'Invoice Processing Automation',
      flow_name: 'Invoice Flow',
      short_description: 'Automated invoice processing and approval',
      description: 'Automatically process, approve, and track invoices with multi-level approval workflows.',
      departments: ['Finance/Accounting', 'Operations'],
      tags: 'invoices, finance, automation, approval',
      status: 'published',
      price: 180,
      assigned_to: freelancer.id
    },
    {
      use_case: 'Customer Support Ticket Router',
      flow_name: 'Ticket Routing System',
      short_description: 'Intelligently route support tickets',
      description: 'Automatically categorize and route support tickets to the right team members.',
      departments: ['Customer Support/Success', 'IT'],
      tags: 'support, tickets, routing, automation',
      status: 'in_progress',
      price: 140,
      assigned_to: freelancer.id
    },
    {
      use_case: 'Contract Review Process',
      flow_name: 'Legal Contract Flow',
      short_description: 'Streamline legal contract reviews',
      description: 'Manage contract reviews with automated routing, version control, and approval tracking.',
      departments: ['Legal', 'Operations'],
      tags: 'contracts, legal, approval, documents',
      status: 'new',
      price: 200,
      assigned_to: null
    },
    {
      use_case: 'Product Launch Checklist',
      flow_name: 'Launch Coordination',
      short_description: 'Coordinate cross-functional product launches',
      description: 'Manage all aspects of product launches with automated task assignments and progress tracking.',
      departments: ['Product Management', 'Marketing', 'Operations'],
      tags: 'product, launch, coordination, checklist',
      status: 'new',
      price: 250,
      assigned_to: null
    },
    {
      use_case: 'Daily Standup Notes',
      flow_name: 'Standup Automation',
      short_description: 'Collect and share daily standup updates',
      description: 'Automated collection and distribution of daily standup notes across the team.',
      departments: ['Everyone - Everyday', 'Product Management'],
      tags: 'standup, meetings, team, communication',
      status: 'published',
      price: 80,
      assigned_to: freelancer.id
    },
    {
      use_case: 'IT Asset Tracking',
      flow_name: 'Asset Management System',
      short_description: 'Track and manage IT assets',
      description: 'Complete asset lifecycle management including procurement, assignment, and retirement.',
      departments: ['IT', 'Operations'],
      tags: 'assets, it, tracking, inventory',
      status: 'in_progress',
      price: 160,
      assigned_to: freelancer.id
    },
    {
      use_case: 'Personal Task Manager',
      flow_name: 'My Tasks',
      short_description: 'Personal productivity task tracker',
      description: 'Manage personal tasks with priorities, due dates, and automated reminders.',
      departments: ['Personal Productivity', 'Everyone - Everyday'],
      tags: 'tasks, productivity, personal, gtd',
      status: 'published',
      price: 60,
      assigned_to: freelancer.id
    },
    {
      use_case: 'Expense Report Submission',
      flow_name: 'Expense Reporting',
      short_description: 'Submit and approve expense reports',
      description: 'Streamlined expense report submission with receipt capture and automated approval routing.',
      departments: ['Finance/Accounting', 'Everyone - Everyday'],
      tags: 'expenses, finance, reimbursement, approval',
      status: 'published',
      price: 120,
      assigned_to: freelancer.id
    },
    {
      use_case: 'Sales Pipeline Management',
      flow_name: 'Pipeline Tracker',
      short_description: 'Track deals through the sales pipeline',
      description: 'Comprehensive sales pipeline management with stage tracking, probability scoring, and automated follow-ups.',
      departments: ['Sales', 'Operations'],
      tags: 'sales, pipeline, crm, deals',
      status: 'published',
      price: 180,
      assigned_to: freelancer.id
    },
    {
      use_case: 'Proposal Generation',
      flow_name: 'Auto Proposal Creator',
      short_description: 'Generate customized sales proposals',
      description: 'Automatically generate professional sales proposals with pricing, terms, and product details.',
      departments: ['Sales', 'Marketing'],
      tags: 'proposals, sales, documents, automation',
      status: 'in_progress',
      price: 160,
      assigned_to: freelancer.id
    }
  ];

  // Insert templates
  let insertedCount = 0;

  for (const template of sampleTemplates) {
    try {
      // Insert the idea (keeping old department field for backward compatibility)
      const result = await db.prepare(`
        INSERT INTO ideas (
          use_case, flow_name, short_description, description,
          department, tags, status, price, assigned_to, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `).get(
        template.use_case,
        template.flow_name,
        template.short_description,
        template.description,
        template.departments[0], // Use first department for backward compatibility
        template.tags,
        template.status,
        template.price,
        template.assigned_to,
        admin.id
      );

      const ideaId = result.id;

      // Insert department relationships
      for (const deptName of template.departments) {
        const deptId = deptMap[deptName];
        if (deptId) {
          await db.prepare(`
            INSERT INTO idea_departments (idea_id, department_id)
            VALUES ($1, $2)
          `).run(ideaId, deptId);
        } else {
          console.warn(`⚠️  Department "${deptName}" not found for template "${template.use_case}"`);
        }
      }

      insertedCount++;
      console.log(`✅ ${template.use_case} (${template.departments.join(', ')})`);
    } catch (error) {
      console.error(`❌ Error inserting template: ${template.use_case}`);
      console.error(error.message);
    }
  }

  console.log(`\n✅ Successfully inserted ${insertedCount} sample templates with departments\n`);

  // Show statistics
  const totalIdeas = await db.prepare('SELECT COUNT(*) as count FROM ideas').get();
  const totalIdeaDepts = await db.prepare('SELECT COUNT(*) as count FROM idea_departments').get();
  const avgDepts = await db.prepare(`
    SELECT AVG(dept_count) as avg
    FROM (
      SELECT COUNT(*) as dept_count
      FROM idea_departments
      GROUP BY idea_id
    ) sub
  `).get();

  console.log('📊 Database Statistics:');
  console.log(`   Total Ideas: ${totalIdeas.count}`);
  console.log(`   Total Idea-Department Links: ${totalIdeaDepts.count}`);
  console.log(`   Average Departments per Idea: ${(avgDepts.avg || 0).toFixed(2)}`);
  console.log();

} catch (error) {
  console.error('\n❌ Seeding failed:', error);
  process.exit(1);
}

process.exit(0);
