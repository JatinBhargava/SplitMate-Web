import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateBalances,
  calculateSettlements,
  adjustBalancesForSettlements,
  calculateRemainingSettlements,
  type SettlementRecord,
} from "@/lib/splitCalculator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, TrendingUp, TrendingDown, CheckCircle2, Clock, HandCoins, Undo2,
} from "lucide-react";

interface Expense {
  id: string;
  paid_by: string;
  amount: number;
  split_among: string[];
}

interface Member {
  id: string;
  name: string;
  user_id?: string | null;
}

interface SettlementViewProps {
  expenses: Expense[];
  members: Member[];
  groupId: string;
  memberId: string;
  memberName: string;
  userId: string;
  isCreator: boolean;
  onSettled?: () => void;
}

export function SettlementView({ expenses, members, groupId, memberId, memberName, userId, isCreator, onSettled }: SettlementViewProps) {
  const { toast } = useToast();
  const [settlementRecords, setSettlementRecords] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSettlements = useCallback(async () => {
    const { data } = await supabase
      .from("settlements")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    if (data) setSettlementRecords(data as SettlementRecord[]);
  }, [groupId]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const rawBalances = calculateBalances(expenses, members);
  const adjustedBalances = adjustBalancesForSettlements(rawBalances, settlementRecords, members);
  const remainingSettlements = calculateRemainingSettlements(adjustedBalances);

  // Check if current user is involved in a settlement (from or to member)
  const canSettle = (fromMemberId: string, toMemberId: string): boolean => {
    if (isCreator) return true;
    // Find the member records for from/to and check if current userId matches
    const fromMember = members.find(m => m.id === fromMemberId);
    const toMember = members.find(m => m.id === toMemberId);
    return (fromMember?.user_id === userId) || (toMember?.user_id === userId);
  };

  const handleMarkPaid = async (from: string, fromName: string, to: string, toName: string, amount: number) => {
    if (!canSettle(from, to)) {
      toast({ title: "Only involved members or the group creator can mark this as settled", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("settlements").insert({
      group_id: groupId,
      from_member_id: from,
      to_member_id: to,
      amount,
      settled_by: memberId,
    });
    if (error) {
      toast({ title: "Error recording settlement", variant: "destructive" });
      setLoading(false);
      return;
    }
    await supabase.from("activity_log").insert({
      group_id: groupId,
      member_id: memberId,
      action: "SETTLEMENT_PAID",
      details: `${memberName} marked ₹${amount.toFixed(2)} payment from ${fromName} to ${toName} as settled`,
    });
    toast({ title: "Settlement recorded!" });
    await fetchSettlements();
    onSettled?.();
    setLoading(false);
  };

  const handleUnsettle = async (settlement: SettlementRecord) => {
    if (!canSettle(settlement.from_member_id, settlement.to_member_id)) {
      toast({ title: "Only involved members or the group creator can undo this settlement", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("settlements").delete().eq("id", settlement.id);
    if (error) {
      toast({ title: "Error undoing settlement", variant: "destructive" });
      setLoading(false);
      return;
    }
    const fromName = memberMap.get(settlement.from_member_id) || "Unknown";
    const toName = memberMap.get(settlement.to_member_id) || "Unknown";
    await supabase.from("activity_log").insert({
      group_id: groupId,
      member_id: memberId,
      action: "SETTLEMENT_UNDONE",
      details: `${memberName} undid ₹${Number(settlement.amount).toFixed(2)} settlement from ${fromName} to ${toName}`,
    });
    toast({ title: "Settlement undone" });
    await fetchSettlements();
    onSettled?.();
    setLoading(false);
  };

  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No expenses to split</p>
        <p className="text-sm">Add expenses first to see the split</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Member balances (raw from expenses) */}
      <div>
        <h3 className="font-display font-semibold mb-3">Member Balances</h3>
        <div className="space-y-2">
          {rawBalances.map((b) => (
            <Card key={b.memberId} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {b.balance > 0.01 ? (
                  <TrendingUp className="w-4 h-4 text-success" />
                ) : b.balance < -0.01 ? (
                  <TrendingDown className="w-4 h-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="font-medium">{b.memberName}</span>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  Paid: ₹{b.totalPaid.toFixed(2)} · Owes: ₹{b.totalOwed.toFixed(2)}
                </p>
                <p className={`font-bold font-display text-sm ${
                  b.balance > 0.01 ? "text-success" : b.balance < -0.01 ? "text-destructive" : "text-muted-foreground"
                }`}>
                  {b.balance >= 0 ? "+" : ""}₹{b.balance.toFixed(2)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Remaining Settlements */}
      <div>
        <h3 className="font-display font-semibold mb-3">Who Pays Whom</h3>
        {remainingSettlements.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success" />
            <p>All settled up!</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {remainingSettlements.map((s, i) => {
              const allowed = canSettle(s.from, s.to);
              return (
                <Card key={i} className="p-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                    <span className="font-semibold text-destructive truncate">{s.fromName}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-success truncate">{s.toName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold font-display text-primary">₹{s.amount.toFixed(2)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      disabled={loading || !allowed}
                      title={!allowed ? "Only involved members or the group creator can settle this" : ""}
                      onClick={() => handleMarkPaid(s.from, s.fromName, s.to, s.toName, s.amount)}
                    >
                      <HandCoins className="w-3.5 h-3.5" /> Paid
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Settlement History */}
      {settlementRecords.length > 0 && (
        <div>
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Settlement History
          </h3>
          <div className="space-y-2">
            {settlementRecords.map((s) => {
              const allowed = canSettle(s.from_member_id, s.to_member_id);
              return (
                <Card key={s.id} className="p-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <span className="truncate">
                      <span className="font-medium">{memberMap.get(s.from_member_id) || "Unknown"}</span>
                      {" → "}
                      <span className="font-medium">{memberMap.get(s.to_member_id) || "Unknown"}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="font-bold font-display text-success">₹{Number(s.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-xs text-destructive hover:text-destructive"
                      disabled={loading || !allowed}
                      title={!allowed ? "Only involved members or the group creator can undo this" : "Undo settlement"}
                      onClick={() => handleUnsettle(s)}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
