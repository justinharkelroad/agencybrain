import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Link2, Image as ImageIcon, Send, Loader2, Mail, Users, Search, X, Lock, Globe, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useCreatePost, useExchangeTags, ExchangeVisibility, ExchangeContentType } from '@/hooks/useExchange';
import { useSendExchangeNotification, EmailAudience } from '@/hooks/useExchangeEmail';
import { useExchangeUserSearch, ExchangeUser } from '@/hooks/useExchangeUserSearch';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface ExchangeShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: ExchangeContentType;
  sourceReference?: { type: string; id: string; title: string; path?: string };
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
  
  // Share type: public or private
  const [shareType, setShareType] = useState<'public' | 'private'>('public');
  const [privateRecipient, setPrivateRecipient] = useState<ExchangeUser | null>(null);
  const [userSearch, setUserSearch] = useState('');
  
  // Email notification state (admin only)
  const [sendEmail, setSendEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailAudience, setEmailAudience] = useState<EmailAudience>('all');
  const [includeStaff, setIncludeStaff] = useState(false);
  
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const { data: tags } = useExchangeTags();
  const createPost = useCreatePost();
  const sendNotification = useSendExchangeNotification();
  const { data: searchResults, isLoading: isSearching } = useExchangeUserSearch(userSearch);
  
  // Preview email function
  const handlePreviewEmail = async () => {
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-exchange-notification', {
        body: {
          preview: true,
          message: emailMessage || content || 'Check out this new content in The Exchange.',
          posterName: 'Agency Brain Admin',
          attachmentName: fileName,
        },
      });
      
      if (error) throw error;
      
      // Open HTML in new tab
      const blob = new Blob([data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      console.error('Preview error:', err);
      toast.error('Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };
  
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
        private_recipient_id: shareType === 'private' ? privateRecipient?.id : undefined,
      } as any,
      {
        onSuccess: (post) => {
          // Send email notification if enabled
          if (sendEmail && isAdmin && post && shareType === 'public') {
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
          setShareType('public');
          setPrivateRecipient(null);
          setUserSearch('');
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
          
          {/* Share Type Selection */}
          <div className="space-y-3">
            <Label>Share type</Label>
            <RadioGroup
              value={shareType}
              onValueChange={(v) => setShareType(v as 'public' | 'private')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" />
                <Label htmlFor="public" className="flex items-center gap-1.5 cursor-pointer font-normal">
                  <Globe className="h-4 w-4" />
                  Public post
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="private" />
                <Label htmlFor="private" className="flex items-center gap-1.5 cursor-pointer font-normal">
                  <Lock className="h-4 w-4" />
                  Private to one person
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* Private Recipient Search */}
          {shareType === 'private' && (
            <div className="space-y-2">
              <Label>Recipient</Label>
              {privateRecipient ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {privateRecipient.full_name
                        ? privateRecipient.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        : privateRecipient.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{privateRecipient.full_name || privateRecipient.email}</p>
                    {privateRecipient.agency_name && (
                      <p className="text-xs text-muted-foreground">{privateRecipient.agency_name}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPrivateRecipient(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="pl-9"
                    />
                  </div>
                  
                  {isSearching ? (
                    <div className="space-y-2 p-2">
                      {[1, 2].map(i => (
                        <div key={i} className="flex items-center gap-3 p-2">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      ))}
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <div className="max-h-[150px] overflow-y-auto border rounded-lg">
                      {searchResults.map(user => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setPrivateRecipient(user);
                            setUserSearch('');
                          }}
                          className="w-full flex items-center gap-3 p-2 hover:bg-muted transition-colors text-left"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {user.full_name
                                ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                : user.email[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{user.full_name || user.email}</p>
                            {user.agency_name && (
                              <p className="text-xs text-muted-foreground">{user.agency_name}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : userSearch.length >= 2 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                  ) : null}
                </div>
              )}
            </div>
          )}
          
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
          
          {/* Tags - only for public posts */}
          {shareType === 'public' && tags && tags.length > 0 && (
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
          
          {/* Visibility (Admin only, public posts only) */}
          {isAdmin && shareType === 'public' && (
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
          
          {/* Email Notification (Admin only, public posts only) */}
          {isAdmin && shareType === 'public' && (
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
                  
                  {/* Preview Email Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePreviewEmail}
                    disabled={previewLoading}
                    className="gap-2"
                  >
                    {previewLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    Preview Email
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleShare} 
            disabled={isLoading || (shareType === 'private' && !privateRecipient)} 
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {shareType === 'private' ? 'Send Privately' : sendEmail ? 'Share & Send Email' : 'Share'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
