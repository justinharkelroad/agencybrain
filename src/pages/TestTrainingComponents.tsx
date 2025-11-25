import { useState, useEffect } from "react";
import { SidebarLayout } from "@/components/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoEmbed } from "@/components/training/VideoEmbed";
import { AttachmentUploader } from "@/components/training/AttachmentUploader";
import { QuizBuilder, QuizData } from "@/components/training/QuizBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTrainingQuizzes } from "@/hooks/useTrainingQuizzes";
import { useTrainingAttachments } from "@/hooks/useTrainingAttachments";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export default function TestTrainingComponents() {
  const [videoUrl, setVideoUrl] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [testLessonId, setTestLessonId] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string>("");
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const setupTestData = async () => {
      if (!user?.id) return;
      
      setIsCreatingLesson(true);

      // Get agency ID
      const { data, error } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching agency_id:", error);
        toast.error("Failed to load agency information");
        setIsCreatingLesson(false);
        return;
      }

      if (!data?.agency_id) {
        setIsCreatingLesson(false);
        return;
      }
      
      setAgencyId(data.agency_id);

      // Check for existing test lesson
      const { data: existingLesson } = await supabase
        .from("training_lessons")
        .select("id")
        .eq("agency_id", data.agency_id)
        .eq("title", "Test Lesson")
        .maybeSingle();

      if (existingLesson) {
        setTestLessonId(existingLesson.id);
        setIsCreatingLesson(false);
        return;
      }

      // Create test lesson if it doesn't exist
      const { data: newLesson, error: createError } = await supabase
        .from("training_lessons")
        .insert({
          agency_id: data.agency_id,
          category_id: "511e1fba-56f5-48a5-9d87-ab77cec768a2",
          title: "Test Lesson",
          description: "Auto-generated test lesson for component testing",
          order_index: 9999
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Error creating test lesson:", createError);
        toast.error("Failed to create test lesson");
      } else if (newLesson) {
        setTestLessonId(newLesson.id);
        toast.success("Test lesson created");
      }
      
      setIsCreatingLesson(false);
    };

    setupTestData();
  }, [user]);

  const { quizzes, createQuizWithQuestions } = useTrainingQuizzes(testLessonId, agencyId);
  const { attachments } = useTrainingAttachments(testLessonId, agencyId);

  const testVideoUrls = [
    { platform: "YouTube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    { platform: "Vimeo", url: "https://vimeo.com/576326154" },
    { platform: "Loom", url: "https://www.loom.com/share/bcb9bde7cda144bfa13cd98491b970f6" },
    { platform: "Wistia", url: "https://hfiagencies.wistia.com/medias/1bz6nrl5ip" },
  ];

  const handleQuizSave = async (quizData: QuizData) => {
    if (!agencyId) {
      toast.error("Agency ID not loaded");
      return;
    }

    createQuizWithQuestions({
      quiz: {
        agency_id: agencyId,
        lesson_id: testLessonId,
        name: quizData.name,
        description: quizData.description,
        is_active: true,
      },
      questions: quizData.questions,
    });
  };

  const handleQueryDatabase = async () => {
    try {
      // Query quizzes with questions and options
      const { data: quizzesData, error: quizzesError } = await supabase
        .from("training_quizzes")
        .select(`
          *,
          training_quiz_questions (
            *,
            training_quiz_options (*)
          )
        `)
        .eq("lesson_id", testLessonId);

      if (quizzesError) throw quizzesError;

      console.log("Saved Quizzes with Questions:", quizzesData);
      toast.success(`Found ${quizzesData?.length || 0} quizzes in database`);

      // Query attachments
      const { data: attachmentData, error: attachmentError } = await supabase
        .from("training_attachments")
        .select("*")
        .eq("lesson_id", testLessonId);

      if (attachmentError) throw attachmentError;

      console.log("Saved Attachments:", attachmentData);
      toast.success(`Found ${attachmentData?.length || 0} attachments in database`);

      // Check storage bucket
      const { data: storageFiles, error: storageError } = await supabase.storage
        .from("training-files")
        .list(testLessonId);

      if (storageError) {
        console.warn("Storage check:", storageError.message);
      } else {
        console.log("Storage Files:", storageFiles);
        toast.success(`Found ${storageFiles?.length || 0} files in training-files bucket`);
      }
    } catch (error: any) {
      console.error("Database query error:", error);
      toast.error(error.message || "Failed to query database");
    }
  };

  if (!agencyId || !testLessonId || isCreatingLesson) {
    return (
      <SidebarLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {isCreatingLesson ? "Setting up test lesson..." : "Loading test environment..."}
            </p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Training Components Test Page</h1>
          <p className="text-muted-foreground">
            Test all Phase 4 shared components: VideoEmbed, AttachmentUploader, and QuizBuilder
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Test Lesson ID: {testLessonId}
          </p>
        </div>

        <Tabs defaultValue="video" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="video">Video Embed</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
            <TabsTrigger value="quiz">Quiz Builder</TabsTrigger>
          </TabsList>

          <TabsContent value="video" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>VideoEmbed Component Test</CardTitle>
                <CardDescription>
                  Test video embedding from YouTube, Vimeo, Loom, and Wistia
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Video URL</Label>
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Enter video URL"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quick Test URLs</Label>
                  <div className="flex flex-wrap gap-2">
                    {testVideoUrls.map((test) => (
                      <Button
                        key={test.platform}
                        variant="outline"
                        size="sm"
                        onClick={() => setVideoUrl(test.url)}
                      >
                        {test.platform}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Preview</Label>
                  <VideoEmbed url={videoUrl} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attachments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AttachmentUploader Component Test</CardTitle>
                <CardDescription>
                  Upload files to training-files bucket or add external links
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AttachmentUploader
                  lessonId={testLessonId}
                  agencyId={agencyId}
                  onAttachmentAdded={(attachment) => {
                    console.log("Attachment added:", attachment);
                    toast.success(
                      attachment.is_external_link
                        ? "External link saved"
                        : "File uploaded successfully"
                    );
                  }}
                />

                <div className="space-y-2">
                  <Label>Current Attachments ({attachments.length})</Label>
                  {attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map((att) => (
                        <Card key={att.id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{att.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {att.is_external_link ? "External Link" : "Uploaded File"}
                                {att.file_size_bytes && ` • ${(att.file_size_bytes / 1024).toFixed(1)} KB`}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No attachments yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quiz" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>QuizBuilder Component Test</CardTitle>
                <CardDescription>
                  Create quiz questions with multiple choice and true/false types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuizBuilder
                  lessonId={testLessonId}
                  agencyId={agencyId}
                  onSave={handleQuizSave}
                />
              </CardContent>
            </Card>

            {quizzes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Saved Quizzes Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quizzes.map((quiz) => (
                    <Card key={quiz.id} className="p-4">
                      <h3 className="font-bold mb-2">{quiz.name}</h3>
                      {quiz.description && (
                        <p className="text-sm text-muted-foreground mb-4">{quiz.description}</p>
                      )}
                      <div className="space-y-3">
                        {quiz.questions?.map((q, idx) => (
                          <Card key={q.id} className="p-3">
                            <p className="font-medium mb-2">Q{idx + 1}: {q.question_text}</p>
                            <p className="text-sm text-muted-foreground mb-2">
                              Type: {q.question_type === "multiple_choice" ? "Multiple Choice" : "True/False"}
                            </p>
                            <div className="space-y-1">
                              {q.options?.map((opt) => (
                                <p key={opt.id} className="text-sm">
                                  {opt.is_correct ? "✓ " : "  "}
                                  {opt.option_text}
                                </p>
                              ))}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Card className="bg-accent/50">
          <CardHeader>
            <CardTitle>Database Verification</CardTitle>
            <CardDescription>Query the database to verify saved data</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleQueryDatabase}>
              Query Database
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Check browser console for detailed results
            </p>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
