-- Create focus_items table for "My Current Focus" feature
CREATE TABLE IF NOT EXISTS public.focus_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority_level TEXT NOT NULL CHECK (priority_level IN ('top', 'mid', 'low')),
  column_status TEXT NOT NULL DEFAULT 'backlog' CHECK (column_status IN ('backlog', 'week1', 'week2', 'next_call', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  column_order INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.focus_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage their own focus items
CREATE POLICY "Users can view their own focus items"
  ON public.focus_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own focus items"
  ON public.focus_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own focus items"
  ON public.focus_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own focus items"
  ON public.focus_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies: Admins can manage all focus items
CREATE POLICY "Admins can view all focus items"
  ON public.focus_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all focus items"
  ON public.focus_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete all focus items"
  ON public.focus_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_focus_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_focus_items_updated_at_trigger
  BEFORE UPDATE ON public.focus_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_focus_items_updated_at();

-- Trigger to auto-set completed_at when moving to completed column
CREATE OR REPLACE FUNCTION public.set_focus_item_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.column_status = 'completed' AND OLD.column_status != 'completed' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.column_status != 'completed' AND OLD.column_status = 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_focus_item_completed_at_trigger
  BEFORE UPDATE ON public.focus_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_focus_item_completed_at();

-- Create indexes for performance
CREATE INDEX idx_focus_items_user_id ON public.focus_items(user_id);
CREATE INDEX idx_focus_items_agency_id ON public.focus_items(agency_id);
CREATE INDEX idx_focus_items_column_status ON public.focus_items(column_status);
CREATE INDEX idx_focus_items_created_at ON public.focus_items(created_at DESC);