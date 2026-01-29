import { supabase } from '@/integrations/supabase/client';

// ============ HELPERS ============

export function hasStaffToken(): boolean {
  // Only use staff path if:
  // 1. Staff session token exists AND
  // 2. User is on a staff route (prevents stale tokens from affecting owner mode)
  const staffToken = localStorage.getItem('staff_session_token');
  if (!staffToken) return false;
  
  // Check if current URL indicates staff mode
  const isStaffRoute = window.location.pathname.startsWith('/staff');
  
  return isStaffRoute;
}

async function callTrainingAdminApi(action: string, params: Record<string, any> = {}): Promise<any> {
  const sessionToken = localStorage.getItem('staff_session_token');
  
  if (!sessionToken) {
    throw new Error('No staff session token');
  }

  const { data, error } = await supabase.functions.invoke('training_admin', {
    headers: {
      'x-staff-session': sessionToken,
    },
    body: { action, ...params },
  });

  if (error) {
    console.error('Training admin API error:', error);
    throw new Error(error.message || 'API call failed');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

// ============ TYPES ============

export interface TrainingCategory {
  id: string;
  agency_id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingCategoryInsert {
  agency_id: string;
  name: string;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export interface TrainingModule {
  id: string;
  agency_id: string;
  category_id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingModuleInsert {
  agency_id: string;
  category_id: string;
  name: string;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export interface TrainingLesson {
  id: string;
  agency_id: string;
  module_id: string;
  name: string;
  description: string | null;
  video_url: string | null;
  video_platform: string | null;
  content_html: string | null;
  thumbnail_url: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingLessonInsert {
  agency_id: string;
  module_id: string;
  name: string;
  description?: string | null;
  video_url?: string | null;
  video_platform?: string | null;
  content_html?: string | null;
  thumbnail_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export interface TrainingAttachment {
  id: string;
  agency_id: string;
  lesson_id: string;
  name: string;
  file_type: string;
  file_url: string;
  file_size_bytes: number | null;
  is_external_link: boolean | null;
  sort_order: number | null;
  created_at: string;
}

export interface TrainingAttachmentInsert {
  agency_id: string;
  lesson_id: string;
  name: string;
  file_type: string;
  file_url: string;
  file_size_bytes?: number | null;
  is_external_link: boolean;
  sort_order?: number | null;
}

export interface TrainingQuizOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean | null;
  sort_order: number | null;
}

export interface TrainingQuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'text_response';
  sort_order: number | null;
  options?: TrainingQuizOption[];
}

export interface TrainingQuiz {
  id: string;
  agency_id: string;
  lesson_id: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  questions?: TrainingQuizQuestion[];
}

export interface QuizWithQuestionsInsert {
  quiz: {
    lesson_id: string;
    agency_id: string;
    name: string;
    description?: string;
    is_active?: boolean;
  };
  questions: {
    question_text: string;
    question_type: 'multiple_choice' | 'true_false' | 'text_response';
    sort_order: number;
    options: {
      option_text: string;
      is_correct: boolean;
      sort_order: number;
    }[];
  }[];
}

// ============ CATEGORIES ============

export async function listCategories(agencyId: string): Promise<TrainingCategory[]> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('categories_list');
    return data.categories || [];
  }

  const { data, error } = await supabase
    .from('training_categories')
    .select('*')
    .eq('agency_id', agencyId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCategory(category: TrainingCategoryInsert): Promise<TrainingCategory> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('category_create', category);
    return data.category;
  }

  const { data, error } = await supabase
    .from('training_categories')
    .insert(category)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, updates: Partial<TrainingCategory>): Promise<TrainingCategory> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('category_update', { id, updates });
    return data.category;
  }

  const { data, error } = await supabase
    .from('training_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  if (hasStaffToken()) {
    await callTrainingAdminApi('category_delete', { id });
    return;
  }

  const { error } = await supabase
    .from('training_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============ MODULES ============

export async function listModules(categoryId: string): Promise<TrainingModule[]> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('modules_list', { category_id: categoryId });
    return data.modules || [];
  }

  const { data, error } = await supabase
    .from('training_modules')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createModule(module: TrainingModuleInsert): Promise<TrainingModule> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('module_create', module);
    return data.module;
  }

  const { data, error } = await supabase
    .from('training_modules')
    .insert(module)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateModule(id: string, updates: Partial<TrainingModule>): Promise<TrainingModule> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('module_update', { id, updates });
    return data.module;
  }

  const { data, error } = await supabase
    .from('training_modules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteModule(id: string): Promise<void> {
  if (hasStaffToken()) {
    await callTrainingAdminApi('module_delete', { id });
    return;
  }

  const { error } = await supabase
    .from('training_modules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============ LESSONS ============

export async function listLessons(moduleId: string): Promise<TrainingLesson[]> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('lessons_list', { module_id: moduleId });
    return data.lessons || [];
  }

  const { data, error } = await supabase
    .from('training_lessons')
    .select('*')
    .eq('module_id', moduleId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createLesson(lesson: TrainingLessonInsert): Promise<TrainingLesson> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('lesson_create', lesson);
    return data.lesson;
  }

  const { data, error } = await supabase
    .from('training_lessons')
    .insert(lesson)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLesson(id: string, updates: Partial<TrainingLesson>): Promise<TrainingLesson> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('lesson_update', { id, updates });
    return data.lesson;
  }

  const { data, error } = await supabase
    .from('training_lessons')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLesson(id: string): Promise<void> {
  if (hasStaffToken()) {
    await callTrainingAdminApi('lesson_delete', { id });
    return;
  }

  const { error } = await supabase
    .from('training_lessons')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============ ATTACHMENTS ============

export async function listAttachments(lessonId: string): Promise<TrainingAttachment[]> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('attachments_list', { lesson_id: lessonId });
    return data.attachments || [];
  }

  const { data, error } = await supabase
    .from('training_attachments')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createAttachment(attachment: TrainingAttachmentInsert): Promise<TrainingAttachment> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('attachment_create', attachment);
    return data.attachment;
  }

  const { data, error } = await supabase
    .from('training_attachments')
    .insert(attachment)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAttachment(id: string, fileUrl: string, isExternal: boolean): Promise<void> {
  if (hasStaffToken()) {
    await callTrainingAdminApi('attachment_delete', { id, file_url: fileUrl, is_external: isExternal });
    return;
  }

  // Delete DB record
  const { error: dbError } = await supabase
    .from('training_attachments')
    .delete()
    .eq('id', id);

  if (dbError) throw dbError;

  // Delete from storage if not external
  if (!isExternal) {
    await supabase.storage.from('training-files').remove([fileUrl]);
  }
}

