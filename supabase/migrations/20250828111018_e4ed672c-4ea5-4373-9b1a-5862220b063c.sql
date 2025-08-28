-- Fix live site: Allow anonymous users to read active prompts
CREATE POLICY "Anonymous users can view active prompts" 
ON public.prompts 
FOR SELECT 
USING (
  is_active = true
);