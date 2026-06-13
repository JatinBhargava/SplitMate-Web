import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Split, History, FileDown, Users, Copy, Share2, Trash2, BarChart3, Menu, Plus, Wallet } from "lucide-react";
import { ProfileDropdown } from "./ProfileDropdown";
import { ThemeToggle } from "./ThemeToggle";
import { ExpenseList } from "./ExpenseList";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { SettlementView } from "./SettlementView";
import { ActivityHistory } from "./ActivityHistory";
import { ShareSettings } from "./ShareSettings";
import { MemberManagement } from "./MemberManagement";
import { Footer } from "./Footer";
import { exportExpensesPdf } from "@/lib/pdfExport";
import { calculateBalances, calculateSettlements } from "@/lib/splitCalculator";
import { ExpenseCharts } from "./ExpenseCharts";
import { BudgetView } from "./BudgetView";
import { ExpenseFilters, type FilterValues } from "./ExpenseFilters";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GroupDashboardProps {
  groupId: string;
  memberId: string;
  memberName: string;
  groupName: string;
  groupCode: string;
  onLeave: () => void;
  onSignOut: () => void;
  userId: string;
}

interface Member { id: string; name: string; user_id?: string | null; }

interface Expense {
  id: string; group_id: string; paid_by: string; created_by: string; description: string;
  amount: number; split_among: string[]; created_at: string; updated_at: string;
  category?: string | null;
}

const navSections = [
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "budget", label: "Budget", icon: Wallet },
  { id: "charts", label: "Charts", icon: BarChart3 },
  { id: "split", label: "Split", icon: Split },
  { id: "history", label: "History", icon: History },
] as const;

