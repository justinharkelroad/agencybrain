-- Fix Sales Experience RLS policies to use user_roles table instead of profiles.role
-- The app uses user_roles table to determine admin status

-- Fix assignment policies
DROP POLICY IF EXISTS "se_assignments_insert" ON public.sales_experience_assignments;
CREATE POLICY "se_assignments_insert" ON public.sales_experience_assignments
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_assignments_update" ON public.sales_experience_assignments;
CREATE POLICY "se_assignments_update" ON public.sales_experience_assignments
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_assignments_delete" ON public.sales_experience_assignments;
CREATE POLICY "se_assignments_delete" ON public.sales_experience_assignments
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Also fix the select policy to use user_roles
DROP POLICY IF EXISTS "se_assignments_select" ON public.sales_experience_assignments;
CREATE POLICY "se_assignments_select" ON public.sales_experience_assignments
FOR SELECT USING (
  public.has_agency_access(auth.uid(), agency_id) OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Fix modules admin policy
DROP POLICY IF EXISTS "se_modules_admin" ON public.sales_experience_modules;
CREATE POLICY "se_modules_admin" ON public.sales_experience_modules
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Fix lessons admin policy
DROP POLICY IF EXISTS "se_lessons_admin" ON public.sales_experience_lessons;
CREATE POLICY "se_lessons_admin" ON public.sales_experience_lessons
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Fix resources admin policy
DROP POLICY IF EXISTS "se_resources_admin" ON public.sales_experience_resources;
CREATE POLICY "se_resources_admin" ON public.sales_experience_resources
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Fix transcripts insert policy
DROP POLICY IF EXISTS "se_transcripts_insert" ON public.sales_experience_transcripts;
CREATE POLICY "se_transcripts_insert" ON public.sales_experience_transcripts
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_transcripts_update" ON public.sales_experience_transcripts;
CREATE POLICY "se_transcripts_update" ON public.sales_experience_transcripts
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Fix AI prompts admin policy
DROP POLICY IF EXISTS "se_ai_prompts_all" ON public.sales_experience_ai_prompts;
CREATE POLICY "se_ai_prompts_all" ON public.sales_experience_ai_prompts
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Fix email templates admin policy
DROP POLICY IF EXISTS "se_email_templates_all" ON public.sales_experience_email_templates;
CREATE POLICY "se_email_templates_all" ON public.sales_experience_email_templates
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
