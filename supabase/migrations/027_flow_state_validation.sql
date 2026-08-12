-- askQuestion nodes can now validate the reply (e.g. "email") and re-ask on a bad
-- format instead of blindly accepting whatever the customer typed. To re-send the
-- original question text and re-check on the next message, the paused state needs to
-- know which node asked it — resume_node_id already points to the node AFTER it.
ALTER TABLE automation_flow_state ADD COLUMN IF NOT EXISTS awaiting_node_id TEXT;
