import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Link2, Image as ImageIcon, Send, Loader2, Mail, Users } from 'lucide-react';
import { useCreatePost, useExchangeTags, ExchangeVisibility, ExchangeContentType } from '@/hooks/useExchange';
import { useSendExchangeNotification, EmailAudience } from '@/hooks/useExchangeEmail';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface ExchangeShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: ExchangeContentType;
  sourceReference?: { type: string; id: string; title: string };
  filePath?: string;
  fileName?: string;
  externalUrl?: string;
  defaultText?: string;
}

export function ExchangeShareModal({
  open,
  onOpenChange,
  contentType,
  sourceReference,
  filePath,
  fileName,
  externalUrl,
  defaultText = '',
}: ExchangeShareModalProps) {
  const { isAdmin } = useAuth();
  const [content, setContent] = useState(defaultText);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<ExchangeVisibility>('boardroom');
  
  // Email notification state (admin only)
  const [sendEmail, setSendEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailAudience, setEmailAudience] = useState<EmailAudience>('all');
  const [includeStaff, setIncludeStaff] = useState(false);
  
  const { data: tags } = useExchangeTags();
  const createPost = useCreatePost();
  const sendNotification = useSendExchangeNotification();
  
  const getContentIcon = () => {
    switch (contentType) {
      case 'image':
        return <ImageIcon className="h-5 w-5 text-primary" />;
      case 'external_link':
        return <Link2 className="h-5 w-5 text-primary" />;
      default:
        return <FileText className="h-5 w-5 text-primary" />;
    }
  };
  
  const getContentLabel = () => {
    switch (contentType) {
      case 'process_vault':
        return 'Process Vault Item';
      case 'flow_result':
        return 'Flow Result';
      case 'saved_report':
        return 'Saved Report';
      case 'training_module':
        return 'Training Module';
      case 'external_link':
        return 'External Link';
      case 'image':
        return 'Image';
      default:
        return 'Content';
    }
  };
  
  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };
  
  const contentTitle = sourceReference?.title || fileName || externalUrl || 'Untitled';
  
  const handleShare = () => {
    createPost.mutate(
      {
        content_type: contentType,
        content_text: content.trim() || undefined,
        file_path: filePath,
        file_name: fileName,
        external_url: externalUrl,
        source_reference: sourceReference,
        visibility,
        tag_ids: selectedTags.length > 0 ? selectedTags : undefined,
      },
      {
        onSuccess: (post) => {
          // Send email notification if enabled
          if (sendEmail && isAdmin && post) {
            sendNotification.mutate({
              post_id: post.id,
              subject: emailSubject || `New in The Exchange: ${contentTitle}`,
              message: emailMessage || content || `Check out this new content in The Exchange.`,
              audience: emailAudience,
              include_staff: includeStaff,
            });
          }
          
          // Reset form
          onOpenChange(false);
          setContent('');
          setSelectedTags([]);
          setSendEmail(false);
          setEmailSubject('');
          setEmailMessage('');
        },
      }
    );
  };
  
  const isLoading = createPost.isPending || sendNotification.isPending;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share to The Exchange</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Content Preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            {getContentIcon()}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{getContentLabel()}</p>
              <p className="text-sm font-medium truncate">{contentTitle}</p>
            </div>
          </div>
          
          {/* Commentary */}
          <div className="space-y-2">
            <Label>Add a description (optional)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts about this..."
              className="min-h-[100px] resize-none"
            />
          </div>
          
          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="space-y-2">
              <Label>Topics</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedTags.includes(tag.id) && "bg-primary"
                    )}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Visibility (Admin only) */}
          {isAdmin && (
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as ExchangeVisibility)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call_scoring">Call Scoring Members</SelectItem>
                  <SelectItem value="boardroom">Boardroom & Above</SelectItem>
                  <SelectItem value="one_on_one">1:1 Coaching Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {visibility === 'call_scoring' && 'Visible to all exchange members'}
                {visibility === 'boardroom' && 'Visible to Boardroom and 1:1 Coaching members'}
                {visibility === 'one_on_one' && 'Visible only to 1:1 Coaching members'}
              </p>
            </div>
          )}
          
          {/* Email Notification (Admin only) */}
          {isAdmin && (
            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="send-email"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(checked === true)}
                />
                <Label htmlFor="send-email" className="flex items-center gap-2 cursor-pointer">
                  <Mail className="h-4 w-4" />
                  Also send email notification
                </Label>
              </div>
              
              {sendEmail && (
                <div className="space-y-4 pl-6 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label>Email Subject</Label>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder={`New in The Exchange: ${contentTitle}`}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Email Message</Label>
                    <Textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder={content || "Check out this new content in The Exchange."}
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Send to
                    </Label>
                    <Select value={emailAudience} onValueChange={(v) => setEmailAudience(v as EmailAudience)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Agency Owners</SelectItem>
                        <SelectItem value="one_on_one">1:1 Coaching Only</SelectItem>
                        <SelectItem value="boardroom">Boardroom & Above</SelectItem>
                        <SelectItem value="call_scoring">Call Scoring Users</SelectItem>
                        <SelectItem value="staff">Staff Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="include-staff"
                      checked={includeStaff}
                      onCheckedChange={(checked) => setIncludeStaff(checked === true)}
                      disabled={emailAudience === 'staff'}
                    />
                    <Label htmlFor="include-staff" className="cursor-pointer text-sm">
                      Also include staff members
                    </Label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleShare} disabled={isLoading} className="gap-2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sendEmail ? 'Share & Send Email' : 'Share'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
