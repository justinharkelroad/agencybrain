-- Create prompts table for AI analysis prompts
CREATE TABLE public.prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create ai_analysis table for storing AI analysis results
CREATE TABLE public.ai_analysis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE SET NULL,
  analysis_type text NOT NULL,
  prompt_used text NOT NULL,
  analysis_result text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;

-- RLS policies for prompts table
CREATE POLICY "Anyone can view active prompts" ON public.prompts
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage all prompts" ON public.prompts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- RLS policies for ai_analysis table  
CREATE POLICY "Users can view their own analyses" ON public.ai_analysis
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.periods 
    WHERE periods.id = ai_analysis.period_id 
    AND periods.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all analyses" ON public.ai_analysis
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can manage all analyses" ON public.ai_analysis
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Create triggers for updated_at columns
CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON public.prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_analysis_updated_at
  BEFORE UPDATE ON public.ai_analysis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default prompts
INSERT INTO public.prompts (category, title, content) VALUES
('sales', 'Sales Performance Analysis', 'Analyze the sales performance data focusing on trends, conversion rates, and opportunities for improvement. Consider premium volume, policy count, and items sold.'),
('marketing', 'Marketing ROI Analysis', 'Evaluate marketing spend effectiveness, lead generation quality, and conversion optimization opportunities. Focus on cost per acquisition and lead source performance.'),
('operations', 'Operational Efficiency Review', 'Review team performance, resource allocation, and operational metrics. Analyze ALR trends, bonus projections, and team roster effectiveness.'),
('retention', 'Client Retention Analysis', 'Assess retention rates, termination patterns, and strategies to improve client loyalty. Focus on identifying at-risk segments and improvement opportunities.'),
('financial', 'Financial Health Assessment', 'Analyze cash flow, profitability, and financial sustainability. Review expense management and revenue optimization opportunities.');