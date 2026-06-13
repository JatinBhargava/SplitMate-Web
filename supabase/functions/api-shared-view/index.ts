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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  // This endpoint is PUBLIC — no auth required
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey);

  try {
    const body = await req.json();
    const { code, password } = body;

    if (!code?.trim() || code.trim().length !== 4) {
      return errorResponse("A valid 4-digit group code is required");
    }

    const { data: group, error } = await supabase
      .from("expense_groups")
      .select("*")
      .eq("code", code.trim())
      .single();
    if (error || !group) return errorResponse("Group not found", 404);

    // Check sharing is enabled (share_password must be set)
    if (!group.share_password) {
      return errorResponse("Sharing is not enabled for this group", 403);
    }

    // Verify password
    if (group.share_password !== password?.trim()) {
      return errorResponse("Incorrect password", 401);
    }

    const [membersRes, expensesRes] = await Promise.all([
      supabase.from("group_members").select("id, name").eq("group_id", group.id),
      supabase
        .from("expenses")
        .select("id, paid_by, description, amount, split_among, created_at, category")
        .eq("group_id", group.id)
        .order("created_at", { ascending: false }),
    ]);

    // Calculate balances & settlements inline
    const members = membersRes.data || [];
    const expenses = expensesRes.data || [];

    const balanceMap = new Map<string, { memberId: string; memberName: string; totalPaid: number; totalOwed: number; balance: number }>();
    members.forEach((m: any) => balanceMap.set(m.id, { memberId: m.id, memberName: m.name, totalPaid: 0, totalOwed: 0, balance: 0 }));
    expenses.forEach((e: any) => {
      const split = e.split_among.length > 0 ? e.split_among : members.map((m: any) => m.id);
      const share = e.amount / split.length;
      const payer = balanceMap.get(e.paid_by);
      if (payer) payer.totalPaid += e.amount;
      split.forEach((id: string) => { const m = balanceMap.get(id); if (m) m.totalOwed += share; });
    });
    balanceMap.forEach((b) => { b.balance = b.totalPaid - b.totalOwed; });
    const balances = Array.from(balanceMap.values());

    return jsonResponse({
      group_name: group.name,
      group_code: group.code,
      members,
      expenses,
      balances,
      total_expenses: expenses.reduce((sum: number, e: any) => sum + e.amount, 0),
    });
  } catch (err: any) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
