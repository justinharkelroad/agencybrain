import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { MessageCircle, Reply, Send, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Comment {
  id: string;
  lesson_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
  replies?: Comment[];
}

interface StaffTrainingCommentsProps {
  lessonId: string;
}

export function StaffTrainingComments({ lessonId }: StaffTrainingCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [staffUserId, setStaffUserId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchComments();
  }, [lessonId]);

  const fetchComments = async () => {
    try {
      const sessionToken = localStorage.getItem('staff_session_token');
      if (!sessionToken) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('staff-training-comments', {
        headers: { 'x-staff-session': sessionToken },
        body: null,
        method: 'GET',
      });

      // Handle the response from the edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-training-comments?lesson_id=${lessonId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-staff-session': sessionToken,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch comments');
      
      const result = await response.json();
      setComments(result.comments || []);
      setStaffUserId(result.staffUserId);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    const sessionToken = localStorage.getItem('staff_session_token');
    if (!sessionToken) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-training-comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-staff-session': sessionToken,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            lesson_id: lessonId,
            content: newComment.trim(),
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to post comment');

      setNewComment('');
      fetchComments();
      toast.success('Comment posted!');
    } catch (err: any) {
      console.error('Error posting comment:', err);
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) return;

    const sessionToken = localStorage.getItem('staff_session_token');
    if (!sessionToken) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-training-comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-staff-session': sessionToken,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            lesson_id: lessonId,
            content: replyContent.trim(),
            parent_id: parentId,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to post reply');

      setReplyContent('');
      setReplyingTo(null);
      fetchComments();
      setExpandedReplies(prev => new Set([...prev, parentId]));
      toast.success('Reply posted!');
    } catch (err: any) {
      console.error('Error posting reply:', err);
      toast.error('Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    const sessionToken = localStorage.getItem('staff_session_token');
    if (!sessionToken) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-training-comments?comment_id=${commentId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-staff-session': sessionToken,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to delete comment');

      fetchComments();
      toast.success('Comment deleted');
    } catch (err) {
      console.error('Error deleting comment:', err);
      toast.error('Failed to delete comment');
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (userId: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
      'bg-orange-500', 'bg-pink-500', 'bg-teal-500'
    ];
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="mt-8 border-t border-border pt-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Community Discussion
        </h2>
        <p className="text-sm text-muted-foreground">
          Ask questions, share insights, and connect with others taking this training. 
          Your peers and coaches are here to help!
        </p>
      </div>

      {/* New Comment Input */}
      <Card className="p-4 mb-6 bg-card/50">
        <Textarea
          placeholder="Share a question or insight..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="mb-3 bg-background border-border min-h-[80px]"
        />
        <div className="flex justify-end">
          <Button 
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
          >
            <Send className="h-4 w-4 mr-2" />
            Post Comment
          </Button>
        </div>
      </Card>

      {/* Comments List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-muted rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-32 mb-2" />
                  <div className="h-16 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No comments yet. Be the first to start the discussion!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id} className="group">
              {/* Parent Comment */}
              <div className="flex gap-3">
                <Avatar className={`h-10 w-10 ${getAvatarColor(comment.user_id)}`}>
                  <AvatarFallback className="text-white text-sm">
                    {getInitials(comment.user_name || 'A')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">
                      {comment.user_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  
                  <p className="text-muted-foreground whitespace-pre-wrap mb-2">
                    {comment.content}
                  </p>
                  
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                      className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <Reply className="h-4 w-4" />
                      Reply
                    </button>
                    
                    {comment.replies && comment.replies.length > 0 && (
                      <button
                        onClick={() => toggleReplies(comment.id)}
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        {expandedReplies.has(comment.id) ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Hide {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Show {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                          </>
                        )}
                      </button>
                    )}
                    
                    {staffUserId === comment.user_id && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Reply Input */}
                  {replyingTo === comment.id && (
                    <div className="mt-3 pl-4 border-l-2 border-border">
                      <Textarea
                        placeholder={`Reply to ${comment.user_name}...`}
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        className="mb-2 bg-background border-border min-h-[60px]"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          onClick={() => handleSubmitReply(comment.id)}
                          disabled={!replyContent.trim() || submitting}
                        >
                          Post Reply
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyContent('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && expandedReplies.has(comment.id) && (
                    <div className="mt-4 space-y-4 pl-4 border-l-2 border-border">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex gap-3 group/reply">
                          <Avatar className={`h-8 w-8 ${getAvatarColor(reply.user_id)}`}>
                            <AvatarFallback className="text-white text-xs">
                              {getInitials(reply.user_name || 'A')}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-foreground text-sm">
                                {reply.user_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            
                            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                              {reply.content}
                            </p>
                            
                            {staffUserId === reply.user_id && (
                              <button
                                onClick={() => handleDeleteComment(reply.id)}
                                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 mt-1 opacity-0 group-hover/reply:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
