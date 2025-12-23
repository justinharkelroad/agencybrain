import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { useFlowProfile } from '@/hooks/useFlowProfile';
import { useFlowStats } from '@/hooks/useFlowStats';
import { useCore4Stats } from '@/hooks/useCore4Stats';
import { FlowTemplate, FlowSession } from '@/types/flows';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, User, ChevronRight, Clock, CheckCircle2, Flame, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { FlowStatsCard } from '@/components/flows/FlowStatsCard';
import { HelpVideoButton } from '@/components/HelpVideoButton';

export default function Flows() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading: profileLoading, hasProfile } = useFlowProfile();
  const flowStats = useFlowStats();
  const core4Stats = useCore4Stats();
  
  const [templates, setTemplates] = useState<FlowTemplate[]>([]);
  const [recentSessions, setRecentSessions] = useState<FlowSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Combined weekly score: Core 4 (max 28) + Flow (max 7) = 35
  const combinedWeeklyScore = core4Stats.weeklyPoints + flowStats.weeklyProgress;
  const combinedWeeklyGoal = 35;
  const combinedPercentage = combinedWeeklyGoal > 0 ? Math.round((combinedWeeklyScore / combinedWeeklyGoal) * 100) : 0;
  const combinedTotalPoints = flowStats.totalFlows + core4Stats.totalPoints;

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch active templates
      const { data: templatesData } = await supabase
        .from('flow_templates')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      setTemplates((templatesData || []) as FlowTemplate[]);

      // Fetch recent sessions for this user
      if (user?.id) {
        const { data: sessionsData } = await supabase
          .from('flow_sessions')
          .select('*, flow_template:flow_templates(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentSessions((sessionsData || []) as FlowSession[]);
      }
    } catch (err) {
      console.error('Error fetching flows data:', err);
    } finally {
      setLoading(false);
    }
  };

  const startFlow = (template: FlowTemplate) => {
    if (!hasProfile) {
      // Redirect to profile setup first
      navigate('/flows/profile', { state: { redirectTo: `/flows/start/${template.slug}` } });
    } else {
      navigate(`/flows/start/${template.slug}`);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium flex items-center gap-2">
            <Sparkles className="h-6 w-6" strokeWidth={1.5} />
            Flows
            <HelpVideoButton videoKey="flows-overview" />
          </h1>
          <p className="text-muted-foreground/70 mt-1">
            Guided reflection for growth
          </p>
        </div>
        
        <Button
          variant="flat"
          onClick={() => navigate('/flows/profile')}
          className="flex items-center gap-2"
        >
          <User className="h-4 w-4" strokeWidth={1.5} />
          {hasProfile ? 'Edit Your AI Experience' : 'Setup Profile'}
        </Button>
      </div>

      {/* Profile Setup Prompt (if no profile) */}
      {!hasProfile && (
        <Card className="mb-8 border-primary/30 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-lg">Required for Flow Usage</h3>
                <p className="text-muted-foreground/70 text-sm mt-1">
                  Share as much information as possible to enhance your AI-powered flow experience.
                </p>
              </div>
              <Button onClick={() => navigate('/flows/profile')}>
                Get Started
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Combined Score Cards - Same as Core4 page */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* THE SCORE */}
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">THE SCORE</p>
            <div className="relative w-32 h-32 mx-auto mb-3">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${combinedPercentage * 2.83} 283`}
                  className="text-primary transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{combinedWeeklyScore}</span>
                <span className="text-xs text-muted-foreground">/ {combinedWeeklyGoal}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Core 4: {core4Stats.weeklyPoints}/28</p>
              <p>Flow: {flowStats.weeklyProgress}/7</p>
            </div>
          </CardContent>
        </Card>

        {/* THE STREAKS */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-4 text-center">THE STREAKS</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Zap className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                <p className="text-xl font-bold">{flowStats.currentStreak}</p>
                <p className="text-xs text-muted-foreground">Flow</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                <p className="text-xl font-bold">{core4Stats.currentStreak}</p>
                <p className="text-xs text-muted-foreground">Core 4</p>
              </div>
            </div>
            <div className="mt-4 text-center text-xs text-muted-foreground">
              <p>Longest: Flow {flowStats.longestStreak} | Core {core4Stats.longestStreak}</p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Gamification Stats - Flow only */}
      <FlowStatsCard />

      {/* Flow Templates Grid */}
      <div className="mb-10">
        <h2 className="text-lg font-medium mb-4">Choose Your Flow</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map(template => (
            <Card
              key={template.id}
              className="cursor-pointer hover:border-border/30 hover:bg-accent/5 transition-all group"
              onClick={() => startFlow(template)}
            >
              <CardContent className="p-6">
                <div className="text-4xl mb-3">{template.icon || '📝'}</div>
                <h3 className="font-medium text-lg group-hover:text-primary transition-colors">
                  {template.name}
                </h3>
                {template.description && (
                  <p className="text-sm text-muted-foreground/70 mt-2 line-clamp-2">
                    {template.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          
        </div>
      </div>

      {/* Recent Stacks / Library */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">📚 Your Flow Library</h2>
          {recentSessions.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => navigate('/flows/library')}
              className="text-muted-foreground"
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>

        {recentSessions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" strokeWidth={1} />
              <h3 className="font-medium mb-2">No flows yet</h3>
              <p className="text-sm text-muted-foreground/70">
                Start your first Flow to begin building your library.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentSessions.map(session => (
              <Card
                key={session.id}
                className="cursor-pointer hover:bg-accent/5 transition-colors"
                onClick={() => navigate(`/flows/view/${session.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">
                      {session.flow_template?.icon || '📝'}
                    </span>
                    <div>
                      <h4 className="font-medium">
                        {session.title || 'Untitled Flow'}
                      </h4>
                      <p className="text-sm text-muted-foreground/70">
                        {session.flow_template?.name} • {format(new Date(session.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-500" />
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
