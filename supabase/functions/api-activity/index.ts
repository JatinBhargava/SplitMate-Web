import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function getSupabaseClient(authHeader: string | null) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader ?? "" } },
  });
}

async function getUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  const supabase = getSupabaseClient(authHeader);
  const user = await getUser(supabase);
  if (!user) return errorResponse("Unauthorized", 401);

  if (req.method !== "GET") return errorResponse("Method not allowed", 405);

  const url = new URL(req.url);
  const groupId = url.searchParams.get("group_id");
  if (!groupId) return errorResponse("group_id query parameter is required");

  const limit = parseInt(url.searchParams.get("limit") || "50");

  try {
    const { data, error } = await supabase
      .from("activity_log")
      .select("id, action, details, member_id, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return jsonResponse({ activities: data });
  } catch (err: any) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
