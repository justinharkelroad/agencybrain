import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useStaffTrainingContent } from '@/hooks/useStaffTrainingContent';
import { useStaffTrainingProgress } from '@/hooks/useStaffTrainingProgress';
import { useUpdateTrainingProgress } from '@/hooks/useUpdateTrainingProgress';
import { supabase } from '@/integrations/supabase/client';
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
import { StaffTrainingComments } from '@/components/training/StaffTrainingComments';
import { BookOpen, CheckCircle, Circle, Video, LogOut, FileText, Download, ClipboardList, AlertCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, isPast } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';

export default function StaffTraining() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout, sessionToken } = useStaffAuth();
  const { data: contentData, isLoading: contentLoading } = useStaffTrainingContent(user?.agency_id);
  const { data: progressData, isLoading: progressLoading } = useStaffTrainingProgress();
  const updateProgress = useUpdateTrainingProgress();
  
  const [selectedLesson, setSelectedLesson] = useState<{
    id: string;
    title: string;
    content: string | null;
    video_url: string | null;
    thumbnail_url: string | null;
  } | null>(null);
  
  const [activeQuiz, setActiveQuiz] = useState<any>(null);

  // Get attachments and quizzes for selected lesson from content data
  const attachments = selectedLesson?.id ? (contentData?.attachmentsByLesson?.[selectedLesson.id] || []) : [];
  const quizzes = selectedLesson?.id ? (contentData?.quizzesByLesson?.[selectedLesson.id] || []) : [];

  // Debug logging for attachments and quizzes
  useEffect(() => {
    if (selectedLesson?.id && contentData) {
      console.log('Selected lesson ID:', selectedLesson.id);
      console.log('Attachments by lesson:', contentData.attachmentsByLesson);
      console.log('Quizzes by lesson:', contentData.quizzesByLesson);
      console.log('Filtered attachments:', attachments);
      console.log('Filtered quizzes:', quizzes);
    }
  }, [selectedLesson?.id, contentData, attachments, quizzes]);

  const isCompleted = (lessonId: string) => {
    return progressData?.progress?.some(p => p.lesson_id === lessonId && p.completed) || false;
  };

  const handleToggleComplete = (lessonId: string) => {
    const currentStatus = isCompleted(lessonId);
    updateProgress.mutate({ lessonId, completed: !currentStatus });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/staff/login');
  };

  const handleDownloadAttachment = async (attachment: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('get_training_attachment_url', {
        body: { 
          session_token: sessionToken,
          attachment_id: attachment.id 
        }
      });
      
      if (error) throw error;
      if (data?.url) {
        // Fetch the file as blob to bypass ad blockers
        const response = await fetch(data.url);
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Create download link
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = data.name || attachment.name || 'download.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Cleanup blob URL
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        
        toast.success('Download started');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file. Try disabling ad blocker.');
    }
  };

  const handleQuizComplete = () => {
    // Invalidate progress query to refresh completion status
    queryClient.invalidateQueries({ queryKey: ['staff-training-progress'] });
    setActiveQuiz(null);
    toast.success('Quiz completed! Lesson marked as complete.');
  };

  if (contentLoading || progressLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  // Handle no assignments state
  if (contentData?.no_assignments) {
    return (
      <div className="p-6">
        {/* Daily Scorecard Card - always show */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Daily Scorecard</CardTitle>
            <CardDescription>Submit your daily metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/staff/submit">
                <Send className="h-4 w-4 mr-2" />
                Submit Today's Numbers
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center justify-center text-center py-12">
          <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No training assigned yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Your administrator will assign training modules to you.
          </p>
        </div>
      </div>
    );
  }

  const categories = contentData?.categories || [];
  
  const totalLessons = categories.reduce((total, cat) => 
    total + cat.modules.reduce((modTotal, mod) => modTotal + mod.lessons.length, 0), 0
  );
  
  const completedLessons = progressData?.progress?.filter(p => p.completed).length || 0;

  const getDueDateBadge = (dueDate: string | null | undefined) => {
    if (!dueDate) return null;
    
    const due = new Date(dueDate);
    const daysUntilDue = differenceInDays(due, new Date());
    
    if (isPast(due)) {
      const daysOverdue = Math.abs(daysUntilDue);
      return (
        <Badge variant="destructive" className="ml-2">
          <AlertCircle className="h-3 w-3 mr-1" />
          Overdue by {daysOverdue} day{daysOverdue !== 1 ? 's' : ''}
        </Badge>
      );
    }
    
    if (daysUntilDue <= 3) {
      return (
        <Badge variant="destructive" className="ml-2">
          Due in {daysUntilDue} day{daysUntilDue !== 1 ? 's' : ''}
        </Badge>
      );
    }
    
    if (daysUntilDue <= 7) {
      return (
        <Badge variant="secondary" className="ml-2 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
          Due in {daysUntilDue} days
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="ml-2">
        Due in {daysUntilDue} days
      </Badge>
    );
  };

  return (
    <div className="p-6">
      {/* Daily Scorecard Card */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Daily Scorecard</CardTitle>
          <CardDescription>Submit your daily metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/staff/submit">
              <Send className="h-4 w-4 mr-2" />
              Submit Today's Numbers
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Progress Summary */}
      <div className="flex items-center gap-4 mb-6">
        <div className="text-sm">
          <span className="font-medium">Progress:</span>{' '}
          <span className="text-muted-foreground">{completedLessons} / {totalLessons} lessons</span>
        </div>
      </div>

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
                <ScrollArea className="h-[calc(100vh-250px)] min-h-[400px] max-h-[700px] pr-4">
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
                                    <div className="flex items-center flex-1">
                                      <span>{module.title}</span>
                                      {getDueDateBadge(module.due_date)}
                                    </div>
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
                  <CardTitle>{selectedLesson?.title || 'Select a lesson'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[calc(100vh-250px)] min-h-[400px] max-h-[700px]">
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
                        {/* Thumbnail Image - above video */}
                        {selectedLesson.thumbnail_url && (
                          <img 
                            src={selectedLesson.thumbnail_url}
                            alt={selectedLesson.title}
                            className="w-full rounded-lg object-cover"
                            style={{ maxHeight: '300px' }}
                          />
                        )}
                        
                        {selectedLesson.video_url && (
                          <VideoEmbed url={selectedLesson.video_url} />
                        )}
                        
                        {selectedLesson.content && (
                          <>
                            <Separator />
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              {/* Support both HTML and plain text with line breaks */}
                              {/<[^>]+>/.test(selectedLesson.content) ? (
                                <div dangerouslySetInnerHTML={{ __html: selectedLesson.content }} />
                              ) : (
                                <div className="whitespace-pre-wrap">{selectedLesson.content}</div>
                              )}
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

                        {/* Completion Section */}
                        {selectedLesson && (
                          <>
                            <Separator />
                            <div className="p-4 rounded-lg border bg-muted/30">
                              {quizzes.length > 0 ? (
                                // Has quiz - check if completed
                                isCompleted(selectedLesson.id) ? (
                                  <div className="flex items-center gap-3 text-green-600">
                                    <CheckCircle className="h-6 w-6 fill-green-600" />
                                    <div>
                                      <p className="font-semibold">Lesson Complete!</p>
                                      <p className="text-sm text-muted-foreground">You've finished this lesson</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 text-amber-600">
                                    <ClipboardList className="h-6 w-6" />
                                    <div>
                                      <p className="font-semibold">Quiz Required</p>
                                      <p className="text-sm text-muted-foreground">Complete the quiz above to finish this lesson</p>
                                    </div>
                                  </div>
                                )
                              ) : (
                                // No quiz - allow manual completion
                                isCompleted(selectedLesson.id) ? (
                                  <div className="flex items-center gap-3 text-green-600">
                                    <CheckCircle className="h-6 w-6 fill-green-600" />
                                    <div>
                                      <p className="font-semibold">Lesson Complete!</p>
                                      <p className="text-sm text-muted-foreground">You've finished this lesson</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-semibold">Ready to complete?</p>
                                      <p className="text-sm text-muted-foreground">Mark this lesson as done</p>
                                    </div>
                                    <Button 
                                      onClick={() => handleToggleComplete(selectedLesson.id)}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Mark Complete
                                    </Button>
                                  </div>
                                )
                              )}
                            </div>
                          </>
                        )}
                        
                        {!selectedLesson.content && !selectedLesson.video_url && attachments.length === 0 && quizzes.length === 0 && (
                          <p className="text-muted-foreground text-center py-8">
                            No content available for this lesson yet.
                          </p>
                        )}

                        {/* Community Discussion */}
                        {selectedLesson?.id && (
                          <StaffTrainingComments 
                            lessonId={selectedLesson.id} 
                            staffMember={{
                              id: user?.id || '',
                              name: user?.team_member_name || user?.display_name || 'Staff Member'
                            }}
                          />
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
  );
}
