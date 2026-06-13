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
  const expenseId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

  try {
    // GET /api-expenses?group_id=xxx — list expenses for a group
    if (req.method === "GET" && !expenseId) {
      const groupId = url.searchParams.get("group_id");
      if (!groupId) return errorResponse("group_id query parameter is required");

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return jsonResponse({ expenses: data });
    }

    // POST /api-expenses — create an expense
    if (req.method === "POST" && !expenseId) {
      const body = await req.json();
      const { group_id, paid_by, amount, description, split_among, category } = body;

      if (!group_id) return errorResponse("group_id is required");
      if (!paid_by) return errorResponse("paid_by (member_id) is required");
      if (!amount || amount <= 0) return errorResponse("A positive amount is required");

      // Get member name for activity log
      const { data: member } = await supabase
        .from("group_members")
        .select("name")
        .eq("id", paid_by)
        .single();

      const { data: expense, error } = await supabase
        .from("expenses")
        .insert({
          group_id,
          paid_by,
          amount,
          description: description || "",
          split_among: split_among || [],
          category: category || null,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("activity_log").insert({
        group_id,
        member_id: paid_by,
        action: "EXPENSE_ADDED",
        details: `${member?.name || "Someone"} added "${description || "Untitled"}" (₹${amount})`,
      });

      return jsonResponse({ expense }, 201);
    }

    // PUT /api-expenses/<expenseId> — update an expense
    if (req.method === "PUT" && expenseId) {
      const body = await req.json();
      const { paid_by, amount, description, split_among, category, member_id } = body;

      const updateData: any = {};
      if (paid_by !== undefined) updateData.paid_by = paid_by;
      if (amount !== undefined) updateData.amount = amount;
      if (description !== undefined) updateData.description = description;
      if (split_among !== undefined) updateData.split_among = split_among;
      if (category !== undefined) updateData.category = category;

      const { data: expense, error } = await supabase
        .from("expenses")
        .update(updateData)
        .eq("id", expenseId)
        .select()
        .single();
      if (error) throw error;

      if (member_id) {
        const { data: member } = await supabase
          .from("group_members")
          .select("name")
          .eq("id", member_id)
          .single();

        await supabase.from("activity_log").insert({
          group_id: expense.group_id,
          member_id,
          action: "EXPENSE_UPDATED",
          details: `${member?.name || "Someone"} updated "${expense.description || "Untitled"}" (₹${expense.amount})`,
        });
      }

      return jsonResponse({ expense });
    }

    // DELETE /api-expenses/<expenseId>?member_id=xxx
    if (req.method === "DELETE" && expenseId) {
      const memberId = url.searchParams.get("member_id");

      // Fetch expense first for logging
      const { data: expense } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", expenseId)
        .single();
      if (!expense) return errorResponse("Expense not found", 404);

      const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
      if (error) throw error;

      if (memberId) {
        const { data: member } = await supabase
          .from("group_members")
          .select("name")
          .eq("id", memberId)
          .single();

        await supabase.from("activity_log").insert({
          group_id: expense.group_id,
          member_id: memberId,
          action: "EXPENSE_DELETED",
          details: `${member?.name || "Someone"} deleted "${expense.description || "Untitled"}" (₹${expense.amount})`,
        });
      }

      return jsonResponse({ message: "Expense deleted" });
    }

    return errorResponse("Not found", 404);
  } catch (err: any) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
