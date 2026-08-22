-- Enable RLS
alter table bots enable row level security;
alter table scripts enable row level security;
alter table variables enable row level security;

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    token TEXT NOT NULL,
    avatar_url TEXT,
    app_id TEXT,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scripts table
CREATE TABLE IF NOT EXISTS scripts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger TEXT NOT NULL,
    code TEXT DEFAULT '',
    compiled_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Variables table
CREATE TABLE IF NOT EXISTS variables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    current_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
CREATE POLICY "Users can only access their own bots"
  ON bots FOR ALL
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can access scripts of their bots"
  ON scripts FOR ALL
  USING (bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid()::text));

CREATE POLICY "Users can access variables of their bots"
  ON variables FOR ALL
  USING (bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid()::text));

-- Indexes
CREATE INDEX idx_bots_user_id ON bots(user_id);
CREATE INDEX idx_scripts_bot_id ON scripts(bot_id);
CREATE INDEX idx_variables_bot_id ON variables(bot_id);
