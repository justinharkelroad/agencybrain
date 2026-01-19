import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Phone, PhoneOff, Mail, FileText, MessageSquare, StickyNote,
  ArrowRight, Clock, Send
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  activity_type: string;
  notes: string | null;
  created_by_name: string | null;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
}

interface WinbackActivityLogProps {
  activities: Activity[];
  loading: boolean;
  onLogActivity: (type: string, notes: string) => Promise<void>;
}

const activityConfig: Record<string, { icon: typeof Phone; label: string; color: string; buttonColor: string }> = {
  called: { icon: Phone, label: 'Called', color: 'text-blue-400', buttonColor: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30' },
  left_vm: { icon: PhoneOff, label: 'Left Voicemail', color: 'text-orange-400', buttonColor: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30' },
  texted: { icon: MessageSquare, label: 'Texted', color: 'text-emerald-400', buttonColor: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  emailed: { icon: Mail, label: 'Emailed', color: 'text-purple-400', buttonColor: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30' },
  quoted: { icon: FileText, label: 'Quoted', color: 'text-yellow-400', buttonColor: 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  note: { icon: StickyNote, label: 'Note', color: 'text-gray-400', buttonColor: 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 border-gray-500/30' },
  status_change: { icon: ArrowRight, label: 'Status Changed', color: 'text-orange-400', buttonColor: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

export function WinbackActivityLog({ activities, loading, onLogActivity }: WinbackActivityLogProps) {
  const [newNote, setNewNote] = useState('');
  const [logging, setLogging] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleQuickAction = async (type: string) => {
    setActiveAction(type);
    setLogging(true);
    try {
      await onLogActivity(type, '');
    } finally {
      setLogging(false);
      setActiveAction(null);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setLogging(true);
    try {
      await onLogActivity('note', newNote.trim());
      setNewNote('');
    } finally {
      setLogging(false);
    }
  };

  const formatStatus = (status: string | null) => {
    if (!status) return '';
    return status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="space-y-4">
      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {(['called', 'left_vm', 'texted', 'emailed', 'quoted'] as const).map((type) => {
          const config = activityConfig[type];
          const Icon = config.icon;
          return (
            <Button
              key={type}
              size="sm"
              variant="outline"
              onClick={() => handleQuickAction(type)}
              disabled={logging}
              className={cn(
                'border transition-colors',
                config.buttonColor,
                activeAction === type && 'opacity-50'
              )}
            >
              <Icon className="h-4 w-4 mr-1" />
              {type === 'left_vm' ? 'Left VM' : config.label}
            </Button>
          );
        })}
      </div>

      {/* Add Note */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Add a note..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={2}
          className="flex-1 resize-none"
        />
        <Button 
          onClick={handleAddNote} 
          disabled={!newNote.trim() || logging}
          size="icon"
          className="h-auto"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Activity Timeline */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Activity History
        </h4>
        
        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
        ) : activities.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">No activity yet</div>
        ) : (
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-3">
              {activities.map((activity) => {
                const config = activityConfig[activity.activity_type] || activityConfig.note;
                const Icon = config.icon;
                
                return (
                  <div key={activity.id} className="flex gap-3 text-sm">
                    <div className={cn('mt-0.5', config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{config.label}</span>
                        {activity.activity_type === 'status_change' && (
                          <span className="text-muted-foreground">
                            {formatStatus(activity.old_status)} → {formatStatus(activity.new_status)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground/80">
                          {activity.created_by_name || 'Unknown'}
                        </span>
                        <span>•</span>
                        <span title={format(new Date(activity.created_at), 'PPpp')}>
                          {format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                        <span className="text-muted-foreground/60">
                          ({formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })})
                        </span>
                      </div>
                      {activity.notes && (
                        <p className="text-muted-foreground mt-1">{activity.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
