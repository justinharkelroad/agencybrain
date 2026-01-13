import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Phone, PhoneOff, MessageSquare, Mail, FileText, Trophy,
  TrendingUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ActivityStats {
  called: number;
  left_vm: number;
  texted: number;
  emailed: number;
  quoted: number;
  total: number;
}

interface WinbackActivityStatsProps {
  agencyId: string | null;
  wonBackCount: number;
}

export function WinbackActivityStats({ agencyId, wonBackCount }: WinbackActivityStatsProps) {
  const [stats, setStats] = useState<ActivityStats>({
    called: 0,
    left_vm: 0,
    texted: 0,
    emailed: 0,
    quoted: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agencyId) return;
    
    fetchStats();
    
    // Subscribe to real-time updates with unique channel name
    const channelName = `winback-activities-stats-${agencyId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'winback_activities',
        },
        (payload) => {
          // Only refetch if this activity belongs to our agency
          if (payload.new && (payload.new as any).agency_id === agencyId) {
            fetchStats();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyId]);

  const fetchStats = async () => {
    if (!agencyId) return;
    
    try {
      // Get activity counts by type (excluding notes and status_change)
      const { data, error } = await supabase
        .from('winback_activities')
        .select('activity_type')
        .eq('agency_id', agencyId)
        .in('activity_type', ['called', 'left_vm', 'texted', 'emailed', 'quoted']);

      if (error) throw error;

      const counts: ActivityStats = {
        called: 0,
        left_vm: 0,
        texted: 0,
        emailed: 0,
        quoted: 0,
        total: 0,
      };

      data?.forEach((row) => {
        const type = row.activity_type as keyof Omit<ActivityStats, 'total'>;
        if (type in counts) {
          counts[type]++;
          counts.total++;
        }
      });

      setStats(counts);
    } catch (err) {
      console.error('Error fetching activity stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const statItems = [
    { key: 'called', label: 'Calls', icon: Phone, color: 'text-green-400', value: stats.called },
    { key: 'left_vm', label: 'VMs', icon: PhoneOff, color: 'text-yellow-400', value: stats.left_vm },
    { key: 'texted', label: 'Texts', icon: MessageSquare, color: 'text-cyan-400', value: stats.texted },
    { key: 'emailed', label: 'Emails', icon: Mail, color: 'text-blue-400', value: stats.emailed },
    { key: 'quoted', label: 'Quotes', icon: FileText, color: 'text-purple-400', value: stats.quoted },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
      {/* Won Back Counter - Highlighted */}
      <Card className="bg-green-500/10 border-green-500/30">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-lg font-bold text-green-400">{wonBackCount}</p>
              <p className="text-xs text-muted-foreground">Won Back</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Stats */}
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${item.color}`} />
                <div>
                  <p className="text-lg font-bold">{loading ? '-' : item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Total Activities */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div>
              <p className="text-lg font-bold">{loading ? '-' : stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
