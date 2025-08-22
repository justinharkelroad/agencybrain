-- Create bonus_grid_saves table for persistent storage
CREATE TABLE public.bonus_grid_saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  grid_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bonus_grid_saves ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own grid saves" 
ON public.bonus_grid_saves 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own grid saves" 
ON public.bonus_grid_saves 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own grid saves" 
ON public.bonus_grid_saves 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own grid saves" 
ON public.bonus_grid_saves 
FOR DELETE 
USING (auth.uid() = user_id);

-- Admins can view all grid saves
CREATE POLICY "Admins can view all grid saves" 
ON public.bonus_grid_saves 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bonus_grid_saves_updated_at
BEFORE UPDATE ON public.bonus_grid_saves
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();