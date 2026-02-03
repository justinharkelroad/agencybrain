import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Mail, MessageSquare, FileText, Loader2 } from 'lucide-react';
import { FollowUpPromptConfig } from './promptBuilderTypes';

interface FollowUpPromptSettingsProps {
  config: FollowUpPromptConfig | undefined;
  onChange: (config: FollowUpPromptConfig) => void;
  onSave?: () => Promise<void>;
  saving?: boolean;
}

const DEFAULT_EMAIL_INSTRUCTIONS = `Write a personalized follow-up email that:
- References specific topics discussed in the call
- Addresses any questions or concerns raised
- Includes a clear next step or call-to-action
- Maintains a professional but warm tone`;

const DEFAULT_TEXT_INSTRUCTIONS = `Write a brief follow-up text message that:
- Thanks the client for the conversation
- References a key topic from the call
- Includes a simple call-to-action`;

const DEFAULT_CRM_INSTRUCTIONS = `Extract CRM-worthy notes including:
- Client's key concerns and pain points
- Coverage discussed and quotes provided
- Follow-up items and next steps
- Any personal details mentioned for rapport`;

export default function FollowUpPromptSettings({
  config,
  onChange,
  onSave,
  saving = false,
}: FollowUpPromptSettingsProps) {
  // Initialize with defaults merged with any existing config
  const [localConfig, setLocalConfig] = useState<FollowUpPromptConfig>(() => ({
    crmNotes: {
      enabled: config?.crmNotes?.enabled ?? true,
      instructions: config?.crmNotes?.instructions || DEFAULT_CRM_INSTRUCTIONS,
    },
    emailTemplate: {
      enabled: config?.emailTemplate?.enabled ?? true,
      tone: config?.emailTemplate?.tone || 'professional',
      instructions: config?.emailTemplate?.instructions || DEFAULT_EMAIL_INSTRUCTIONS,
    },
    textTemplate: {
      enabled: config?.textTemplate?.enabled ?? true,
      tone: config?.textTemplate?.tone || 'friendly',
      maxLength: config?.textTemplate?.maxLength || 160,
      instructions: config?.textTemplate?.instructions || DEFAULT_TEXT_INSTRUCTIONS,
    },
  }));

  // Re-sync when prop changes
  useEffect(() => {
    setLocalConfig({
      crmNotes: {
        enabled: config?.crmNotes?.enabled ?? true,
        instructions: config?.crmNotes?.instructions || DEFAULT_CRM_INSTRUCTIONS,
      },
      emailTemplate: {
        enabled: config?.emailTemplate?.enabled ?? true,
        tone: config?.emailTemplate?.tone || 'professional',
        instructions: config?.emailTemplate?.instructions || DEFAULT_EMAIL_INSTRUCTIONS,
      },
      textTemplate: {
        enabled: config?.textTemplate?.enabled ?? true,
        tone: config?.textTemplate?.tone || 'friendly',
        maxLength: config?.textTemplate?.maxLength || 160,
        instructions: config?.textTemplate?.instructions || DEFAULT_TEXT_INSTRUCTIONS,
      },
    });
  }, [config]);

  // Propagate changes upward
  const handleChange = (newConfig: FollowUpPromptConfig) => {
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const updateCrmNotes = (updates: Partial<NonNullable<FollowUpPromptConfig['crmNotes']>>) => {
    handleChange({
      ...localConfig,
      crmNotes: { ...localConfig.crmNotes!, ...updates },
    });
  };

  const updateEmailTemplate = (updates: Partial<NonNullable<FollowUpPromptConfig['emailTemplate']>>) => {
    handleChange({
      ...localConfig,
      emailTemplate: { ...localConfig.emailTemplate!, ...updates },
    });
  };

  const updateTextTemplate = (updates: Partial<NonNullable<FollowUpPromptConfig['textTemplate']>>) => {
    handleChange({
      ...localConfig,
      textTemplate: { ...localConfig.textTemplate!, ...updates },
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Configure how AI generates follow-up content after call scoring. CRM notes are generated
        automatically during analysis. Email and text templates are generated on-demand when requested.
      </div>

      {/* CRM Notes Config */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <CardTitle className="text-base">CRM Notes</CardTitle>
                <CardDescription>Extracted during call analysis</CardDescription>
              </div>
            </div>
            <Switch
              checked={localConfig.crmNotes?.enabled ?? true}
              onCheckedChange={(enabled) => updateCrmNotes({ enabled })}
            />
          </div>
        </CardHeader>
        {localConfig.crmNotes?.enabled && (
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="crm-instructions">Custom Instructions</Label>
              <Textarea
                id="crm-instructions"
                value={localConfig.crmNotes?.instructions || ''}
                onChange={(e) => updateCrmNotes({ instructions: e.target.value })}
                placeholder="Instructions for extracting CRM notes..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Guide the AI on what information to extract for CRM documentation.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Email Template Config */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-green-500" />
              <div>
                <CardTitle className="text-base">Email Template</CardTitle>
                <CardDescription>Generated on-demand</CardDescription>
              </div>
            </div>
            <Switch
              checked={localConfig.emailTemplate?.enabled ?? true}
              onCheckedChange={(enabled) => updateEmailTemplate({ enabled })}
            />
          </div>
        </CardHeader>
        {localConfig.emailTemplate?.enabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-tone">Tone</Label>
              <Select
                value={localConfig.emailTemplate?.tone || 'professional'}
                onValueChange={(tone: 'professional' | 'friendly' | 'casual') =>
                  updateEmailTemplate({ tone })
                }
              >
                <SelectTrigger id="email-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sets the overall voice and style of generated emails.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-instructions">Custom Instructions</Label>
              <Textarea
                id="email-instructions"
                value={localConfig.emailTemplate?.instructions || ''}
                onChange={(e) => updateEmailTemplate({ instructions: e.target.value })}
                placeholder="Instructions for generating follow-up emails..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Specific guidance for what the email should include and how it should be structured.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Text/SMS Template Config */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-500" />
              <div>
                <CardTitle className="text-base">Text/SMS Template</CardTitle>
                <CardDescription>Generated on-demand</CardDescription>
              </div>
            </div>
            <Switch
              checked={localConfig.textTemplate?.enabled ?? true}
              onCheckedChange={(enabled) => updateTextTemplate({ enabled })}
            />
          </div>
        </CardHeader>
        {localConfig.textTemplate?.enabled && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="text-tone">Tone</Label>
                <Select
                  value={localConfig.textTemplate?.tone || 'friendly'}
                  onValueChange={(tone: 'professional' | 'friendly' | 'casual') =>
                    updateTextTemplate({ tone })
                  }
                >
                  <SelectTrigger id="text-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="text-max-length">Max Length</Label>
                <Input
                  id="text-max-length"
                  type="number"
                  min={50}
                  max={500}
                  value={localConfig.textTemplate?.maxLength || 160}
                  onChange={(e) => updateTextTemplate({ maxLength: parseInt(e.target.value) || 160 })}
                />
                <p className="text-xs text-muted-foreground">
                  Standard SMS is 160 chars
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="text-instructions">Custom Instructions</Label>
              <Textarea
                id="text-instructions"
                value={localConfig.textTemplate?.instructions || ''}
                onChange={(e) => updateTextTemplate({ instructions: e.target.value })}
                placeholder="Instructions for generating follow-up texts..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Specific guidance for text message content and style.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Save Button (if onSave provided) */}
      {onSave && (
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Follow-Up Settings
          </Button>
        </div>
      )}
    </div>
  );
}
