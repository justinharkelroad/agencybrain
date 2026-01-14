import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { SalesPromptConfig, ScoredSection, ChecklistItem } from './promptBuilderTypes';

interface SalesPromptBuilderProps {
  config: SalesPromptConfig;
  onChange: (config: SalesPromptConfig) => void;
}

export default function SalesPromptBuilder({ config, onChange }: SalesPromptBuilderProps) {
  const updateField = <K extends keyof SalesPromptConfig>(field: K, value: SalesPromptConfig[K]) => {
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
    const newItems = [...(config.checklistItems || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    updateField('checklistItems', newItems);
  };

  const addChecklistItem = () => {
    updateField('checklistItems', [...(config.checklistItems || []), { label: '', criteria: '' }]);
  };

  const removeChecklistItem = (index: number) => {
    updateField('checklistItems', (config.checklistItems || []).filter((_, i) => i !== index));
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
              placeholder="What should the summary focus on? e.g., 'Summarize why the prospect called and whether they showed buying intent'"
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
          <CardDescription>Add the categories you want GPT to score. Each will appear as a card in the report.</CardDescription>
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
                placeholder="What should GPT look for when scoring this section? e.g., 'Score based on whether the rep introduced themselves warmly, asked about the prospect's day, and established personal connection within the first 60 seconds'"
                rows={3}
              />
            </div>
          ))}
          <Button variant="outline" onClick={addSection}>
            <Plus className="h-4 w-4 mr-2" /> Add Scored Section
          </Button>
        </CardContent>
      </Card>

      {/* Section 3: Discovery Wins */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Discovery Wins</CardTitle>
          <CardDescription>What should count as a "win" during discovery?</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config.discoveryWinsCriteria}
            onChange={(e) => updateField('discoveryWinsCriteria', e.target.value)}
            placeholder="e.g., Uncovering pain points with current carrier, learning about life changes (new home, new baby, teen driver), identifying cross-sell opportunities, getting budget information"
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Section 4: Closing Attempts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Closing Attempts</CardTitle>
          <CardDescription>What counts as a closing attempt?</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config.closingAttemptsCriteria}
            onChange={(e) => updateField('closingAttemptsCriteria', e.target.value)}
            placeholder="e.g., Asking for the sale directly, offering to bind coverage today, suggesting a start date, overcoming objections, assumptive closes"
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Section 5: Coaching Focus */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coaching Recommendations Focus</CardTitle>
          <CardDescription>What areas should coaching suggestions prioritize?</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config.coachingFocus}
            onChange={(e) => updateField('coachingFocus', e.target.value)}
            placeholder="e.g., Focus on closing techniques, objection handling, building urgency, asking for referrals"
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Section 6: Execution Clean Sheet (Checklist) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Execution Clean Sheet</CardTitle>
          <CardDescription>Yes/No checklist items that appear at the bottom of the report. These track specific behaviors you want to see on every call.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(config.checklistItems || []).map((item, idx) => (
            <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center gap-2">
                <Input
                  value={item.label}
                  onChange={(e) => updateChecklistItem(idx, 'label', e.target.value)}
                  placeholder="e.g., Ask for Sale"
                />
                <Button variant="ghost" size="sm" onClick={() => removeChecklistItem(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                value={item.criteria}
                onChange={(e) => updateChecklistItem(idx, 'criteria', e.target.value)}
                placeholder="What counts as 'Yes'? e.g., 'Rep directly asked the prospect to move forward, bind coverage, or commit to a start date'"
                rows={2}
              />
            </div>
          ))}
          <Button variant="outline" onClick={addChecklistItem}>
            <Plus className="h-4 w-4 mr-2" /> Add Checklist Item
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
