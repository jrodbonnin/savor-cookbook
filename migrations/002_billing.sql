CREATE TABLE IF NOT EXISTS savor.billing_customers (
  user_id text PRIMARY KEY,
  stripe_customer_id text UNIQUE,
  checkout_session_id text,
  checkout_attempt_id uuid,
  checkout_origin text,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS savor.subscriptions (
  stripe_subscription_id text PRIMARY KEY,
  user_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  price_id text,
  status text NOT NULL,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  latest_invoice_status text,
  price_valid boolean NOT NULL DEFAULT false,
  paused boolean NOT NULL DEFAULT false,
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_id ON savor.subscriptions (user_id);
CREATE TABLE IF NOT EXISTS savor.stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  customer_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON savor.billing_customers, savor.subscriptions, savor.stripe_events FROM PUBLIC;
