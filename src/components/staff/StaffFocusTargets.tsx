import { useState, useEffect } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, CheckCircle2, Clock, Calendar } from 'lucide-react';

interface FocusItem {
  id: string;
  title: string;
  description: string | null;
  priority_level: 'top' | 'mid' | 'low';
  column_status: string;
  created_at: string;
  completed_at: string | null;
}

const PRIORITY_COLORS = {
  top: 'bg-red-500/10 text-red-600 border-red-500/20',
  mid: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  low: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const COLUMN_LABELS: Record<string, string> = {
  week1: 'Within 1 Week',
  week2: 'Within 2 Weeks',
  next_call: 'Before Next Call',
  backlog: 'Backlog',
  completed: 'Completed',
};

export function StaffFocusTargets() {
  const { user, sessionToken } = useStaffAuth();
  const [focusItems, setFocusItems] = useState<FocusItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFocusItems() {
      if (!sessionToken) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
          headers: { 'x-staff-session': sessionToken },
          body: { type: 'focus_items' },
        });

        if (error) {
          console.error('Error fetching focus items:', error);
        } else if (data?.focus_items) {
          setFocusItems(data.focus_items);
        }
      } catch (err) {
        console.error('Error fetching focus items:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchFocusItems();
  }, [sessionToken]);

  // Filter to show active items (not completed)
  const activeItems = focusItems.filter(item => item.column_status !== 'completed');
  const completedItems = focusItems.filter(item => item.column_status === 'completed');

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            My Focus Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (focusItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            My Focus Targets
          </CardTitle>
          <CardDescription>Your current focus items and goals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No focus targets assigned yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          My Focus Targets
        </CardTitle>
        <CardDescription>
          {activeItems.length} active • {completedItems.length} completed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Items */}
        {activeItems.length > 0 && (
          <div className="space-y-3">
            {activeItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant="outline" className={PRIORITY_COLORS[item.priority_level]}>
                      {item.priority_level === 'top' ? 'High' : item.priority_level === 'mid' ? 'Medium' : 'Low'}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {COLUMN_LABELS[item.column_status] || item.column_status}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Completed Items (collapsible/summary) */}
        {completedItems.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>{completedItems.length} completed items</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {completedItems.slice(0, 3).map((item) => (
                <Badge key={item.id} variant="outline" className="text-muted-foreground line-through">
                  {item.title}
                </Badge>
              ))}
              {completedItems.length > 3 && (
                <Badge variant="outline" className="text-muted-foreground">
                  +{completedItems.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
