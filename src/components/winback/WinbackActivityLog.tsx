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

const activityConfig: Record<string, { icon: typeof Phone; label: string; color: string }> = {
  called: { icon: Phone, label: 'Called', color: 'text-green-400' },
  left_vm: { icon: PhoneOff, label: 'Left Voicemail', color: 'text-yellow-400' },
  texted: { icon: MessageSquare, label: 'Texted', color: 'text-cyan-400' },
  emailed: { icon: Mail, label: 'Emailed', color: 'text-blue-400' },
  quoted: { icon: FileText, label: 'Quoted', color: 'text-purple-400' },
  note: { icon: StickyNote, label: 'Note', color: 'text-gray-400' },
  status_change: { icon: ArrowRight, label: 'Status Changed', color: 'text-orange-400' },
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
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleQuickAction('called')}
          disabled={logging}
          className={cn(activeAction === 'called' && 'opacity-50')}
        >
          <Phone className="h-4 w-4 mr-1" />
          Called
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleQuickAction('left_vm')}
          disabled={logging}
          className={cn(activeAction === 'left_vm' && 'opacity-50')}
        >
          <PhoneOff className="h-4 w-4 mr-1" />
          Left VM
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleQuickAction('texted')}
          disabled={logging}
          className={cn(activeAction === 'texted' && 'opacity-50')}
        >
          <MessageSquare className="h-4 w-4 mr-1" />
          Texted
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleQuickAction('emailed')}
          disabled={logging}
          className={cn(activeAction === 'emailed' && 'opacity-50')}
        >
          <Mail className="h-4 w-4 mr-1" />
          Emailed
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleQuickAction('quoted')}
          disabled={logging}
          className={cn(activeAction === 'quoted' && 'opacity-50')}
        >
          <FileText className="h-4 w-4 mr-1" />
          Quoted
        </Button>
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
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">
                          {activity.created_by_name || 'Unknown'}
                        </span>
                      </div>
                      {activity.notes && (
                        <p className="text-muted-foreground mt-1">{activity.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1" title={format(new Date(activity.created_at), 'PPpp')}>
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </p>
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
