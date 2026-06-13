import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, FileDown, ArrowLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ExpenseList } from "@/components/ExpenseList";
import { SettlementView } from "@/components/SettlementView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportExpensesPdf } from "@/lib/pdfExport";
import { calculateBalances, calculateSettlements } from "@/lib/splitCalculator";
import { Receipt, Split } from "lucide-react";

interface Member { id: string; name: string; }
interface Expense {
  id: string; group_id: string; paid_by: string; description: string;
  amount: number; split_among: string[]; created_at: string; updated_at: string; category?: string | null;
}

export default function SharedView() {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [unlocked, setUnlocked] = useState(false);

  const handleView = async () => {
    if (!code.trim() || code.trim().length !== 4) {
      toast({ title: "Enter a valid 4-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: group, error } = await supabase
        .from("expense_groups")
        .select("*")
        .eq("code", code.trim())
        .single();
      if (error || !group) {
        toast({ title: "Group not found", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Check password if set
      if (group.share_password && group.share_password !== password.trim()) {
        toast({ title: "Incorrect password", variant: "destructive" });
        setLoading(false);
        return;
      }

      if (group.share_password === null && !group.share_password) {
        // No password set — check if sharing is enabled (password must be explicitly set)
        // If share_password is null, sharing is not enabled
        toast({ title: "Sharing is not enabled for this group", description: "The group creator needs to set a share password first.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const [membersRes, expensesRes] = await Promise.all([
        supabase.from("group_members").select("id, name").eq("group_id", group.id),
        supabase.from("expenses").select("*").eq("group_id", group.id).order("created_at", { ascending: false }),
      ]);

      setGroupName(group.name);
      setGroupCode(group.code);
      setMembers(membersRes.data || []);
      setExpenses(expensesRes.data || []);
      setUnlocked(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = () => {
    const memberMap = new Map(members.map((m) => [m.id, m.name]));
    const expenseRows = expenses.map((e) => ({
      description: e.description || "Untitled",
      amount: e.amount,
      paidByName: memberMap.get(e.paid_by) || "Unknown",
      splitAmongNames: (e.split_among.length > 0 ? e.split_among : members.map((m) => m.id)).map(
        (id) => memberMap.get(id) || "Unknown"
      ),
      date: new Date(e.created_at).toLocaleDateString(),
    }));
    const balances = calculateBalances(expenses, members);
    const settlements = calculateSettlements(expenses, members);
    exportExpensesPdf(groupName, groupCode, expenseRows, balances, settlements);
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Eye className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-display tracking-tight">View Expenses</h1>
            <p className="text-muted-foreground mt-2">Enter the group code and password to view shared expenses</p>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display text-lg">Access Shared Expenses</CardTitle>
              <CardDescription>The group creator must have enabled sharing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Group Code</Label>
                <Input
                  placeholder="4-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  className="text-center text-2xl font-display tracking-[0.5em]"
                />
              </div>
              <div>
                <Label>Share Password</Label>
                <Input
                  type="password"
                  placeholder="Password set by group creator"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleView} disabled={loading} className="w-full">
                {loading ? "Loading..." : "View Expenses"}
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-4">
            <a href="/" className="text-primary hover:underline flex items-center justify-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to login
            </a>
          </p>
        </div>
      </div>
    );
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-display">{groupName}</h1>
            <span className="text-sm text-muted-foreground font-mono">Code: {groupCode}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportPdf} className="gap-2" size="sm">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setUnlocked(false)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold font-display text-primary">₹{totalExpenses.toFixed(2)}</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="text-2xl font-bold font-display">{expenses.length}</p>
          </div>
        </div>

        <Tabs defaultValue="expenses">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="expenses" className="flex-1 gap-2">
              <Receipt className="w-4 h-4" /> Expenses
            </TabsTrigger>
            <TabsTrigger value="split" className="flex-1 gap-2">
              <Split className="w-4 h-4" /> Split
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses">
            <ExpenseList
              expenses={expenses}
              members={members}
              currentMemberId=""
              onEdit={() => {}}
              onDelete={() => {}}
              readOnly
            />
          </TabsContent>

          <TabsContent value="split">
            <SettlementView expenses={expenses} members={members} groupId="" memberId="" memberName="" userId="" isCreator={false} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
