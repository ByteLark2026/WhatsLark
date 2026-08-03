-- Prevent duplicate order-event rows (and duplicate customer WhatsApp notifications)
-- when a store retries webhook delivery for the same order/event.
ALTER TABLE ecommerce_order_events
  ADD CONSTRAINT ecommerce_order_events_unique_delivery
  UNIQUE (connection_id, external_order_id, event_type);
