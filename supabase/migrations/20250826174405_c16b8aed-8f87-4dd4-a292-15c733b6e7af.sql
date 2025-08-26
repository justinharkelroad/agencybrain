-- Enable pg_trgm extension for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AgencyBrain Scorecard Forms Schema

-- Update agencies table with scorecard-specific fields
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS slug text UNIQUE,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS email_from text DEFAULT 'notify@myagencybrain.com',
ADD COLUMN IF NOT EXISTS reminder_times_json jsonb DEFAULT '[{"time": "16:45", "type": "same_day"}, {"time": "07:00", "type": "next_day"}]',
ADD COLUMN IF NOT EXISTS owner_rollup_time text DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS cc_owner_on_reminders boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS suppress_if_final_exists boolean DEFAULT true;

-- Update team_members table with scorecard fields
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS schedule_json jsonb DEFAULT '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}';

-- Create dictionaries table
CREATE TABLE IF NOT EXISTS public.dictionaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create dictionary_options table
CREATE TABLE IF NOT EXISTS public.dictionary_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dictionary_id uuid NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  order_index integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create form_templates table
CREATE TABLE IF NOT EXISTS public.form_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  role app_member_role NOT NULL,
  settings_json jsonb DEFAULT '{}',
  schema_json jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agency_id, slug)
);

-- Create form_links table
CREATE TABLE IF NOT EXISTS public.form_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_template_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone
);

-- Create submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_template_id uuid NOT NULL,
  team_member_id uuid NOT NULL,
  submission_date date NOT NULL,
  work_date date NOT NULL,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  payload_json jsonb NOT NULL DEFAULT '{}',
  supersedes_id uuid,
  superseded_at timestamp with time zone,
  late boolean DEFAULT false,
  final boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create metrics_daily table
CREATE TABLE IF NOT EXISTS public.metrics_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  team_member_id uuid NOT NULL,
  date date NOT NULL,
  outbound_calls integer DEFAULT 0,
  talk_minutes integer DEFAULT 0,
  quoted_count integer DEFAULT 0,
  quoted_entity text DEFAULT 'Households',
  sold_items integer DEFAULT 0,
  sold_policies integer DEFAULT 0,
  sold_premium_cents bigint DEFAULT 0,
  cross_sells_uncovered integer DEFAULT 0,
  mini_reviews integer DEFAULT 0,
  final_submission_id uuid,
  pass boolean DEFAULT false,
  daily_score integer DEFAULT 0,
  streak_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agency_id, team_member_id, date)
);

-- Create targets table
CREATE TABLE IF NOT EXISTS public.targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  team_member_id uuid,
  metric_key text NOT NULL,
  value_number integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create scorecard_rules table
CREATE TABLE IF NOT EXISTS public.scorecard_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  role app_member_role NOT NULL,
  selected_metrics text[] DEFAULT '{}',
  n_required integer DEFAULT 2,
  weights jsonb DEFAULT '{}',
  backfill_days integer DEFAULT 7,
  counted_days jsonb DEFAULT '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}',
  count_weekend_if_submitted boolean DEFAULT true,
  recalc_past_on_change boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agency_id, role)
);

-- Create excusals table
CREATE TABLE IF NOT EXISTS public.excusals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  team_member_id uuid NOT NULL,
  date date NOT NULL,
  mode text NOT NULL CHECK (mode IN ('skip_day', 'count_as_pass')),
  note text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create quoted_households table
