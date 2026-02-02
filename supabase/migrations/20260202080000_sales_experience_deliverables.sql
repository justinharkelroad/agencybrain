-- =====================================================
-- Sales Experience Deliverables
-- Migration: Tables for deliverables, AI builder sessions, and prompts
-- =====================================================

-- =====================================================
-- 1. TABLES
-- =====================================================

-- 1.1 Sales Experience Deliverables - One row per deliverable type per assignment
CREATE TABLE IF NOT EXISTS public.sales_experience_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.sales_experience_assignments(id) ON DELETE CASCADE,
  deliverable_type text NOT NULL CHECK (deliverable_type IN ('sales_process', 'accountability_metrics', 'consequence_ladder')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'complete')),
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, deliverable_type)
);

CREATE INDEX IF NOT EXISTS idx_se_deliverables_assignment ON public.sales_experience_deliverables(assignment_id);
CREATE INDEX IF NOT EXISTS idx_se_deliverables_type ON public.sales_experience_deliverables(deliverable_type);
CREATE INDEX IF NOT EXISTS idx_se_deliverables_status ON public.sales_experience_deliverables(status);

-- 1.2 Sales Experience Deliverable Sessions - AI Builder conversation sessions
CREATE TABLE IF NOT EXISTS public.sales_experience_deliverable_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES public.sales_experience_deliverables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_content_json jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_se_deliverable_sessions_deliverable ON public.sales_experience_deliverable_sessions(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_se_deliverable_sessions_user ON public.sales_experience_deliverable_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_se_deliverable_sessions_status ON public.sales_experience_deliverable_sessions(status);

-- =====================================================
-- 2. TRIGGERS
-- =====================================================

-- 2.1 Updated_at triggers
DROP TRIGGER IF EXISTS update_se_deliverables_updated_at ON public.sales_experience_deliverables;
CREATE TRIGGER update_se_deliverables_updated_at
BEFORE UPDATE ON public.sales_experience_deliverables
FOR EACH ROW EXECUTE FUNCTION public.update_sales_experience_updated_at();

DROP TRIGGER IF EXISTS update_se_deliverable_sessions_updated_at ON public.sales_experience_deliverable_sessions;
CREATE TRIGGER update_se_deliverable_sessions_updated_at
BEFORE UPDATE ON public.sales_experience_deliverable_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_sales_experience_updated_at();

-- 2.2 Auto-create deliverables when assignment becomes active
CREATE OR REPLACE FUNCTION public.initialize_sales_experience_deliverables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only run when status changes to 'active' or on initial insert with active/pending
  IF NEW.status IN ('active', 'pending') AND (OLD IS NULL OR OLD.status NOT IN ('active', 'pending')) THEN
    -- Create the 3 deliverable types
    INSERT INTO public.sales_experience_deliverables (assignment_id, deliverable_type, status, content_json)
    VALUES
      (NEW.id, 'sales_process', 'draft', '{"rapport": [], "coverage": [], "closing": []}'::jsonb),
      (NEW.id, 'accountability_metrics', 'draft', '{"categories": []}'::jsonb),
      (NEW.id, 'consequence_ladder', 'draft', '{"steps": []}'::jsonb)
    ON CONFLICT (assignment_id, deliverable_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_initialize_se_deliverables ON public.sales_experience_assignments;
CREATE TRIGGER trigger_initialize_se_deliverables
AFTER INSERT OR UPDATE ON public.sales_experience_assignments
FOR EACH ROW
EXECUTE FUNCTION public.initialize_sales_experience_deliverables();

-- =====================================================
-- 3. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.sales_experience_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_deliverable_sessions ENABLE ROW LEVEL SECURITY;

-- Deliverables: Agency access + admin
DROP POLICY IF EXISTS "se_deliverables_select" ON public.sales_experience_deliverables;
CREATE POLICY "se_deliverables_select" ON public.sales_experience_deliverables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sales_experience_assignments sea
    WHERE sea.id = assignment_id
      AND public.has_agency_access(auth.uid(), sea.agency_id)
  ) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_deliverables_insert" ON public.sales_experience_deliverables;
CREATE POLICY "se_deliverables_insert" ON public.sales_experience_deliverables
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales_experience_assignments sea
    WHERE sea.id = assignment_id
      AND public.has_agency_access(auth.uid(), sea.agency_id)
  ) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_deliverables_update" ON public.sales_experience_deliverables;
CREATE POLICY "se_deliverables_update" ON public.sales_experience_deliverables
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.sales_experience_assignments sea
    WHERE sea.id = assignment_id
      AND public.has_agency_access(auth.uid(), sea.agency_id)
  ) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_deliverables_delete" ON public.sales_experience_deliverables;
