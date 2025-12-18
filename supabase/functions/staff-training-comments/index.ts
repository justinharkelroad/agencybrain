import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Verify staff session
    const sessionToken = req.headers.get("x-staff-session");
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "Missing session token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session, error: sessionError } = await supabase
      .from("staff_sessions")
      .select("staff_user_id, staff_users(id, name, team_member_id)")
      .eq("session_token", sessionToken)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const staffUser = session.staff_users as { id: string; name: string; team_member_id: string | null };

    const method = req.method;
    const url = new URL(req.url);

    if (method === "GET") {
      // Get comments for a lesson
      const lessonId = url.searchParams.get("lesson_id");
      if (!lessonId) {
        return new Response(JSON.stringify({ error: "Missing lesson_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: comments, error } = await supabase
        .from("training_comments")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Get user info for comments
      const userIds = [...new Set(comments?.map((c: any) => c.user_id) || [])];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("user_id, name")
        .in("user_id", userIds);

      // Also get staff user names for staff-submitted comments
      const { data: staffUsers } = await supabase
        .from("staff_users")
        .select("id, name")
        .in("id", userIds);

      const commentsWithUsers = comments?.map((comment: any) => {
        const profile = profiles?.find((p: any) => p.id === comment.user_id);
        const teamMember = teamMembers?.find((tm: any) => tm.user_id === comment.user_id);
        const staffUserMatch = staffUsers?.find((su: any) => su.id === comment.user_id);
        return {
          ...comment,
          user_name: staffUserMatch?.name || teamMember?.name || profile?.full_name || "Anonymous",
          user_email: profile?.email,
        };
      }) || [];

      // Organize into parent comments and replies
      const parentComments = commentsWithUsers.filter((c: any) => !c.parent_id);
      const replies = commentsWithUsers.filter((c: any) => c.parent_id);
      
      const organized = parentComments.map((parent: any) => ({
        ...parent,
        replies: replies.filter((r: any) => r.parent_id === parent.id),
      }));

      return new Response(JSON.stringify({ comments: organized, staffUserId: session.staff_user_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST") {
      // Create a comment
      const body = await req.json();
      const { lesson_id, content, parent_id } = body;

      if (!lesson_id || !content) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use staff_user_id as the user_id for staff comments
      const { data: comment, error } = await supabase
        .from("training_comments")
        .insert({
          lesson_id,
          user_id: session.staff_user_id,
          content: content.trim(),
          parent_id: parent_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ comment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "DELETE") {
      // Delete a comment
      const commentId = url.searchParams.get("comment_id");
      if (!commentId) {
        return new Response(JSON.stringify({ error: "Missing comment_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership
      const { data: existingComment } = await supabase
        .from("training_comments")
        .select("user_id")
        .eq("id", commentId)
        .single();

      if (!existingComment || existingComment.user_id !== session.staff_user_id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("training_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
