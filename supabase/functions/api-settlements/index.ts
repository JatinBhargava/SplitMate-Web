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

interface Expense { id: string; paid_by: string; amount: number; split_among: string[]; }
interface Member { id: string; name: string; }

function calculateBalances(expenses: Expense[], members: Member[]) {
  const balances = new Map<string, { memberId: string; memberName: string; totalPaid: number; totalOwed: number; balance: number }>();
  members.forEach((m) => balances.set(m.id, { memberId: m.id, memberName: m.name, totalPaid: 0, totalOwed: 0, balance: 0 }));

  expenses.forEach((expense) => {
    const splitMembers = expense.split_among.length > 0 ? expense.split_among : members.map((m) => m.id);
    const share = expense.amount / splitMembers.length;
    const payer = balances.get(expense.paid_by);
    if (payer) payer.totalPaid += expense.amount;
    splitMembers.forEach((id) => { const m = balances.get(id); if (m) m.totalOwed += share; });
  });

  balances.forEach((b) => { b.balance = b.totalPaid - b.totalOwed; });
  return Array.from(balances.values());
}

function calculateSettlements(expenses: Expense[], members: Member[]) {
  const balances = calculateBalances(expenses, members);
  const settlements: { from: string; from_name: string; to: string; to_name: string; amount: number }[] = [];
  const debtors = balances.filter((b) => b.balance < -0.01).map((b) => ({ ...b }));
  const creditors = balances.filter((b) => b.balance > 0.01).map((b) => ({ ...b }));
  debtors.sort((a, b) => a.balance - b.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(-debtors[i].balance, creditors[j].balance);
    if (amount > 0.01) {
      settlements.push({
        from: debtors[i].memberId, from_name: debtors[i].memberName,
        to: creditors[j].memberId, to_name: creditors[j].memberName,
        amount: Math.round(amount * 100) / 100,
      });
    }
    debtors[i].balance += amount;
    creditors[j].balance -= amount;
    if (Math.abs(debtors[i].balance) < 0.01) i++;
    if (Math.abs(creditors[j].balance) < 0.01) j++;
  }
  return settlements;
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

  try {
    const [membersRes, expensesRes, settlementsRes] = await Promise.all([
      supabase.from("group_members").select("id, name").eq("group_id", groupId),
      supabase.from("expenses").select("id, paid_by, amount, split_among").eq("group_id", groupId),
      supabase.from("settlements").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
    ]);

    const members = membersRes.data || [];
    const expenses = expensesRes.data || [];
    const settlementRecords = settlementsRes.data || [];

    return jsonResponse({
      balances: calculateBalances(expenses, members),
      settlements: calculateSettlements(expenses, members),
      settlement_records: settlementRecords,
    });
  } catch (err: any) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
