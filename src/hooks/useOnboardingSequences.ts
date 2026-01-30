import { useState, useEffect, useCallback } from "react";
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export type SequenceTargetType = 'onboarding' | 'lead_nurturing' | 'requote' | 'retention' | 'other';
export type ActionType = 'call' | 'text' | 'email' | 'other';

export interface SequenceStep {
  id: string;
  sequence_id: string;
  day_number: number;
  action_type: ActionType;
  title: string;
  description: string | null;
  script_template: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OnboardingSequence {
  id: string;
  agency_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  target_type: SequenceTargetType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  steps?: SequenceStep[];
}

export interface CreateSequenceInput {
  name: string;
  description?: string;
  is_active?: boolean;
  target_type: SequenceTargetType;
}

export interface UpdateSequenceInput {
  name?: string;
  description?: string;
  is_active?: boolean;
  target_type?: SequenceTargetType;
}

export interface CreateStepInput {
  day_number: number;
  action_type: ActionType;
  title: string;
  description?: string;
  script_template?: string;
  sort_order: number;
}

export interface UpdateStepInput {
  day_number?: number;
  action_type?: ActionType;
  title?: string;
  description?: string;
  script_template?: string;
  sort_order?: number;
}

export function useOnboardingSequences() {
  const { user } = useAuth();
  const [sequences, setSequences] = useState<OnboardingSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  const fetchSequences = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get user's agency
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) {
        setLoading(false);
        return;
      }

      setAgencyId(profile.agency_id);

