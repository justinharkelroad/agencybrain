-- Create support_tickets table for global feedback/issue reporting
-- This table stores user-submitted issues that get emailed to info@standardplaybook.com

CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Submitter relationships (nullable because could be staff or user)
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_member_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,

  -- Denormalized submitter info for easy viewing without joins
  submitter_name TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  submitter_type TEXT NOT NULL CHECK (submitter_type IN ('owner', 'admin', 'staff')),
  agency_name TEXT,

  -- Ticket content
  description TEXT NOT NULL,
  page_url TEXT,
  browser_info TEXT,

  -- Attachments stored as array of storage URLs
  attachment_urls TEXT[] DEFAULT '{}',

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Admin handling
  admin_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create tickets (their own user_id)
CREATE POLICY "Users can create their own tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

-- Policy: Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
ON public.support_tickets
FOR SELECT
USING (
  user_id = auth.uid()
);

-- Policy: Admins can view and manage all tickets
CREATE POLICY "Admins can manage all tickets"
ON public.support_tickets
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Add updated_at trigger (reuses existing function)
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for common queries
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_agency_id ON public.support_tickets(agency_id);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX idx_support_tickets_priority ON public.support_tickets(priority);

-- Add comment for documentation
COMMENT ON TABLE public.support_tickets IS 'User-submitted feedback and issue reports. Emails sent to info@standardplaybook.com on creation.';
