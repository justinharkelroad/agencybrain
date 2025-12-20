import { useState } from 'react';
import { Send, Link2, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreatePost, useExchangeTags, ExchangeVisibility } from '@/hooks/useExchange';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function ExchangePostComposer() {
  const { isAdmin } = useAuth();
  const [content, setContent] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<ExchangeVisibility>('boardroom');
  
  const { data: tags } = useExchangeTags();
  const createPost = useCreatePost();
  
  const handleSubmit = () => {
    if (!content.trim() && !externalUrl.trim()) return;
    
    createPost.mutate(
      {
        content_type: externalUrl ? 'external_link' : 'text_post',
        content_text: content.trim() || undefined,
        external_url: externalUrl.trim() || undefined,
        visibility,
        tag_ids: selectedTags.length > 0 ? selectedTags : undefined,
      },
      {
        onSuccess: () => {
          setContent('');
          setExternalUrl('');
          setShowUrlInput(false);
          setSelectedTags([]);
        },
      }
    );
  };
  
  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };
  
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4 space-y-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share something with the community..."
          className="min-h-[100px] resize-none"
        />
        
        {showUrlInput && (
          <Input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="Enter URL..."
            className="text-sm"
          />
        )}
        
        {/* Tags */}
        {tags && tags.length > 0 && (
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
        )}
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className={cn(showUrlInput && "bg-muted")}
            >
              <Link2 className="h-4 w-4" />
            </Button>
            
            {isAdmin && (
              <Select value={visibility} onValueChange={(v) => setVisibility(v as ExchangeVisibility)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call_scoring">Call Scoring</SelectItem>
                  <SelectItem value="boardroom">Boardroom</SelectItem>
                  <SelectItem value="one_on_one">1:1 Coaching</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          
          <Button
            onClick={handleSubmit}
            disabled={(!content.trim() && !externalUrl.trim()) || createPost.isPending}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Post
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