CREATE POLICY "se_deliverables_delete" ON public.sales_experience_deliverables
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Deliverable Sessions: User owns session or admin
DROP POLICY IF EXISTS "se_deliverable_sessions_select" ON public.sales_experience_deliverable_sessions;
CREATE POLICY "se_deliverable_sessions_select" ON public.sales_experience_deliverable_sessions
FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_deliverable_sessions_insert" ON public.sales_experience_deliverable_sessions;
CREATE POLICY "se_deliverable_sessions_insert" ON public.sales_experience_deliverable_sessions
FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "se_deliverable_sessions_update" ON public.sales_experience_deliverable_sessions;
CREATE POLICY "se_deliverable_sessions_update" ON public.sales_experience_deliverable_sessions
FOR UPDATE USING (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "se_deliverable_sessions_delete" ON public.sales_experience_deliverable_sessions;
CREATE POLICY "se_deliverable_sessions_delete" ON public.sales_experience_deliverable_sessions
FOR DELETE USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- 4. SEED AI PROMPTS FOR DELIVERABLE BUILDER
-- =====================================================

INSERT INTO public.sales_experience_ai_prompts (prompt_key, prompt_name, prompt_template, model_preference, description)
VALUES
  ('deliverable_sales_process', 'Sales Process Builder',
   'You are a sales coaching expert helping an insurance agency owner build their sales process framework. Guide them through creating a structured sales process with three phases: Rapport, Coverage, and Closing.

Your goal is to help them articulate their existing sales process into clear, actionable bullet points for each phase. Be conversational and ask follow-up questions to get specific details.

CONVERSATION FLOW:
1. First, ask about their Rapport phase - how do they build trust and connect with prospects?
2. Then, explore their Coverage phase - how do they present products and handle objections?
3. Finally, discuss their Closing phase - what techniques do they use to ask for the business?

After gathering enough information for each phase, provide a summary of the bullet points you''ve captured.

When the user says they''re done or asks to generate the final content, output the structured data in this exact JSON format at the END of your response:
```json
{"rapport": ["item1", "item2", ...], "coverage": ["item1", ...], "closing": ["item1", ...]}
```

Keep responses concise and focused. Ask one or two questions at a time.',
   'claude-3-haiku',
   'Used in the AI Builder for creating Sales Process deliverable'),

  ('deliverable_accountability_metrics', 'Accountability Metrics Builder',
   'You are a sales management expert helping an insurance agency owner define their accountability metrics framework. Guide them through creating categories of metrics they want to track for their sales team.

Your goal is to help them identify meaningful categories (like Daily Activities, Weekly Goals, Quality Metrics) and the specific metrics within each category.

CONVERSATION FLOW:
1. Start by asking what areas of performance they want to track
2. For each category mentioned, ask what specific metrics matter most
3. Help them think about both activity metrics (calls, appointments) and outcome metrics (policies sold, premium)

After gathering enough information, provide a summary of the categories and metrics you''ve captured.

When the user says they''re done or asks to generate the final content, output the structured data in this exact JSON format at the END of your response:
```json
{"categories": [{"name": "Category Name", "items": ["metric1", "metric2", ...]}, ...]}
```

Keep responses concise and focused. Ask one or two questions at a time.',
   'claude-3-haiku',
   'Used in the AI Builder for creating Accountability Metrics deliverable'),

  ('deliverable_consequence_ladder', 'Consequence Ladder Builder',
   'You are an HR and management expert helping an insurance agency owner build a progressive discipline framework called a Consequence Ladder. Guide them through defining what happens at each step when performance issues arise.

Your goal is to help them create a fair, consistent progression from informal conversations to termination, ensuring they have documentation and clear expectations at each step.

CONVERSATION FLOW:
1. Ask about their philosophy on addressing performance issues
2. Walk through each level (typically 4-6 steps) asking what happens at each stage
3. Common structure: Verbal coaching → Written warning → Final warning → Termination
4. For each step, capture the title and a brief description of what happens

After gathering enough information, provide a summary of the ladder steps you''ve captured.

When the user says they''re done or asks to generate the final content, output the structured data in this exact JSON format at the END of your response:
```json
{"steps": [{"incident": 1, "title": "Step Title", "description": "What happens..."}, ...]}
```

Keep responses concise and focused. Ask one or two questions at a time.',
   'claude-3-haiku',
   'Used in the AI Builder for creating Consequence Ladder deliverable')
ON CONFLICT (prompt_key) DO UPDATE SET
  prompt_name = EXCLUDED.prompt_name,
  prompt_template = EXCLUDED.prompt_template,
  model_preference = EXCLUDED.model_preference,
  description = EXCLUDED.description,
  updated_at = now();

-- =====================================================
-- 5. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.sales_experience_deliverables IS 'The 3 deliverables (Sales Process, Accountability Metrics, Consequence Ladder) built during the 8-week program';
COMMENT ON TABLE public.sales_experience_deliverable_sessions IS 'AI Builder conversation sessions for guided deliverable creation';
COMMENT ON COLUMN public.sales_experience_deliverables.content_json IS 'Structured content: sales_process={rapport,coverage,closing}, accountability_metrics={categories}, consequence_ladder={steps}';
COMMENT ON COLUMN public.sales_experience_deliverable_sessions.messages_json IS 'Array of {role, content} message objects from the AI conversation';
COMMENT ON COLUMN public.sales_experience_deliverable_sessions.generated_content_json IS 'The final structured content extracted from the AI conversation';