      // Fetch sequences with their steps
      const { data: sequencesData, error } = await supabase
        .from('onboarding_sequences')
        .select(`
          *,
          steps:onboarding_sequence_steps(*)
        `)
        .eq('agency_id', profile.agency_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Sort steps by sort_order within each sequence
      const sequencesWithSortedSteps = (sequencesData || []).map(seq => ({
        ...seq,
        steps: (seq.steps || []).sort((a: SequenceStep, b: SequenceStep) =>
          a.day_number - b.day_number || a.sort_order - b.sort_order
        ),
      }));

      setSequences(sequencesWithSortedSteps);
    } catch (error: any) {
      console.error('Error fetching sequences:', error);
      toast.error('Failed to load sequences');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  const createSequence = async (input: CreateSequenceInput): Promise<OnboardingSequence | null> => {
    if (!agencyId || !user?.id) {
      toast.error('Not authorized');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('onboarding_sequences')
        .insert({
          agency_id: agencyId,
          name: input.name,
          description: input.description || null,
          is_active: input.is_active ?? true,
          target_type: input.target_type,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Sequence created successfully!');
      await fetchSequences();
      return data;
    } catch (error: any) {
      console.error('Error creating sequence:', error);
      toast.error('Failed to create sequence');
      return null;
    }
  };

  const updateSequence = async (
    sequenceId: string,
    input: UpdateSequenceInput
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('onboarding_sequences')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sequenceId);

      if (error) throw error;

      toast.success('Sequence updated successfully!');
      await fetchSequences();
      return true;
    } catch (error: any) {
      console.error('Error updating sequence:', error);
      toast.error('Failed to update sequence');
      return false;
    }
  };

  const deleteSequence = async (sequenceId: string): Promise<boolean> => {
    try {
      // Check if there are active instances using this sequence
      const { data: activeInstances } = await supabase
        .from('onboarding_instances')
        .select('id')
        .eq('sequence_id', sequenceId)
        .in('status', ['active', 'paused'])
        .limit(1);

      if (activeInstances && activeInstances.length > 0) {
        toast.error('Cannot delete sequence with active instances. Deactivate it instead.');
        return false;
      }

      const { error } = await supabase
        .from('onboarding_sequences')
        .delete()
        .eq('id', sequenceId);

      if (error) throw error;

      toast.success('Sequence deleted successfully!');
      await fetchSequences();
      return true;
    } catch (error: any) {
      console.error('Error deleting sequence:', error);
      toast.error('Failed to delete sequence');
      return false;
    }
  };

  const toggleSequenceActive = async (
    sequenceId: string,
    isActive: boolean
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('onboarding_sequences')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sequenceId);

      if (error) throw error;

      toast.success(`Sequence ${isActive ? 'activated' : 'deactivated'} successfully!`);
      await fetchSequences();
      return true;
    } catch (error: any) {
      console.error('Error toggling sequence status:', error);
      toast.error('Failed to update sequence status');
      return false;
    }
  };

  const duplicateSequence = async (sequenceId: string): Promise<OnboardingSequence | null> => {
    if (!agencyId || !user?.id) {
      toast.error('Not authorized');
      return null;
    }

    try {
      // Find the original sequence
      const original = sequences.find(s => s.id === sequenceId);
      if (!original) {
        toast.error('Sequence not found');
        return null;
      }

      // Create new sequence
      const { data: newSequence, error: seqError } = await supabase
        .from('onboarding_sequences')
        .insert({
          agency_id: agencyId,
          name: `${original.name} (Copy)`,
          description: original.description,
          is_active: false, // Start inactive
          target_type: original.target_type,
          created_by: user.id,
        })
        .select()
        .single();

      if (seqError) throw seqError;

      // Copy steps if any
      if (original.steps && original.steps.length > 0) {
        const newSteps = original.steps.map(step => ({
          sequence_id: newSequence.id,
          day_number: step.day_number,
          action_type: step.action_type,
          title: step.title,
          description: step.description,
          script_template: step.script_template,
          sort_order: step.sort_order,
        }));

        const { error: stepsError } = await supabase
          .from('onboarding_sequence_steps')
          .insert(newSteps);

        if (stepsError) throw stepsError;
      }

      toast.success('Sequence duplicated successfully!');
      await fetchSequences();
      return newSequence;
    } catch (error: any) {
      console.error('Error duplicating sequence:', error);
      toast.error('Failed to duplicate sequence');
      return null;
    }
  };

  // Step management
  const addStep = async (
    sequenceId: string,
    input: CreateStepInput
  ): Promise<SequenceStep | null> => {
    try {
      const { data, error } = await supabase
        .from('onboarding_sequence_steps')
        .insert({
          sequence_id: sequenceId,
          day_number: input.day_number,
          action_type: input.action_type,
          title: input.title,
          description: input.description || null,
          script_template: input.script_template || null,
          sort_order: input.sort_order,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchSequences();
      return data;
    } catch (error: any) {
      console.error('Error adding step:', error);
      toast.error('Failed to add step');
      return null;
    }
  };

  const updateStep = async (
    stepId: string,
    input: UpdateStepInput
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('onboarding_sequence_steps')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stepId);

      if (error) throw error;

      await fetchSequences();
      return true;
    } catch (error: any) {
      console.error('Error updating step:', error);
      toast.error('Failed to update step');
      return false;
    }
  };

  const deleteStep = async (stepId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('onboarding_sequence_steps')
        .delete()
        .eq('id', stepId);

      if (error) throw error;

      await fetchSequences();
      return true;
    } catch (error: any) {
      console.error('Error deleting step:', error);
      toast.error('Failed to delete step');
      return false;
    }
  };

  const reorderSteps = async (
    sequenceId: string,
    stepIds: string[]
  ): Promise<boolean> => {
    try {
      // Update sort_order for each step
      const updates = stepIds.map((id, index) =>
        supabase
          .from('onboarding_sequence_steps')
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);
      await fetchSequences();
      return true;
    } catch (error: any) {
      console.error('Error reordering steps:', error);
      toast.error('Failed to reorder steps');
      return false;
    }
  };

  // Bulk save steps (for editor modal that manages steps locally)
  const saveSequenceWithSteps = async (
    sequenceId: string | undefined,
    sequenceData: CreateSequenceInput | UpdateSequenceInput,
    steps: Array<Omit<CreateStepInput, 'sort_order'> & { id?: string }>
  ): Promise<OnboardingSequence | null> => {
    if (!agencyId || !user?.id) {
      toast.error('Not authorized');
      return null;
    }

    try {
      let targetSequenceId = sequenceId;

      if (sequenceId) {
        // Update existing sequence
        const { error: updateError } = await supabase
          .from('onboarding_sequences')
          .update({
            ...sequenceData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sequenceId);

        if (updateError) throw updateError;
      } else {
        // Create new sequence
        const { data: newSequence, error: createError } = await supabase
          .from('onboarding_sequences')
          .insert({
            agency_id: agencyId,
            name: (sequenceData as CreateSequenceInput).name,
            description: sequenceData.description || null,
            is_active: sequenceData.is_active ?? true,
            target_type: (sequenceData as CreateSequenceInput).target_type,
            created_by: user.id,
          })
          .select()
          .single();

        if (createError) throw createError;
        targetSequenceId = newSequence.id;
      }

      // Get existing steps for this sequence
      const { data: existingSteps } = await supabase
        .from('onboarding_sequence_steps')
        .select('id')
        .eq('sequence_id', targetSequenceId);

      const existingStepIds = new Set((existingSteps || []).map(s => s.id));
      const newStepIds = new Set(steps.filter(s => s.id).map(s => s.id));

      // Delete removed steps
      const stepsToDelete = [...existingStepIds].filter(id => !newStepIds.has(id));
      if (stepsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('onboarding_sequence_steps')
          .delete()
          .in('id', stepsToDelete);

        if (deleteError) throw deleteError;
      }

      // Update existing and insert new steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.id && existingStepIds.has(step.id)) {
          // Update existing step
          const { error: updateStepError } = await supabase
            .from('onboarding_sequence_steps')
            .update({
              day_number: step.day_number,
              action_type: step.action_type,
              title: step.title,
              description: step.description || null,
              script_template: step.script_template || null,
              sort_order: i,
              updated_at: new Date().toISOString(),
            })
            .eq('id', step.id);

          if (updateStepError) throw updateStepError;
        } else {
          // Insert new step
          const { error: insertStepError } = await supabase
            .from('onboarding_sequence_steps')
            .insert({
              sequence_id: targetSequenceId,
              day_number: step.day_number,
              action_type: step.action_type,
              title: step.title,
              description: step.description || null,
              script_template: step.script_template || null,
              sort_order: i,
            });

          if (insertStepError) throw insertStepError;
        }
      }

      toast.success(sequenceId ? 'Sequence updated successfully!' : 'Sequence created successfully!');
      await fetchSequences();

      // Return the updated/created sequence
      const { data: resultSequence } = await supabase
        .from('onboarding_sequences')
        .select(`*, steps:onboarding_sequence_steps(*)`)
        .eq('id', targetSequenceId)
        .single();

      return resultSequence;
    } catch (error: any) {
      console.error('Error saving sequence:', error);
      toast.error('Failed to save sequence');
      return null;
    }
  };

  return {
    sequences,
    loading,
    agencyId,
    refetch: fetchSequences,
    // Sequence operations
    createSequence,
    updateSequence,
    deleteSequence,
    toggleSequenceActive,
    duplicateSequence,
    saveSequenceWithSteps,
    // Step operations
    addStep,
    updateStep,
    deleteStep,
    reorderSteps,
  };
}