CREATE TABLE IF NOT EXISTS public.quoted_households (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL,
  submission_id uuid NOT NULL,
  team_member_id uuid NOT NULL,
  work_date date NOT NULL,
  household_name text NOT NULL,
  lead_source_id uuid,
  zip text,
  extras jsonb DEFAULT '{}',
  is_final boolean DEFAULT true,
  is_late boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.dictionary_options ADD CONSTRAINT fk_dictionary_options_dictionary_id FOREIGN KEY (dictionary_id) REFERENCES public.dictionaries(id) ON DELETE CASCADE;
ALTER TABLE public.form_links ADD CONSTRAINT fk_form_links_form_template_id FOREIGN KEY (form_template_id) REFERENCES public.form_templates(id) ON DELETE CASCADE;
ALTER TABLE public.submissions ADD CONSTRAINT fk_submissions_form_template_id FOREIGN KEY (form_template_id) REFERENCES public.form_templates(id) ON DELETE CASCADE;
ALTER TABLE public.submissions ADD CONSTRAINT fk_submissions_team_member_id FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;
ALTER TABLE public.submissions ADD CONSTRAINT fk_submissions_supersedes_id FOREIGN KEY (supersedes_id) REFERENCES public.submissions(id);
ALTER TABLE public.metrics_daily ADD CONSTRAINT fk_metrics_daily_team_member_id FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;
ALTER TABLE public.metrics_daily ADD CONSTRAINT fk_metrics_daily_final_submission_id FOREIGN KEY (final_submission_id) REFERENCES public.submissions(id);
ALTER TABLE public.targets ADD CONSTRAINT fk_targets_team_member_id FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;
ALTER TABLE public.quoted_households ADD CONSTRAINT fk_quoted_households_submission_id FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;
ALTER TABLE public.quoted_households ADD CONSTRAINT fk_quoted_households_team_member_id FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_quoted_households_agency_work_date ON public.quoted_households(agency_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_quoted_households_team_member ON public.quoted_households(team_member_id);
CREATE INDEX IF NOT EXISTS idx_quoted_households_extras ON public.quoted_households USING gin(extras jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_quoted_households_household_name ON public.quoted_households USING gin(household_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_submissions_work_date ON public.submissions(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_team_member_date ON public.submissions(team_member_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_agency_date ON public.metrics_daily(agency_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_form_templates_agency_role ON public.form_templates(agency_id, role);

-- Enable RLS on all tables
ALTER TABLE public.dictionaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictionary_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excusals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quoted_households ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dictionaries
CREATE POLICY "Users can manage their agency dictionaries" ON public.dictionaries
FOR ALL USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- RLS Policies for dictionary_options
CREATE POLICY "Users can manage their agency dictionary options" ON public.dictionary_options
FOR ALL USING (EXISTS (
  SELECT 1 FROM public.dictionaries d 
  WHERE d.id = dictionary_options.dictionary_id 
  AND has_agency_access(auth.uid(), d.agency_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.dictionaries d 
  WHERE d.id = dictionary_options.dictionary_id 
  AND has_agency_access(auth.uid(), d.agency_id)
));

-- RLS Policies for form_templates
CREATE POLICY "Users can manage their agency form templates" ON public.form_templates
FOR ALL USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- RLS Policies for form_links
CREATE POLICY "Users can manage their agency form links" ON public.form_links
FOR ALL USING (EXISTS (
  SELECT 1 FROM public.form_templates ft 
  WHERE ft.id = form_links.form_template_id 
  AND has_agency_access(auth.uid(), ft.agency_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.form_templates ft 
  WHERE ft.id = form_links.form_template_id 
  AND has_agency_access(auth.uid(), ft.agency_id)
));

-- RLS Policies for submissions (public insert via token, agency read)
CREATE POLICY "Agency users can view their submissions" ON public.submissions
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.form_templates ft 
  WHERE ft.id = submissions.form_template_id 
  AND has_agency_access(auth.uid(), ft.agency_id)
));

CREATE POLICY "Public can insert submissions via valid token" ON public.submissions
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM public.form_links fl
  JOIN public.form_templates ft ON ft.id = fl.form_template_id
  WHERE fl.form_template_id = submissions.form_template_id
  AND fl.enabled = true
  AND (fl.expires_at IS NULL OR fl.expires_at > now())
));

-- RLS Policies for metrics_daily
CREATE POLICY "Users can manage their agency metrics" ON public.metrics_daily
FOR ALL USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- RLS Policies for targets
CREATE POLICY "Users can manage their agency targets" ON public.targets
FOR ALL USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- RLS Policies for scorecard_rules
CREATE POLICY "Users can manage their agency scorecard rules" ON public.scorecard_rules
FOR ALL USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- RLS Policies for excusals
CREATE POLICY "Users can manage their agency excusals" ON public.excusals
FOR ALL USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- RLS Policies for quoted_households
CREATE POLICY "Users can manage their agency quoted households" ON public.quoted_households
FOR ALL USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Add updated_at triggers
CREATE TRIGGER update_dictionaries_updated_at BEFORE UPDATE ON public.dictionaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_form_templates_updated_at BEFORE UPDATE ON public.form_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_metrics_daily_updated_at BEFORE UPDATE ON public.metrics_daily FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_targets_updated_at BEFORE UPDATE ON public.targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scorecard_rules_updated_at BEFORE UPDATE ON public.scorecard_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();