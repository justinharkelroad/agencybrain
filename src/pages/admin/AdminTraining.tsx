import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Edit, Plus, Trash2, ArrowRight, ArrowLeft, Download, FileIcon } from "lucide-react";
import { useTrainingCategories } from "@/hooks/useTrainingCategories";
import { useTrainingModules } from "@/hooks/useTrainingModules";
import { useTrainingLessons } from "@/hooks/useTrainingLessons";
import { useTrainingAttachments } from "@/hooks/useTrainingAttachments";
import { useTrainingQuizzes } from "@/hooks/useTrainingQuizzes";
import { AttachmentUploader } from "@/components/training/AttachmentUploader";
import { QuizBuilder } from "@/components/training/QuizBuilder";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function AdminTraining() {
  const navigate = useNavigate();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  
  // Navigation state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  
  // Category state
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    sort_order: 0,
    is_active: true,
  });

  // Module state
  const [moduleDialog, setModuleDialog] = useState(false);
  const [editingModule, setEditingModule] = useState<any>(null);
  const [moduleForm, setModuleForm] = useState({
    name: '',
    description: '',
    sort_order: 0,
    is_active: true,
  });

  // Lesson state
  const [lessonDialog, setLessonDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [lessonForm, setLessonForm] = useState({
    name: '',
    video_platform: 'youtube',
    video_url: '',
    content_html: '',
    description: '',
    sort_order: 0,
    is_active: true,
  });

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'module' | 'lesson', id: string } | null>(null);

  // Hooks
  const { categories, createCategory, updateCategory, deleteCategory, isCreating: isCreatingCategory, isUpdating: isUpdatingCategory } = useTrainingCategories(agencyId || undefined);
  const { modules, createModule, updateModule, deleteModule, isCreating: isCreatingModule, isUpdating: isUpdatingModule } = useTrainingModules(selectedCategoryId || undefined);
  const { lessons, createLesson, updateLesson, deleteLesson, isCreating: isCreatingLesson, isUpdating: isUpdatingLesson } = useTrainingLessons(selectedModuleId || undefined);
  const { attachments, deleteAttachment, getDownloadUrl } = useTrainingAttachments(editingLesson?.id, agencyId || undefined);
  const { quizzes, createQuizWithQuestions, deleteQuiz, isCreating: isCreatingQuiz } = useTrainingQuizzes(editingLesson?.id, agencyId || undefined);

  // Attachment handlers
  const handleDownloadAttachment = async (attachment: any) => {
    try {
      const url = await getDownloadUrl(attachment.file_url, attachment.is_external_link || false);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleDeleteAttachment = (attachment: any) => {
    deleteAttachment({
      id: attachment.id,
      fileUrl: attachment.file_url,
      isExternal: attachment.is_external_link || false,
    });
  };

  // Quiz save handler
  const handleQuizSave = async (quizData: any) => {
    if (!editingLesson || !agencyId) {
      console.error('Missing lesson or agency ID');
      return;
    }
    
    // Delete existing quiz first if it exists (unique constraint on lesson_id)
    if (quizzes && quizzes.length > 0) {
      const { error } = await supabase
        .from('training_quizzes')
        .delete()
        .eq('id', quizzes[0].id);
      
      if (error) {
        console.error('Failed to delete existing quiz:', error);
        toast.error('Failed to update quiz');
        return;
      }
    }
    
    createQuizWithQuestions({
      quiz: {
        lesson_id: editingLesson.id,
        agency_id: agencyId,
        name: quizData.name,
        description: quizData.description || '',
        is_active: true,
      },
      questions: quizData.questions,
    });
  };

  // Fetch agency ID
  useEffect(() => {
    async function fetchAgencyId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/dashboard');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) {
        navigate('/dashboard');
        return;
      }

      setAgencyId(profile.agency_id);
    }

    fetchAgencyId();
  }, [navigate]);

  // Category handlers
  const handleSaveCategory = () => {
    if (!agencyId) return;

    if (editingCategory) {
      updateCategory({ id: editingCategory.id, updates: categoryForm });
    } else {
      createCategory({ ...categoryForm, agency_id: agencyId });
    }
    setCategoryDialog(false);
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '', sort_order: 0, is_active: true });
  };

  const openCategoryDialog = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name || '',
        description: category.description || '',
        sort_order: category.sort_order || 0,
        is_active: category.is_active !== false,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        description: '',
        sort_order: categories?.length || 0,
        is_active: true,
      });
    }
    setCategoryDialog(true);
  };

  // Module handlers
  const handleSaveModule = () => {
    if (!agencyId || !selectedCategoryId) return;

    if (editingModule) {
      updateModule({ id: editingModule.id, updates: moduleForm });
    } else {
      createModule({ ...moduleForm, agency_id: agencyId, category_id: selectedCategoryId });
    }
    setModuleDialog(false);
    setEditingModule(null);
    setModuleForm({ name: '', description: '', sort_order: 0, is_active: true });
  };

  const openModuleDialog = (module?: any) => {
    if (module) {
      setEditingModule(module);
      setModuleForm({
        name: module.name || '',
        description: module.description || '',
        sort_order: module.sort_order || 0,
        is_active: module.is_active !== false,
      });
    } else {
      setEditingModule(null);
      setModuleForm({
        name: '',
        description: '',
        sort_order: modules?.length || 0,
        is_active: true,
      });
    }
    setModuleDialog(true);
  };

  // Lesson handlers
  const handleSaveLesson = () => {
    if (!agencyId || !selectedModuleId) return;

    if (editingLesson) {
      updateLesson({ id: editingLesson.id, updates: lessonForm });
    } else {
      createLesson({ ...lessonForm, agency_id: agencyId, module_id: selectedModuleId });
    }
    setLessonDialog(false);
    setEditingLesson(null);
    setLessonForm({
      name: '',
      video_platform: 'youtube',
      video_url: '',
      content_html: '',
      description: '',
      sort_order: 0,
      is_active: true,
    });
  };

  const openLessonDialog = (lesson?: any) => {
    if (lesson) {
      setEditingLesson(lesson);
      setLessonForm({
        name: lesson.name || '',
        video_platform: lesson.video_platform || 'youtube',
        video_url: lesson.video_url || '',
        content_html: lesson.content_html || '',
        description: lesson.description || '',
        sort_order: lesson.sort_order || 0,
        is_active: lesson.is_active !== false,
      });
    } else {
      setEditingLesson(null);
      setLessonForm({
        name: '',
        video_platform: 'youtube',
        video_url: '',
        content_html: '',
        description: '',
        sort_order: lessons?.length || 0,
        is_active: true,
      });
    }
    setLessonDialog(true);
  };

  // Delete handler
  const handleDelete = () => {
    if (!deleteTarget) return;

    switch (deleteTarget.type) {
      case 'category':
        deleteCategory(deleteTarget.id);
        if (selectedCategoryId === deleteTarget.id) {
          setSelectedCategoryId('');
          setSelectedModuleId('');
        }
        break;
      case 'module':
        deleteModule(deleteTarget.id);
        if (selectedModuleId === deleteTarget.id) {
          setSelectedModuleId('');
        }
        break;
      case 'lesson':
        deleteLesson(deleteTarget.id);
        break;
    }

    setDeleteDialog(false);
    setDeleteTarget(null);
  };

  const confirmDelete = (type: 'category' | 'module' | 'lesson', id: string) => {
    setDeleteTarget({ type, id });
    setDeleteDialog(true);
  };

  if (!agencyId) {
    return <LoadingSpinner />;
  }

  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);
  const selectedModule = modules?.find(m => m.id === selectedModuleId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Training System</h1>
        <p className="text-muted-foreground">Manage training categories, modules, and lessons</p>
      </div>

      {/* Enhanced Breadcrumb Navigation */}
      <Card className="bg-muted/50">
        <CardContent className="py-3">
          <div className="flex items-center gap-3 text-sm">
            <Button 
              variant={!selectedCategoryId ? "default" : "ghost"}
              size="sm"
              onClick={() => { setSelectedCategoryId(''); setSelectedModuleId(''); }}
            >
              📁 All Categories
            </Button>
            {selectedCategoryId && (
              <>
                <span className="text-muted-foreground">/</span>
                <Button 
                  variant={!selectedModuleId ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedModuleId('')}
                >
                  📦 {selectedCategory?.name}
                </Button>
              </>
            )}
            {selectedModuleId && (
              <>
                <span className="text-muted-foreground">/</span>
                <Button variant="default" size="sm" disabled>
                  📖 {selectedModule?.name}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CATEGORIES VIEW (top level) */}
      {!selectedCategoryId && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Training Categories</CardTitle>
                <CardDescription>Organize your training content into categories</CardDescription>
              </div>
              <Button onClick={() => openCategoryDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">No training categories yet</p>
                <p className="text-sm mb-4">Create your first category to start organizing training content</p>
                <Button onClick={() => openCategoryDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Category
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell>{category.description}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedCategoryId(category.id)}>
                              View Modules
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openCategoryDialog(category)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => confirmDelete('category', category.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODULES VIEW (middle tier) */}
      {selectedCategoryId && !selectedModuleId && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setSelectedCategoryId('')}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Category</p>
                  <CardTitle className="text-xl">{selectedCategory?.name}</CardTitle>
                  <CardDescription>
                    {modules.length} {modules.length === 1 ? 'module' : 'modules'} in this category
                  </CardDescription>
                </div>
              </div>
              <Button onClick={() => openModuleDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Module
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {modules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">No modules in this category yet</p>
                <p className="text-sm mb-4">Create your first module to start adding lessons</p>
                <Button onClick={() => openModuleDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Module
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.map((module) => (
                      <TableRow key={module.id}>
                        <TableCell className="font-medium">{module.name}</TableCell>
                        <TableCell>{module.description}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedModuleId(module.id)}>
                              View Lessons
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openModuleDialog(module)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => confirmDelete('module', module.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* LESSONS VIEW (bottom tier) */}
      {selectedModuleId && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setSelectedModuleId('')}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Module</p>
                  <CardTitle className="text-xl">{selectedModule?.name}</CardTitle>
                  <CardDescription>
                    {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'} in this module
                  </CardDescription>
                </div>
              </div>
              <Button onClick={() => openLessonDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Lesson
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lessons.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">No lessons in this module yet</p>
                <p className="text-sm mb-4">Add your first lesson with video content</p>
                <Button onClick={() => openLessonDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Lesson
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lesson Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Video</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lessons.map((lesson) => (
                      <TableRow key={lesson.id}>
                        <TableCell className="font-medium">{lesson.name}</TableCell>
                        <TableCell>{lesson.description}</TableCell>
                        <TableCell>
                          {lesson.video_url ? (
                            <Badge variant="outline" className="text-green-600">Has Video</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openLessonDialog(lesson)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => confirmDelete('lesson', lesson.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CATEGORY DIALOG */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category Name</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
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
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setCategoryDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveCategory} disabled={isCreatingCategory || isUpdatingCategory}>
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODULE DIALOG */}
      <Dialog open={moduleDialog} onOpenChange={setModuleDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingModule ? 'Edit Module' : 'Create Module'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Module Name</Label>
              <Input
                value={moduleForm.name}
                onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={moduleForm.description}
                onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={moduleForm.sort_order}
                onChange={(e) => setModuleForm({ ...moduleForm, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={moduleForm.is_active}
                onCheckedChange={(checked) => setModuleForm({ ...moduleForm, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setModuleDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveModule} disabled={isCreatingModule || isUpdatingModule}>
                {editingModule ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* LESSON DIALOG */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLesson ? 'Edit Lesson' : 'Create Lesson'}</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="attachments" disabled={!editingLesson}>Attachments</TabsTrigger>
              <TabsTrigger value="quiz" disabled={!editingLesson}>Quiz</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div>
                <Label>Lesson Name</Label>
                <Input
                  value={lessonForm.name}
                  onChange={(e) => setLessonForm({ ...lessonForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={lessonForm.description}
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Video Platform</Label>
                  <Select value={lessonForm.video_platform} onValueChange={(value) => setLessonForm({ ...lessonForm, video_platform: value })}>
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
              </div>
              <div>
                <Label>Video URL</Label>
                <Input
                  value={lessonForm.video_url}
                  onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <div>
                <Label>Content (HTML)</Label>
                <Textarea
                  value={lessonForm.content_html}
                  onChange={(e) => setLessonForm({ ...lessonForm, content_html: e.target.value })}
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
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setLessonDialog(false)}>Cancel</Button>
                <Button onClick={handleSaveLesson} disabled={isCreatingLesson || isUpdatingLesson}>
                  {editingLesson ? 'Update' : 'Create'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="attachments" className="space-y-4">
              {editingLesson && agencyId && (
                <>
                  <AttachmentUploader lessonId={editingLesson.id} agencyId={agencyId} maxSizeMB={25} />
                  
                  {/* Attachments List */}
                  {attachments.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Uploaded Files ({attachments.length})</h4>
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileIcon className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{attachment.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {attachment.file_size_bytes 
                                  ? `${(attachment.file_size_bytes / 1024 / 1024).toFixed(2)} MB`
                                  : attachment.is_external_link ? 'External Link' : 'Unknown size'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleDownloadAttachment(attachment)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteAttachment(attachment)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No attachments yet. Upload a file or add a link above.
                    </p>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="quiz">
              {editingLesson && agencyId && (
                <QuizBuilder 
                  lessonId={editingLesson.id} 
                  agencyId={agencyId} 
                  onSave={handleQuizSave}
                  initialData={quizzes && quizzes.length > 0 ? {
                    name: quizzes[0].name,
                    description: quizzes[0].description || "",
                    questions: quizzes[0].questions?.filter(q => !q.question_text.startsWith("What is the main takeaway") && !q.question_text.startsWith("Why do you feel")).map(q => ({
                      question_text: q.question_text,
                      question_type: q.question_type,
                      sort_order: q.sort_order || 0,
                      options: q.options?.map(o => ({
                        option_text: o.option_text,
                        is_correct: o.is_correct || false,
                        sort_order: o.sort_order || 0,
                      })) || [],
                    })) || [],
                  } : undefined}
                />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'category' && 'This will delete the category and all its modules and lessons. This action cannot be undone.'}
              {deleteTarget?.type === 'module' && 'This will delete the module and all its lessons. This action cannot be undone.'}
              {deleteTarget?.type === 'lesson' && 'This will permanently delete this lesson. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
