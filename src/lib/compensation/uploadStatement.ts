import { supabase } from "@/integrations/supabase/client";

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
}

export async function uploadStatement(params: UploadStatementParams): Promise<UploadResult> {
  const { agencyId, file, month, year, vcBaselineAchieved, uploadedBy } = params;
  
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
    }, { onConflict: 'agency_id,statement_month,statement_year' })
    .select('id, storage_path')
    .single();
  
  if (error) throw error;
  
  return data;
}