export async function getSignedDownloadUrl(fileUrl: string): Promise<string> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('attachment_get_signed_url', { file_url: fileUrl });
    return data.signedUrl;
  }

  const { data, error } = await supabase.storage
    .from('training-files')
    .createSignedUrl(fileUrl, 3600);

  if (error) throw error;
  return data.signedUrl;
}

export async function getSignedUploadUrl(lessonId: string, fileName: string, contentType: string): Promise<{ uploadUrl: string; path: string }> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('attachment_get_upload_url', {
      lesson_id: lessonId,
      file_name: fileName,
      content_type: contentType,
    });
    return { uploadUrl: data.uploadUrl, path: data.path };
  }

  // For owner mode, we need agencyId - get it from the lesson
  const { data: lesson } = await supabase
    .from('training_lessons')
    .select('agency_id')
    .eq('id', lessonId)
    .single();

  const path = `${lesson?.agency_id}/${lessonId}/${Date.now()}_${fileName}`;
  const { data, error } = await supabase.storage
    .from('training-files')
    .createSignedUploadUrl(path);

  if (error) throw error;
  return { uploadUrl: data.signedUrl, path };
}

// Helper for file upload flow (staff uses signed URL, owner uses direct upload)
export async function uploadAttachmentFile(
  file: File,
  lessonId: string,
  agencyId: string
): Promise<{ path: string }> {
  if (hasStaffToken()) {
    // Staff mode: Use signed upload URL
    const { uploadUrl, path } = await getSignedUploadUrl(lessonId, file.name, file.type);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    return { path };
  }

  // Owner mode: Direct upload
  const path = `${agencyId}/${lessonId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage
    .from('training-files')
    .upload(path, file);

  if (error) throw error;
  return { path };
}

// ============ QUIZZES ============

export async function listQuizzes(lessonId: string): Promise<TrainingQuiz[]> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('quizzes_list', { lesson_id: lessonId });
    return data.quizzes || [];
  }

  // Fetch quizzes
  const { data: quizzes, error: quizError } = await supabase
    .from('training_quizzes')
    .select('*')
    .eq('lesson_id', lessonId);

  if (quizError) throw quizError;
  if (!quizzes || quizzes.length === 0) return [];

  // Fetch questions
  const quizIds = quizzes.map(q => q.id);
  const { data: questions, error: qError } = await supabase
    .from('training_quiz_questions')
    .select('*')
    .in('quiz_id', quizIds)
    .order('sort_order', { ascending: true });

  if (qError) throw qError;

  // Fetch options
  const questionIds = (questions || []).map(q => q.id);
  let options: TrainingQuizOption[] = [];
  if (questionIds.length > 0) {
    const { data: optionsData, error: oError } = await supabase
      .from('training_quiz_options')
      .select('*')
      .in('question_id', questionIds)
      .order('sort_order', { ascending: true });

    if (oError) throw oError;
    options = optionsData || [];
  }

  // Assemble nested structure
  return quizzes.map(quiz => ({
    ...quiz,
    questions: (questions || [])
      .filter(q => q.quiz_id === quiz.id)
      .map(question => ({
        ...question,
        options: options.filter(o => o.question_id === question.id),
      })),
  }));
}

export async function createQuizWithQuestions(quizData: QuizWithQuestionsInsert): Promise<TrainingQuiz> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('quiz_create', {
      lesson_id: quizData.quiz.lesson_id,
      name: quizData.quiz.name,
      description: quizData.quiz.description,
      is_active: quizData.quiz.is_active,
      questions: quizData.questions,
    });
    return data.quiz;
  }

  // Create quiz
  const { data: quiz, error: quizError } = await supabase
    .from('training_quizzes')
    .insert({
      agency_id: quizData.quiz.agency_id,
      lesson_id: quizData.quiz.lesson_id,
      name: quizData.quiz.name,
      description: quizData.quiz.description,
      is_active: quizData.quiz.is_active ?? true,
    })
    .select()
    .single();

  if (quizError) throw quizError;

  // Create questions
  if (quizData.questions && quizData.questions.length > 0) {
    const questionsToInsert = quizData.questions.map(q => ({
      quiz_id: quiz.id,
      question_text: q.question_text,
      question_type: q.question_type,
      sort_order: q.sort_order,
    }));

    const { data: insertedQuestions, error: questionsError } = await supabase
      .from('training_quiz_questions')
      .insert(questionsToInsert)
      .select();

    if (questionsError) throw questionsError;

    // Create options
    const optionsToInsert = (insertedQuestions || []).flatMap((question, qIdx) => {
      return (quizData.questions[qIdx].options || []).map(opt => ({
        question_id: question.id,
        option_text: opt.option_text,
        is_correct: opt.is_correct,
        sort_order: opt.sort_order,
      }));
    });

    if (optionsToInsert.length > 0) {
      const { error: optionsError } = await supabase
        .from('training_quiz_options')
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;
    }
  }

  return quiz;
}

export async function deleteQuiz(id: string): Promise<void> {
  if (hasStaffToken()) {
    await callTrainingAdminApi('quiz_delete', { id });
    return;
  }

  const { error } = await supabase
    .from('training_quizzes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============ STAFF USERS (for assignments) ============

export interface StaffUserForAssignment {
  id: string;
  display_name: string | null;
  username: string;
  email: string | null;
  is_active: boolean;
  team_member_id: string | null;
}

export async function listStaffUsers(agencyId: string): Promise<StaffUserForAssignment[]> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('staff_users_list');
    return data.staff_users || [];
  }

  const { data, error } = await supabase
    .from('staff_users')
    .select('id, display_name, username, email, is_active, team_member_id')
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .order('display_name');

  if (error) throw error;
  return data || [];
}

// ============ TEAM MEMBERS WITH STAFF LOGINS ============

export async function listTeamMembersWithLogins(agencyId: string): Promise<{
  team_members: any[];
  staff_users: any[];
}> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('team_members_with_logins');
    return { team_members: data.team_members || [], staff_users: data.staff_users || [] };
  }

  const [teamMembersRes, staffUsersRes] = await Promise.all([
    supabase
      .from('team_members')
      .select('id, name, email, role, status')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('staff_users')
      .select('id, username, display_name, email, is_active, last_login_at, created_at, team_member_id')
      .eq('agency_id', agencyId)
  ]);

  if (teamMembersRes.error) throw teamMembersRes.error;
  if (staffUsersRes.error) throw staffUsersRes.error;

  return {
    team_members: teamMembersRes.data || [],
    staff_users: staffUsersRes.data || []
  };
}

// ============ MODULES (all for agency) ============

export async function listAllModules(agencyId: string): Promise<TrainingModule[]> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('modules_all');
    return data.modules || [];
  }

  const { data, error } = await supabase
    .from('training_modules')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

// ============ ASSIGNMENTS ============

export interface TrainingAssignment {
  id: string;
  agency_id: string;
  staff_user_id: string;
  module_id: string;
  assigned_at: string;
  due_date: string | null;
  assigned_by: string | null;
  staff_users?: { display_name: string | null; username: string } | null;
  training_modules?: { name: string } | null;
}

export async function listAssignments(agencyId: string): Promise<TrainingAssignment[]> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('assignments_list');
    return data.assignments || [];
  }

  const { data, error } = await supabase
    .from('training_assignments')
    .select(`
      *,
      staff_users(display_name, username),
      training_modules(name)
    `)
    .eq('agency_id', agencyId)
    .order('assigned_at', { ascending: false });

  if (error) throw error;
  return (data || []) as TrainingAssignment[];
}

export async function bulkCreateAssignments(
  agencyId: string,
  staffUserIds: string[],
  moduleIds: string[],
  dueDate?: string | null,
  assignedBy?: string
): Promise<TrainingAssignment[]> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('assignment_bulk_create', {
      staff_user_ids: staffUserIds,
      module_ids: moduleIds,
      due_date: dueDate,
    });
    return data.assignments || [];
  }

  const records: any[] = [];
  for (const staffId of staffUserIds) {
    for (const moduleId of moduleIds) {
      records.push({
        agency_id: agencyId,
        staff_user_id: staffId,
        module_id: moduleId,
        assigned_by: assignedBy,
        due_date: dueDate || null,
      });
    }
  }

  const { data, error } = await supabase
    .from('training_assignments')
    .insert(records)
    .select();

  if (error) throw error;
  return (data || []) as TrainingAssignment[];
}

export async function updateAssignment(id: string, dueDate: string | null): Promise<TrainingAssignment> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('assignment_update', { id, due_date: dueDate });
    return data.assignment;
  }

  const { data, error } = await supabase
    .from('training_assignments')
    .update({ due_date: dueDate })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as TrainingAssignment;
}

export async function deleteAssignment(id: string): Promise<void> {
  if (hasStaffToken()) {
    await callTrainingAdminApi('assignment_delete', { id });
    return;
  }

  const { error } = await supabase
    .from('training_assignments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============ LESSON PROGRESS (for status calculation) ============

export async function getLessonProgressAll(agencyId: string): Promise<{
  progress: any[];
  lessons: any[];
  allLessons: any[];
  agencyStaff: any[];
}> {
  if (hasStaffToken()) {
    const data = await callTrainingAdminApi('lesson_progress_all');
    return {
      progress: data.progress || [],
      lessons: data.lessons || [],
      allLessons: data.allLessons || [],
      agencyStaff: data.agencyStaff || []
    };
  }

  const [progressRes, lessonsRes, staffRes] = await Promise.all([
    supabase.from('staff_lesson_progress').select('staff_user_id, lesson_id, completed'),
    supabase.from('training_lessons').select('id, module_id').eq('agency_id', agencyId),
    supabase.from('staff_users').select('id').eq('agency_id', agencyId)
  ]);

  if (progressRes.error) throw progressRes.error;
  if (lessonsRes.error) throw lessonsRes.error;
  if (staffRes.error) throw staffRes.error;

  return {
    progress: progressRes.data || [],
    lessons: lessonsRes.data || [],
    allLessons: lessonsRes.data || [],
    agencyStaff: staffRes.data || []
  };
}
