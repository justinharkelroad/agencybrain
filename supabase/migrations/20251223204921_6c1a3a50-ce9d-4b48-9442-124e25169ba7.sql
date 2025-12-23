-- Create staff_core4_entries table for staff user Core 4 tracking
CREATE TABLE public.staff_core4_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_user_id UUID NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  body_completed BOOLEAN DEFAULT false,
  body_note TEXT,
  being_completed BOOLEAN DEFAULT false,
  being_note TEXT,
  balance_completed BOOLEAN DEFAULT false,
  balance_note TEXT,
  business_completed BOOLEAN DEFAULT false,
  business_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(staff_user_id, date)
);

-- Enable RLS
ALTER TABLE public.staff_core4_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies - staff can only manage their own entries (enforced via edge function)
-- No direct RLS needed since all access goes through edge functions with session token validation

-- Create index for performance
CREATE INDEX idx_staff_core4_entries_staff_user_date ON public.staff_core4_entries(staff_user_id, date DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_staff_core4_entries_updated_at
BEFORE UPDATE ON public.staff_core4_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();