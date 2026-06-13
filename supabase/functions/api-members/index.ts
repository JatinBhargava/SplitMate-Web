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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const supabase = getSupabaseClient(authHeader);
  const user = await getUser(supabase);
  if (!user) return errorResponse("Unauthorized", 401);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const memberId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

  try {
    // GET /api-members?group_id=xxx
    if (req.method === "GET" && !memberId) {
      const groupId = url.searchParams.get("group_id");
      if (!groupId) return errorResponse("group_id query parameter is required");

      const { data, error } = await supabase
        .from("group_members")
        .select("id, name, user_id, created_at")
        .eq("group_id", groupId);
      if (error) throw error;

      return jsonResponse({ members: data });
    }

    // PUT /api-members/<memberId> — rename member (creator only)
    if (req.method === "PUT" && memberId) {
      const body = await req.json();
      const { name } = body;
      if (!name?.trim()) return errorResponse("Name is required");

      // Get the member's group, verify creator
      const { data: member } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("id", memberId)
        .single();
      if (!member) return errorResponse("Member not found", 404);

      const { data: group } = await supabase
        .from("expense_groups")
        .select("created_by")
        .eq("id", member.group_id)
        .single();
      if (group?.created_by !== user.id) {
        return errorResponse("Only the group creator can rename members", 403);
      }

      const { data: updated, error } = await supabase
        .from("group_members")
        .update({ name: name.trim() })
        .eq("id", memberId)
        .select()
        .single();
      if (error) throw error;

      return jsonResponse({ member: updated });
    }

    // DELETE /api-members/<memberId> — remove member (creator only)
    if (req.method === "DELETE" && memberId) {
      const { data: member } = await supabase
        .from("group_members")
        .select("group_id, name, user_id")
        .eq("id", memberId)
        .single();
      if (!member) return errorResponse("Member not found", 404);

      const { data: group } = await supabase
        .from("expense_groups")
        .select("created_by")
        .eq("id", member.group_id)
        .single();
      if (group?.created_by !== user.id) {
        return errorResponse("Only the group creator can remove members", 403);
      }

      // Delete member's expenses first
      await supabase.from("expenses").delete().eq("paid_by", memberId);
      const { error } = await supabase.from("group_members").delete().eq("id", memberId);
      if (error) throw error;

      return jsonResponse({ message: `Member "${member.name}" removed` });
    }

    return errorResponse("Not found", 404);
  } catch (err: any) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
