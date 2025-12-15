import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, Code, Wand2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import SalesPromptBuilder from './SalesPromptBuilder';
import ServicePromptBuilder from './ServicePromptBuilder';
import { generateSalesPrompt, generateServicePrompt } from './promptGenerator';
import {
  SalesPromptConfig,
  ServicePromptConfig,
  DEFAULT_SALES_CONFIG,
  DEFAULT_SERVICE_CONFIG,
} from './promptBuilderTypes';

type EditorMode = 'builder' | 'raw' | 'preview';

interface PromptBuilderWrapperProps {
  callType: 'sales' | 'service';
  templateName: string;
  systemPrompt: string;
  skillCategories: any; // JSON stored config
  onSystemPromptChange: (prompt: string) => void;
  onSkillCategoriesChange: (config: any) => void;
}

export default function PromptBuilderWrapper({
  callType,
  templateName,
  systemPrompt,
  skillCategories,
  onSystemPromptChange,
  onSkillCategoriesChange,
}: PromptBuilderWrapperProps) {
  const [useBuilder, setUseBuilder] = useState(true);
  const [editorMode, setEditorMode] = useState<EditorMode>('builder');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [switchWarningOpen, setSwitchWarningOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<EditorMode | null>(null);

  // Config states
  const [salesConfig, setSalesConfig] = useState<SalesPromptConfig>(() => {
    if (skillCategories && typeof skillCategories === 'object' && skillCategories.summaryInstructions) {
      return { ...DEFAULT_SALES_CONFIG, ...skillCategories, templateName };
    }
    return { ...DEFAULT_SALES_CONFIG, templateName };
  });

  const [serviceConfig, setServiceConfig] = useState<ServicePromptConfig>(() => {
    if (skillCategories && typeof skillCategories === 'object' && skillCategories.checklistItems) {
      return { ...DEFAULT_SERVICE_CONFIG, ...skillCategories, templateName };
    }
    return { ...DEFAULT_SERVICE_CONFIG, templateName };
  });

  // Track if raw prompt has been manually edited
  const [rawPromptEdited, setRawPromptEdited] = useState(false);

  // Generate prompt when config changes
  useEffect(() => {
    if (editorMode === 'builder') {
      const generatedPrompt = callType === 'sales'
        ? generateSalesPrompt(salesConfig)
        : generateServicePrompt(serviceConfig);
      onSystemPromptChange(generatedPrompt);
      onSkillCategoriesChange(callType === 'sales' ? salesConfig : serviceConfig);
      setRawPromptEdited(false);
    }
  }, [salesConfig, serviceConfig, callType, editorMode, onSystemPromptChange, onSkillCategoriesChange]);

  // Update template name in config when it changes
  useEffect(() => {
    if (callType === 'sales') {
      setSalesConfig(prev => ({ ...prev, templateName }));
    } else {
      setServiceConfig(prev => ({ ...prev, templateName }));
    }
  }, [templateName, callType]);

  const handleModeSwitch = (newMode: EditorMode) => {
    if (editorMode === 'raw' && rawPromptEdited && newMode === 'builder') {
      setPendingMode(newMode);
      setSwitchWarningOpen(true);
      return;
    }
    setEditorMode(newMode);
    setRawPromptEdited(false);
  };

  const confirmModeSwitch = () => {
    if (pendingMode) {
      setEditorMode(pendingMode);
      setRawPromptEdited(false);
      // Regenerate from config
      const generatedPrompt = callType === 'sales'
        ? generateSalesPrompt(salesConfig)
        : generateServicePrompt(serviceConfig);
      onSystemPromptChange(generatedPrompt);
    }
    setSwitchWarningOpen(false);
    setPendingMode(null);
  };

  const handleRawPromptChange = (value: string) => {
    onSystemPromptChange(value);
    setRawPromptEdited(true);
  };

  const generatedPrompt = callType === 'sales'
    ? generateSalesPrompt(salesConfig)
    : generateServicePrompt(serviceConfig);

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={editorMode === 'builder'}
            onCheckedChange={(checked) => handleModeSwitch(checked ? 'builder' : 'raw')}
          />
          <Label className="text-sm font-medium">
            {editorMode === 'builder' ? (
              <span className="flex items-center gap-1">
                <Wand2 className="h-4 w-4" /> Prompt Builder
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Code className="h-4 w-4" /> Raw Editor
              </span>
            )}
          </Label>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-4 w-4 mr-2" /> Preview Prompt
        </Button>
      </div>

      {/* Editor Content */}
      {editorMode === 'builder' ? (
        callType === 'sales' ? (
          <SalesPromptBuilder config={salesConfig} onChange={setSalesConfig} />
        ) : (
          <ServicePromptBuilder config={serviceConfig} onChange={setServiceConfig} />
        )
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="raw-prompt">System Prompt (Raw)</Label>
            {rawPromptEdited && (
              <span className="text-xs text-yellow-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Manual edits - switching to Builder will regenerate
              </span>
            )}
          </div>
          <Textarea
            id="raw-prompt"
            value={systemPrompt}
            onChange={(e) => handleRawPromptChange(e.target.value)}
            placeholder="Enter the AI prompt that will analyze call transcripts..."
            className="font-mono text-sm"
            rows={20}
          />
          <p className="text-xs text-muted-foreground">
            Advanced mode: Edit the prompt directly. Switching back to Builder will overwrite manual changes.
          </p>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generated Prompt Preview</DialogTitle>
          </DialogHeader>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">This prompt will be sent to GPT for call analysis:</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg overflow-x-auto">
                {editorMode === 'raw' ? systemPrompt : generatedPrompt}
              </pre>
            </CardContent>
          </Card>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Switch Warning Dialog */}
      <Dialog open={switchWarningOpen} onOpenChange={setSwitchWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Switch to Builder Mode?
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            You have manually edited the prompt in raw mode. Switching to Builder mode will regenerate
            the prompt from the builder configuration, and your manual edits will be lost.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwitchWarningOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmModeSwitch}>
              Switch to Builder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
