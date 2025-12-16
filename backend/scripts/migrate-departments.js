/**
 * Migration script to convert single department field to many-to-many relationship
 * This script:
 * 1. Creates the departments table with predefined departments
 * 2. Creates the idea_departments junction table
 * 3. Migrates existing department data to the new structure
 */

import db, { initDatabase } from '../src/database/db.js';

// Initialize database connection
await initDatabase();

console.log('🔄 Starting department migration...\n');

try {
  // 1. Create departments table
  console.log('📋 Step 1: Creating departments table...');
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 999,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 2. Insert predefined departments
  console.log('📋 Step 2: Inserting predefined departments...');
  const departments = [
    { name: 'Everyone - Everyday', description: 'Templates useful for everyone in daily tasks', order: 1 },
    { name: 'Customer Support/Success', description: 'Customer support and success templates', order: 2 },
    { name: 'Finance/Accounting', description: 'Finance and accounting workflows', order: 3 },
    { name: 'HR', description: 'Human resources templates', order: 4 },
    { name: 'IT', description: 'Information technology templates', order: 5 },
    { name: 'Legal', description: 'Legal department templates', order: 6 },
    { name: 'Marketing', description: 'Marketing and campaigns', order: 7 },
    { name: 'Operations', description: 'Operations and logistics', order: 8 },
    { name: 'Personal Productivity', description: 'Personal productivity and organization', order: 9 },
    { name: 'Product Management', description: 'Product management workflows', order: 10 },
    { name: 'Sales', description: 'Sales processes and pipelines', order: 11 },
  ];

  for (const dept of departments) {
    await db.prepare(`
      INSERT INTO departments (name, description, display_order)
      VALUES ($1, $2, $3)
      ON CONFLICT(name) DO NOTHING
    `).run(dept.name, dept.description, dept.order);
  }

  console.log(`   ✅ Inserted ${departments.length} departments`);

  // 3. Create idea_departments junction table
  console.log('📋 Step 3: Creating idea_departments junction table...');
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS idea_departments (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(idea_id, department_id)
    )
  `).run();

  // Create indexes
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_idea_departments_idea_id ON idea_departments(idea_id)
  `).run();
  
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_idea_departments_department_id ON idea_departments(department_id)
  `).run();

  // 4. Migrate existing department data
  console.log('📋 Step 4: Migrating existing department data...');
  
  // Get all ideas with departments
  const ideasWithDepts = await db.prepare(`
    SELECT id, department FROM ideas WHERE department IS NOT NULL AND department != ''
  `).all();

  console.log(`   Found ${ideasWithDepts.length} ideas with departments`);

  // Create a mapping of old department names to new department names
  const deptMapping = {
    'Sales': 'Sales',
    'Finance': 'Finance/Accounting',
    'Marketing': 'Marketing',
    'HR': 'HR',
    'Support': 'Customer Support/Success',
    'Customer Support': 'Customer Support/Success',
    'Operations': 'Operations',
    'Legal': 'Legal',
    'IT': 'IT',
    'QA': 'IT',
    'Security': 'IT',
    'Engineering': 'IT',
  };

  let migratedCount = 0;
  for (const idea of ideasWithDepts) {
    const oldDept = idea.department;
    const newDept = deptMapping[oldDept] || 'Everyone - Everyday';
    
    try {
      await db.prepare(`
        INSERT INTO idea_departments (idea_id, department_id)
        SELECT $1, d.id FROM departments d WHERE d.name = $2
        ON CONFLICT(idea_id, department_id) DO NOTHING
      `).run(idea.id, newDept);
      migratedCount++;
    } catch (error) {
      console.warn(`   ⚠️ Failed to migrate idea ${idea.id} with department "${oldDept}": ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${migratedCount} idea-department relationships`);

  // 5. Verify migration
  console.log('📋 Step 5: Verifying migration...');
  const verifyCount = await db.prepare('SELECT COUNT(*) as count FROM idea_departments').get();
  console.log(`   ✅ Total idea-department relationships: ${verifyCount.count}`);

  // Get department statistics
  const deptStats = await db.prepare(`
    SELECT d.name, COUNT(id.id) as template_count
    FROM departments d
    LEFT JOIN idea_departments id ON d.id = id.department_id
    GROUP BY d.id, d.name
    ORDER BY d.display_order
  `).all();

  console.log('\n📊 Department Statistics:');
  for (const stat of deptStats) {
    console.log(`   ${stat.name}: ${stat.template_count} templates`);
  }

  console.log('\n✅ Migration completed successfully!\n');
  console.log('📝 Note: The old "department" column in the ideas table has been kept for backward compatibility.');
  console.log('   You can safely remove it later once you verify everything works correctly.\n');

} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}

process.exit(0);
