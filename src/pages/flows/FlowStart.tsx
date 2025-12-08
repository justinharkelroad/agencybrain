import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export default function FlowStart() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (slug && user?.id) {
      startSession();
    }
  }, [slug, user?.id]);

  const startSession = async () => {
    try {
      const { data: template, error: templateError } = await supabase
        .from('flow_templates')
        .select('id')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (templateError || !template) {
        navigate('/flows');
        return;
      }

      const { data: existingSession } = await supabase
        .from('flow_sessions')
        .select('id')
        .eq('user_id', user!.id)
        .eq('flow_template_id', template.id)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingSession) {
        navigate(`/flows/session/${slug}`, { replace: true });
      } else {
        const { error: sessionError } = await supabase
          .from('flow_sessions')
          .insert({
            user_id: user!.id,
            flow_template_id: template.id,
            status: 'in_progress',
            responses_json: {},
          })
          .select()
          .single();

        if (sessionError) {
          console.error('Error creating session:', sessionError);
          navigate('/flows');
          return;
        }

        navigate(`/flows/session/${slug}`, { replace: true });
      }
    } catch (err) {
      console.error('Error starting flow:', err);
      navigate('/flows');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Starting your stack...</p>
      </div>
    </div>
  );
}
