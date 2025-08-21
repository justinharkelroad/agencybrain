-- Create snapshot planner table
CREATE TABLE public.snapshot_planner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  snapshot_date DATE NOT NULL,
  uploaded_month INTEGER NOT NULL CHECK (uploaded_month >= 1 AND uploaded_month <= 12),
  ytd_items_total INTEGER NOT NULL,
  current_month_items_total INTEGER,
  grid_version TEXT,
  tiers JSONB NOT NULL,
  raw_pdf_meta JSONB
);

-- Enable RLS
ALTER TABLE public.snapshot_planner ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own snapshots" 
ON public.snapshot_planner 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all snapshots" 
ON public.snapshot_planner 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = auth.uid() AND role = 'admin'
));

-- Add updated_at trigger
CREATE TRIGGER update_snapshot_planner_updated_at
  BEFORE UPDATE ON public.snapshot_planner
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();