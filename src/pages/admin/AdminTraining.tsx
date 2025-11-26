import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { BookOpen, Plus, Pencil, Trash2, Video, FileText, HelpCircle } from 'lucide-react';
import { useTrainingCategories } from '@/hooks/useTrainingCategories';
import { useTrainingLessons } from '@/hooks/useTrainingLessons';
import { useTrainingAttachments } from '@/hooks/useTrainingAttachments';
import { useTrainingQuizzes } from '@/hooks/useTrainingQuizzes';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VideoEmbed } from '@/components/training/VideoEmbed';
import { AttachmentUploader } from '@/components/training/AttachmentUploader';
import { QuizBuilder, QuizData } from '@/components/training/QuizBuilder';

export default function AdminTraining() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyLoading, setAgencyLoading] = useState(true);

  useEffect(() => {
    const fetchAgencyId = async () => {
      if (!user) {
        setAgencyLoading(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();
      if (data) setAgencyId(data.agency_id);
      setAgencyLoading(false);
    };
    fetchAgencyId();
  }, [user]);

  // Categories
  const { categories, createCategory, updateCategory, deleteCategory, isCreating: isCreatingCategory } = useTrainingCategories(agencyId || undefined);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', sort_order: 0, is_active: true });

  // Lessons
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const { lessons, createLesson, updateLesson, deleteLesson, isCreating: isCreatingLesson } = useTrainingLessons(selectedCategoryId);
  const [lessonDialog, setLessonDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [lessonForm, setLessonForm] = useState({
    name: '',
    module_id: '',
    video_platform: 'youtube',
    video_url: '',
    content_html: '',
    description: '',
    estimated_duration_minutes: 0,
    sort_order: 0,
    is_active: true,
  });

  // Attachments and Quizzes for current lesson being edited
  const { attachments, deleteAttachment, isDeleting: isDeletingAttachment } = 
    useTrainingAttachments(editingLesson?.id, agencyId || undefined);
  
  const { quizzes, createQuizWithQuestions, deleteQuiz, isCreating: isCreatingQuiz, isDeleting: isDeletingQuiz } = 
    useTrainingQuizzes(editingLesson?.id, agencyId || undefined);

  // Delete confirmations
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'category' | 'lesson'; id: string } | null>(null);

  // Show loading spinner while fetching agency
  if (agencyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only redirect if user or agencyId is truly missing after loading
  if (!user || !agencyId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Category handlers
  const handleSaveCategory = () => {
    if (editingCategory) {
      updateCategory({ id: editingCategory.id, updates: categoryForm });
    } else {
      createCategory({ ...categoryForm, agency_id: agencyId! });
    }
    setCategoryDialog(false);
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '', sort_order: 0, is_active: true });
  };

  const openCategoryDialog = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        sort_order: category.sort_order || 0,
        is_active: category.is_active !== false,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', sort_order: categories?.length || 0, is_active: true });
    }
    setCategoryDialog(true);
  };

  // Lesson handlers
  const handleSaveLesson = () => {
    if (editingLesson) {
      updateLesson({ id: editingLesson.id, updates: lessonForm });
    } else {
      createLesson({ ...lessonForm, agency_id: agencyId!, module_id: selectedCategoryId });
    }
    setLessonDialog(false);
    setEditingLesson(null);
    setLessonForm({
      name: '',
      module_id: '',
      video_platform: 'youtube',
      video_url: '',
      content_html: '',
      description: '',
      estimated_duration_minutes: 0,
      sort_order: 0,
      is_active: true,
    });
  };

  const openLessonDialog = (lesson?: any) => {
    if (lesson) {
      setEditingLesson(lesson);
      setLessonForm({
        name: lesson.name,
        module_id: lesson.module_id,
        video_platform: lesson.video_platform || 'youtube',
        video_url: lesson.video_url || '',
        content_html: lesson.content_html || '',
        description: lesson.description || '',
        estimated_duration_minutes: lesson.estimated_duration_minutes || 0,
        sort_order: lesson.sort_order || 0,
        is_active: lesson.is_active !== false,
      });
    } else {
      setEditingLesson(null);
      setLessonForm({
        name: '',
        module_id: selectedCategoryId,
        video_platform: 'youtube',
        video_url: '',
        content_html: '',
        description: '',
        estimated_duration_minutes: 0,
        sort_order: lessons?.length || 0,
        is_active: true,
      });
    }
    setLessonDialog(true);
  };

  const handleQuizSave = (quizData: QuizData) => {
    if (!editingLesson?.id || !agencyId) return;
    createQuizWithQuestions({
      quiz: {
        lesson_id: editingLesson.id,
        agency_id: agencyId,
        name: quizData.name,
        description: quizData.description,
      },
      questions: quizData.questions,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            Training System Management
          </h1>
          <p className="text-muted-foreground">Manage modules and lessons for your training program</p>
        </div>

        <div className="grid gap-8">
          {/* Categories Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Training Modules</CardTitle>
                  <CardDescription>Organize lessons into modules</CardDescription>
                </div>
                <Button onClick={() => openCategoryDialog()} disabled={isCreatingCategory}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Module
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories?.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-muted-foreground">{cat.description}</TableCell>
                      <TableCell>{cat.sort_order}</TableCell>
                      <TableCell>
                        <Badge variant={cat.is_active ? 'default' : 'secondary'}>
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openCategoryDialog(cat)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'category', id: cat.id })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!categories || categories.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No modules yet. Create your first training module.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Lessons Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Training Lessons</CardTitle>
                  <CardDescription>Manage video lessons and content</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a module" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => openLessonDialog()} disabled={!selectedCategoryId || isCreatingLesson}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lesson
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedCategoryId ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lesson Name</TableHead>
                      <TableHead>Video</TableHead>
                      <TableHead>Duration (min)</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lessons?.map((lesson) => (
                      <TableRow key={lesson.id}>
                        <TableCell className="font-medium">{lesson.name}</TableCell>
                        <TableCell>
                          {lesson.video_url && (
                            <Badge variant="outline">
                              <Video className="h-3 w-3 mr-1" />
                              {lesson.video_platform}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{lesson.estimated_duration_minutes}</TableCell>
                        <TableCell>{lesson.sort_order}</TableCell>
                        <TableCell>
                          <Badge variant={lesson.is_active ? 'default' : 'secondary'}>
                            {lesson.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openLessonDialog(lesson)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'lesson', id: lesson.id })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!lessons || lessons.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No lessons in this module yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Select a module to view its lessons
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category Dialog */}
        <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Edit Module' : 'Create Module'}</DialogTitle>
              <DialogDescription>Configure training module details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Module Name</Label>
                <Input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g., Getting Started"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Brief description of this module"
                />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={categoryForm.sort_order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={categoryForm.is_active}
                  onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCategoryDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveCategory} disabled={!categoryForm.name}>
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lesson Dialog */}
        <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingLesson ? 'Edit Lesson' : 'Create Lesson'}</DialogTitle>
              <DialogDescription>Configure lesson content, video, attachments, and quizzes</DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">
                  <Video className="h-4 w-4 mr-2" />
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="attachments" disabled={!editingLesson}>
                  <FileText className="h-4 w-4 mr-2" />
                  Attachments
                </TabsTrigger>
                <TabsTrigger value="quiz" disabled={!editingLesson}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Quiz
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div>
                  <Label>Lesson Name</Label>
                  <Input
                    value={lessonForm.name}
                    onChange={(e) => setLessonForm({ ...lessonForm, name: e.target.value })}
                    placeholder="e.g., Introduction to the Platform"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={lessonForm.description}
                    onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                    placeholder="Brief lesson description"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Video Platform</Label>
                    <Select value={lessonForm.video_platform} onValueChange={(v) => setLessonForm({ ...lessonForm, video_platform: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="vimeo">Vimeo</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={lessonForm.estimated_duration_minutes}
                      onChange={(e) => setLessonForm({ ...lessonForm, estimated_duration_minutes: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Video URL</Label>
                  <Input
                    value={lessonForm.video_url}
                    onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                  {lessonForm.video_url && (
                    <div className="mt-3">
                      <Label className="text-sm text-muted-foreground">Preview</Label>
                      <div className="mt-2">
                        <VideoEmbed url={lessonForm.video_url} />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Lesson Content (HTML)</Label>
                  <Textarea
                    value={lessonForm.content_html}
                    onChange={(e) => setLessonForm({ ...lessonForm, content_html: e.target.value })}
                    placeholder="Additional lesson content..."
                    rows={6}
                  />
                </div>
                <div>
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    value={lessonForm.sort_order}
                    onChange={(e) => setLessonForm({ ...lessonForm, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={lessonForm.is_active}
                    onCheckedChange={(checked) => setLessonForm({ ...lessonForm, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="space-y-4 mt-4">
                {editingLesson ? (
                  <>
                    <AttachmentUploader lessonId={editingLesson.id} agencyId={agencyId!} />
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Current Attachments</Label>
                      {attachments && attachments.length > 0 ? (
                        attachments.map((att) => (
                          <Card key={att.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{att.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {att.is_external_link ? "External Link" : "Uploaded File"}
                                  {att.file_size_bytes && ` • ${(att.file_size_bytes / 1024).toFixed(1)} KB`}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteAttachment({
                                  id: att.id,
                                  fileUrl: att.file_url,
                                  isExternal: att.is_external_link ?? false
                                })}
                                disabled={isDeletingAttachment}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </Card>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No attachments yet</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Save the lesson first to add attachments</p>
                )}
              </TabsContent>

              <TabsContent value="quiz" className="space-y-4 mt-4">
                {editingLesson ? (
                  <>
                    {quizzes && quizzes.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Existing Quizzes</Label>
                        {quizzes.map((quiz) => (
                          <Card key={quiz.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{quiz.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {quiz.questions?.length || 0} question{quiz.questions?.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteQuiz(quiz.id)}
                                disabled={isDeletingQuiz}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Create New Quiz</Label>
                      <QuizBuilder 
                        lessonId={editingLesson.id} 
                        agencyId={agencyId!} 
                        onSave={handleQuizSave} 
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Save the lesson first to add quizzes</p>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setLessonDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveLesson} disabled={!lessonForm.name}>
                {editingLesson ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this {deleteConfirm?.type}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConfirm?.type === 'category') deleteCategory(deleteConfirm.id);
                  if (deleteConfirm?.type === 'lesson') deleteLesson(deleteConfirm.id);
                  setDeleteConfirm(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
