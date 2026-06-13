import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Plus, Wallet, Trash2, AlertTriangle, TrendingUp, TrendingDown,
  Users, User, Pencil, Link2, Unlink, FileDown, Search, ArrowUpDown, List, SplitSquareVertical,
  SlidersHorizontal, CalendarIcon, X,
} from "lucide-react";
import { CreateBudgetDialog } from "./CreateBudgetDialog";
import { AddIncomeDialog } from "./AddIncomeDialog";
import { exportBudgetPdf } from "@/lib/pdfExport";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Member { id: string; name: string; }

interface Expense {
  id: string; group_id: string; paid_by: string; description: string;
  amount: number; split_among: string[]; created_at: string; updated_at: string;
  category?: string | null;
}

interface Budget {
  id: string; group_id: string; created_by: string; type: string;
  name: string; budget_limit: number | null; member_ids: string[];
  linked_expense_ids: string[]; created_at: string;
}

interface IncomeEntry {
  id: string; budget_id: string; added_by: string;
  description: string; amount: number; created_at: string;
}

interface BudgetViewProps {
  groupId: string;
  memberId: string;
  members: Member[];
  expenses: Expense[];
  onDataChanged?: () => void;
}

type SortOrder = "newest" | "oldest" | "amount-high" | "amount-low";

