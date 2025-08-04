-- Create table for storing column mappings
CREATE TABLE public.column_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_type VARCHAR(50) NOT NULL, -- csv, xlsx, xls, pdf
  category VARCHAR(50) NOT NULL, -- sales, marketing, operations, etc.
  original_columns JSONB NOT NULL, -- detected column names
  mapped_columns JSONB NOT NULL, -- mapping to standard fields
  mapping_rules JSONB, -- additional parsing rules
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.column_mappings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own column mappings" 
ON public.column_mappings 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own column mappings" 
ON public.column_mappings 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own column mappings" 
ON public.column_mappings 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own column mappings" 
ON public.column_mappings 
FOR DELETE 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all column mappings" 
ON public.column_mappings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_column_mappings_updated_at
BEFORE UPDATE ON public.column_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_column_mappings_user_id ON public.column_mappings(user_id);
CREATE INDEX idx_column_mappings_file_type ON public.column_mappings(file_type);
CREATE INDEX idx_column_mappings_category ON public.column_mappings(category);