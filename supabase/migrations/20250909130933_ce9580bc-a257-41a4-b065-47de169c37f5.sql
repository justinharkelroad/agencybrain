-- Add KPI versioning tables and columns

-- Create kpi_versions table for historical KPI label tracking
CREATE TABLE public.kpi_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_id UUID NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_to TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on kpi_versions
ALTER TABLE public.kpi_versions ENABLE ROW LEVEL SECURITY;

-- Create policy for kpi_versions
CREATE POLICY "Users can manage their agency KPI versions" 
ON public.kpi_versions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.kpis k 
    WHERE k.id = kpi_versions.kpi_id 
    AND has_agency_access(auth.uid(), k.agency_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.kpis k 
    WHERE k.id = kpi_versions.kpi_id 
    AND has_agency_access(auth.uid(), k.agency_id)
  )
);

-- Create forms_kpi_bindings table to track which KPI versions forms use
CREATE TABLE public.forms_kpi_bindings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  kpi_version_id UUID NOT NULL REFERENCES public.kpi_versions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(form_template_id, kpi_version_id)
);

-- Enable RLS on forms_kpi_bindings
ALTER TABLE public.forms_kpi_bindings ENABLE ROW LEVEL SECURITY;

-- Create policy for forms_kpi_bindings
CREATE POLICY "Users can manage their agency form KPI bindings" 
ON public.forms_kpi_bindings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.form_templates ft 
    WHERE ft.id = forms_kpi_bindings.form_template_id 
    AND has_agency_access(auth.uid(), ft.agency_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.form_templates ft 
    WHERE ft.id = forms_kpi_bindings.form_template_id 
    AND has_agency_access(auth.uid(), ft.agency_id)
  )
);

-- Add versioning columns to metrics_daily
ALTER TABLE public.metrics_daily 
ADD COLUMN kpi_version_id UUID REFERENCES public.kpi_versions(id),
ADD COLUMN label_at_submit TEXT,
ADD COLUMN submitted_at TIMESTAMP WITH TIME ZONE;

-- Backfill existing KPIs with initial versions
INSERT INTO public.kpi_versions (kpi_id, label, valid_from)
SELECT 
  k.id,
  k.label,
  k.created_at
FROM public.kpis k
WHERE k.is_active = true;

-- Create index for performance
CREATE INDEX idx_kpi_versions_kpi_id ON public.kpi_versions(kpi_id);
CREATE INDEX idx_kpi_versions_valid_period ON public.kpi_versions(valid_from, valid_to);
CREATE INDEX idx_forms_kpi_bindings_form_id ON public.forms_kpi_bindings(form_template_id);
CREATE INDEX idx_metrics_daily_kpi_version ON public.metrics_daily(kpi_version_id);

-- Function to create new KPI version when label changes
CREATE OR REPLACE FUNCTION public.create_kpi_version_on_label_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create new version if label actually changed
  IF OLD.label != NEW.label THEN
    -- Close previous version
    UPDATE public.kpi_versions 
    SET valid_to = now() 
    WHERE kpi_id = NEW.id AND valid_to IS NULL;
    
    -- Create new version
    INSERT INTO public.kpi_versions (kpi_id, label, valid_from)
    VALUES (NEW.id, NEW.label, now());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic KPI versioning
CREATE TRIGGER kpi_label_change_trigger
  AFTER UPDATE ON public.kpis
  FOR EACH ROW
  WHEN (OLD.label IS DISTINCT FROM NEW.label)
  EXECUTE FUNCTION public.create_kpi_version_on_label_change();