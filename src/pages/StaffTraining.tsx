import { useState, useEffect } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useStaffTrainingContent } from '@/hooks/useStaffTrainingContent';
import { useStaffTrainingProgress } from '@/hooks/useStaffTrainingProgress';
import { useUpdateTrainingProgress } from '@/hooks/useUpdateTrainingProgress';
import { useTrainingAttachments } from '@/hooks/useTrainingAttachments';
import { useTrainingQuizzes, TrainingQuiz } from '@/hooks/useTrainingQuizzes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { VideoEmbed } from '@/components/training/VideoEmbed';
import { QuizTaker } from '@/components/training/QuizTaker';
import { BookOpen, CheckCircle, Circle, Video, LogOut, FileText, Download, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

export default function StaffTraining() {
  const { user, logout, sessionToken } = useStaffAuth();
  const { data: contentData, isLoading: contentLoading } = useStaffTrainingContent(user?.agency_id);
  const { data: progressData, isLoading: progressLoading } = useStaffTrainingProgress();
  const updateProgress = useUpdateTrainingProgress();
  
  const [selectedLesson, setSelectedLesson] = useState<{
    id: string;
    title: string;
    content: string | null;
    video_url: string | null;
  } | null>(null);
  
  const [activeQuiz, setActiveQuiz] = useState<TrainingQuiz | null>(null);

  const { attachments, getDownloadUrl } = useTrainingAttachments(selectedLesson?.id);
  const { quizzes } = useTrainingQuizzes(selectedLesson?.id);

  const isCompleted = (lessonId: string) => {
    return progressData?.progress?.some(p => p.lesson_id === lessonId && p.completed) || false;
  };

  const handleToggleComplete = (lessonId: string) => {
    const currentStatus = isCompleted(lessonId);
    updateProgress.mutate({ lessonId, completed: !currentStatus });
  };

  const handleLogout = () => {
    logout();
  };

  const handleDownloadAttachment = async (attachment: any) => {
    try {
      const url = await getDownloadUrl(attachment.file_url, attachment.is_external_link || false);
      window.open(url, '_blank');
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleQuizComplete = () => {
    if (selectedLesson) {
      handleToggleComplete(selectedLesson.id);
    }
  };

  if (contentLoading || progressLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  const categories = contentData?.categories || [];
  
  const totalLessons = categories.reduce((total, cat) => 
    total + cat.modules.reduce((modTotal, mod) => modTotal + mod.lessons.length, 0), 0
  );
  
  const completedLessons = progressData?.progress?.filter(p => p.completed).length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Training Portal</h1>
              <p className="text-sm text-muted-foreground">Welcome, {user?.display_name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">Progress</p>
              <p className="text-xs text-muted-foreground">
                {completedLessons} / {totalLessons} lessons
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Training Content List */}
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Training Modules</CardTitle>
                <CardDescription>
                  Browse all available training content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No training content available yet.
                    </p>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {categories.map((category) => (
                        <AccordionItem key={category.id} value={category.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{category.name}</span>
                              <Badge variant="secondary" className="ml-2">
                                {category.modules.reduce((total, mod) => total + mod.lessons.length, 0)}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {category.description && (
                              <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
                            )}
                            <Accordion type="multiple" className="w-full">
                              {category.modules.map((module) => (
                                <AccordionItem key={module.id} value={module.id}>
                                  <AccordionTrigger className="hover:no-underline text-sm">
                                    <span>{module.title}</span>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    {module.description && (
                                      <p className="text-xs text-muted-foreground mb-2">{module.description}</p>
                                    )}
                                    <div className="space-y-1">
                                      {module.lessons.map((lesson) => (
                                         <div
                                          key={lesson.id}
                                          className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            console.log('Lesson clicked:', lesson);
                                            setSelectedLesson(lesson);
                                          }}
                                        >
                                          {isCompleted(lesson.id) ? (
                                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                          ) : (
                                            <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                          )}
                                          <span className="text-sm flex-1">{lesson.title}</span>
                                          {lesson.video_url && <Video className="h-3 w-3 text-muted-foreground" />}
                                        </div>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Lesson Viewer */}
          <div className="md:col-span-2">
            {activeQuiz ? (
              <QuizTaker 
                quiz={activeQuiz} 
                sessionToken={sessionToken || ''}
                onBack={() => setActiveQuiz(null)}
                onComplete={handleQuizComplete}
              />
            ) : (
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle>{selectedLesson?.title || 'Select a lesson'}</CardTitle>
                      {selectedLesson && (
                        <div className="flex items-center gap-2 mt-2">
                          <Checkbox
                            id="complete-lesson"
                            checked={isCompleted(selectedLesson.id)}
                            onCheckedChange={() => handleToggleComplete(selectedLesson.id)}
                          />
                          <label
                            htmlFor="complete-lesson"
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            Mark as complete
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    {!selectedLesson ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-20">
                        <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No lesson selected</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Select a lesson from the list to view its content
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {selectedLesson.video_url && (
                          <VideoEmbed url={selectedLesson.video_url} />
                        )}
                        
                        {selectedLesson.content && (
                          <>
                            <Separator />
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <div dangerouslySetInnerHTML={{ __html: selectedLesson.content }} />
                            </div>
                          </>
                        )}

                        {/* Attachments Section */}
                        {attachments.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <h3 className="font-semibold mb-3 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Attachments
                              </h3>
                              <div className="space-y-2">
                                {attachments.map((attachment) => (
                                  <Button
                                    key={attachment.id}
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => handleDownloadAttachment(attachment)}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    {attachment.name}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Quiz Section */}
                        {quizzes.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <h3 className="font-semibold mb-3 flex items-center gap-2">
                                <ClipboardList className="h-4 w-4" />
                                Quiz
                              </h3>
                              {quizzes.map((quiz) => (
                                <div key={quiz.id} className="p-4 border rounded-lg">
                                  <p className="font-medium">{quiz.name}</p>
                                  {quiz.description && (
                                    <p className="text-sm text-muted-foreground mt-1">{quiz.description}</p>
                                  )}
                                  <Button className="mt-3" onClick={() => setActiveQuiz(quiz)}>
                                    Take Quiz
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        
                        {!selectedLesson.content && !selectedLesson.video_url && attachments.length === 0 && quizzes.length === 0 && (
                          <p className="text-muted-foreground text-center py-8">
                            No content available for this lesson yet.
                          </p>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
