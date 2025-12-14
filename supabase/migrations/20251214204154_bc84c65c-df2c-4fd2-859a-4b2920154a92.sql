-- Create saved_reports table for persistent report storage
CREATE TABLE public.saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('staff_roi', 'vendor_verifier')),
  title TEXT NOT NULL,
  input_data JSONB NOT NULL,
  results_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own agency's reports
CREATE POLICY "Users can view their agency reports"
ON public.saved_reports
FOR SELECT
USING (
  agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  )
);

-- Users can insert their own reports
CREATE POLICY "Users can insert their own reports"
ON public.saved_reports
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  )
);

-- Users can delete their own reports
CREATE POLICY "Users can delete their own reports"
ON public.saved_reports
FOR DELETE
USING (
  auth.uid() = user_id
);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
ON public.saved_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create index for faster queries
CREATE INDEX idx_saved_reports_agency_id ON public.saved_reports(agency_id);
CREATE INDEX idx_saved_reports_user_id ON public.saved_reports(user_id);
CREATE INDEX idx_saved_reports_type ON public.saved_reports(report_type);