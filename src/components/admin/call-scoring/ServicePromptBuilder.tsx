import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { ServicePromptConfig, ScoredSection, ChecklistItem } from './promptBuilderTypes';

interface ServicePromptBuilderProps {
  config: ServicePromptConfig;
  onChange: (config: ServicePromptConfig) => void;
}

export default function ServicePromptBuilder({ config, onChange }: ServicePromptBuilderProps) {
  const updateField = <K extends keyof ServicePromptConfig>(field: K, value: ServicePromptConfig[K]) => {
    onChange({ ...config, [field]: value });
  };

  const updateSection = (index: number, field: keyof ScoredSection, value: string) => {
    const newSections = [...config.scoredSections];
    newSections[index] = { ...newSections[index], [field]: value };
    updateField('scoredSections', newSections);
  };

  const addSection = () => {
    updateField('scoredSections', [...config.scoredSections, { name: '', criteria: '' }]);
  };

  const removeSection = (index: number) => {
    updateField('scoredSections', config.scoredSections.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, field: keyof ChecklistItem, value: string) => {
    const newItems = [...config.checklistItems];
    newItems[index] = { ...newItems[index], [field]: value };
    updateField('checklistItems', newItems);
  };

  const addChecklistItem = () => {
    updateField('checklistItems', [...config.checklistItems, { label: '', criteria: '' }]);
  };

  const removeChecklistItem = (index: number) => {
    updateField('checklistItems', config.checklistItems.filter((_, i) => i !== index));
  };

  const updateCrmSection = (index: number, value: string) => {
    const newSections = [...config.crmSections];
    newSections[index] = value;
    updateField('crmSections', newSections);
  };

  const addCrmSection = () => {
    updateField('crmSections', [...config.crmSections, '']);
  };

  const removeCrmSection = (index: number) => {
    updateField('crmSections', config.crmSections.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Basic Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Call Summary Instructions</Label>
            <Textarea
              value={config.summaryInstructions}
              onChange={(e) => updateField('summaryInstructions', e.target.value)}
              placeholder="e.g., 'Explain why the customer called and what resolution was provided or promised'"
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Scored Sections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scored Sections</CardTitle>
          <CardDescription>Add the categories you want GPT to score (typically 5-8 sections)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.scoredSections.map((section, idx) => (
            <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center gap-2">
                <Input
                  value={section.name}
                  onChange={(e) => updateSection(idx, 'name', e.target.value)}
                  placeholder="Section name, e.g., Opening & Rapport"
                  className="font-semibold"
                />
                <Button variant="ghost" size="sm" onClick={() => removeSection(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                value={section.criteria}
                onChange={(e) => updateSection(idx, 'criteria', e.target.value)}
                placeholder="What should GPT look for? e.g., 'Did the CSR greet warmly, introduce themselves, and set a positive tone?'"
                rows={3}
              />
            </div>
          ))}
          <Button variant="outline" onClick={addSection}>
            <Plus className="h-4 w-4 mr-2" /> Add Scored Section
          </Button>
        </CardContent>
      </Card>

      {/* Section 3: Final Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Final Checklist Items</CardTitle>
          <CardDescription>Yes/No items that appear at the bottom of the report</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.checklistItems.map((item, idx) => (
            <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center gap-2">
                <Input
                  value={item.label}
                  onChange={(e) => updateChecklistItem(idx, 'label', e.target.value)}
                  placeholder="e.g., Offered a policy review"
                />
                <Button variant="ghost" size="sm" onClick={() => removeChecklistItem(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                value={item.criteria}
                onChange={(e) => updateChecklistItem(idx, 'criteria', e.target.value)}
                placeholder="What counts as 'Yes'? e.g., 'CSR explicitly offered to review the client's current coverage or mentioned checking for discounts'"
                rows={2}
              />
            </div>
          ))}
          <Button variant="outline" onClick={addChecklistItem}>
            <Plus className="h-4 w-4 mr-2" /> Add Checklist Item
          </Button>
        </CardContent>
      </Card>

      {/* Section 4: CRM Notes Structure */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CRM Notes Structure</CardTitle>
          <CardDescription>What subheadings should appear in the CRM notes?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.crmSections.map((section, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={section}
                onChange={(e) => updateCrmSection(idx, e.target.value)}
                placeholder="e.g., Personal Details, Coverage Details, Resolution / Next Step"
              />
              <Button variant="ghost" size="sm" onClick={() => removeCrmSection(idx)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addCrmSection}>
            <Plus className="h-4 w-4 mr-2" /> Add CRM Section
          </Button>
        </CardContent>
      </Card>

      {/* Section 5: Improvement Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Improvement Suggestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Number of Suggestions</Label>
            <Select value={config.numSuggestions} onValueChange={(v) => updateField('numSuggestions', v)}>
              <SelectTrigger className="w-32 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Suggestions Focus</Label>
            <Textarea
              value={config.suggestionsFocus}
              onChange={(e) => updateField('suggestionsFocus', e.target.value)}
              placeholder="What should suggestions prioritize? e.g., 'Focus on efficiency, empathy, and cross-sell opportunities'"
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
