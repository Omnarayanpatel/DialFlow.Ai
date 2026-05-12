CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  password VARCHAR(255) NOT NULL,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  zoho_id VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'agent',
  status VARCHAR(20) DEFAULT 'Offline',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS zoho_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Offline';

CREATE TABLE IF NOT EXISTS agent_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logout_time TIMESTAMP,
  break_start_time TIMESTAMP,
  total_break_duration INTEGER NOT NULL DEFAULT 0,
  break_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'online',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS login_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS logout_time TIMESTAMP;
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS break_start_time TIMESTAMP;
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS total_break_duration INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS break_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'online';
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS responses (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  employee_id VARCHAR(50) NOT NULL,
  employee_name VARCHAR(120) NOT NULL,
  zoho_id VARCHAR(100),
  dialer_id VARCHAR(100),
  reference_id VARCHAR(100) NOT NULL,
  call_status VARCHAR(50) NOT NULL DEFAULT 'NA',
  disposition VARCHAR(100) NOT NULL DEFAULT 'NA',
  sub_disposition VARCHAR(150) NOT NULL DEFAULT 'NA',
  language VARCHAR(50) NOT NULL DEFAULT 'NA',
  language_other VARCHAR(100),
  remark TEXT
);

ALTER TABLE responses ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS employee_name VARCHAR(120);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS zoho_id VARCHAR(100);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS dialer_id VARCHAR(100);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS call_status VARCHAR(50) DEFAULT 'NA';
ALTER TABLE responses ADD COLUMN IF NOT EXISTS disposition VARCHAR(100) DEFAULT 'NA';
ALTER TABLE responses ADD COLUMN IF NOT EXISTS sub_disposition VARCHAR(150) DEFAULT 'NA';
ALTER TABLE responses ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'NA';
ALTER TABLE responses ADD COLUMN IF NOT EXISTS language_other VARCHAR(100);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS remark TEXT;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_responses_agent_created_at
  ON responses (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_responses_agent_created_date
  ON responses (employee_id, (created_at::date));

CREATE INDEX IF NOT EXISTS idx_responses_agent_status_disposition
  ON responses (employee_id, call_status, disposition);

CREATE INDEX IF NOT EXISTS idx_responses_agent_reference_id
  ON responses (employee_id, reference_id);

CREATE INDEX IF NOT EXISTS idx_responses_created_date
  ON responses ((created_at::date), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_responses_created_date_agent
  ON responses ((created_at::date), employee_id);

CREATE INDEX IF NOT EXISTS idx_responses_status_disposition_created_at
  ON responses (call_status, disposition, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_responses_employee_name_lower
  ON responses (LOWER(employee_name));

CREATE INDEX IF NOT EXISTS idx_responses_reference_id_lower
  ON responses (LOWER(reference_id));

CREATE INDEX IF NOT EXISTS idx_responses_employee_name_trgm
  ON responses USING GIN (employee_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_responses_reference_id_trgm
  ON responses USING GIN (reference_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_role_status
  ON users (role, status);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_active
  ON agent_sessions (user_id, logout_time, status);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_active_status_login
  ON agent_sessions (logout_time, status, login_time DESC);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_login
  ON agent_sessions (user_id, login_time DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'responses' AND column_name = 'timestamp'
  ) THEN
    EXECUTE 'UPDATE responses SET created_at = timestamp WHERE created_at IS NULL';
  END IF;
END $$;
