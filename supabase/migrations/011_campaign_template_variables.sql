-- Add template_variables to campaigns for per-campaign variable values
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_variables JSONB NOT NULL DEFAULT '{}';

-- Also add product_id reference (optional, links to synced product)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ecommerce_product_id UUID REFERENCES ecommerce_products(id) ON DELETE SET NULL;
