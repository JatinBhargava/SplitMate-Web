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
  // pathParts: ["api-groups"] or ["api-groups", "<groupId>"]
  const groupId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

  try {
    // GET /api-groups — list user's groups
    if (req.method === "GET" && !groupId) {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("id, name, group_id")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) {
        return jsonResponse({ groups: [] });
      }

      const groupIds = memberships.map((m: any) => m.group_id);
      const { data: groups } = await supabase
        .from("expense_groups")
        .select("id, name, code, created_by, created_at")
        .in("id", groupIds);

      const { data: allMembers } = await supabase
        .from("group_members")
        .select("group_id")
        .in("group_id", groupIds);

      const countMap: Record<string, number> = {};
      allMembers?.forEach((m: any) => {
        countMap[m.group_id] = (countMap[m.group_id] || 0) + 1;
      });

      const result = (groups || []).map((g: any) => {
        const membership = memberships.find((m: any) => m.group_id === g.id);
        return {
          group_id: g.id,
          member_id: membership?.id,
          group_name: g.name,
          group_code: g.code,
          is_creator: g.created_by === user.id,
          member_count: countMap[g.id] || 0,
          created_at: g.created_at,
        };
      });

      return jsonResponse({ groups: result });
    }

    // POST /api-groups — create a group
    if (req.method === "POST" && !groupId) {
      const body = await req.json();
      const { name } = body;
      if (!name?.trim()) return errorResponse("Group name is required");

      const code = String(Math.floor(1000 + Math.random() * 9000));

      // Get user display name
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      const displayName = profile?.display_name || "User";

      const { data: group, error: groupError } = await supabase
        .from("expense_groups")
        .insert({ name: name.trim(), code, created_by: user.id })
        .select()
        .single();
      if (groupError) throw groupError;

      const { data: member, error: memberError } = await supabase
        .from("group_members")
        .insert({ group_id: group.id, name: displayName, user_id: user.id })
        .select()
        .single();
      if (memberError) throw memberError;

      await supabase.from("activity_log").insert({
        group_id: group.id,
        member_id: member.id,
        action: "GROUP_CREATED",
        details: `${displayName} created group "${name.trim()}"`,
      });

      return jsonResponse({
        group_id: group.id,
        member_id: member.id,
        group_name: group.name,
        group_code: group.code,
        member_name: member.name,
      }, 201);
    }

    // POST /api-groups/join — join a group by code
    if (req.method === "POST" && groupId === "join") {
      const body = await req.json();
      const { code } = body;
      if (!code?.trim() || code.trim().length !== 4) {
        return errorResponse("A valid 4-digit code is required");
      }

      const { data: group, error: groupError } = await supabase
        .from("expense_groups")
        .select("*")
        .eq("code", code.trim())
        .single();
      if (groupError || !group) return errorResponse("Group not found", 404);

      // Check existing membership
      const { data: existing } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", group.id)
        .eq("user_id", user.id)
        .single();

      if (existing) {
        return jsonResponse({
          group_id: group.id,
          member_id: existing.id,
          group_name: group.name,
          group_code: group.code,
          member_name: existing.name,
          already_member: true,
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      const displayName = profile?.display_name || "User";

      const { data: member, error: memberError } = await supabase
        .from("group_members")
        .insert({ group_id: group.id, name: displayName, user_id: user.id })
        .select()
        .single();
      if (memberError) throw memberError;

      await supabase.from("activity_log").insert({
        group_id: group.id,
        member_id: member.id,
        action: "MEMBER_JOINED",
        details: `${displayName} joined the group`,
      });

      return jsonResponse({
        group_id: group.id,
        member_id: member.id,
        group_name: group.name,
        group_code: group.code,
        member_name: member.name,
        already_member: false,
      }, 201);
    }

    // DELETE /api-groups/<groupId> — close/delete group (creator only)
    if (req.method === "DELETE" && groupId) {
      // Verify creator
      const { data: group } = await supabase
        .from("expense_groups")
        .select("created_by")
        .eq("id", groupId)
        .single();
      if (!group) return errorResponse("Group not found", 404);
      if (group.created_by !== user.id) return errorResponse("Only the creator can delete a group", 403);

      await supabase.from("expenses").delete().eq("group_id", groupId);
      await supabase.from("activity_log").delete().eq("group_id", groupId);
      await supabase.from("group_members").delete().eq("group_id", groupId);
      const { error } = await supabase.from("expense_groups").delete().eq("id", groupId);
      if (error) throw error;

      return jsonResponse({ message: "Group and all associated data deleted" });
    }

    return errorResponse("Not found", 404);
  } catch (err: any) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
