import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, MoreHorizontal, Trash2, Flag, ExternalLink, FileText, Image as ImageIcon, Link2, Lock, Pin, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ExchangePost, useToggleLike, useDeletePost, useReportPost } from '@/hooks/useExchange';
import { usePinPost } from '@/hooks/useExchangePin';
import { ExchangeCommentSection } from './ExchangeCommentSection';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ExchangePostCardProps {
  post: ExchangePost & { is_pinned?: boolean };
  defaultShowComments?: boolean;
}

export function ExchangePostCard({ post, defaultShowComments = false }: ExchangePostCardProps) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [contentExpanded, setContentExpanded] = useState(false);
  
  const toggleLike = useToggleLike();
  const deletePost = useDeletePost();
  const reportPost = useReportPost();
  const pinPost = usePinPost();
  
  const isOwner = user?.id === post.user_id;
  const canDelete = isOwner || isAdmin;
  const isPrivateShare = !!(post as any).private_recipient_id;
  const isPinned = !!(post as any).is_pinned;
  
  // Check if content is long (more than 300 chars or 3 lines)
  const isLongContent = post.content_text && (
    post.content_text.length > 300 || 
    post.content_text.split('\n').length > 3
  );
  const displayContent = isLongContent && !contentExpanded
    ? post.content_text!.slice(0, 280) + '...'
    : post.content_text;
  
  const getContentIcon = () => {
    switch (post.content_type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'external_link':
        return <Link2 className="h-4 w-4" />;
      case 'training_module':
        return <GraduationCap className="h-4 w-4" />;
      case 'process_vault':
      case 'saved_report':
        return <FileText className="h-4 w-4" />;
      default:
        return null;
    }
  };
  
  const getContentTypeLabel = () => {
    switch (post.content_type) {
      case 'process_vault':
        return 'Process Vault';
      case 'flow_result':
        return 'Flow Result';
      case 'saved_report':
        return 'Report';
      case 'training_module':
        return 'Training Module';
      case 'external_link':
        return 'Link';
      case 'image':
        return 'Image';
      default:
        return null;
    }
  };
  
  const handleLike = () => {
    if (isPrivateShare) return;
    toggleLike.mutate({ postId: post.id, hasLiked: post.user_has_liked });
  };
  
  const handleDelete = () => {
    deletePost.mutate(post.id);
    setShowDeleteDialog(false);
  };
  
  const handleReport = () => {
    if (!reportReason.trim()) return;
    reportPost.mutate({ postId: post.id, reason: reportReason });
    setShowReportDialog(false);
    setReportReason('');
  };
  
  const handlePin = () => {
    pinPost.mutate({ postId: post.id, pin: !isPinned });
  };
  
  const handleViewTraining = () => {
    if (post.source_reference?.type === 'training_module' && post.source_reference?.id) {
      navigate(`/training/standard?module=${post.source_reference.id}`);
    }
  };
  
  const userInitials = post.user.full_name
    ? post.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : post.user.email[0].toUpperCase();

  return (
    <TooltipProvider>
      <Card className={cn(
        "border-border/50 bg-card/50 backdrop-blur-sm hover:border-border transition-all duration-200",
        isPrivateShare && "border-primary/30 bg-primary/5",
        isPinned && "border-amber-500/30 bg-amber-500/5"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {post.user.full_name || post.user.email}
                  </span>
                  {post.is_admin_post && (
                    <Badge variant="secondary" className="text-xs">Admin</Badge>
                  )}
                  {isPinned && (
                    <Badge variant="outline" className="text-xs gap-1 border-amber-500/50 text-amber-600">
                      <Pin className="h-3 w-3" />
                      Pinned
                    </Badge>
                  )}
                  {isPrivateShare && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Lock className="h-3 w-3" />
                      Private
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {post.user.agency?.name && (
                    <>
                      <span>{post.user.agency.name}</span>
                      <span>•</span>
                    </>
                  )}
                  <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isAdmin && (
                  <>
                    <DropdownMenuItem onClick={handlePin}>
                      <Pin className="h-4 w-4 mr-2" />
                      {isPinned ? 'Unpin' : 'Pin to Top'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
                {!isOwner && (
                  <DropdownMenuItem onClick={() => setShowReportDialog(true)}>
                    <Flag className="h-4 w-4 mr-2" />
                    Report
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map(tag => (
                <Badge key={tag.id} variant="outline" className="text-xs">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Content Type Badge */}
          {getContentTypeLabel() && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {getContentIcon()}
              <span>{getContentTypeLabel()}</span>
              {post.source_reference?.title && (
                <>
                  <span>•</span>
                  <span className="font-medium">{post.source_reference.title}</span>
                </>
              )}
            </div>
          )}
          
          {/* Content Text */}
          {post.content_text && (
            <div>
              <p className="text-foreground whitespace-pre-wrap">{displayContent}</p>
              {isLongContent && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto text-primary"
                  onClick={() => setContentExpanded(!contentExpanded)}
                >
                  {contentExpanded ? 'Show less' : 'Read more'}
                </Button>
              )}
            </div>
          )}
          
          {/* Training Module Link */}
          {post.content_type === 'training_module' && post.source_reference?.id && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleViewTraining}
            >
              <GraduationCap className="h-4 w-4" />
              View Training
            </Button>
          )}
          
          {/* External Link */}
          {post.external_url && (
            <a
              href={post.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
            >
              <ExternalLink className="h-4 w-4 text-primary" />
              <span className="text-primary hover:underline truncate">{post.external_url}</span>
            </a>
          )}
          
          {/* File Preview */}
          {post.file_path && post.file_name && (
            <a
              href={`https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/uploads/${post.file_path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-sm">{post.file_name}</span>
            </a>
          )}
          
          {/* Actions */}
          {!isPrivateShare && (
            <div className="flex items-center gap-4 pt-2 border-t border-border/50">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 h-8 transition-all",
                      post.user_has_liked && "text-red-500"
                    )}
                    onClick={handleLike}
                    disabled={toggleLike.isPending}
                  >
                    <Heart className={cn(
                      "h-4 w-4 transition-transform",
                      post.user_has_liked && "fill-current scale-110"
                    )} />
                    <span>{post.likes_count}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Like</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 h-8"
                    onClick={() => setShowComments(!showComments)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>{post.comments_count}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Comments</TooltipContent>
              </Tooltip>
            </div>
          )}
          
          {/* Comments Section */}
          {showComments && !isPrivateShare && (
            <ExchangeCommentSection postId={post.id} />
          )}
        </CardContent>
      </Card>
      
      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Please describe why you're reporting this post. Our team will review your report.
            </p>
            <div className="space-y-2">
              <Label htmlFor="report-reason">Reason</Label>
              <Textarea
                id="report-reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe the issue..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReport} 
              disabled={!reportReason.trim() || reportPost.isPending}
            >
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
