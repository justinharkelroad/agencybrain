import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dumbbell, Brain, Heart, Briefcase, Plus, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Core4Domain = 'body' | 'being' | 'balance' | 'business';

interface MissionItem {
  text: string;
  completed: boolean;
}

interface StaffCore4Mission {
  id: string;
  staff_user_id: string;
  domain: Core4Domain;
  title: string;
  items: MissionItem[];
  weekly_measurable: string | null;
  status: 'active' | 'completed' | 'archived';
  month_year: string;
}

const domainConfig: Record<Core4Domain, { label: string; icon: typeof Dumbbell; color: string }> = {
  body: { label: 'Body', icon: Dumbbell, color: 'text-green-500' },
  being: { label: 'Being', icon: Brain, color: 'text-purple-500' },
  balance: { label: 'Balance', icon: Heart, color: 'text-pink-500' },
  business: { label: 'Business', icon: Briefcase, color: 'text-blue-500' },
};

export function StaffCore4MonthlyMissions() {
  const { user, sessionToken } = useStaffAuth();
  const [missions, setMissions] = useState<StaffCore4Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMission, setNewMission] = useState({
    domain: 'body' as Core4Domain,
    title: '',
    items: ['', '', '', ''],
    weekly_measurable: '',
  });

  const currentMonthYear = format(new Date(), 'yyyy-MM');

  const fetchMissions = useCallback(async () => {
    if (!user?.id || !sessionToken) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get_staff_core4_entries', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: { action: 'fetch_missions', month_year: currentMonthYear },
      });

      if (error) throw error;
      setMissions(data?.missions || []);
    } catch (err) {
      console.error('Error fetching missions:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, sessionToken, currentMonthYear]);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  const getMissionForDomain = (domain: Core4Domain): StaffCore4Mission | null => {
    return missions.find(m => m.domain === domain) || null;
  };

  const handleCreateMission = async () => {
    if (!user?.id || !sessionToken || !newMission.title.trim()) {
      toast.error('Please enter a mission title');
      return;
    }

    if (getMissionForDomain(newMission.domain)) {
      toast.error(`A mission already exists for ${domainConfig[newMission.domain].label}`);
      return;
    }

    try {
      const items: MissionItem[] = newMission.items
        .filter(item => item.trim())
        .map(text => ({ text, completed: false }));

      const { error } = await supabase.functions.invoke('get_staff_core4_entries', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          action: 'create_mission',
          domain: newMission.domain,
          title: newMission.title.trim(),
          items,
          weekly_measurable: newMission.weekly_measurable.trim() || null,
          month_year: currentMonthYear,
        },
      });

      if (error) throw error;

      toast.success('Mission created!');
      setDialogOpen(false);
      setNewMission({
        domain: 'body',
        title: '',
        items: ['', '', '', ''],
        weekly_measurable: '',
      });
      fetchMissions();
    } catch (err) {
      console.error('Error creating mission:', err);
      toast.error('Failed to create mission');
    }
  };

  const toggleMissionItem = async (missionId: string, itemIndex: number) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission || !sessionToken) return;

    const updatedItems = [...mission.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      completed: !updatedItems[itemIndex].completed,
    };

    // Optimistic update
    setMissions(prev => prev.map(m => 
      m.id === missionId ? { ...m, items: updatedItems } : m
    ));

    try {
      const { error } = await supabase.functions.invoke('get_staff_core4_entries', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          action: 'update_mission_item',
          mission_id: missionId,
          items: updatedItems,
        },
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error updating mission item:', err);
      fetchMissions();
    }
  };

  const updateMissionStatus = async (missionId: string, status: 'active' | 'completed' | 'archived') => {
    if (!sessionToken) return;

    try {
      const { error } = await supabase.functions.invoke('get_staff_core4_entries', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          action: 'update_mission_status',
          mission_id: missionId,
          status,
        },
      });

      if (error) throw error;
      
      toast.success(status === 'completed' ? 'Mission marked complete!' : 'Mission updated');
      fetchMissions();
    } catch (err) {
      console.error('Error updating mission status:', err);
      toast.error('Failed to update mission');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Monthly Missions</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Mission
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-3">
                {(() => {
                  const { icon: Icon, color } = domainConfig[newMission.domain];
                  return <Icon className={cn("h-8 w-8", color)} />;
                })()}
                <DialogTitle className={cn("text-2xl font-bold", domainConfig[newMission.domain].color)}>
                  {domainConfig[newMission.domain].label.toUpperCase()}
                </DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>MISSION</Label>
                <Input
                  placeholder="e.g., Run 50 miles this month"
                  value={newMission.title}
                  onChange={(e) => setNewMission(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>WEEKLY STRIKES</Label>
                {newMission.items.map((item, idx) => (
                  <Input
                    key={idx}
                    placeholder={`Week ${idx + 1}`}
                    value={item}
                    onChange={(e) => {
                      const items = [...newMission.items];
                      items[idx] = e.target.value;
                      setNewMission(prev => ({ ...prev, items }));
                    }}
                  />
                ))}
              </div>

              <div className="space-y-2">
                <Label>WHY IS THIS IMPORTANT? (optional)</Label>
                <Textarea
                  placeholder="What drives you to complete this mission?"
                  value={newMission.weekly_measurable}
                  onChange={(e) => setNewMission(prev => ({ ...prev, weekly_measurable: e.target.value }))}
                />
              </div>

              <Button onClick={handleCreateMission} className="w-full">
                Create Mission
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(domainConfig) as Core4Domain[]).map(domain => {
          const mission = getMissionForDomain(domain);
          const { label, icon: Icon, color } = domainConfig[domain];
          const completedCount = mission?.items.filter(i => i.completed).length || 0;
          const totalItems = mission?.items.length || 0;

          return (
            <Card key={domain} className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-5 w-5", color)} />
                  <CardTitle className="text-base">{label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {mission ? (
                  <div className="space-y-3">
                    <p className="font-medium text-sm">{mission.title}</p>
                    
                    {mission.items.length > 0 && (
                      <div className="space-y-2">
                        {mission.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Checkbox
                              checked={item.completed}
                              onCheckedChange={() => toggleMissionItem(mission.id, idx)}
                            />
                            <span className={cn(
                              "text-sm",
                              item.completed && "line-through text-muted-foreground"
                            )}>
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {mission.weekly_measurable && (
                      <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                        📊 {mission.weekly_measurable}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {completedCount}/{totalItems} complete
                      </span>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-xs text-green-500 hover:text-green-600"
                          onClick={() => updateMissionStatus(mission.id, 'completed')}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setNewMission(prev => ({ ...prev, domain }));
                      setDialogOpen(true);
                    }}
                    className="w-full py-6 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Mission
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
