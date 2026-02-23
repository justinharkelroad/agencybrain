import { supabase } from '@/integrations/supabase/client';
import { hasStaffToken } from './trainingAdminApi';

// ============ TYPES ============

export interface SPAssignment {
  id: string;
  agency_id: string;
  staff_user_id: string;
  sp_category_id: string | null;
  sp_module_id: string | null;
  sp_lesson_id: string | null;
  assigned_at: string;
  due_date: string | null;
  assigned_by_user_id: string | null;
  assigned_by_staff_id: string | null;
  seen_at: string | null;
  status?: string;
  level?: 'category' | 'module' | 'lesson';
  staff_users?: { id: string; display_name: string; username: string };
  sp_categories?: { id: string; name: string; slug: string } | null;
  sp_modules?: { id: string; name: string; slug: string; category_id: string } | null;
  sp_lessons?: { id: string; name: string; slug: string; module_id: string } | null;
}

export interface SPAssignmentItem {
  sp_category_id?: string;
  sp_module_id?: string;
  sp_lesson_id?: string;
}

export interface SPCategoryOption {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  access_tiers: string[];
}

export interface SPContentTreeNode {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string;
  sp_modules: {
    id: string;
    name: string;
    slug: string;
    sp_lessons: {
      id: string;
      name: string;
      slug: string;
    }[];
  }[];
}

// ============ HELPERS ============

async function callSPAssignmentApi(action: string, params: Record<string, any> = {}): Promise<any> {
  const sessionToken = localStorage.getItem('staff_session_token');

  if (!sessionToken) {
    throw new Error('No staff session token');
  }

  const { data, error } = await supabase.functions.invoke('sp_assignment_admin', {
    headers: {
      'x-staff-session': sessionToken,
    },
    body: { action, ...params },
  });

  if (error) {
    console.error('SP assignment API error:', error);
    throw new Error(error.message || 'API call failed');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

// ============ API FUNCTIONS ============

export async function listSPAssignments(agencyId: string): Promise<SPAssignment[]> {
  if (hasStaffToken()) {
    const data = await callSPAssignmentApi('list');
    return data.assignments || [];
  }

  // Owner path: call edge function to get assignments with computed status
  const { data, error } = await supabase.functions.invoke('sp_assignment_admin', {
    body: { action: 'list' },
  });

  if (error) {
    console.error('SP assignment list error:', error);
    throw new Error(error.message || 'Failed to list assignments');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.assignments || [];
}

export async function bulkCreateSPAssignments(
  agencyId: string,
  staffUserIds: string[],
  items: SPAssignmentItem[],
  dueDate?: string | null,
  assignedByUserId?: string
): Promise<SPAssignment[]> {
  if (hasStaffToken()) {
    const data = await callSPAssignmentApi('bulk_create', {
      staff_user_ids: staffUserIds,
      items,
      due_date: dueDate,
    });
    return data.assignments || [];
  }

  // Owner path: call edge function which handles insert + email in one shot
  const { data, error } = await supabase.functions.invoke('sp_assignment_admin', {
    body: {
      action: 'bulk_create',
      staff_user_ids: staffUserIds,
      items,
      due_date: dueDate,
    },
  });

  if (error) {
    console.error('SP assignment bulk create error:', error);
    throw new Error(error.message || 'Failed to create assignments');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.assignments || [];
}

export async function listSPContentTree(agencyId: string): Promise<SPContentTreeNode[]> {
  if (hasStaffToken()) {
    const data = await callSPAssignmentApi('list_content');
    return data.tree || [];
  }

  const { data, error } = await supabase.functions.invoke('sp_assignment_admin', {
    body: { action: 'list_content' },
  });

  if (error) {
    console.error('SP content tree error:', error);
    throw new Error(error.message || 'Failed to list content tree');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.tree || [];
}

export async function updateSPAssignment(id: string, dueDate: string | null): Promise<void> {
  if (hasStaffToken()) {
    await callSPAssignmentApi('update', { id, due_date: dueDate });
    return;
  }

  const { error } = await supabase
    .from('sp_assignments')
    .update({ due_date: dueDate })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteSPAssignment(id: string): Promise<void> {
  if (hasStaffToken()) {
    await callSPAssignmentApi('delete', { id });
    return;
  }

  const { error } = await supabase
    .from('sp_assignments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function listAccessibleSPCategories(agencyId: string): Promise<SPCategoryOption[]> {
  if (hasStaffToken()) {
    const data = await callSPAssignmentApi('list_categories');
    return data.categories || [];
  }

  // Owner path: call edge function for consistent tier filtering
  const { data, error } = await supabase.functions.invoke('sp_assignment_admin', {
    body: { action: 'list_categories' },
  });

  if (error) {
    console.error('SP categories list error:', error);
    throw new Error(error.message || 'Failed to list categories');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.categories || [];
}

export interface UnseenAssignment {
  level: 'category' | 'module' | 'lesson';
  sp_category_id?: string;
  sp_module_id?: string;
  sp_lesson_id?: string;
  category_slug?: string;
  module_slug?: string;
  lesson_slug?: string;
  target_name?: string;
  // Backward compat
  category_name?: string;
}

export interface UnseenSPResult {
  count: number;
  assignments: UnseenAssignment[];
}

export async function getUnseenSPAssignments(staffUserId: string): Promise<UnseenSPResult> {
  const sessionToken = localStorage.getItem('staff_session_token');
  if (!sessionToken) {
    return { count: 0, assignments: [] };
  }

  try {
    const { data, error } = await supabase.functions.invoke('sp_assignment_admin', {
      headers: { 'x-staff-session': sessionToken },
      body: { action: 'unseen_count' },
    });

    if (error) {
      console.error('[SP Banner] Edge function error:', error);
      return { count: 0, assignments: [] };
    }

    if (data?.error) {
      console.error('[SP Banner] API error:', data.error);
      return { count: 0, assignments: [] };
    }

    return {
      count: data?.count || 0,
      assignments: data?.assignments || [],
    };
  } catch (err) {
    console.error('[SP Banner] Unexpected error:', err);
    return { count: 0, assignments: [] };
  }
}

export async function markSPAssignmentsSeen(): Promise<void> {
  const sessionToken = localStorage.getItem('staff_session_token');
  if (!sessionToken) return;

  await supabase.functions.invoke('sp_assignment_admin', {
    headers: { 'x-staff-session': sessionToken },
    body: { action: 'mark_seen' },
  });
}
