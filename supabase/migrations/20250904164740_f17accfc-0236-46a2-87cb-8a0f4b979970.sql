-- Phase 1: Create sticky required fields system and fix lead source relationships

-- Create table to define standard field types for sticky fields
CREATE TABLE IF NOT EXISTS public.form_section_field_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'longtext', 'select', 'number', 'currency')),
  is_sticky BOOLEAN NOT NULL DEFAULT false,
  is_system_required BOOLEAN NOT NULL DEFAULT false,
  section_type TEXT NOT NULL CHECK (section_type IN ('quotedDetails', 'soldDetails')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for form_section_field_types
ALTER TABLE public.form_section_field_types ENABLE ROW LEVEL SECURITY;

-- Create policy for form_section_field_types (readable by all authenticated users, manageable by admins)
CREATE POLICY "Anyone can view field types" ON public.form_section_field_types
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage field types" ON public.form_section_field_types
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add lead_source_id to sold_policy_details for proper relationship
ALTER TABLE public.sold_policy_details 
ADD COLUMN IF NOT EXISTS lead_source_id UUID REFERENCES public.lead_sources(id);

-- Insert sticky field definitions for Quoted Household Details
INSERT INTO public.form_section_field_types (field_key, field_label, field_type, is_sticky, is_system_required, section_type, order_index)
VALUES 
  ('prospect_name', 'Prospect Name', 'text', true, true, 'quotedDetails', 1),
  ('lead_source', 'Lead Source', 'select', true, true, 'quotedDetails', 2),
  ('detailed_notes', 'Detailed Notes', 'longtext', true, true, 'quotedDetails', 3)
ON CONFLICT (field_key) DO UPDATE SET
  field_label = EXCLUDED.field_label,
  field_type = EXCLUDED.field_type,
  is_sticky = EXCLUDED.is_sticky,
  is_system_required = EXCLUDED.is_system_required,
  section_type = EXCLUDED.section_type,
  order_index = EXCLUDED.order_index,
  updated_at = now();

-- Insert sticky field definitions for Sold Household Details (renamed from Sold Policy Details)
INSERT INTO public.form_section_field_types (field_key, field_label, field_type, is_sticky, is_system_required, section_type, order_index)
VALUES 
  ('customer_name', 'Customer Name', 'text', true, true, 'soldDetails', 1),
  ('policy_type', 'Policy Type', 'select', true, true, 'soldDetails', 2),
  ('num_items', '# of Items', 'number', true, true, 'soldDetails', 3),
  ('premium_sold', 'Premium Sold', 'currency', true, true, 'soldDetails', 4),
  ('lead_source', 'Lead Source', 'select', true, true, 'soldDetails', 5),
  ('zip_code', 'Zip Code', 'text', true, true, 'soldDetails', 6)
ON CONFLICT (field_key) DO UPDATE SET
  field_label = EXCLUDED.field_label,
  field_type = EXCLUDED.field_type,
  is_sticky = EXCLUDED.is_sticky,
  is_system_required = EXCLUDED.is_system_required,
  section_type = EXCLUDED.section_type,
  order_index = EXCLUDED.order_index,
  updated_at = now();

-- Create function to get sticky fields for a section type
CREATE OR REPLACE FUNCTION public.get_sticky_fields_for_section(p_section_type TEXT)
RETURNS TABLE(
  field_key TEXT,
  field_label TEXT,
  field_type TEXT,
  is_system_required BOOLEAN,
  order_index INTEGER
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 
    fft.field_key,
    fft.field_label,
    fft.field_type,
    fft.is_system_required,
    fft.order_index
  FROM form_section_field_types fft
  WHERE fft.section_type = p_section_type 
    AND fft.is_sticky = true
  ORDER BY fft.order_index ASC;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_form_section_field_types_section_sticky 
  ON public.form_section_field_types(section_type, is_sticky);

CREATE INDEX IF NOT EXISTS idx_form_section_field_types_order 
  ON public.form_section_field_types(section_type, order_index);

-- Add index on lead_sources for better dropdown performance
CREATE INDEX IF NOT EXISTS idx_lead_sources_agency_active_order 
  ON public.lead_sources(agency_id, is_active, order_index) 
  WHERE is_active = true;