import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { MessageCircle, Reply, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Comment {
  id: string;
  lesson_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  user_name: string | null;
  replies?: Comment[];
}

interface StaffTrainingCommentsProps {
  lessonId: string;
  staffMember: {
    id: string;
    name: string;
  };
}

export function StaffTrainingComments({ lessonId, staffMember }: StaffTrainingCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (lessonId) {
      fetchComments();
    }
  }, [lessonId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const { data: commentsData, error } = await supabase
        .from('training_comments')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        setComments([]);
        return;
      }

      // Organize into parent comments and replies
      const parentComments = (commentsData || []).filter(c => !c.parent_id);
      const replies = (commentsData || []).filter(c => c.parent_id);

      const organized = parentComments.map(parent => ({
        ...parent,
        replies: replies.filter(r => r.parent_id === parent.id),
      }));

      setComments(organized);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    if (!staffMember) {
      toast.error('Staff member not identified');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('training_comments')
        .insert({
          lesson_id: lessonId,
          user_id: staffMember.id,
          user_name: staffMember.name,
          content: newComment.trim(),
        });

      if (error) {
        console.error('Insert error:', error);
        toast.error('Failed to post comment: ' + error.message);
        return;
      }

      setNewComment('');
      await fetchComments();
      toast.success('Comment posted!');
    } catch (err: any) {
      console.error('Error posting comment:', err);
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    if (!staffMember) {
      toast.error('Staff member not identified');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('training_comments')
        .insert({
          lesson_id: lessonId,
          user_id: staffMember.id,
          parent_id: parentId,
          user_name: staffMember.name,
          content: replyContent.trim(),
        });

      if (error) {
        console.error('Reply error:', error);
        toast.error('Failed to post reply: ' + error.message);
        return;
      }

      setReplyContent('');
      setReplyingTo(null);
      setExpandedReplies(prev => new Set([...prev, parentId]));
      await fetchComments();
      toast.success('Reply posted!');
    } catch (err: any) {
      console.error('Error posting reply:', err);
      toast.error('Failed to post reply');
    } finally {
      setSubmitting(false);
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

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500',
      'bg-orange-500', 'bg-pink-500', 'bg-teal-500'
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="mt-8 pt-8 border-t border-border">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Community Discussion</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Ask questions, share insights, and connect with others taking this training.
          Your peers and coaches are here to help!
        </p>
      </div>

      {/* New Comment Input */}
      <Card className="p-4 mb-6 bg-card border-border">
        <Textarea
          placeholder="Share your thoughts or ask a question..."
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
            {submitting ? 'Posting...' : 'Post Comment'}
          </Button>
        </div>
      </Card>

      {/* Comments List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
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
              <div className="flex gap-3">
                <Avatar className={`h-10 w-10 ${getAvatarColor(comment.user_name || 'A')}`}>
                  <AvatarFallback className="text-white text-sm">
                    {getInitials(comment.user_name || 'Anonymous')}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">
                      {comment.user_name || 'Anonymous'}
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
                  </div>

                  {/* Reply Input */}
                  {replyingTo === comment.id && (
                    <div className="mt-3 pl-4 border-l-2 border-border">
                      <Textarea
                        placeholder={`Reply to ${comment.user_name || 'Anonymous'}...`}
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
                          {submitting ? 'Posting...' : 'Post Reply'}
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
                        <div key={reply.id} className="flex gap-3">
                          <Avatar className={`h-8 w-8 ${getAvatarColor(reply.user_name || 'A')}`}>
                            <AvatarFallback className="text-white text-xs">
                              {getInitials(reply.user_name || 'Anonymous')}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-foreground text-sm">
                                {reply.user_name || 'Anonymous'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                              {reply.content}
                            </p>
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

export default StaffTrainingComments;
