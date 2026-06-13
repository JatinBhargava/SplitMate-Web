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

  const url = new URL(req.url);
  const groupId = url.searchParams.get("group_id");
  if (!groupId) return errorResponse("group_id query parameter is required");

  try {
    // GET — get share settings
    if (req.method === "GET") {
      const { data: group } = await supabase
        .from("expense_groups")
        .select("share_password, created_by")
        .eq("id", groupId)
        .single();
      if (!group) return errorResponse("Group not found", 404);

      return jsonResponse({
        sharing_enabled: !!group.share_password,
        is_creator: group.created_by === user.id,
      });
    }

    // PUT — update share password
    if (req.method === "PUT") {
      const body = await req.json();
      const { share_password } = body;

      // Verify creator
      const { data: group } = await supabase
        .from("expense_groups")
        .select("created_by")
        .eq("id", groupId)
        .single();
      if (!group) return errorResponse("Group not found", 404);
      if (group.created_by !== user.id) {
        return errorResponse("Only the group creator can update share settings", 403);
      }

      const { error } = await supabase
        .from("expense_groups")
        .update({ share_password: share_password || null })
        .eq("id", groupId);
      if (error) throw error;

      return jsonResponse({
        message: share_password ? "Sharing enabled" : "Sharing disabled",
        sharing_enabled: !!share_password,
      });
    }

    return errorResponse("Method not allowed", 405);
  } catch (err: any) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
