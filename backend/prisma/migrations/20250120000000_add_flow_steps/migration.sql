-- Add flow_steps column to ideas table
-- This column stores a JSON array of extracted integration/step information from the flow JSON
ALTER TABLE ideas ADD COLUMN flow_steps TEXT;
