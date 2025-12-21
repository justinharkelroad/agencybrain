import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Reply, Trash2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { usePostComments, useCreateComment, useDeleteComment, ExchangeComment } from '@/hooks/useExchangeComments';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface CommentItemProps {
  comment: ExchangeComment;
  isReply?: boolean;
  userId?: string;
  isAdmin?: boolean;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  replyText: string;
  setReplyText: (text: string) => void;
  onDeleteComment: (commentId: string) => void;
  onSubmitReply: (parentCommentId: string) => void;
  isPending: boolean;
}

// Defined at module scope to prevent re-creation on each render
function CommentItem({
  comment,
  isReply = false,
  userId,
  isAdmin,
  replyingTo,
  setReplyingTo,
  replyText,
  setReplyText,
  onDeleteComment,
  onSubmitReply,
  isPending,
}: CommentItemProps) {
  const isOwner = userId === comment.user_id;
  const canDelete = isOwner || isAdmin;
  
  const initials = comment.user.full_name
    ? comment.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : comment.user.email[0].toUpperCase();
  
  return (
    <div className={cn("space-y-2", isReply && "ml-8")}>
      <div className="flex items-start gap-3">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground">
              {comment.user.full_name || comment.user.email}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-foreground/90 mt-1">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1">
            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => onDeleteComment(comment.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Reply Input */}
      {replyingTo === comment.id && (
        <div className="ml-10 flex gap-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            className="min-h-[60px] text-sm resize-none"
          />
          <Button
            size="sm"
            onClick={() => onSubmitReply(comment.id)}
            disabled={!replyText.trim() || isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReply
              userId={userId}
              isAdmin={isAdmin}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              replyText={replyText}
              setReplyText={setReplyText}
              onDeleteComment={onDeleteComment}
              onSubmitReply={onSubmitReply}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ExchangeCommentSectionProps {
  postId: string;
}

export function ExchangeCommentSection({ postId }: ExchangeCommentSectionProps) {
  const { user, isAdmin } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  
  const { data: comments, isLoading } = usePostComments(postId);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  
  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    createComment.mutate(
      { postId, content: newComment.trim() },
      { onSuccess: () => setNewComment('') }
    );
  };
  
  const handleSubmitReply = (parentCommentId: string) => {
    if (!replyText.trim()) return;
    createComment.mutate(
      { postId, content: replyText.trim(), parentCommentId },
      {
        onSuccess: () => {
          setReplyText('');
          setReplyingTo(null);
        },
      }
    );
  };

  const handleDeleteComment = (commentId: string) => {
    deleteComment.mutate({ commentId, postId });
  };
  
  if (isLoading) {
    return (
      <div className="pt-4 border-t border-border/50">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="pt-4 border-t border-border/50 space-y-4">
      {/* New Comment Input */}
      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="min-h-[60px] text-sm resize-none"
        />
        <Button
          size="sm"
          onClick={handleSubmitComment}
          disabled={!newComment.trim() || createComment.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Comments List */}
      {comments && comments.length > 0 && (
        <div className="space-y-4">
          {comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              userId={user?.id}
              isAdmin={isAdmin}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              replyText={replyText}
              setReplyText={setReplyText}
              onDeleteComment={handleDeleteComment}
              onSubmitReply={handleSubmitReply}
              isPending={createComment.isPending}
            />
          ))}
        </div>
      )}
      
      {comments && comments.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No comments yet. Be the first to comment!
        </p>
      )}
    </div>
  );
}
