import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Award, ThumbsUp, AlertTriangle } from "lucide-react";

export default function RoleplayStatsCards() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: sessions } = useQuery({
    queryKey: ['roleplay-sessions-stats', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) throw new Error('No agency ID');

      const { data, error } = await supabase
        .from('roleplay_sessions')
        .select('overall_score')
        .eq('agency_id', profile.agency_id);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.agency_id
  });

  const stats = {
    total: sessions?.length || 0,
    excellent: sessions?.filter(s => s.overall_score === 'Excellent').length || 0,
    good: sessions?.filter(s => s.overall_score === 'Good').length || 0,
    needsImprovement: sessions?.filter(s => s.overall_score === 'Needs Improvement').length || 0,
  };

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Excellent</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.excellent}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Good</CardTitle>
          <ThumbsUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{stats.good}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Needs Work</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{stats.needsImprovement}</div>
        </CardContent>
      </Card>
    </div>
  );
}
