const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
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
CREATE INDEX IF NOT EXISTS otps_email_idx ON otps(email, purpose);
`;

async function migrate() {
  await pool.query(SCHEMA);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE otps ALTER COLUMN phone DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE INDEX IF NOT EXISTS otps_email_idx ON otps(email, purpose);
  `);
}

module.exports = { pool, migrate };

if (require.main === module) {
  migrate()
    .then(() => { console.log('Migration done'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
