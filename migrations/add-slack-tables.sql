-- Add Slack integration tables safely
-- Run this SQL manually instead of using drizzle-kit push

BEGIN;

-- Create slack_workspaces table
CREATE TABLE IF NOT EXISTS slack_workspaces (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  slack_team_id TEXT NOT NULL UNIQUE,
  team_name TEXT NOT NULL,
  bot_token TEXT NOT NULL,
  bot_user_id TEXT NOT NULL,
  installed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for slack_workspaces
CREATE INDEX IF NOT EXISTS idx_slack_workspaces_client_id ON slack_workspaces(client_id);
CREATE INDEX IF NOT EXISTS idx_slack_workspaces_team_id ON slack_workspaces(slack_team_id);

-- Create slack_user_mappings table
CREATE TABLE IF NOT EXISTS slack_user_mappings (
  id SERIAL PRIMARY KEY,
  slack_user_id TEXT NOT NULL,
  slack_team_id TEXT NOT NULL,
  ferdinand_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for slack_user_mappings
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_slack_user ON slack_user_mappings(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_client ON slack_user_mappings(client_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_team ON slack_user_mappings(slack_team_id);

-- Create unique constraint for active mappings
CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_user_mappings_unique_active
  ON slack_user_mappings(slack_user_id, slack_team_id)
  WHERE is_active = true;

-- Create api_tokens table
CREATE TABLE IF NOT EXISTS api_tokens (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  token_name TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['read:assets'],
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for api_tokens
CREATE INDEX IF NOT EXISTS idx_api_tokens_client_id ON api_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);

-- Create slack_conversations table
CREATE TABLE IF NOT EXISTS slack_conversations (
  id SERIAL PRIMARY KEY,
  slack_user_id TEXT NOT NULL,
  slack_channel_id TEXT NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  context JSONB DEFAULT '{}',
  last_message_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Create indexes for slack_conversations
CREATE INDEX IF NOT EXISTS idx_slack_conversations_user ON slack_conversations(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_conversations_client ON slack_conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_slack_conversations_expires ON slack_conversations(expires_at);

COMMIT;

-- Verify tables were created
\dt slack_*
\dt api_tokens;