import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verifying session ${session_id}, payment_status: ${session.payment_status}`);

    // Check if payment is completed
    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ 
          verified: false, 
          payment_status: session.payment_status,
          message: "Payment not yet completed" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client to update the purchase
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the purchase by session ID
    const { data: purchase, error: fetchError } = await serviceClient
      .from("challenge_purchases")
      .select("id, purchaser_id, agency_id, quantity, total_price_cents, purchased_at, status")
      .eq("stripe_checkout_session_id", session_id)
      .single();

    if (fetchError || !purchase) {
      console.error("Purchase not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Purchase not found for this session" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user owns this purchase
    if (purchase.purchaser_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - purchase belongs to different user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already completed, just return the data
    if (purchase.status === "completed") {
      return new Response(
        JSON.stringify({
          verified: true,
          already_completed: true,
          purchase: {
            quantity: purchase.quantity,
            total_price_cents: purchase.total_price_cents,
            purchased_at: purchase.purchased_at,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update purchase to completed
    const { error: updateError } = await serviceClient
      .from("challenge_purchases")
      .update({
        status: "completed",
        purchased_at: new Date().toISOString(),
        stripe_payment_intent_id: typeof session.payment_intent === 'string' 
          ? session.payment_intent 
          : session.payment_intent?.id || null,
      })
      .eq("id", purchase.id);

    if (updateError) {
      console.error("Failed to update purchase:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update purchase status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully verified and completed purchase ${purchase.id}`);

    return new Response(
      JSON.stringify({
        verified: true,
        purchase: {
          quantity: purchase.quantity,
          total_price_cents: purchase.total_price_cents,
          purchased_at: new Date().toISOString(),
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error verifying session:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
