import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, Copy, RefreshCw, Check, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useGenerateFollowUp } from '@/hooks/useGenerateFollowUp';

interface FollowUpTemplateDisplayProps {
  open: boolean;
  onClose: () => void;
  callId: string;
  existingEmail?: string | null;
  existingText?: string | null;
  clientName?: string;
}

export function FollowUpTemplateDisplay({
  open,
  onClose,
  callId,
  existingEmail,
  existingText,
  clientName = 'Client',
}: FollowUpTemplateDisplayProps) {
  const [activeTab, setActiveTab] = useState<'email' | 'text'>('email');
  const [emailContent, setEmailContent] = useState(existingEmail || '');
  const [textContent, setTextContent] = useState(existingText || '');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const generateMutation = useGenerateFollowUp();

  // Reset local state when callId changes or dialog opens
  useEffect(() => {
    if (open) {
      setEmailContent(existingEmail || '');
      setTextContent(existingText || '');
      setActiveTab('email');
    }
  }, [callId, open, existingEmail, existingText]);

  const handleGenerate = async (type: 'email' | 'text' | 'both') => {
    try {
      const result = await generateMutation.mutateAsync({
        callId,
        templateType: type,
      });

      if (result.templates.email) {
        setEmailContent(result.templates.email);
      }
      if (result.templates.text) {
        setTextContent(result.templates.text);
      }

      toast.success(`${type === 'both' ? 'Templates' : type.charAt(0).toUpperCase() + type.slice(1)} generated successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate template');
    }
  };

  const handleCopy = async (content: string, type: 'email' | 'text') => {
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      if (type === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
      }
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const isGenerating = generateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Follow-Up Templates
            {clientName && (
              <Badge variant="outline" className="font-normal">
                for {clientName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'email' | 'text')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Text/SMS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Personalized follow-up email based on the call
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerate('email')}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-1">{emailContent ? 'Regenerate' : 'Generate'}</span>
                </Button>
                {emailContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(emailContent, 'email')}
                  >
                    {copiedEmail ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-1">Copy</span>
                  </Button>
                )}
              </div>
            </div>

            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                {emailContent ? (
                  <div className="whitespace-pre-wrap text-sm font-normal">
                    {emailContent}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No email template generated yet.</p>
                    <p className="text-sm">Click "Generate" to create one.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="text" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Brief SMS follow-up message
                </p>
                {textContent && (
                  <Badge variant="outline" className="mt-1 font-mono">
                    {textContent.length} characters
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerate('text')}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-1">{textContent ? 'Regenerate' : 'Generate'}</span>
                </Button>
                {textContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(textContent, 'text')}
                  >
                    {copiedText ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-1">Copy</span>
                  </Button>
                )}
              </div>
            </div>

            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                {textContent ? (
                  <div className="text-sm font-normal">
                    {textContent}
                    {textContent.length > 160 && (
                      <div className="flex items-center gap-2 mt-3 text-yellow-500 text-xs">
                        <AlertCircle className="h-3 w-3" />
                        Message exceeds standard SMS length (160 chars)
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No text template generated yet.</p>
                    <p className="text-sm">Click "Generate" to create one.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleGenerate('both')}
            disabled={isGenerating}
            className="flex-1 sm:flex-none"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Generate Both
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
