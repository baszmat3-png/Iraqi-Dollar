const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  pts BIGINT NOT NULL DEFAULT 0,
  gems BIGINT NOT NULL DEFAULT 0,
  usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  spent BIGINT NOT NULL DEFAULT 0,
  kyc INT NOT NULL DEFAULT 0,
  ref_code TEXT UNIQUE,
  welcome_given BOOLEAN NOT NULL DEFAULT FALSE,
  running BOOLEAN NOT NULL DEFAULT FALSE,
  left_sec INT NOT NULL DEFAULT 86400,
  accr DOUBLE PRECISION NOT NULL DEFAULT 0,
  accg DOUBLE PRECISION NOT NULL DEFAULT 0,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  last_tick TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS otps (
  id SERIAL PRIMARY KEY,
  purpose TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  code_hash TEXT NOT NULL,
  payload JSONB,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS otps_phone_idx ON otps(phone, purpose);
CREATE TABLE IF NOT EXISTS counters (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idx INT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  listed_price BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS counters_user_idx ON counters(user_id);
CREATE TABLE IF NOT EXISTS withdrawals (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  method INT NOT NULL,
  emergency BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wd_user_idx ON withdrawals(user_id, created_at);
CREATE TABLE IF NOT EXISTS ledger (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  pts BIGINT NOT NULL DEFAULT 0,
  gems BIGINT NOT NULL DEFAULT 0,
  usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ledger_user_idx ON ledger(user_id, created_at DESC);
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS sync_kv (
  key TEXT PRIMARY KEY,
  val JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sync_cmds (
  id SERIAL PRIMARY KEY,
  body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sync_accounts (
  email TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  demo BOOLEAN NOT NULL DEFAULT FALSE,
  pts BIGINT NOT NULL DEFAULT 0,
  gems BIGINT NOT NULL DEFAULT 0,
  usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  blk BOOLEAN NOT NULL DEFAULT FALSE,
  kyc BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS pass_hash TEXT;
ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS vml BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS vph BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS cl JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS rcode TEXT;
ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS ref_by TEXT;
ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS rf_total BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS sync_accounts_rcode_idx ON sync_accounts(rcode);
CREATE TABLE IF NOT EXISTS sync_ref_ev (
  uid TEXT PRIMARY KEY,
  invitee TEXT NOT NULL,
  inviter TEXT NOT NULL,
  base BIGINT NOT NULL,
  pts BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sync_ref_ev_inviter_idx ON sync_ref_ev(inviter);
CREATE INDEX IF NOT EXISTS sync_ref_ev_invitee_idx ON sync_ref_ev(invitee);
CREATE TABLE IF NOT EXISTS fin_ev (
  uid TEXT PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email TEXT,
  kind TEXT NOT NULL,
  cat TEXT NOT NULL,
  pts BIGINT NOT NULL DEFAULT 0,
  iqd NUMERIC(16,2) NOT NULL DEFAULT 0,
  note TEXT,
  src TEXT NOT NULL DEFAULT 'auto'
);
CREATE INDEX IF NOT EXISTS fin_ev_ts_idx ON fin_ev(ts);
CREATE TABLE IF NOT EXISTS user_devices (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ua TEXT, ip TEXT, country TEXT, tz TEXT,
  is_vpn BOOLEAN NOT NULL DEFAULT FALSE,
  banned BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(email, fingerprint)
);
CREATE INDEX IF NOT EXISTS user_devices_email_idx ON user_devices(email);
CREATE TABLE IF NOT EXISTS security_alerts (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  email TEXT,
  meta JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS security_alerts_created_idx ON security_alerts(created_at DESC);
`;

async function migrate() {
  await pool.query(SCHEMA);
  await pool.query("DELETE FROM sync_accounts WHERE demo=TRUE OR LOWER(email)='demo@test.com'").catch(()=>{});
  await pool.query("DELETE FROM users WHERE LOWER(email)='demo@test.com'").catch(()=>{});
  if (process.env.RESET_BALANCES_ON_BOOT !== '1') return;
  await pool.query(`
    UPDATE sync_accounts SET pts=0, gems=0, usd=0, cl='[]'::jsonb;
    UPDATE users SET pts=0, gems=0, usd=0, welcome_given=TRUE, running=FALSE, done=FALSE, left_sec=86400, accr=0, accg=0;
    DELETE FROM counters;
  `).catch((err) => console.warn('Initial reset notice:', err.message));
}

module.exports = { pool, migrate };

if (require.main === module) {
  migrate()
    .then(() => { console.log('Migration done'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
