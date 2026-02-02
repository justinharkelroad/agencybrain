import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  Send,
  MessageSquare,
  Building2,
  Calendar,
  Eye,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Assignment {
  id: string;
  agency_id: string;
  status: string;
  agencies: {
    name: string;
  };
}

interface Message {
  id: string;
  assignment_id: string;
  sender_type: 'coach' | 'owner';
  sender_id: string | null;
  subject: string;
  body: string;
  is_read: boolean;
  created_at: string;
  sales_experience_assignments: {
    agencies: {
      name: string;
    };
  };
  profiles: {
    full_name: string | null;
  } | null;
}

export function SEMessagesTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isComposeDialogOpen, setIsComposeDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [viewingMessage, setViewingMessage] = useState<Message | null>(null);

  // Fetch active/pending assignments for recipient dropdown
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['admin-se-assignments-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_assignments')
        .select('id, agency_id, status, agencies(name)')
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Assignment[];
    },
  });

  // Fetch all messages (both sent and received)
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['admin-se-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_messages')
        .select(`
          *,
          sales_experience_assignments(agencies(name)),
          profiles:sender_id(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Message[];
    },
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (params: { assignment_ids: string[]; subject: string; body: string }) => {
      // Insert a message for each selected assignment
      const messagesToInsert = params.assignment_ids.map((assignment_id) => ({
        assignment_id,
        sender_type: 'coach' as const,
        sender_id: user?.id,
        subject: params.subject,
        body: params.body,
        is_read: false,
      }));

      const { error } = await supabase
        .from('sales_experience_messages')
        .insert(messagesToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-se-messages'] });
      setIsComposeDialogOpen(false);
      setSelectedAssignment('all');
      setSubject('');
      setBody('');
      toast.success('Message sent successfully');
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    },
  });

  const handleSendMessage = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Please enter a subject and message');
      return;
    }

    const assignmentIds =
      selectedAssignment === 'all'
        ? assignments?.map((a) => a.id) || []
        : [selectedAssignment];

    if (assignmentIds.length === 0) {
      toast.error('No active assignments to message');
      return;
    }

    sendMessage.mutate({
      assignment_ids: assignmentIds,
      subject,
      body,
    });
  };

  const isLoading = assignmentsLoading || messagesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Messages</h2>
          <p className="text-sm text-muted-foreground">
            Send messages to agencies enrolled in the 8-Week Sales Experience
          </p>
        </div>
        <Dialog open={isComposeDialogOpen} onOpenChange={setIsComposeDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Send className="h-4 w-4" />
              Compose Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Compose Message</DialogTitle>
              <DialogDescription>
                Send a message to one or all agencies in the program
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Recipients</Label>
                <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        All Active Agencies ({assignments?.length || 0})
                      </div>
                    </SelectItem>
                    {assignments?.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {assignment.agencies.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Message subject..."
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message..."
                  rows={8}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsComposeDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={sendMessage.isPending}
                className="gap-2"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Message History
          </CardTitle>
          <CardDescription>Recent messages sent to and from participants</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No messages yet. Compose a message to get started.
                  </TableCell>
                </TableRow>
              ) : (
                messages?.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(message.created_at), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {message.sales_experience_assignments?.agencies?.name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          message.sender_type === 'coach'
                            ? 'bg-blue-500/10 text-blue-600'
                            : 'bg-green-500/10 text-green-600'
                        }
                      >
                        {message.sender_type === 'coach' ? 'Sent' : 'Received'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{message.subject}</TableCell>
                    <TableCell>
                      {message.sender_type === 'owner' && (
                        <Badge
                          variant="outline"
                          className={
                            message.is_read
                              ? 'bg-slate-500/10 text-slate-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }
                        >
                          {message.is_read ? 'Read' : 'Unread'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => setViewingMessage(message)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Message Dialog */}
      <Dialog open={!!viewingMessage} onOpenChange={() => setViewingMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingMessage?.subject}</DialogTitle>
            <DialogDescription>
              {viewingMessage && (
                <div className="flex items-center gap-4 mt-2">
                  <span>
                    {viewingMessage.sender_type === 'coach' ? 'To' : 'From'}:{' '}
                    {viewingMessage.sales_experience_assignments?.agencies?.name}
                  </span>
                  <span className="text-muted-foreground">
                    {format(new Date(viewingMessage.created_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="whitespace-pre-wrap text-sm">{viewingMessage?.body}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingMessage(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
