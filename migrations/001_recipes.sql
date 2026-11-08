CREATE SCHEMA IF NOT EXISTS savor;
REVOKE ALL ON SCHEMA savor FROM PUBLIC;
CREATE TABLE IF NOT EXISTS savor.recipes (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  recipe jsonb NOT NULL CHECK (jsonb_typeof(recipe) = 'object'),
  source_text text NOT NULL CHECK (char_length(source_text) <= 6000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recipes_user_created ON savor.recipes (user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS savor.ai_usage (
  scope text NOT NULL,
  day date NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  last_attempt timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, day)
);
CREATE TABLE IF NOT EXISTS savor.ai_imports (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  source_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  recipe jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS imports_user_created ON savor.ai_imports (user_id, created_at DESC);
REVOKE ALL ON ALL TABLES IN SCHEMA savor FROM PUBLIC;
