-- Create table for storing column mappings
CREATE TABLE public.column_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  original_columns JSONB NOT NULL,
  mapped_columns JSONB NOT NULL,
  mapping_rules JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.column_mappings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own column mappings" 
ON public.column_mappings 
FOR ALL 
USING (user_id = auth.uid());

-- Add indexes for performance
CREATE INDEX idx_column_mappings_user_id ON public.column_mappings(user_id);
CREATE INDEX idx_column_mappings_file_type ON public.column_mappings(file_type);
CREATE INDEX idx_column_mappings_category ON public.column_mappings(category);