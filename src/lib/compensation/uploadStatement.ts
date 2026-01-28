import { supabase } from "@/integrations/supabase/client";
import { computeFileHash } from "@/lib/utils/file-hash";

interface UploadStatementParams {
  agencyId: string;
  file: File;
  month: number;
  year: number;
  vcBaselineAchieved: boolean;
  uploadedBy: string;
}

interface UploadResult {
  id: string;
  storage_path: string;
  isDuplicate?: boolean;
  existingUploadDate?: string;
}

/**
 * Check if a statement with the same content hash already exists
 */
async function checkForDuplicate(agencyId: string, contentHash: string): Promise<{
  isDuplicate: boolean;
  existingUpload?: { id: string; uploaded_at: string; statement_month: number; statement_year: number };
}> {
  const { data, error } = await supabase
    .from('comp_statement_uploads')
    .select('id, uploaded_at, statement_month, statement_year')
    .eq('agency_id', agencyId)
    .eq('content_hash', contentHash)
    .maybeSingle();

  if (error) {
    console.warn('[uploadStatement] Error checking for duplicate:', error);
    return { isDuplicate: false };
  }

  if (data) {
    return { isDuplicate: true, existingUpload: data };
  }

  return { isDuplicate: false };
}

export async function uploadStatement(params: UploadStatementParams): Promise<UploadResult> {
  const { agencyId, file, month, year, vcBaselineAchieved, uploadedBy } = params;

  // Compute content hash for duplicate detection
  const contentHash = await computeFileHash(file);

  // Check for existing upload with same content
  const { isDuplicate, existingUpload } = await checkForDuplicate(agencyId, contentHash);

  if (isDuplicate && existingUpload) {
    console.warn(`[uploadStatement] Duplicate statement detected. Already uploaded on ${existingUpload.uploaded_at} for ${existingUpload.statement_month}/${existingUpload.statement_year}`);
    return {
      id: existingUpload.id,
      storage_path: '',
      isDuplicate: true,
      existingUploadDate: existingUpload.uploaded_at,
    };
  }

  // Build storage path: {agency_id}/{year}-{month}-statement.xlsx
  const paddedMonth = String(month).padStart(2, '0');
  const storagePath = `${agencyId}/${year}-${paddedMonth}-statement.xlsx`;

  // Upload to storage bucket
  const { error: storageError } = await supabase.storage
    .from('compensation-statements')
    .upload(storagePath, file, { upsert: true });

  if (storageError) throw storageError;

  // Upsert record in comp_statement_uploads
  const { data, error } = await supabase
    .from('comp_statement_uploads')
    .upsert({
      agency_id: agencyId,
      statement_month: month,
      statement_year: year,
      filename: file.name,
      storage_path: storagePath,
      file_size_bytes: file.size,
      vc_baseline_achieved: vcBaselineAchieved,
      uploaded_by: uploadedBy,
      content_hash: contentHash,
    }, { onConflict: 'agency_id,statement_month,statement_year' })
    .select('id, storage_path')
    .single();

  if (error) throw error;

  return data;
}
