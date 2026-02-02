import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, Save, FileText, ExternalLink } from "lucide-react";
import { useUpdateChallengeLesson, type ChallengeLesson, type LessonDocument } from "@/hooks/useChallengeAdmin";
import { cn } from "@/lib/utils";

interface ChallengeLessonEditorProps {
  lesson: ChallengeLesson;
  weekNumber: number;
  onClose: () => void;
}

export function ChallengeLessonEditor({ lesson, weekNumber, onClose }: ChallengeLessonEditorProps) {
  const [tab, setTab] = useState("details");
  const [form, setForm] = useState({
    title: lesson.title,
    video_url: lesson.video_url || "",
    video_thumbnail_url: lesson.video_thumbnail_url || "",
    preview_text: lesson.preview_text || "",
    content_html: lesson.content_html || "",
    is_discovery_flow: lesson.is_discovery_flow,
    email_subject: lesson.email_subject || "",
    email_preview: lesson.email_preview || "",
  });
  const [questions, setQuestions] = useState<string[]>(
    (lesson.questions as string[]) || []
  );
  const [actionItems, setActionItems] = useState<string[]>(
    (lesson.action_items as string[]) || []
  );
  const [documents, setDocuments] = useState<LessonDocument[]>(
    lesson.documents_json || []
  );

  const updateLesson = useUpdateChallengeLesson();

  const handleSave = () => {
    // Filter out empty documents and normalize URLs
    const validDocuments = documents
      .filter(d => d.url.trim() && d.name.trim())
      .map(d => ({
        ...d,
        url: d.url.trim().startsWith('http') ? d.url.trim() : `https://${d.url.trim()}`,
      }));

    updateLesson.mutate({
      id: lesson.id,
      updates: {
        ...form,
        questions: questions.filter(q => q.trim()),
        action_items: actionItems.filter(a => a.trim()),
        documents_json: validDocuments,
      },
    }, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  const addQuestion = () => {
    setQuestions([...questions, ""]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, value: string) => {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  };

  const addActionItem = () => {
    setActionItems([...actionItems, ""]);
  };

  const removeActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index));
  };

  const updateActionItem = (index: number, value: string) => {
    const updated = [...actionItems];
    updated[index] = value;
    setActionItems(updated);
  };

  // Document management
  const addDocument = () => {
    setDocuments([...documents, { id: `doc_${Date.now()}`, name: "", url: "" }]);
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const updateDocument = (index: number, field: 'name' | 'url', value: string) => {
    const updated = [...documents];
    updated[index] = { ...updated[index], [field]: value };
    setDocuments(updated);
  };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayOfWeek = lesson.day_of_week || ((lesson.day_number - 1) % 5) + 1;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Week {weekNumber} • Day {lesson.day_number}
            <span className="text-muted-foreground font-normal">
              ({dayNames[dayOfWeek - 1]})
            </span>
          </DialogTitle>
          <DialogDescription>
            Edit lesson content, reflection questions, and action items
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="actions">Action Items</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Lesson Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="video_url">Video URL</Label>
              <Input
                id="video_url"
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thumbnail">Video Thumbnail URL</Label>
              <Input
                id="thumbnail"
                placeholder="https://..."
                value={form.video_thumbnail_url}
                onChange={(e) => setForm({ ...form, video_thumbnail_url: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preview">Preview Text</Label>
              <Textarea
                id="preview"
                placeholder="Brief description shown before viewing the lesson..."
                value={form.preview_text}
                onChange={(e) => setForm({ ...form, preview_text: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content (HTML)</Label>
              <Textarea
                id="content"
                placeholder="<p>Full lesson content...</p>"
                value={form.content_html}
                onChange={(e) => setForm({ ...form, content_html: e.target.value })}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="discovery_flow"
                checked={form.is_discovery_flow}
                onCheckedChange={(checked) => setForm({ ...form, is_discovery_flow: checked })}
              />
              <Label htmlFor="discovery_flow">Discovery Flow Day (Friday)</Label>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Downloadable Documents
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addDocument}>
                    <Plus className="h-4 w-4 mr-1" /> Add Document
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No documents yet. Add links to PDFs, spreadsheets, or other downloadable resources.
                  </p>
                ) : (
                  documents.map((doc, index) => (
                    <div key={doc.id} className="space-y-2 p-3 border border-border rounded-lg">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                        <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                        <div className="flex-1 space-y-2">
                          <Input
                            value={doc.name}
                            onChange={(e) => updateDocument(index, 'name', e.target.value)}
                            placeholder="Document name (e.g., Sales Script Template)"
                          />
                          <div className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <Input
                              value={doc.url}
                              onChange={(e) => updateDocument(index, 'url', e.target.value)}
                              placeholder="https://docs.google.com/... or https://example.com/file.pdf"
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDocument(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <p className="text-xs text-muted-foreground">
                  Add links to Google Docs, PDFs, or any downloadable resources. These will appear as download links in the lesson.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Reflection Questions</CardTitle>
                  <Button variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="h-4 w-4 mr-1" /> Add Question
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No questions yet. Add reflection questions for participants to answer.
                  </p>
                ) : (
                  questions.map((question, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-move" />
                      <span className="text-sm text-muted-foreground mt-2 w-6">{index + 1}.</span>
                      <Input
                        value={question}
                        onChange={(e) => updateQuestion(index, e.target.value)}
                        placeholder="Enter reflection question..."
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeQuestion(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Daily Action Items</CardTitle>
                  <Button variant="outline" size="sm" onClick={addActionItem}>
                    <Plus className="h-4 w-4 mr-1" /> Add Action
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {actionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No action items yet. Add tasks for participants to complete.
                  </p>
                ) : (
                  actionItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-move" />
                      <span className="text-sm text-muted-foreground mt-2 w-6">{index + 1}.</span>
                      <Input
                        value={item}
                        onChange={(e) => updateActionItem(index, e.target.value)}
                        placeholder="Enter action item..."
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeActionItem(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email_subject">Email Subject</Label>
              <Input
                id="email_subject"
                placeholder="Day {day_number}: {title}"
                value={form.email_subject}
                onChange={(e) => setForm({ ...form, email_subject: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_preview">Email Preview Text</Label>
              <Textarea
                id="email_preview"
                placeholder="Brief preview shown in email inbox..."
                value={form.email_preview}
                onChange={(e) => setForm({ ...form, email_preview: e.target.value })}
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateLesson.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateLesson.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
