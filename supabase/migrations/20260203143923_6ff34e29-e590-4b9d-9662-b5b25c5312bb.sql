-- Add recipient_user_id to track specific message recipients
ALTER TABLE sales_experience_messages 
ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES profiles(id);

-- Add recipient_role to store what role they have (for display purposes)
ALTER TABLE sales_experience_messages 
ADD COLUMN IF NOT EXISTS recipient_role text;

COMMENT ON COLUMN sales_experience_messages.recipient_user_id IS 'Specific user the message is intended for (owner, key employee, or manager)';
COMMENT ON COLUMN sales_experience_messages.recipient_role IS 'Role label of the recipient (Owner, Key Employee, Manager)';