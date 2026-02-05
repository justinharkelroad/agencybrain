import React, { useEffect, useState } from "react";
import { useOnboardingSequences, OnboardingSequence, SequenceTargetType } from "@/hooks/useOnboardingSequences";
import { SequenceTemplatesList } from "@/components/onboarding/SequenceTemplatesList";
import { CommunitySequencesList } from "@/components/onboarding/CommunitySequencesList";
import { SequenceTemplateEditor } from "@/components/onboarding/SequenceTemplateEditor";
import type { StepFormData } from "@/components/onboarding/SequenceStepEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SequenceBuilder() {
  const {
    sequences,
    loading,
    duplicateSequence,
    deleteSequence,
    toggleSequenceActive,
    toggleSequencePublic,
    clonePublicSequence,
    saveSequenceWithSteps,
  } = useOnboardingSequences();

  const [activeTab, setActiveTab] = useState<string>("my-templates");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<OnboardingSequence | null>(null);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Sequence Builder | My Agency Brain";
    const meta = document.querySelector('meta[name="description"]');
    const content = "Create and manage onboarding sequence templates for follow-up tasks";
    if (meta) meta.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  const handleCreateNew = () => {
    setEditingSequence(null);
    setEditorOpen(true);
  };

  const handleEdit = (sequence: OnboardingSequence) => {
    setEditingSequence(sequence);
    setEditorOpen(true);
  };

  const handleDuplicate = async (sequenceId: string) => {
    await duplicateSequence(sequenceId);
  };

  const handleDelete = async (sequenceId: string) => {
    await deleteSequence(sequenceId);
  };

  const handleToggleActive = async (sequenceId: string, isActive: boolean) => {
    await toggleSequenceActive(sequenceId, isActive);
  };

  const handleTogglePublic = async (sequenceId: string, isPublic: boolean) => {
    await toggleSequencePublic(sequenceId, isPublic);
  };

  const handleCloneFromCommunity = async (sequenceId: string) => {
    setCloning(sequenceId);
    try {
      await clonePublicSequence(sequenceId);
      // Switch to my templates tab after cloning
      setActiveTab("my-templates");
    } finally {
      setCloning(null);
    }
  };

  const handleSave = async (
    sequenceData: { name: string; description: string; target_type: SequenceTargetType; is_active: boolean; custom_type_label?: string },
    steps: StepFormData[]
  ) => {
    setSaving(true);
    try {
      await saveSequenceWithSteps(
        editingSequence?.id,
        {
          name: sequenceData.name,
          description: sequenceData.description || undefined,
          target_type: sequenceData.target_type,
          is_active: sequenceData.is_active,
          custom_type_label: sequenceData.custom_type_label,
        },
        steps.map(s => ({
          id: s.id,
          day_number: s.day_number,
          action_type: s.action_type,
          title: s.title,
          description: s.description || undefined,
          script_template: s.script_template || undefined,
        }))
      );
      setEditorOpen(false);
      setEditingSequence(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sequence Builder</h1>
        <p className="text-muted-foreground">
          Create and manage onboarding sequence templates for new customer follow-ups.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-templates">My Templates</TabsTrigger>
          <TabsTrigger value="community">Community Library</TabsTrigger>
        </TabsList>

        <TabsContent value="my-templates" className="mt-0">
          <SequenceTemplatesList
            sequences={sequences}
            loading={loading}
            onCreateNew={handleCreateNew}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
            onTogglePublic={handleTogglePublic}
          />
        </TabsContent>

        <TabsContent value="community" className="mt-0">
          <CommunitySequencesList
            onClone={handleCloneFromCommunity}
            cloning={cloning}
          />
        </TabsContent>
      </Tabs>

      <SequenceTemplateEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingSequence(null);
        }}
        sequence={editingSequence}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
