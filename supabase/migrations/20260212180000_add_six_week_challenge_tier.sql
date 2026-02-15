-- Add 'Six Week Challenge' to membership_tier enum
-- This tier is for standalone challenge buyers who purchase from the public landing page.
-- They get limited portal access (challenge + exchange only), gated similarly to Call Scoring tier.
ALTER TYPE membership_tier ADD VALUE IF NOT EXISTS 'Six Week Challenge';
