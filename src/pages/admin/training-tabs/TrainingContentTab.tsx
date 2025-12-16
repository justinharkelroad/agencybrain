import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Edit, Plus, Trash2, ArrowLeft, Download, FileIcon, Upload, X, ImageIcon } from "lucide-react";
import { useTrainingCategories } from "@/hooks/useTrainingCategories";
import { useTrainingModules } from "@/hooks/useTrainingModules";
import { useTrainingLessons } from "@/hooks/useTrainingLessons";
import { useTrainingAttachments } from "@/hooks/useTrainingAttachments";
import { useTrainingQuizzes } from "@/hooks/useTrainingQuizzes";
import { AttachmentUploader } from "@/components/training/AttachmentUploader";
import { QuizBuilder } from "@/components/training/QuizBuilder";

interface TrainingContentTabProps {
  agencyId: string;
}

export function TrainingContentTab({ agencyId }: TrainingContentTabProps) {
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
  const [lessonTab, setLessonTab] = useState('basic');
  const [lessonForm, setLessonForm] = useState({
    name: '',
    video_platform: 'youtube',
    video_url: '',
    content_html: '',
    description: '',
    sort_order: 0,
    is_active: true,
    thumbnail_url: '',
  });
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'module' | 'lesson', id: string, name: string } | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<{
    modules: number;
    lessons: number;
    quizzes: number;
    quizAttempts: number;
    lessonProgress: number;
    assignments: number;
  } | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);

  // Hooks
  const { categories, createCategory, updateCategory, deleteCategory, isCreating: isCreatingCategory, isUpdating: isUpdatingCategory } = useTrainingCategories(agencyId);
  const { modules, createModule, updateModule, deleteModule, isCreating: isCreatingModule, isUpdating: isUpdatingModule } = useTrainingModules(selectedCategoryId || undefined);
  const { lessons, createLesson, createLessonAsync, updateLesson, deleteLesson, isCreating: isCreatingLesson, isUpdating: isUpdatingLesson } = useTrainingLessons(selectedModuleId || undefined);
  const { attachments, deleteAttachment, getDownloadUrl } = useTrainingAttachments(editingLesson?.id, agencyId);
  const { quizzes, createQuizWithQuestions, deleteQuiz, isCreating: isCreatingQuiz } = useTrainingQuizzes(editingLesson?.id, agencyId);
  
  // Ref to prevent duplicate lesson creation race condition
  const isSavingLessonRef = useRef(false);

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

  // Thumbnail upload handler
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    setUploadingThumbnail(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `training-thumbnails/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('training-assets')
        .upload(filePath, file);
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload image');
        return;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('training-assets')
        .getPublicUrl(filePath);
      
      setLessonForm(prev => ({ ...prev, thumbnail_url: publicUrl }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingThumbnail(false);
    }
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
    
    // Prevent duplicate creation if auto-save is in progress
    if (isSavingLessonRef.current) return;

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
      thumbnail_url: '',
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
        thumbnail_url: lesson.thumbnail_url || '',
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
        thumbnail_url: '',
      });
    }
    setLessonTab('basic');
    setLessonDialog(true);
  };

  // Tab change handler for lesson dialog - auto-saves when switching to attachments/quiz
  const handleLessonTabChange = async (tab: string) => {
    if ((tab === 'attachments' || tab === 'quiz') && !editingLesson) {
      if (!lessonForm.name.trim()) {
        toast.error('Please enter a lesson name first');
        return;
      }
      
      // Prevent race condition with manual save button
      if (isSavingLessonRef.current) return;
      isSavingLessonRef.current = true;
      
      try {
        const savedLesson = await createLessonAsync({
          name: lessonForm.name,
          description: lessonForm.description || null,
          video_url: lessonForm.video_url || null,
          video_platform: lessonForm.video_platform || 'youtube',
          content_html: lessonForm.content_html || null,
          sort_order: lessons?.length || 0,
          is_active: lessonForm.is_active,
          agency_id: agencyId,
          module_id: selectedModuleId!,
        });
        setEditingLesson(savedLesson);
        toast.success('Lesson saved! You can now add attachments and quizzes.');
      } catch (error) {
        toast.error('Failed to save lesson');
        isSavingLessonRef.current = false;
        return;
      }
      isSavingLessonRef.current = false;
    }
    setLessonTab(tab);
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

  const confirmDelete = async (type: 'category' | 'module' | 'lesson', id: string, name: string) => {
    setDeleteTarget({ type, id, name });
    setDeleteImpact(null);
    setLoadingImpact(true);
    setDeleteDialog(true);

    try {
      let moduleIds: string[] = [];
      let lessonIds: string[] = [];
      let quizIds: string[] = [];
      let modulesCount = 0;
      let lessonsCount = 0;
      let quizzesCount = 0;

      if (type === 'category') {
        // Get all modules in category
        const { data: mods } = await supabase
          .from('training_modules')
          .select('id')
          .eq('category_id', id);
        moduleIds = mods?.map(m => m.id) || [];
        modulesCount = moduleIds.length;

        if (moduleIds.length > 0) {
          // Get all lessons in those modules
          const { data: lsns } = await supabase
            .from('training_lessons')
            .select('id')
            .in('module_id', moduleIds);
          lessonIds = lsns?.map(l => l.id) || [];
          lessonsCount = lessonIds.length;
        }
      } else if (type === 'module') {
        // Get all lessons in module
        const { data: lsns } = await supabase
          .from('training_lessons')
          .select('id')
          .eq('module_id', id);
        lessonIds = lsns?.map(l => l.id) || [];
        lessonsCount = lessonIds.length;
      } else {
        lessonIds = [id];
      }

      // Get quizzes for lessons
      if (lessonIds.length > 0) {
        const { data: qzs } = await supabase
          .from('training_quizzes')
          .select('id')
          .in('lesson_id', lessonIds);
        quizIds = qzs?.map(q => q.id) || [];
        quizzesCount = quizIds.length;
      }

      // Count quiz attempts that will be orphaned
      let quizAttemptsCount = 0;
      if (quizIds.length > 0) {
        const { count } = await supabase
          .from('training_quiz_attempts')
          .select('*', { count: 'exact', head: true })
          .in('quiz_id', quizIds);
        quizAttemptsCount = count || 0;
      }

      // Count lesson progress that will be orphaned
      let lessonProgressCount = 0;
      if (lessonIds.length > 0) {
        const { count } = await supabase
          .from('staff_lesson_progress')
          .select('*', { count: 'exact', head: true })
          .in('lesson_id', lessonIds);
        lessonProgressCount = count || 0;
      }

      // Count assignments
      let assignmentsCount = 0;
      if (type === 'category' && moduleIds.length > 0) {
        const { count } = await supabase
          .from('training_assignments')
          .select('*', { count: 'exact', head: true })
          .in('module_id', moduleIds);
        assignmentsCount = count || 0;
      } else if (type === 'module') {
        const { count } = await supabase
          .from('training_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('module_id', id);
        assignmentsCount = count || 0;
      }

      setDeleteImpact({
        modules: modulesCount,
        lessons: lessonsCount,
        quizzes: quizzesCount,
        quizAttempts: quizAttemptsCount,
        lessonProgress: lessonProgressCount,
        assignments: assignmentsCount,
      });
    } catch (error) {
      console.error('Error fetching deletion impact:', error);
    } finally {
      setLoadingImpact(false);
    }
  };

  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);
  const selectedModule = modules?.find(m => m.id === selectedModuleId);

  return (
    <div className="space-y-6">
      {/* Enhanced Breadcrumb Navigation */}
      <Card className="bg-muted/50">
        <CardContent className="py-3">
          <div className="flex items-center gap-3 text-sm flex-wrap">
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
              <div className="overflow-x-auto rounded-md border">
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
                            <Button size="sm" variant="flat" onClick={() => setSelectedCategoryId(category.id)}>
                              View Modules
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openCategoryDialog(category)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => confirmDelete('category', category.id, category.name)}>
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
              <div className="overflow-x-auto rounded-md border">
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
                            <Button size="sm" variant="flat" onClick={() => setSelectedModuleId(module.id)}>
                              View Lessons
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openModuleDialog(module)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => confirmDelete('module', module.id, module.name)}>
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

      {/* LESSONS VIEW (lowest tier) */}
      {selectedModuleId && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                <p className="text-sm mb-4">Create your first lesson to start adding training content</p>
                <Button onClick={() => openLessonDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Lesson
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
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
                        <TableCell>{lesson.video_url ? '✓' : '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openLessonDialog(lesson)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => confirmDelete('lesson', lesson.id, lesson.name)}>
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

      {/* Category Dialog */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Category name"
              />
            </div>
            <div>
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Category description"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={categoryForm.is_active}
                onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
            <Button onClick={handleSaveCategory} disabled={isCreatingCategory || isUpdatingCategory} className="w-full">
              {editingCategory ? 'Update' : 'Create'} Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Module Dialog */}
      <Dialog open={moduleDialog} onOpenChange={setModuleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModule ? 'Edit Module' : 'New Module'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mod-name">Name</Label>
              <Input
                id="mod-name"
                value={moduleForm.name}
                onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value })}
                placeholder="Module name"
              />
            </div>
            <div>
              <Label htmlFor="mod-desc">Description</Label>
              <Textarea
                id="mod-desc"
                value={moduleForm.description}
                onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                placeholder="Module description"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={moduleForm.is_active}
                onCheckedChange={(checked) => setModuleForm({ ...moduleForm, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
            <Button onClick={handleSaveModule} disabled={isCreatingModule || isUpdatingModule} className="w-full">
              {editingModule ? 'Update' : 'Create'} Module
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog - with Tabs */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLesson ? `Edit Lesson: ${editingLesson.name}` : 'New Lesson'}</DialogTitle>
          </DialogHeader>
          <Tabs value={lessonTab} onValueChange={handleLessonTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
              <TabsTrigger value="quiz">Quiz</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="lesson-name">Name</Label>
                <Input
                  id="lesson-name"
                  value={lessonForm.name}
                  onChange={(e) => setLessonForm({ ...lessonForm, name: e.target.value })}
                  placeholder="Lesson name"
                />
              </div>
              <div>
                <Label htmlFor="lesson-desc">Description</Label>
                <Textarea
                  id="lesson-desc"
                  value={lessonForm.description}
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                  placeholder="Lesson description"
                />
              </div>
              
              {/* Thumbnail Image */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Header Image
                </Label>
                <p className="text-sm text-muted-foreground">
                  Add a header image that displays above the video (optional)
                </p>
                
                {lessonForm.thumbnail_url ? (
                  <div className="relative">
                    <img 
                      src={lessonForm.thumbnail_url} 
                      alt="Lesson thumbnail" 
                      className="w-full max-h-48 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setLessonForm({ ...lessonForm, thumbnail_url: '' })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailUpload}
                      className="hidden"
                      id="thumbnail-upload"
                      disabled={uploadingThumbnail}
                    />
                    <label 
                      htmlFor="thumbnail-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      {uploadingThumbnail ? (
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {uploadingThumbnail ? 'Uploading...' : 'Click to upload header image'}
                      </span>
                      <span className="text-xs text-muted-foreground/70">PNG, JPG up to 5MB</span>
                    </label>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="video-platform">Video Platform</Label>
                  <Select
                    value={lessonForm.video_platform}
                    onValueChange={(v) => setLessonForm({ ...lessonForm, video_platform: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="vimeo">Vimeo</SelectItem>
                      <SelectItem value="loom">Loom</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="video-url">Video URL</Label>
                  <Input
                    id="video-url"
                    value={lessonForm.video_url}
                    onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="content-html">Lesson Content</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Supports plain text with line breaks, or HTML tags for formatting
                </p>
                <Textarea
                  id="content-html"
                  value={lessonForm.content_html}
                  onChange={(e) => setLessonForm({ ...lessonForm, content_html: e.target.value })}
                  placeholder="Enter lesson content...&#10;&#10;Use line breaks for paragraphs, or HTML like:&#10;<p>Paragraph</p>&#10;<ul><li>Bullet point</li></ul>"
                  className="font-mono text-sm min-h-[150px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={lessonForm.is_active}
                  onCheckedChange={(checked) => setLessonForm({ ...lessonForm, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
              <Button onClick={handleSaveLesson} disabled={isCreatingLesson || isUpdatingLesson} className="w-full">
                {editingLesson ? 'Update' : 'Create'} Lesson
              </Button>
            </TabsContent>
            <TabsContent value="attachments" className="mt-4">
              {editingLesson && (
                <div className="space-y-4">
                  <AttachmentUploader
                    lessonId={editingLesson.id}
                    agencyId={agencyId}
                  />
                  {attachments && attachments.length > 0 && (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>File Name</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attachments.map((att: any) => (
                            <TableRow key={att.id}>
                              <TableCell className="flex items-center gap-2">
                                <FileIcon className="h-4 w-4" />
                                {att.name}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="ghost" onClick={() => handleDownloadAttachment(att)}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleDeleteAttachment(att)}>
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
                </div>
              )}
            </TabsContent>
            <TabsContent value="quiz" className="mt-4">
              {editingLesson && (
                          <QuizBuilder
                            lessonId={editingLesson.id}
                            agencyId={agencyId}
                            onSave={handleQuizSave}
                          />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog with Impact Warning */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Delete {deleteTarget?.type === 'category' ? 'Category' : deleteTarget?.type === 'module' ? 'Module' : 'Lesson'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Are you sure you want to delete <span className="font-semibold">"{deleteTarget?.name}"</span>?
                </p>
                
                {loadingImpact ? (
                  <div className="text-center py-2 text-muted-foreground">
                    Calculating impact...
                  </div>
                ) : deleteImpact && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
                    <p className="font-medium text-destructive text-sm">This will permanently delete:</p>
                    <ul className="text-sm space-y-1 ml-4 list-disc">
                      {deleteTarget?.type === 'category' && deleteImpact.modules > 0 && (
                        <li>{deleteImpact.modules} module{deleteImpact.modules !== 1 ? 's' : ''}</li>
                      )}
                      {deleteImpact.lessons > 0 && (
                        <li>{deleteImpact.lessons} lesson{deleteImpact.lessons !== 1 ? 's' : ''}</li>
                      )}
                      {deleteImpact.quizzes > 0 && (
                        <li>{deleteImpact.quizzes} quiz{deleteImpact.quizzes !== 1 ? 'zes' : ''}</li>
                      )}
                      {deleteImpact.assignments > 0 && (
                        <li>{deleteImpact.assignments} staff assignment{deleteImpact.assignments !== 1 ? 's' : ''}</li>
                      )}
                    </ul>
                    
                    {(deleteImpact.quizAttempts > 0 || deleteImpact.lessonProgress > 0) && (
                      <div className="pt-2 border-t border-destructive/20">
                        <p className="font-medium text-amber-600 dark:text-amber-400 text-sm">Staff history will be preserved:</p>
                        <ul className="text-sm space-y-1 ml-4 list-disc text-muted-foreground">
                          {deleteImpact.quizAttempts > 0 && (
                            <li>{deleteImpact.quizAttempts} quiz attempt{deleteImpact.quizAttempts !== 1 ? 's' : ''} (with reflections & AI feedback)</li>
                          )}
                          {deleteImpact.lessonProgress > 0 && (
                            <li>{deleteImpact.lessonProgress} lesson completion record{deleteImpact.lessonProgress !== 1 ? 's' : ''}</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loadingImpact}
            >
              Delete {deleteTarget?.type}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
