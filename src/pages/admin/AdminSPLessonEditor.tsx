import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft,
  Save,
  Loader2,
  Video,
  FileText,
  FileUp,
  HelpCircle,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

interface LessonDocument {
  id: string;
  url: string;
  name: string;
}

export default function AdminSPLessonEditor() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [searchParams] = useSearchParams();
  const moduleIdFromQuery = searchParams.get('moduleId');
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !lessonId || lessonId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [moduleId, setModuleId] = useState<string>(moduleIdFromQuery || '');
  const [moduleName, setModuleName] = useState('');

  // Lesson fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [documents, setDocuments] = useState<LessonDocument[]>([]);
  const [estimatedMinutes, setEstimatedMinutes] = useState(10);
  const [hasQuiz, setHasQuiz] = useState(true);

  // Quiz questions (multiple choice - optional)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    if (!isNew && lessonId) {
      loadLesson(lessonId);
    } else if (moduleIdFromQuery) {
      loadModule(moduleIdFromQuery);
    }
  }, [lessonId, isNew, moduleIdFromQuery]);

  const loadModule = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('sp_modules')
        .select('id, name')
        .eq('id', id)
        .single();

      if (error) throw error;
      setModuleId(data.id);
      setModuleName(data.name);
    } catch (err) {
      console.error('Error loading module:', err);
    }
  };

  const loadLesson = async (id: string) => {
    setLoading(true);
    try {
      // Load lesson
      const { data: lesson, error: lessonError } = await supabase
        .from('sp_lessons')
        .select(`
          *,
          module:sp_modules(id, name)
        `)
        .eq('id', id)
        .single();

      if (lessonError) throw lessonError;

      setModuleId(lesson.module_id);
      setModuleName(lesson.module?.name || '');
      setName(lesson.name);
      setSlug(lesson.slug);
      setDescription(lesson.description || '');
      setVideoUrl(lesson.video_url || '');
      setContentHtml(lesson.content_html || '');
      // Load documents from documents_json or migrate from legacy fields
      if (lesson.documents_json && Array.isArray(lesson.documents_json) && lesson.documents_json.length > 0) {
        setDocuments(lesson.documents_json);
      } else if (lesson.document_url) {
        // Legacy fallback
        setDocuments([{ id: `doc_${Date.now()}`, url: lesson.document_url, name: lesson.document_name || 'Document' }]);
      } else {
        setDocuments([]);
      }
      setEstimatedMinutes(lesson.estimated_minutes || 10);
      setHasQuiz(lesson.has_quiz ?? true);

      // Load quiz if exists
      const { data: quiz, error: quizError } = await supabase
        .from('sp_quizzes')
        .select('*')
        .eq('lesson_id', id)
        .single();

      if (!quizError && quiz) {
        setQuizQuestions(quiz.questions_json || []);
      }
    } catch (err) {
      console.error('Error loading lesson:', err);
      toast({ title: 'Error loading lesson', variant: 'destructive' });
      navigate('/admin/standard-playbook');
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

  // Quiz question management
  const addQuestion = () => {
    setQuizQuestions(prev => [
      ...prev,
      {
        id: `q_${Date.now()}`,
        question: '',
        options: ['', '', '', ''],
        correct_index: 0,
      },
    ]);
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    setQuizQuestions(prev =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuizQuestions(prev =>
      prev.map((q, i) => {
        if (i === questionIndex) {
          const newOptions = [...q.options];
          newOptions[optionIndex] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const removeQuestion = (index: number) => {
    setQuizQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!slug.trim()) {
      toast({ title: 'Slug is required', variant: 'destructive' });
      return;
    }
    if (!moduleId) {
      toast({ title: 'Module is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Filter out empty documents
      const validDocuments = documents.filter(d => d.url.trim());
      
      const lessonData = {
        module_id: moduleId,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        video_url: videoUrl.trim() || null,
        content_html: contentHtml.trim() || null,
        documents_json: validDocuments,
        estimated_minutes: estimatedMinutes,
        has_quiz: hasQuiz,
      };

      let savedLessonId = lessonId;

      if (isNew) {
        // Get current lesson count for display_order
        const { count } = await supabase
          .from('sp_lessons')
          .select('*', { count: 'exact', head: true })
          .eq('module_id', moduleId);

        const { data, error } = await supabase
          .from('sp_lessons')
          .insert({
            ...lessonData,
            display_order: count || 0,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            toast({ title: 'A lesson with this slug already exists', variant: 'destructive' });
            return;
          }
          throw error;
        }

        savedLessonId = data.id;
        toast({ title: 'Lesson created!' });
      } else {
        const { error } = await supabase
          .from('sp_lessons')
          .update(lessonData)
          .eq('id', lessonId);

        if (error) throw error;
        toast({ title: 'Lesson saved!' });
      }

      // Save quiz if has_quiz is true
      if (hasQuiz && savedLessonId) {
        // Upsert quiz
        const { error: quizError } = await supabase
          .from('sp_quizzes')
          .upsert({
            lesson_id: savedLessonId,
            questions_json: quizQuestions,
          }, {
            onConflict: 'lesson_id',
          });

        if (quizError) {
          console.error('Error saving quiz:', quizError);
          toast({ title: 'Warning: Quiz may not have saved', variant: 'destructive' });
        }
      }

      navigate(`/admin/standard-playbook/module/${moduleId}`);
    } catch (err) {
      console.error('Error saving lesson:', err);
      toast({ title: 'Error saving lesson', variant: 'destructive' });
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
            onClick={() => navigate(`/admin/standard-playbook/module/${moduleId}`)}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Back to {moduleName || 'Module'}
          </Button>
          <h1 className="text-2xl font-medium">
            {isNew ? 'New Lesson' : `Edit: ${name}`}
          </h1>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" strokeWidth={1.5} />
          )}
          {saving ? 'Saving...' : 'Save Lesson'}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g., Introduction to Sales"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="e.g., intro-to-sales"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of this lesson"
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="minutes">Estimated Time (minutes)</Label>
              <Input
                id="minutes"
                type="number"
                value={estimatedMinutes}
                onChange={e => setEstimatedMinutes(parseInt(e.target.value) || 10)}
                className="mt-1 w-32"
                min={1}
              />
            </div>
          </CardContent>
        </Card>

        {/* Video */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video
            </CardTitle>
            <CardDescription>
              Paste a YouTube or Loom video URL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or https://www.loom.com/share/..."
            />
            {videoUrl && (
              <p className="text-xs text-muted-foreground mt-2">
                Video will be embedded in the lesson
              </p>
            )}
          </CardContent>
        </Card>

        {/* Rich Text Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Lesson Content
            </CardTitle>
            <CardDescription>
              Add written content below the video (supports basic HTML)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={contentHtml}
              onChange={e => setContentHtml(e.target.value)}
              placeholder="Write your lesson content here... You can use basic HTML tags like <b>, <i>, <ul>, <li>, <h3>, etc."
              rows={8}
            />
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileUp className="h-5 w-5" />
                  Downloadable Documents
                </CardTitle>
                <CardDescription>
                  Add PDFs or documents for users to download
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDocuments(prev => [...prev, { id: `doc_${Date.now()}`, url: '', name: '' }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Document
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No documents added. Click "Add Document" to add one.
              </p>
            ) : (
              <div className="space-y-4">
                {documents.map((doc, index) => (
                  <div key={doc.id} className="flex gap-3 items-start border border-border/50 rounded-lg p-3">
                    <div className="flex-1 space-y-3">
                      <div>
                        <Label>Document URL</Label>
                        <Input
                          value={doc.url}
                          onChange={e => {
                            const newDocs = [...documents];
                            newDocs[index] = { ...doc, url: e.target.value };
                            setDocuments(newDocs);
                          }}
                          placeholder="https://... (URL to PDF or document)"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Display Name</Label>
                        <Input
                          value={doc.name}
                          onChange={e => {
                            const newDocs = [...documents];
                            newDocs[index] = { ...doc, name: e.target.value };
                            setDocuments(newDocs);
                          }}
                          placeholder="e.g., Sales Script Template.pdf"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive mt-6"
                      onClick={() => setDocuments(prev => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quiz */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Quiz
                </CardTitle>
                <CardDescription>
                  Multiple choice questions (optional) + 3 standard reflection questions
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="hasQuiz">Enable Quiz</Label>
                <Switch
                  id="hasQuiz"
                  checked={hasQuiz}
                  onCheckedChange={setHasQuiz}
                />
              </div>
            </div>
          </CardHeader>
          {hasQuiz && (
            <CardContent className="space-y-6">
              {/* Info about standard questions */}
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Standard Reflection Questions (always included):</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>What was your biggest takeaway from the lesson?</li>
                  <li>How will you immediately take action on that takeaway?</li>
                  <li>What is the result you will see to know you completed this as you desire?</li>
                </ol>
              </div>

              {/* Multiple choice questions */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label>Multiple Choice Questions (optional)</Label>
                  <Button variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Question
                  </Button>
                </div>

                {quizQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No multiple choice questions. Click "Add Question" to create one, or leave empty for reflection-only quiz.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {quizQuestions.map((q, qIndex) => (
                      <div key={q.id} className="border border-border/50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                            <span className="text-sm font-medium">Question {qIndex + 1}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeQuestion(qIndex)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <Textarea
                            value={q.question}
                            onChange={e => updateQuestion(qIndex, { question: e.target.value })}
                            placeholder="Enter your question..."
                            rows={2}
                          />

                          <div className="grid grid-cols-2 gap-2">
                            {q.options.map((opt, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct_${q.id}`}
                                  checked={q.correct_index === optIndex}
                                  onChange={() => updateQuestion(qIndex, { correct_index: optIndex })}
                                  className="h-4 w-4"
                                />
                                <Input
                                  value={opt}
                                  onChange={e => updateOption(qIndex, optIndex, e.target.value)}
                                  placeholder={`Option ${optIndex + 1}`}
                                  className="flex-1"
                                />
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Select the radio button next to the correct answer
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
