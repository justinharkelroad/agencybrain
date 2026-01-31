import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Video, FileText, HelpCircle, Zap, CheckCircle2, Circle } from "lucide-react";
import {
  useChallengeProducts,
  useChallengeModules,
  useChallengeLessons,
  type ChallengeLesson
} from "@/hooks/useChallengeAdmin";
import { ChallengeLessonEditor } from "@/components/challenge/admin/ChallengeLessonEditor";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

export function ChallengeContentTab() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Persist selectedWeek to URL to survive tab switches
  const selectedWeek = parseInt(searchParams.get('week') || '1', 10);
  const editLessonId = searchParams.get('editLessonId') || '';

  const setSelectedWeek = useCallback((week: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('week', String(week));
      // Clear lesson edit when week changes
      next.delete('editLessonId');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setEditLessonId = useCallback((id: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) {
        next.set('editLessonId', id);
      } else {
        next.delete('editLessonId');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Track the actual editing lesson object (synced from lessons data)
  const [editingLesson, setEditingLessonState] = useState<ChallengeLesson | null>(null);

  // Fetch challenge product (assuming single product for now)
  const { data: products, isLoading: productsLoading } = useChallengeProducts();
  const product = products?.[0];

  // Fetch modules for this product
  const { data: modules, isLoading: modulesLoading } = useChallengeModules(product?.id);

  // Get the current week's module
  const currentModule = modules?.find(m => m.week_number === selectedWeek);

  // Fetch lessons for the current module
  const { data: lessons, isLoading: lessonsLoading } = useChallengeLessons(currentModule?.id);

  // Sync editingLesson from URL param when lessons data is available
  useEffect(() => {
    if (editLessonId && lessons) {
      const lesson = lessons.find((l: ChallengeLesson) => l.id === editLessonId);
      if (lesson) {
        setEditingLessonState(lesson);
      }
    } else if (!editLessonId) {
      setEditingLessonState(null);
    }
  }, [editLessonId, lessons]);

  // Wrapper to open lesson editor via URL param
  const openLessonEditor = (lesson: ChallengeLesson) => {
    setEditLessonId(lesson.id);
    setEditingLessonState(lesson);
  };

  // Wrapper to close lesson editor
  const closeLessonEditor = () => {
    setEditLessonId('');
    setEditingLessonState(null);
  };

  if (productsLoading) {
    return <LoadingSpinner />;
  }

  if (!product) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No challenge product found. Create one first.
        </CardContent>
      </Card>
    );
  }

  const weekTabs = Array.from({ length: 6 }, (_, i) => i + 1);

  // Helper to check if lesson has content
  const hasContent = (lesson: ChallengeLesson) => {
    return !!(lesson.video_url || lesson.content_html);
  };

  // Day names for display
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div className="space-y-6">
      {/* Product Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>{product.description}</CardDescription>
            </div>
            <Badge variant="outline">
              {product.duration_weeks} weeks • {product.total_lessons} lessons
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Week Selector */}
      <Tabs value={String(selectedWeek)} onValueChange={(v) => setSelectedWeek(Number(v))}>
        <TabsList className="grid w-full grid-cols-6">
          {weekTabs.map((week) => {
            const weekModule = modules?.find(m => m.week_number === week);
            return (
              <TabsTrigger key={week} value={String(week)} className="flex flex-col gap-1">
                <span>Week {week}</span>
                {weekModule && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                    {weekModule.name.replace(`Week ${week}: `, '')}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {weekTabs.map((week) => (
          <TabsContent key={week} value={String(week)} className="mt-6">
            {modulesLoading || lessonsLoading ? (
              <LoadingSpinner />
            ) : !currentModule ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No module found for Week {week}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Module Header */}
                <Card className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{currentModule.name}</CardTitle>
                        {currentModule.description && (
                          <CardDescription>{currentModule.description}</CardDescription>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {lessons?.length || 0} lessons
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>

                {/* Lessons Grid */}
                <div className="grid gap-4">
                  {lessons?.map((lesson) => (
                    <Card 
                      key={lesson.id} 
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/50",
                        hasContent(lesson) ? "border-l-4 border-l-primary" : "border-l-4 border-l-muted"
                      )}
                      onClick={() => openLessonEditor(lesson)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {/* Day indicator */}
                            <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg bg-muted">
                              <span className="text-xs text-muted-foreground">Day</span>
                              <span className="text-2xl font-bold">{lesson.day_number}</span>
                            </div>

                            {/* Lesson info */}
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{lesson.title}</h3>
                                {lesson.is_discovery_flow && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Zap className="h-3 w-3 mr-1" />
                                    Discovery Flow
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {dayNames[lesson.day_of_week ? lesson.day_of_week - 1 : (lesson.day_number - 1) % 5]}
                              </p>
                              {lesson.preview_text && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                  {lesson.preview_text}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Status indicators */}
                          <div className="flex items-center gap-3">
                            {/* Content status icons */}
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div className="flex items-center gap-1" title="Video">
                                <Video className={cn("h-4 w-4", lesson.video_url ? "text-primary" : "")} />
                                {lesson.video_url ? (
                                  <CheckCircle2 className="h-3 w-3 text-primary" />
                                ) : (
                                  <Circle className="h-3 w-3" />
                                )}
                              </div>
                              <div className="flex items-center gap-1" title="Content">
                                <FileText className={cn("h-4 w-4", lesson.content_html ? "text-primary" : "")} />
                                {lesson.content_html ? (
                                  <CheckCircle2 className="h-3 w-3 text-primary" />
                                ) : (
                                  <Circle className="h-3 w-3" />
                                )}
                              </div>
                              <div className="flex items-center gap-1" title="Questions">
                                <HelpCircle className={cn("h-4 w-4", lesson.questions?.length ? "text-primary" : "")} />
                                {lesson.questions?.length ? (
                                  <CheckCircle2 className="h-3 w-3 text-primary" />
                                ) : (
                                  <Circle className="h-3 w-3" />
                                )}
                              </div>
                            </div>

                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {(!lessons || lessons.length === 0) && (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No lessons found for this week
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Lesson Editor Dialog */}
      {editingLesson && (
        <ChallengeLessonEditor
          lesson={editingLesson}
          weekNumber={selectedWeek}
          onClose={closeLessonEditor}
        />
      )}
    </div>
  );
}
