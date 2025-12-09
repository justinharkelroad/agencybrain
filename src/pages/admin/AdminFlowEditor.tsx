import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { FlowQuestion } from '@/types/flows';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const EMOJI_OPTIONS = ['🙏', '😤', '⚔️', '💡', '📖', '🔍', '❤️', '🎯', '🧠', '✨', '🔥', '💪', '🌟', '📝'];

const DEFAULT_QUESTION: Omit<FlowQuestion, 'id'> = {
  type: 'textarea',
  prompt: '',
  required: true,
};

export default function AdminFlowEditor() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !templateId || templateId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📝');
  const [color, setColor] = useState('#6366f1');
  const [isActive, setIsActive] = useState(false);
  const [aiChallengeEnabled, setAiChallengeEnabled] = useState(true);
  const [aiChallengeIntensity, setAiChallengeIntensity] = useState('gentle');
  const [questions, setQuestions] = useState<FlowQuestion[]>([]);

  useEffect(() => {
    if (!isNew && templateId) {
      loadTemplate(templateId);
    }
  }, [templateId, isNew]);

  const loadTemplate = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flow_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setName(data.name || '');
      setSlug(data.slug || '');
      setDescription(data.description || '');
      setIcon(data.icon || '📝');
      setColor(data.color || '#6366f1');
      setIsActive(data.is_active || false);
      setAiChallengeEnabled(data.ai_challenge_enabled ?? true);
      setAiChallengeIntensity(data.ai_challenge_intensity || 'gentle');
      
      const parsedQuestions = typeof data.questions_json === 'string'
        ? JSON.parse(data.questions_json)
        : data.questions_json;
      setQuestions(parsedQuestions || []);
    } catch (err) {
      console.error('Error loading template:', err);
      toast({
        title: 'Error loading template',
        variant: 'destructive',
      });
      navigate('/admin/flows');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (isNew) {
      setSlug(generateSlug(value));
    }
  };

  const addQuestion = () => {
    const newQuestion: FlowQuestion = {
      ...DEFAULT_QUESTION,
      id: `q_${Date.now()}`,
    };
    setQuestions(prev => [...prev, newQuestion]);
    setExpandedQuestion(newQuestion.id);
  };

  const updateQuestion = (id: string, updates: Partial<FlowQuestion>) => {
    setQuestions(prev => 
      prev.map(q => q.id === id ? { ...q, ...updates } : q)
    );
  };

  const deleteQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
    if (expandedQuestion === id) {
      setExpandedQuestion(null);
    }
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!slug.trim()) {
      toast({ title: 'Slug is required', variant: 'destructive' });
      return;
    }
    if (questions.length === 0) {
      toast({ title: 'At least one question is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        icon,
        color,
        is_active: isActive,
        ai_challenge_enabled: aiChallengeEnabled,
        ai_challenge_intensity: aiChallengeIntensity,
        questions_json: questions,
      };

      if (isNew) {
        const { error } = await supabase
          .from('flow_templates')
          .insert(templateData);

        if (error) {
          if (error.code === '23505') {
            toast({ title: 'A template with this slug already exists', variant: 'destructive' });
            return;
          }
          throw error;
        }
        
        toast({ title: 'Template created!' });
      } else {
        const { error } = await supabase
          .from('flow_templates')
          .update(templateData)
          .eq('id', templateId);

        if (error) throw error;
        
        toast({ title: 'Template saved!' });
      }

      navigate('/admin/flows');
    } catch (err) {
      console.error('Error saving template:', err);
      toast({
        title: 'Error saving template',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/flows')}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Back to Templates
          </Button>
          <h1 className="text-2xl font-medium">
            {isNew ? 'New Flow Template' : `Edit: ${name}`}
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => window.open(`/flows/start/${slug}`, '_blank')}
            disabled={isNew || !isActive}
          >
            <Eye className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" strokeWidth={1.5} />
            )}
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g., Grateful"
                  className="mt-1"
                />
              </div>

              {/* Slug */}
              <div>
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="e.g., grateful"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL-safe identifier (lowercase, no spaces)
                </p>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description shown to users"
                  className="mt-1"
                  rows={2}
                />
              </div>

              {/* Icon */}
              <div>
                <Label>Icon</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setIcon(emoji)}
                      className={`w-10 h-10 text-xl rounded-lg border transition-all ${
                        icon === emoji 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border/50 hover:border-border'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Show in Flows hub
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </CardContent>
          </Card>

          {/* AI Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>AI Challenges</Label>
                  <p className="text-xs text-muted-foreground">
                    Challenge vague answers
                  </p>
                </div>
                <Switch
                  checked={aiChallengeEnabled}
                  onCheckedChange={setAiChallengeEnabled}
                />
              </div>

              {aiChallengeEnabled && (
                <div>
                  <Label>Challenge Intensity</Label>
                  <Select
                    value={aiChallengeIntensity}
                    onValueChange={setAiChallengeIntensity}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gentle">Gentle</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="direct">Direct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Questions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Questions</CardTitle>
                <CardDescription>
                  {questions.length} question{questions.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <Button onClick={addQuestion} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Question
              </Button>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No questions yet. Add your first question to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div
                      key={question.id}
                      className="border border-border/50 rounded-lg overflow-hidden"
                    >
                      {/* Question Header */}
                      <div
                        className="flex items-center gap-3 p-3 bg-muted/30 cursor-pointer"
                        onClick={() => setExpandedQuestion(
                          expandedQuestion === question.id ? null : question.id
                        )}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                        <span className="text-sm font-medium text-muted-foreground w-6">
                          {index + 1}.
                        </span>
                        <span className="flex-1 text-sm truncate">
                          {question.prompt || '(empty prompt)'}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {question.type}
                        </span>
                        {expandedQuestion === question.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      {/* Question Editor (Expanded) */}
                      {expandedQuestion === question.id && (
                        <div className="p-4 space-y-4 border-t border-border/50">
                          {/* Prompt */}
                          <div>
                            <Label>Prompt *</Label>
                            <Textarea
                              value={question.prompt}
                              onChange={e => updateQuestion(question.id, { prompt: e.target.value })}
                              placeholder="Enter the question prompt..."
                              className="mt-1"
                              rows={2}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Use {'{variable}'} to interpolate previous answers
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Type */}
                            <div>
                              <Label>Type</Label>
                              <Select
                                value={question.type}
                                onValueChange={v => updateQuestion(question.id, { type: v as any })}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Short Text</SelectItem>
                                  <SelectItem value="textarea">Long Text</SelectItem>
                                  <SelectItem value="select">Dropdown</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Interpolation Key */}
                            <div>
                              <Label>Interpolation Key</Label>
                              <Input
                                value={question.interpolation_key || ''}
                                onChange={e => updateQuestion(question.id, { 
                                  interpolation_key: e.target.value || undefined 
                                })}
                                placeholder="e.g., trigger"
                                className="mt-1"
                              />
                            </div>
                          </div>

                          {/* Options (for select type) */}
                          {question.type === 'select' && (
                            <div>
                              <Label>Options (one per line)</Label>
                              <Textarea
                                value={(question.options || []).join('\n')}
                                onChange={e => updateQuestion(question.id, { 
                                  options: e.target.value.split('\n').filter(Boolean)
                                })}
                                placeholder="Option 1&#10;Option 2&#10;Option 3"
                                className="mt-1"
                                rows={3}
                              />
                            </div>
                          )}

                          {/* Placeholder */}
                          <div>
                            <Label>Placeholder Text</Label>
                            <Input
                              value={question.placeholder || ''}
                              onChange={e => updateQuestion(question.id, { 
                                placeholder: e.target.value || undefined 
                              })}
                              placeholder="Hint text shown in empty input"
                              className="mt-1"
                            />
                          </div>

                          {/* Toggles */}
                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`required-${question.id}`}
                                checked={question.required}
                                onCheckedChange={v => updateQuestion(question.id, { required: v })}
                              />
                              <Label htmlFor={`required-${question.id}`}>Required</Label>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`challenge-${question.id}`}
                                checked={question.ai_challenge || false}
                                onCheckedChange={v => updateQuestion(question.id, { ai_challenge: v })}
                              />
                              <Label htmlFor={`challenge-${question.id}`}>AI Challenge</Label>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/50">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveQuestion(index, 'up')}
                                disabled={index === 0}
                              >
                                <ChevronUp className="h-4 w-4" />
                                Up
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveQuestion(index, 'down')}
                                disabled={index === questions.length - 1}
                              >
                                <ChevronDown className="h-4 w-4" />
                                Down
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteQuestion(question.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
