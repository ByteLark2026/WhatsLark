-- ─── Ecommerce Connector ─────────────────────────────────────────────────────

CREATE TYPE ecommerce_platform AS ENUM ('woocommerce', 'shopify');
CREATE TYPE ecommerce_order_event AS ENUM ('order_placed', 'order_confirmed', 'order_shipped', 'order_delivered', 'order_cancelled', 'order_refunded');

-- Store connections
CREATE TABLE ecommerce_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform ecommerce_platform NOT NULL,
  store_name TEXT NOT NULL,
  store_url TEXT NOT NULL,
  -- WooCommerce fields
  consumer_key TEXT,
  consumer_secret TEXT,
  -- Shopify fields
  api_access_token TEXT,
  -- Shared
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  webhook_secret TEXT, -- for verifying incoming webhooks from the store
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, store_url)
);

-- Cached product catalog
CREATE TABLE ecommerce_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES ecommerce_connections(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL, -- product id in WooCommerce/Shopify
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2),
  compare_price NUMERIC(12,2),
  currency TEXT DEFAULT 'AED',
  image_url TEXT,
  product_url TEXT,
  sku TEXT,
  stock_status TEXT, -- instock, outofstock, etc.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, external_id)
);

-- Order events received from store webhooks
CREATE TABLE ecommerce_order_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES ecommerce_connections(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type ecommerce_order_event NOT NULL,
  external_order_id TEXT NOT NULL,
  order_number TEXT,
  customer_phone TEXT,
  customer_name TEXT,
  customer_email TEXT,
  total_amount NUMERIC(12,2),
  currency TEXT DEFAULT 'AED',
  items JSONB DEFAULT '[]',
  tracking_url TEXT,
  otp_code TEXT, -- if OTP was sent for this order
  whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_sent_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX ecommerce_connections_company_id ON ecommerce_connections(company_id);
CREATE INDEX ecommerce_products_connection_id ON ecommerce_products(connection_id);
CREATE INDEX ecommerce_products_company_id ON ecommerce_products(company_id);
CREATE INDEX ecommerce_order_events_connection_id ON ecommerce_order_events(connection_id);
CREATE INDEX ecommerce_order_events_company_id ON ecommerce_order_events(company_id);
CREATE INDEX ecommerce_order_events_customer_phone ON ecommerce_order_events(customer_phone);
CREATE INDEX ecommerce_order_events_created_at ON ecommerce_order_events(created_at DESC);

-- Updated_at triggers
CREATE TRIGGER trg_ecommerce_connections_updated_at
  BEFORE UPDATE ON ecommerce_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ecommerce_products_updated_at
  BEFORE UPDATE ON ecommerce_products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE ecommerce_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ecommerce_connections_company ON ecommerce_connections
  USING (company_id = current_company_id() OR is_super_admin());

CREATE POLICY ecommerce_products_company ON ecommerce_products
  USING (company_id = current_company_id() OR is_super_admin());

CREATE POLICY ecommerce_order_events_company ON ecommerce_order_events
  USING (company_id = current_company_id() OR is_super_admin());
