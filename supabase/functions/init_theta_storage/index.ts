import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const bucketName = 'theta-audio-tracks'
    
    // Check if bucket already exists
    const { data: existingBuckets, error: listError } = await supabaseAdmin
      .storage
      .listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      throw listError
    }

    const bucketExists = existingBuckets?.some(b => b.name === bucketName)

    if (bucketExists) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Bucket already exists',
          bucket: bucketName 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Create the bucket
    const { data: bucketData, error: createError } = await supabaseAdmin
      .storage
      .createBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'audio/mpeg',
          'audio/wav', 
          'audio/mp3',
          'audio/mp4',
          'audio/x-m4a'
        ]
      })

    if (createError) {
      console.error('Error creating bucket:', createError)
      throw createError
    }

    console.log('Successfully created bucket:', bucketName)

    // Note: Storage RLS policies must be configured via Supabase Dashboard
    // Navigate to: Storage > Policies > New Policy
    // Required policies:
    // 1. SELECT: bucket_id = 'theta-audio-tracks' (public read)
    // 2. INSERT: bucket_id = 'theta-audio-tracks' AND authenticated
    // 3. UPDATE: bucket_id = 'theta-audio-tracks' AND service_role
    // 4. DELETE: bucket_id = 'theta-audio-tracks' AND service_role

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Storage bucket created successfully',
        bucket: bucketName,
        data: bucketData,
        next_steps: 'Configure storage policies in Supabase Dashboard at: https://supabase.com/dashboard/project/wjqyccbytctqwceuhzhk/storage/policies'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in init_theta_storage:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})