export function GroupDashboard({ groupId, memberId, memberName, groupName, groupCode, onLeave, onSignOut, userId }: GroupDashboardProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [budgetIncomeMap, setBudgetIncomeMap] = useState<Record<string, any[]>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [memberMgmtOpen, setMemberMgmtOpen] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({
    search: "", category: "", memberId: "", dateFrom: undefined, dateTo: undefined,
    sortBy: "date", sortOrder: "desc",
  });
  const [activeSection, setActiveSection] = useState("expenses");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const [membersRes, expensesRes, groupRes, budgetsRes] = await Promise.all([
      supabase.from("group_members").select("id, name, user_id").eq("group_id", groupId),
      supabase.from("expenses").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.from("expense_groups").select("created_by").eq("id", groupId).single(),
      supabase.from("budgets").select("*").eq("group_id", groupId),
    ]);
    if (membersRes.data) setMembers(membersRes.data);
    if (expensesRes.data) setExpenses(expensesRes.data);
    if (groupRes.data) setIsCreator(groupRes.data.created_by === userId);
    if (budgetsRes.data) {
      setBudgets(budgetsRes.data);
      const bIds = budgetsRes.data.map((b: any) => b.id);
      if (bIds.length > 0) {
        const { data: incData } = await supabase.from("income_entries").select("*").in("budget_id", bIds);
        if (incData) {
          const m: Record<string, any[]> = {};
          incData.forEach((e: any) => { if (!m[e.budget_id]) m[e.budget_id] = []; m[e.budget_id].push(e); });
          setBudgetIncomeMap(m);
        }
      }
    }
  }, [groupId, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (expense: Expense) => {
    const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
    if (error) { toast({ title: "Error deleting expense", variant: "destructive" }); return; }
    await supabase.from("activity_log").insert({
      group_id: groupId, member_id: memberId, action: "EXPENSE_DELETED",
      details: `${memberName} deleted "${expense.description}" (₹${expense.amount})`,
    });
    toast({ title: "Expense deleted" });
    fetchData();
  };

  const handleCloseGroup = async () => {
    await supabase.from("expenses").delete().eq("group_id", groupId);
    await supabase.from("activity_log").delete().eq("group_id", groupId);
    await supabase.from("group_members").delete().eq("group_id", groupId);
    const { error } = await supabase.from("expense_groups").delete().eq("id", groupId);
    if (error) {
      toast({ title: "Error closing group", variant: "destructive" });
      return;
    }
    toast({ title: "Group closed and all data deleted" });
    onLeave();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(groupCode);
    toast({ title: "Code copied!", description: `Share ${groupCode} with friends` });
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

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const filteredExpenses = expenses.filter((e) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const paidByName = (memberMap.get(e.paid_by) || "").toLowerCase();
      if (!e.description.toLowerCase().includes(q) && !paidByName.includes(q)) return false;
    }
    if (filters.category && (e.category || "other") !== filters.category) return false;
    if (filters.memberId && e.paid_by !== filters.memberId) return false;
    if (filters.dateFrom && new Date(e.created_at) < filters.dateFrom) return false;
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(e.created_at) > to) return false;
    }
    return true;
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const order = filters.sortOrder === "asc" ? 1 : -1;
    if (filters.sortBy === "amount") {
      return (a.amount - b.amount) * order;
    }
    if (filters.sortBy === "paid_by") {
      const aName = memberMap.get(a.paid_by) || "";
      const bName = memberMap.get(b.paid_by) || "";
      return aName.localeCompare(bName) * order;
    }
    if (filters.sortBy === "description") {
      return a.description.localeCompare(b.description) * order;
    }
    const aDate = new Date(a.created_at).getTime();
    const bDate = new Date(b.created_at).getTime();
    return (aDate - bDate) * order;
  });

  const handleSidebarNav = (sectionId: string) => {
    setActiveSection(sectionId);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold font-display">{groupName}</h1>
              <p className="text-sm text-muted-foreground">Welcome back, <span className="font-medium text-foreground">{memberName}</span></p>
              <button onClick={copyCode} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <span className="font-mono">Code: {groupCode}</span>
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={onLeave} title="Back to groups">
              <Receipt className="w-4 h-4" />
            </Button>
            <ProfileDropdown memberName={memberName} userId={userId} onSignOut={onSignOut} />
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle className="text-lg font-display">{groupName}</SheetTitle>
          </SheetHeader>

          <nav className="flex flex-col gap-1 px-3 py-2">
            {navSections.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSidebarNav(item.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <Separator className="my-2" />

          <div className="flex flex-col gap-1 px-3 py-2">
            <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</p>
            <button
              onClick={() => { setEditExpense(null); setAddOpen(true); setSidebarOpen(false); }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Expense
            </button>
            <button
              onClick={() => { handleExportPdf(); setSidebarOpen(false); }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <FileDown className="w-4 h-4" /> Export PDF
            </button>
            <button
              onClick={() => { setMemberMgmtOpen(true); setSidebarOpen(false); }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Users className="w-4 h-4" /> Members
            </button>
            <button
              onClick={() => { setShareOpen(true); setSidebarOpen(false); }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Share2 className="w-4 h-4" /> Share Settings
            </button>
            {isCreator && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-4 h-4" /> Close Group
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close this group?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all expenses, activity history, and member data for "{groupName}". This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCloseGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <main className="container max-w-3xl mx-auto px-4 py-6 flex-1">
        {/* Icon-only scrollable tab bar */}
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 mb-4 border-b border-border">
            {navSections.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeSection === item.id ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "shrink-0 h-10 w-10 rounded-full transition-all",
                      activeSection === item.id && "shadow-md"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}

            {/* Quick add expense button in tab bar */}
            <div className="ml-auto shrink-0">
              <Button onClick={() => { setEditExpense(null); setAddOpen(true); }} size="sm" className="gap-1.5 rounded-full">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
          </div>
        </TooltipProvider>

        {/* Summary Cards - hidden on budget section */}
        {activeSection !== "budget" && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="glass-card rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold font-display text-primary">₹{totalExpenses.toFixed(2)}</p>
            </div>
            <button
              onClick={() => setMemberMgmtOpen(true)}
              className="glass-card rounded-xl p-4 text-center hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer w-full"
            >
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Members</p>
              <p className="text-2xl font-bold font-display">{members.length}</p>
            </button>
          </div>
        )}

        {/* Content area */}
        <div className="animate-fade-in">
          {activeSection === "expenses" && (
            <>
              <ExpenseFilters members={members} filters={filters} onChange={setFilters} />
              <ExpenseList expenses={filteredExpenses} members={members} currentMemberId={memberId}
                onEdit={(e) => { setEditExpense(e); setAddOpen(true); }} onDelete={handleDelete} />
            </>
          )}
          {activeSection === "budget" && (
            <BudgetView groupId={groupId} memberId={memberId} members={members} expenses={expenses} onDataChanged={fetchData} />
          )}
          {activeSection === "charts" && (
            <ExpenseCharts expenses={expenses} members={members} budgets={budgets} budgetIncomeMap={budgetIncomeMap} />
          )}
          {activeSection === "split" && (
            <SettlementView expenses={expenses} members={members} groupId={groupId} memberId={memberId} memberName={memberName} userId={userId} isCreator={isCreator} onSettled={fetchData} />
          )}
          {activeSection === "history" && (
            <ActivityHistory groupId={groupId} members={members} />
          )}
        </div>
      </main>

      <AddExpenseDialog open={addOpen} onOpenChange={setAddOpen} groupId={groupId}
        memberId={memberId} memberName={memberName} members={members}
        editExpense={editExpense} onSaved={fetchData} />

      <ShareSettings open={shareOpen} onOpenChange={setShareOpen} groupId={groupId} />

      <MemberManagement open={memberMgmtOpen} onOpenChange={setMemberMgmtOpen}
        groupId={groupId} members={members} currentMemberId={memberId}
        onMemberChanged={fetchData} isCreator={isCreator} />

      <Footer />
    </div>
  );
}
