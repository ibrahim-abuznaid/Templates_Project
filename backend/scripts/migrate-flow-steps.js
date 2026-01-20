/**
 * Migration script for extracting flow steps from existing templates
 * 
 * This script:
 * 1. Adds the flow_steps column to ideas table if it doesn't exist
 * 2. Processes all templates that have flow_json data
 * 3. Extracts integration/step information from flow_json
 * 4. Stores the extracted steps in the flow_steps column
 * 
 * This script is idempotent - safe to run multiple times.
 * 
 * Usage: node scripts/migrate-flow-steps.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Convert piece package name to human-readable display name
// e.g., "@activepieces/piece-google-calendar" -> "Google Calendar"
const pieceNameToDisplayName = (pieceName) => {
  if (!pieceName) return 'Unknown';
  
  // Remove the @activepieces/piece- prefix
  let name = pieceName.replace('@activepieces/piece-', '');
  
  // Handle special cases
  const specialCases = {
    'perplexity-ai': 'Perplexity AI',
    'google-calendar': 'Google Calendar',
    'google-docs': 'Google Docs',
    'google-sheets': 'Google Sheets',
    'google-drive': 'Google Drive',
    'google-gmail': 'Gmail',
    'gmail': 'Gmail',
    'date-helper': 'Date Helper',
    'openai': 'OpenAI',
    'slack': 'Slack',
    'discord': 'Discord',
    'notion': 'Notion',
    'airtable': 'Airtable',
    'hubspot': 'HubSpot',
    'salesforce': 'Salesforce',
    'stripe': 'Stripe',
    'shopify': 'Shopify',
    'mailchimp': 'Mailchimp',
    'sendgrid': 'SendGrid',
    'twilio': 'Twilio',
    'github': 'GitHub',
    'gitlab': 'GitLab',
    'jira': 'Jira',
    'trello': 'Trello',
    'asana': 'Asana',
    'monday': 'Monday.com',
    'clickup': 'ClickUp',
    'zoom': 'Zoom',
    'microsoft-teams': 'Microsoft Teams',
    'microsoft-outlook': 'Microsoft Outlook',
    'microsoft-excel': 'Microsoft Excel',
    'dropbox': 'Dropbox',
    'box': 'Box',
    'http': 'HTTP Request',
    'webhook': 'Webhook',
    'schedule': 'Schedule',
    'code': 'Code',
    'data-mapper': 'Data Mapper',
    'delay': 'Delay',
    'branch': 'Branch',
    'loop': 'Loop',
    'text-helper': 'Text Helper',
    'math-helper': 'Math Helper',
    'json': 'JSON',
    'xml': 'XML',
    'csv': 'CSV',
    'pdf': 'PDF',
    'image': 'Image',
    'anthropic': 'Anthropic Claude',
    'gemini': 'Google Gemini',
    'stability-ai': 'Stability AI',
    'eleven-labs': 'ElevenLabs',
    'deepl': 'DeepL',
    'aws-s3': 'AWS S3',
    'aws-lambda': 'AWS Lambda',
    'aws-sns': 'AWS SNS',
    'aws-sqs': 'AWS SQS',
    'firebase': 'Firebase',
    'supabase': 'Supabase',
    'postgresql': 'PostgreSQL',
    'mysql': 'MySQL',
    'mongodb': 'MongoDB',
    'redis': 'Redis',
    'elasticsearch': 'Elasticsearch',
    'intercom': 'Intercom',
    'zendesk': 'Zendesk',
    'freshdesk': 'Freshdesk',
    'linear': 'Linear',
    'figma': 'Figma',
    'webflow': 'Webflow',
    'wordpress': 'WordPress',
    'woocommerce': 'WooCommerce',
    'pipedrive': 'Pipedrive',
    'calendly': 'Calendly',
    'typeform': 'Typeform',
    'google-forms': 'Google Forms',
    'telegram': 'Telegram',
    'whatsapp': 'WhatsApp',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'twitter': 'Twitter/X',
    'linkedin': 'LinkedIn',
    'youtube': 'YouTube',
    'tiktok': 'TikTok',
    'spotify': 'Spotify',
    'quickbooks': 'QuickBooks',
    'xero': 'Xero',
    'zapier': 'Zapier',
    'make': 'Make',
    'n8n': 'n8n',
    'pabbly': 'Pabbly',
    'activepieces': 'Activepieces'
  };
  
  if (specialCases[name]) {
    return specialCases[name];
  }
  
  // Default: Convert kebab-case to Title Case
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Extract flows array from uploaded flow JSON
const extractFlowsFromJson = (flowJson) => {
  if (!flowJson) {
    return { success: false, error: 'Empty file' };
  }
  
  try {
    const parsed = JSON.parse(flowJson);
    
    // Case 1: Our storage format (has _flowCount property)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed._flowCount !== undefined && parsed.flows) {
      const flows = Array.isArray(parsed.flows) ? parsed.flows : [parsed.flows];
      return { success: true, flows, pieces: parsed.pieces || [] };
    }
    
    // Case 2: Full template export object with flows property
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.flows) {
      const flows = Array.isArray(parsed.flows) ? parsed.flows : [parsed.flows];
      return { success: true, flows, pieces: parsed.pieces || [] };
    }
    
    return { success: false, error: 'Invalid format' };
  } catch (error) {
    return { success: false, error: 'Invalid JSON format' };
  }
};

// Extract unique integrations/steps from flow JSON
const extractStepsFromFlows = (flowJson) => {
  if (!flowJson) {
    return [];
  }
  
  try {
    const parsed = JSON.parse(flowJson);
    
    // Get the pieces array if available (contains unique integrations at root level)
    const piecesArray = parsed.pieces || [];
    
    // Extract flows
    const result = extractFlowsFromJson(flowJson);
    if (!result.success) {
      // If no flows, but we have pieces array, extract from that
      if (piecesArray.length > 0) {
        return piecesArray.map(pieceName => ({
          displayName: pieceNameToDisplayName(pieceName),
          pieceName: pieceName,
          pieceDisplayName: pieceNameToDisplayName(pieceName),
          type: 'PIECE'
        }));
      }
      return [];
    }
    
    const flows = result.flows;
    const stepsMap = new Map(); // Use map to dedupe by pieceName
    
    // Helper to traverse actions recursively
    const traverseAction = (action) => {
      if (!action) return;
      
      // Extract piece info if this is a piece action
      if (action.settings?.pieceName) {
        const pieceName = action.settings.pieceName;
        if (!stepsMap.has(pieceName)) {
          stepsMap.set(pieceName, {
            displayName: action.displayName || pieceNameToDisplayName(pieceName),
            pieceName: pieceName,
            pieceDisplayName: pieceNameToDisplayName(pieceName),
            actionName: action.settings.actionName || action.settings.triggerName || null,
            triggerName: action.settings.triggerName || null,
            type: action.type || 'PIECE'
          });
        }
      }
      
      // Handle branch actions
      if (action.onSuccessAction) {
        traverseAction(action.onSuccessAction);
      }
      if (action.onFailureAction) {
        traverseAction(action.onFailureAction);
      }
      
      // Handle loop actions
      if (action.firstLoopAction) {
        traverseAction(action.firstLoopAction);
      }
      
      // Handle router actions
      if (action.children && Array.isArray(action.children)) {
        action.children.forEach(child => traverseAction(child));
      }
      if (action.branches && Array.isArray(action.branches)) {
        action.branches.forEach(branch => {
          if (branch.action) traverseAction(branch.action);
        });
      }
      
      // Continue to next action
      if (action.nextAction) {
        traverseAction(action.nextAction);
      }
    };
    
    // Process each flow
    for (const flow of flows) {
      // Extract trigger
      if (flow.trigger) {
        if (flow.trigger.settings?.pieceName) {
          const pieceName = flow.trigger.settings.pieceName;
          if (!stepsMap.has(pieceName)) {
            stepsMap.set(pieceName, {
              displayName: flow.trigger.displayName || pieceNameToDisplayName(pieceName),
              pieceName: pieceName,
              pieceDisplayName: pieceNameToDisplayName(pieceName),
              triggerName: flow.trigger.settings.triggerName || null,
              actionName: null,
              type: flow.trigger.type || 'PIECE_TRIGGER'
            });
          }
        }
        
        // Traverse actions starting from trigger's nextAction
        if (flow.trigger.nextAction) {
          traverseAction(flow.trigger.nextAction);
        }
      }
    }
    
    // Convert map to array
    return Array.from(stepsMap.values());
  } catch (error) {
    return [];
  }
};

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting flow steps migration...\n');
    
    // Check if column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ideas' 
      AND column_name = 'flow_steps'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('📝 Adding "flow_steps" column...');
      await client.query(`
        ALTER TABLE ideas 
        ADD COLUMN flow_steps TEXT
      `);
      console.log('   ✅ Added "flow_steps" column\n');
    } else {
      console.log('   ⏭️  "flow_steps" column already exists\n');
    }

    // Get all templates with flow_json
    console.log('📦 Fetching templates with flow_json...');
    const templates = await client.query(`
      SELECT id, flow_name, flow_json 
      FROM ideas 
      WHERE flow_json IS NOT NULL AND flow_json != ''
      ORDER BY id
    `);
    
    console.log(`   Found ${templates.rows.length} templates with flow data\n`);
    
    if (templates.rows.length === 0) {
      console.log('✅ No templates to process. Migration complete!');
      return;
    }

    // Process each template
    console.log('🔄 Processing templates...\n');
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const template of templates.rows) {
      processed++;
      const { id, flow_name, flow_json } = template;
      
      try {
        // Extract steps
        const steps = extractStepsFromFlows(flow_json);
        
        if (steps.length === 0) {
          console.log(`   [${processed}/${templates.rows.length}] #${id} "${flow_name || 'Untitled'}": No steps found, skipping`);
          skipped++;
          continue;
        }
        
        const stepsJson = JSON.stringify(steps);
        
        // Update the template
        await client.query(
          'UPDATE ideas SET flow_steps = $1 WHERE id = $2',
          [stepsJson, id]
        );
        
        console.log(`   [${processed}/${templates.rows.length}] #${id} "${flow_name || 'Untitled'}": ${steps.length} integration(s) extracted ✅`);
        updated++;
        
      } catch (error) {
        console.error(`   [${processed}/${templates.rows.length}] #${id} "${flow_name || 'Untitled'}": Error - ${error.message} ❌`);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`   Total templates processed: ${processed}`);
    console.log(`   Successfully updated: ${updated}`);
    console.log(`   Skipped (no steps found): ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log('='.repeat(60));
    console.log('\n✅ Flow steps migration completed!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});
