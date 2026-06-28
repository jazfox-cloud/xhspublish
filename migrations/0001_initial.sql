CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  avatar_url TEXT,
  credit_balance INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wechat_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  openid TEXT NOT NULL,
  unionid TEXT,
  nickname TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wechat_accounts_openid ON wechat_accounts(openid);
CREATE INDEX IF NOT EXISTS idx_wechat_accounts_user_id ON wechat_accounts(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  related_id TEXT,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id_created_at ON credit_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS publish_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  images_json TEXT NOT NULL,
  topics_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'web',
  idempotency_key TEXT,
  credit_ledger_id TEXT REFERENCES credit_ledger(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  opened_at INTEGER,
  launched_at INTEGER,
  submitted_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_publish_tasks_user_id_idempotency ON publish_tasks(user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_publish_tasks_user_id_created_at ON publish_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publish_tasks_expires_at ON publish_tasks(expires_at);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  r2_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_user_id_created_at ON assets(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  credits_amount INTEGER NOT NULL,
  price_fen INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  wxpay_prepay_id TEXT,
  wxpay_out_trade_no TEXT UNIQUE,
  paid_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  event_type TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_events_order_id ON payment_events(order_id);
