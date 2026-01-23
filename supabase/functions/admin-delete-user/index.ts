import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validate Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Create authenticated client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // 3. Get caller identity
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser();
    if (authError || !caller) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. SECURE: Check caller is admin using has_role() function
    const { data: isAdmin, error: roleCheckError } = await supabase
      .rpc('has_role', { _user_id: caller.id, _role: 'admin' });

    if (roleCheckError || !isAdmin) {
      console.error('Admin check failed:', { 
        callerId: caller.id, 
        isAdmin, 
        error: roleCheckError 
      });
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Parse request body
    const { userId } = await req.json();
    if (!userId) {
      console.error('Missing userId in request');
      return new Response(
        JSON.stringify({ error: 'Missing userId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Delete request:', { 
      callerId: caller.id, 
      targetUserId: userId 
    });

    // 6. Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 7. Verify target user exists
    const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getUserError || !targetUser) {
      console.error('Target user not found:', { userId, error: getUserError });
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. CRITICAL SAFETY CHECK: Prevent deleting admins
    const { data: targetIsAdmin, error: targetRoleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: userId, _role: 'admin' });

    if (targetRoleError) {
      console.error('Failed to check target role:', targetRoleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify target user role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetIsAdmin) {
      console.warn('Attempt to delete admin blocked:', { 
        callerId: caller.id, 
        targetUserId: userId 
      });
      return new Response(
        JSON.stringify({ 
          error: 'Cannot delete admin users. Remove admin role first.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. DELETE USER (CASCADE handles all related records)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('User deletion failed:', { 
        userId, 
        error: deleteError 
      });
      return new Response(
        JSON.stringify({ 
          error: `Failed to delete user: ${deleteError.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User deleted successfully:', { 
      deletedUserId: userId, 
      deletedBy: caller.id,
      deletedEmail: targetUser.user.email
    });

    // 10. Success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User deleted successfully',
        deletedUser: {
          id: userId,
          email: targetUser.user.email
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in admin-delete-user:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
