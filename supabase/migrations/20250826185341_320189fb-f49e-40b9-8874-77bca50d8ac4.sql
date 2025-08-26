-- Create lead sources table for agency-wide lead source configuration
CREATE TABLE public.lead_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on lead_sources
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

-- Create policies for lead_sources
CREATE POLICY "Users can manage their agency lead sources" 
ON public.lead_sources 
FOR ALL 
USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Create quoted_household_details table for detailed quoted household tracking
CREATE TABLE public.quoted_household_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL,
  household_name TEXT NOT NULL,
  zip_code TEXT,
  lead_source_id UUID,
  policy_type TEXT,
  extras JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on quoted_household_details
ALTER TABLE public.quoted_household_details ENABLE ROW LEVEL SECURITY;

-- Create policy for quoted_household_details (access through submissions)
CREATE POLICY "Users can manage quoted details via submissions" 
ON public.quoted_household_details 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id  
    WHERE s.id = quoted_household_details.submission_id 
    AND has_agency_access(auth.uid(), ft.agency_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.id = quoted_household_details.submission_id 
    AND has_agency_access(auth.uid(), ft.agency_id)
  )
);

-- Create sold_policy_details table for detailed sold policy tracking  
CREATE TABLE public.sold_policy_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL,
  policy_holder_name TEXT NOT NULL,
  policy_type TEXT NOT NULL,
  premium_amount_cents BIGINT NOT NULL DEFAULT 0,
  commission_amount_cents BIGINT DEFAULT 0,
  quoted_household_detail_id UUID, -- Link to quoted household if applicable
  extras JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sold_policy_details
ALTER TABLE public.sold_policy_details ENABLE ROW LEVEL SECURITY;

-- Create policy for sold_policy_details (access through submissions)
CREATE POLICY "Users can manage sold details via submissions" 
ON public.sold_policy_details 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.id = sold_policy_details.submission_id 
    AND has_agency_access(auth.uid(), ft.agency_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.id = sold_policy_details.submission_id 
    AND has_agency_access(auth.uid(), ft.agency_id)
  )
);

-- Create trigger for updating timestamps
CREATE TRIGGER update_lead_sources_updated_at
  BEFORE UPDATE ON public.lead_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();