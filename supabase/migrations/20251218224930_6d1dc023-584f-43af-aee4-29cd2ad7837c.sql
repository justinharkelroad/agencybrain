-- Custom Detail Collections: Allows agencies to create their own repeater sections
CREATE TABLE public.custom_detail_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- "Referrals Received"
  description TEXT,                      -- Optional description
  controlling_kpi_key TEXT,              -- Which KPI key controls entry count
  is_enabled BOOLEAN DEFAULT true,       -- Toggle on/off
  field_order INTEGER DEFAULT 0,         -- Order in the form
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Custom Detail Fields: Fields within a custom collection
CREATE TABLE public.custom_detail_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES custom_detail_collections(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                   -- "Referrer Name"
  field_key TEXT NOT NULL,               -- Auto-generated: "referrer_name" or "field_123456"
  field_type TEXT NOT NULL,              -- "short_text", "long_text", "number", "currency", "dropdown", "date", "checkbox", "email", "phone"
  is_required BOOLEAN DEFAULT false,
  options JSONB,                         -- For dropdowns: ["Option 1", "Option 2"]
  field_order INTEGER DEFAULT 0,         -- Order within collection
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(collection_id, field_key)
);

-- Custom Detail Entries: Stores submitted entries for custom collections
CREATE TABLE public.custom_detail_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES custom_detail_collections(id),
  team_member_id UUID NOT NULL REFERENCES team_members(id),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  work_date DATE NOT NULL,
  entry_index INTEGER NOT NULL,          -- 0, 1, 2... for multiple entries
  field_values JSONB NOT NULL,           -- {"referrer_name": "John", "referral_type": "Friend", ...}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_custom_detail_collections_form ON custom_detail_collections(form_template_id);
CREATE INDEX idx_custom_detail_collections_agency ON custom_detail_collections(agency_id);
CREATE INDEX idx_custom_detail_fields_collection ON custom_detail_fields(collection_id);
CREATE INDEX idx_custom_detail_entries_submission ON custom_detail_entries(submission_id);
CREATE INDEX idx_custom_detail_entries_collection ON custom_detail_entries(collection_id);
CREATE INDEX idx_custom_detail_entries_agency_date ON custom_detail_entries(agency_id, work_date);

-- Enable RLS
ALTER TABLE public.custom_detail_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_detail_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_detail_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_detail_collections
CREATE POLICY "Users can manage their agency custom collections"
ON public.custom_detail_collections
FOR ALL
USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Public can view enabled collections via form template"
ON public.custom_detail_collections
FOR SELECT
USING (
  is_enabled = true AND
  EXISTS (
    SELECT 1 FROM form_templates ft
    WHERE ft.id = custom_detail_collections.form_template_id
    AND ft.is_active = true
  )
);

-- RLS Policies for custom_detail_fields
CREATE POLICY "Users can manage fields for their agency collections"
ON public.custom_detail_fields
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM custom_detail_collections cdc
    WHERE cdc.id = custom_detail_fields.collection_id
    AND has_agency_access(auth.uid(), cdc.agency_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM custom_detail_collections cdc
    WHERE cdc.id = custom_detail_fields.collection_id
    AND has_agency_access(auth.uid(), cdc.agency_id)
  )
);

CREATE POLICY "Public can view fields for enabled collections"
ON public.custom_detail_fields
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM custom_detail_collections cdc
    JOIN form_templates ft ON ft.id = cdc.form_template_id
    WHERE cdc.id = custom_detail_fields.collection_id
    AND cdc.is_enabled = true
    AND ft.is_active = true
  )
);

-- RLS Policies for custom_detail_entries
CREATE POLICY "Users can manage entries for their agency"
ON public.custom_detail_entries
FOR ALL
USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Public can insert entries via valid submission"
ON public.custom_detail_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM submissions s
    WHERE s.id = custom_detail_entries.submission_id
  )
);

-- Trigger for updated_at on collections
CREATE TRIGGER update_custom_detail_collections_updated_at
BEFORE UPDATE ON public.custom_detail_collections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on fields
CREATE TRIGGER update_custom_detail_fields_updated_at
BEFORE UPDATE ON public.custom_detail_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on entries
CREATE TRIGGER update_custom_detail_entries_updated_at
BEFORE UPDATE ON public.custom_detail_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();