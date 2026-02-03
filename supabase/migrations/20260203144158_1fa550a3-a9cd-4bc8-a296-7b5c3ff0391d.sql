-- Add subject column to sales_experience_messages for message organization
ALTER TABLE sales_experience_messages 
ADD COLUMN IF NOT EXISTS subject text;

-- Add is_read boolean for simpler read tracking
ALTER TABLE sales_experience_messages 
ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

COMMENT ON COLUMN sales_experience_messages.subject IS 'Subject line for the message';
COMMENT ON COLUMN sales_experience_messages.is_read IS 'Whether the message has been read';