export function BudgetView({ groupId, memberId, members, expenses, onDataChanged }: BudgetViewProps) {
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [incomeMap, setIncomeMap] = useState<Record<string, IncomeEntry[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [editIncome, setEditIncome] = useState<IncomeEntry | null>(null);
  const [activeBudgetId, setActiveBudgetId] = useState<string | null>(null);
  const [linkDialogBudget, setLinkDialogBudget] = useState<Budget | null>(null);
  const [linkSelection, setLinkSelection] = useState<string[]>([]);

  // Filters & search
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [viewMode, setViewMode] = useState<"separate" | "combined">("separate");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = [
    typeFilter !== "all",
    memberFilter !== "all",
    sortOrder !== "newest",
    viewMode !== "separate",
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  const fetchBudgets = useCallback(async () => {
    const { data } = await supabase.from("budgets").select("*").eq("group_id", groupId).order("created_at", { ascending: false });
    if (data) {
      setBudgets(data);
      const budgetIds = data.map((b: Budget) => b.id);
      if (budgetIds.length > 0) {
        const { data: incomeData } = await supabase.from("income_entries").select("*").in("budget_id", budgetIds).order("created_at", { ascending: false });
        if (incomeData) {
          const map: Record<string, IncomeEntry[]> = {};
          incomeData.forEach((entry: IncomeEntry) => {
            if (!map[entry.budget_id]) map[entry.budget_id] = [];
            map[entry.budget_id].push(entry);
          });
          setIncomeMap(map);
        }
      } else {
        setIncomeMap({});
      }
    }
    onDataChanged?.();
  }, [groupId, onDataChanged]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  const getLinkedExpenses = (budget: Budget): Expense[] => {
    if (budget.linked_expense_ids.length > 0) {
      return expenses.filter((e) => budget.linked_expense_ids.includes(e.id));
    }
    return expenses.filter((e) => budget.member_ids.includes(e.paid_by));
  };

  const getTotalIncome = (budgetId: string) => (incomeMap[budgetId] || []).reduce((sum, e) => sum + e.amount, 0);
  const getTotalExpenses = (budget: Budget) => getLinkedExpenses(budget).reduce((sum, e) => sum + e.amount, 0);

  // Filter budgets
  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      if (search) {
        const q = search.toLowerCase();
        if (!b.name.toLowerCase().includes(q)) return false;
      }
      if (typeFilter !== "all" && b.type !== typeFilter) return false;
      if (memberFilter !== "all" && !b.member_ids.includes(memberFilter)) return false;
      return true;
    });
  }, [budgets, search, typeFilter, memberFilter]);

  // Date filter helper
  const isInDateRange = (dateStr: string) => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(dateStr);
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      if (d < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    return true;
  };

  // Build combined transactions for a budget
  const getCombinedTransactions = (budget: Budget) => {
    const incomeEntries = incomeMap[budget.id] || [];
    const linkedExpenses = getLinkedExpenses(budget);

    type Transaction = { id: string; type: "income" | "expense"; description: string; amount: number; by: string; date: string; created_at: string; };

    const transactions: Transaction[] = [
      ...incomeEntries.map((e) => ({
        id: e.id, type: "income" as const, description: e.description,
        amount: e.amount, by: memberMap.get(e.added_by) || "Unknown", date: new Date(e.created_at).toLocaleDateString(), created_at: e.created_at,
      })),
      ...linkedExpenses.map((e) => ({
        id: e.id, type: "expense" as const, description: e.description || "Untitled",
        amount: e.amount, by: memberMap.get(e.paid_by) || "Unknown", date: new Date(e.created_at).toLocaleDateString(), created_at: e.created_at,
      })),
    ];

    // Apply search and date filters
    const filtered = transactions.filter((t) => {
      if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.by.toLowerCase().includes(search.toLowerCase())) return false;
      if (!isInDateRange(t.created_at)) return false;
      return true;
    });

    // Sort
    return filtered.sort((a, b) => {
      switch (sortOrder) {
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "amount-high": return b.amount - a.amount;
        case "amount-low": return a.amount - b.amount;
      }
    });
  };

  // Sort income/expenses separately
  const getSortedIncome = (budgetId: string) => {
    const entries = (incomeMap[budgetId] || []).filter(e => isInDateRange(e.created_at));
    return [...entries].sort((a, b) => {
      switch (sortOrder) {
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "amount-high": return b.amount - a.amount;
        case "amount-low": return a.amount - b.amount;
      }
    });
  };

  const getSortedExpenses = (budget: Budget) => {
    const linked = getLinkedExpenses(budget).filter(e => isInDateRange(e.created_at));
    return [...linked].sort((a, b) => {
      switch (sortOrder) {
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "amount-high": return b.amount - a.amount;
        case "amount-low": return a.amount - b.amount;
      }
    });
  };

  const handleDeleteBudget = async (budgetId: string) => {
    const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
    if (error) { toast({ title: "Error deleting budget", variant: "destructive" }); return; }
    toast({ title: "Budget deleted" }); fetchBudgets();
  };

  const handleDeleteIncome = async (incomeId: string) => {
    const { error } = await supabase.from("income_entries").delete().eq("id", incomeId);
    if (error) { toast({ title: "Error deleting income", variant: "destructive" }); return; }
    toast({ title: "Income entry deleted" }); fetchBudgets();
  };

  const openLinkDialog = (budget: Budget) => {
    setLinkDialogBudget(budget);
    setLinkSelection(budget.linked_expense_ids.length > 0
      ? [...budget.linked_expense_ids]
      : expenses.filter(e => budget.member_ids.includes(e.paid_by)).map(e => e.id)
    );
  };

  const saveLinkSelection = async () => {
    if (!linkDialogBudget) return;
    const { error } = await supabase.from("budgets").update({ linked_expense_ids: linkSelection }).eq("id", linkDialogBudget.id);
    if (error) { toast({ title: "Error updating links", variant: "destructive" }); return; }
    toast({ title: "Expense links updated!" });
    setLinkDialogBudget(null);
    fetchBudgets();
  };

  const unlinkAllExpenses = async (budget: Budget) => {
    const { error } = await supabase.from("budgets").update({ linked_expense_ids: [] }).eq("id", budget.id);
    if (error) { toast({ title: "Error unlinking", variant: "destructive" }); return; }
    toast({ title: "All expenses unlinked — budget now auto-tracks by members" });
    fetchBudgets();
  };

  const handleExportBudgetPdf = (budget: Budget) => {
    const totalIncome = getTotalIncome(budget.id);
    const linked = getLinkedExpenses(budget);
    const totalExp = linked.reduce((s, e) => s + e.amount, 0);
    const incomeEntries = (incomeMap[budget.id] || []).map(e => ({
      description: e.description, amount: e.amount,
      addedBy: memberMap.get(e.added_by) || "Unknown",
      date: new Date(e.created_at).toLocaleDateString(),
    }));
    const linkedExpenses = linked.map(e => ({
      description: e.description || "Untitled", amount: e.amount,
      paidBy: memberMap.get(e.paid_by) || "Unknown",
      date: new Date(e.created_at).toLocaleDateString(),
    }));
    exportBudgetPdf(budget.name, {
      budgetName: budget.name,
      budgetType: budget.type,
      budgetLimit: budget.budget_limit,
      memberNames: budget.member_ids.map(id => memberMap.get(id) || "Unknown"),
      totalIncome, totalExpenses: totalExp, incomeEntries, linkedExpenses,
    });
  };

  if (budgets.length === 0) {
    return (
      <div className="text-center py-12">
        <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Budgets Yet</h3>
        <p className="text-sm text-muted-foreground mb-6">Create a personal or group budget to track income vs expenses.</p>
        <Button onClick={() => { setEditBudget(null); setCreateOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Create Budget
        </Button>
        <CreateBudgetDialog open={createOpen} onOpenChange={setCreateOpen} groupId={groupId} memberId={memberId} members={members} onCreated={fetchBudgets} editBudget={null} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>

        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 relative">
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-3 pointer-events-auto" align="end">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Filters & Sort</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                setTypeFilter("all"); setMemberFilter("all"); setSortOrder("newest");
                setViewMode("separate"); setDateFrom(undefined); setDateTo(undefined);
              }}>
                Clear All
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Member</label>
              <Select value={memberFilter} onValueChange={setMemberFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Sort By</label>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                <SelectTrigger className="h-8 text-xs"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="amount-high">Amount ↓</SelectItem>
                  <SelectItem value="amount-low">Amount ↑</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Date Range</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-8 text-xs flex-1 justify-start", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="w-3 h-3 mr-1" />
                      {dateFrom ? format(dateFrom, "dd/MM/yy") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-8 text-xs flex-1 justify-start", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="w-3 h-3 mr-1" />
                      {dateTo ? format(dateTo, "dd/MM/yy") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">View Mode</label>
              <Button
                variant={viewMode === "combined" ? "secondary" : "outline"}
                size="sm" className="w-full h-8 gap-1 text-xs"
                onClick={() => setViewMode(viewMode === "separate" ? "combined" : "separate")}
              >
                {viewMode === "combined" ? <List className="w-3 h-3" /> : <SplitSquareVertical className="w-3 h-3" />}
                {viewMode === "combined" ? "Combined View" : "Separate View"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button size="sm" onClick={() => { setEditBudget(null); setCreateOpen(true); }} className="gap-1.5 shrink-0">
          <Plus className="w-4 h-4" /> New Budget
        </Button>
      </div>

      {filteredBudgets.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No budgets match your filters.</p>
      )}

      {filteredBudgets.map((budget) => {
        const totalIncome = getTotalIncome(budget.id);
        const totalExpense = getTotalExpenses(budget);
        const remaining = totalIncome - totalExpense;
        const percentage = budget.budget_limit
          ? Math.min((totalExpense / budget.budget_limit) * 100, 100)
          : totalIncome > 0 ? Math.min((totalExpense / totalIncome) * 100, 100) : 0;
        const isWarning = budget.budget_limit ? percentage >= 80 : false;
        const isOver = budget.budget_limit ? totalExpense > budget.budget_limit : false;
        const hasExplicitLinks = budget.linked_expense_ids.length > 0;

        return (
          <div key={budget.id} className="glass-card rounded-xl p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold">{budget.name}</h4>
                  <Badge variant={budget.type === "personal" ? "secondary" : "outline"} className="text-xs gap-1">
                    {budget.type === "personal" ? <User className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    {budget.type}
                  </Badge>
                  {hasExplicitLinks && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Link2 className="w-3 h-3" /> {budget.linked_expense_ids.length} linked
                    </Badge>
                  )}
                </div>
                {budget.type === "group" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Members: {budget.member_ids.map((id) => memberMap.get(id) || "Unknown").join(", ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExportBudgetPdf(budget)} title="Export PDF">
                  <FileDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditBudget(budget); setCreateOpen(true); }} title="Edit budget">
                  <Pencil className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete budget">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{budget.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>This will delete the budget and all its income entries. Linked expenses will not be deleted.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteBudget(budget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 p-2">
                <TrendingUp className="w-4 h-4 mx-auto text-primary mb-1" />
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="font-bold text-sm text-primary">₹{totalIncome.toFixed(0)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <TrendingDown className="w-4 h-4 mx-auto text-destructive mb-1" />
                <p className="text-xs text-muted-foreground">Spent</p>
                <p className="font-bold text-sm text-destructive">₹{totalExpense.toFixed(0)}</p>
              </div>
              <div className={cn("rounded-lg p-2", remaining >= 0 ? "bg-primary/10" : "bg-destructive/10")}>
                <Wallet className="w-4 h-4 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">{budget.budget_limit ? "Remaining" : "Balance"}</p>
                <p className={cn("font-bold text-sm", remaining >= 0 ? "text-primary" : "text-destructive")}>
                  ₹{budget.budget_limit ? (budget.budget_limit - totalExpense).toFixed(0) : remaining.toFixed(0)}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            {(budget.budget_limit || totalIncome > 0) && (
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{budget.budget_limit ? `₹${totalExpense.toFixed(0)} / ₹${budget.budget_limit.toFixed(0)} limit` : `₹${totalExpense.toFixed(0)} / ₹${totalIncome.toFixed(0)} income`}</span>
                  <span>{percentage.toFixed(0)}%</span>
                </div>
                <Progress value={percentage} className={cn("h-2", isOver ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-warning" : "")} />
                {isWarning && !isOver && (
                  <p className="text-xs text-warning flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" /> Approaching budget limit</p>
                )}
                {isOver && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" /> Over budget!</p>
                )}
              </div>
            )}

            {/* Combined view: all transactions in one sorted list */}
            {viewMode === "combined" ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">All Transactions</p>
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
                    onClick={() => { setActiveBudgetId(budget.id); setEditIncome(null); setIncomeOpen(true); }}>
                    <Plus className="w-3 h-3" /> Add Income
                  </Button>
                </div>
                {(() => {
                  const transactions = getCombinedTransactions(budget);
                  if (transactions.length === 0) return <p className="text-xs text-muted-foreground text-center py-2">No transactions yet</p>;
                  return (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {transactions.map((t) => (
                        <div key={`${t.type}-${t.id}`} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Badge variant={t.type === "income" ? "default" : "destructive"} className="text-[10px] px-1.5 py-0 shrink-0">
                              {t.type === "income" ? "IN" : "OUT"}
                            </Badge>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{t.description}</p>
                              <p className="text-xs text-muted-foreground">{t.by} · {t.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={cn("text-sm font-semibold", t.type === "income" ? "text-primary" : "text-destructive")}>
                              {t.type === "income" ? "+" : "-"}₹{t.amount.toFixed(0)}
                            </span>
                            {t.type === "income" && (
                              <>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                  const entry = (incomeMap[budget.id] || []).find(e => e.id === t.id);
                                  if (entry) { setActiveBudgetId(budget.id); setEditIncome(entry); setIncomeOpen(true); }
                                }}>
                                  <Pencil className="w-3 h-3 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteIncome(t.id)}>
                                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {/* Link/Unlink button */}
                <div className="flex justify-end gap-1 mt-2">
                  {hasExplicitLinks && (
                    <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => unlinkAllExpenses(budget)}>
                      <Unlink className="w-3 h-3" /> Reset Links
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => openLinkDialog(budget)}>
                    <Link2 className="w-3 h-3" /> Link/Unlink
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Income entries - separate view */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Income Entries</p>
                    <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
                      onClick={() => { setActiveBudgetId(budget.id); setEditIncome(null); setIncomeOpen(true); }}>
                      <Plus className="w-3 h-3" /> Add Income
                    </Button>
                  </div>
                  {(() => {
                    const sortedIncome = getSortedIncome(budget.id);
                    if (sortedIncome.length === 0) return <p className="text-xs text-muted-foreground text-center py-2">No income added yet</p>;
                    return (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {sortedIncome.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium">{entry.description}</p>
                              <p className="text-xs text-muted-foreground">{memberMap.get(entry.added_by) || "Unknown"} · {new Date(entry.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-semibold text-primary">+₹{entry.amount.toFixed(0)}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setActiveBudgetId(budget.id); setEditIncome(entry); setIncomeOpen(true); }}>
                                <Pencil className="w-3 h-3 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteIncome(entry.id)}>
                                <Trash2 className="w-3 h-3 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Linked Expenses - separate view */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">
                      {hasExplicitLinks ? "Linked Expenses" : "Tracked Expenses"} ({getLinkedExpenses(budget).length})
                    </p>
                    <div className="flex gap-1">
                      {hasExplicitLinks && (
                        <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => unlinkAllExpenses(budget)}>
                          <Unlink className="w-3 h-3" /> Reset
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => openLinkDialog(budget)}>
                        <Link2 className="w-3 h-3" /> Link/Unlink
                      </Button>
                    </div>
                  </div>
                  {(() => {
                    const sortedExp = getSortedExpenses(budget);
                    if (sortedExp.length === 0) return <p className="text-xs text-muted-foreground text-center py-2">No expenses linked</p>;
                    return (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {sortedExp.slice(0, 5).map((e) => (
                          <div key={e.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium">{e.description || "Untitled"}</p>
                              <p className="text-xs text-muted-foreground">{memberMap.get(e.paid_by) || "Unknown"} · {new Date(e.created_at).toLocaleDateString()}</p>
                            </div>
                            <span className="text-sm font-semibold text-destructive">-₹{e.amount.toFixed(0)}</span>
                          </div>
                        ))}
                        {sortedExp.length > 5 && (
                          <p className="text-xs text-muted-foreground text-center py-1">+{sortedExp.length - 5} more expenses</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        );
      })}

      <CreateBudgetDialog open={createOpen} onOpenChange={setCreateOpen}
        groupId={groupId} memberId={memberId} members={members} onCreated={fetchBudgets} editBudget={editBudget} />

      {activeBudgetId && (
        <AddIncomeDialog open={incomeOpen} onOpenChange={setIncomeOpen}
          budgetId={activeBudgetId} memberId={memberId} onSaved={fetchBudgets} editIncome={editIncome} />
      )}

      {/* Link/Unlink expenses dialog */}
      <Dialog open={!!linkDialogBudget} onOpenChange={(v) => { if (!v) setLinkDialogBudget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link Expenses to "{linkDialogBudget?.name}"</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Select which expenses count toward this budget.</p>
          <div className="space-y-1 max-h-60 overflow-y-auto border border-border rounded-lg p-2">
            {expenses.map((e) => (
              <label key={e.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5">
                <Checkbox
                  checked={linkSelection.includes(e.id)}
                  onCheckedChange={(checked) => {
                    setLinkSelection(prev => checked ? [...prev, e.id] : prev.filter(id => id !== e.id));
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.description || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground">{memberMap.get(e.paid_by) || "Unknown"} · ₹{e.amount.toFixed(0)}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogBudget(null)}>Cancel</Button>
            <Button onClick={saveLinkSelection}>{linkSelection.length} expenses selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
