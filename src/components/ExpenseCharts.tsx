import { useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ResponsiveContainer, Tooltip, Legend, AreaChart, Area,
} from "recharts";
import { EXPENSE_CATEGORIES } from "@/lib/categories";

interface Member { id: string; name: string; }
interface Expense {
  id: string; group_id: string; paid_by: string; description: string;
  amount: number; split_among: string[]; created_at: string; category?: string | null;
}
interface Budget {
  id: string; name: string; type: string; budget_limit: number | null;
  member_ids: string[]; linked_expense_ids: string[];
}
interface IncomeEntry {
  id: string; budget_id: string; added_by: string;
  description: string; amount: number; created_at: string;
}

interface ExpenseChartsProps {
  expenses: Expense[];
  members: Member[];
  budgets?: Budget[];
  budgetIncomeMap?: Record<string, IncomeEntry[]>;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 55%)",
  "hsl(340, 65%, 55%)",
  "hsl(160, 60%, 45%)",
  "hsl(45, 80%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(20, 70%, 55%)",
];

export function ExpenseCharts({ expenses, members, budgets = [], budgetIncomeMap = {} }: ExpenseChartsProps) {
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const cat = e.category || "other";
      map.set(cat, (map.get(cat) || 0) + e.amount);
    });
    return Array.from(map.entries()).map(([key, value]) => {
      const cat = EXPENSE_CATEGORIES.find((c) => c.value === key);
      return { name: cat ? `${cat.icon} ${cat.label}` : key, value: Math.round(value * 100) / 100 };
    }).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const memberData = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      map.set(e.paid_by, (map.get(e.paid_by) || 0) + e.amount);
    });
    return Array.from(map.entries()).map(([id, value]) => {
      const m = members.find((m) => m.id === id);
      return { name: m?.name || "Unknown", amount: Math.round(value * 100) / 100 };
    }).sort((a, b) => b.amount - a.amount);
  }, [expenses, members]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => {
        const [y, m] = month.split("-");
        const label = new Date(+y, +m - 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        return { month: label, amount: Math.round(amount * 100) / 100 };
      });
  }, [expenses]);

  // Budget comparison data
  const budgetComparisonData = useMemo(() => {
    if (budgets.length === 0) return [];
    return budgets.map((b) => {
      const incomeEntries = budgetIncomeMap[b.id] || [];
      const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
      const linkedExpenses = b.linked_expense_ids.length > 0
        ? expenses.filter((e) => b.linked_expense_ids.includes(e.id))
        : expenses.filter((e) => b.member_ids.includes(e.paid_by));
      const totalExpense = linkedExpenses.reduce((s, e) => s + e.amount, 0);
      return {
        name: b.name,
        income: Math.round(totalIncome),
        expenses: Math.round(totalExpense),
        balance: Math.round(totalIncome - totalExpense),
        limit: b.budget_limit ? Math.round(b.budget_limit) : null,
      };
    });
  }, [budgets, budgetIncomeMap, expenses]);

  // Monthly income vs expenses trend
  const monthlyIncomeVsExpense = useMemo(() => {
    if (budgets.length === 0) return [];
    const expMap = new Map<string, number>();
    const incMap = new Map<string, number>();

    expenses.forEach((e) => {
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      expMap.set(key, (expMap.get(key) || 0) + e.amount);
    });

    Object.values(budgetIncomeMap).flat().forEach((e: IncomeEntry) => {
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      incMap.set(key, (incMap.get(key) || 0) + e.amount);
    });

    const allMonths = new Set([...expMap.keys(), ...incMap.keys()]);
    return Array.from(allMonths)
      .sort()
      .map((month) => {
        const [y, m] = month.split("-");
        const label = new Date(+y, +m - 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        return {
          month: label,
          income: Math.round(incMap.get(month) || 0),
          expenses: Math.round(expMap.get(month) || 0),
        };
      });
  }, [expenses, budgets, budgetIncomeMap]);

  // Budget utilization (percentage used of limit or income)
  const budgetUtilizationData = useMemo(() => {
    return budgets
      .filter((b) => b.budget_limit || (budgetIncomeMap[b.id]?.length ?? 0) > 0)
      .map((b) => {
        const incomeEntries = budgetIncomeMap[b.id] || [];
        const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
        const linkedExpenses = b.linked_expense_ids.length > 0
          ? expenses.filter((e) => b.linked_expense_ids.includes(e.id))
          : expenses.filter((e) => b.member_ids.includes(e.paid_by));
        const totalExpense = linkedExpenses.reduce((s, e) => s + e.amount, 0);
        const cap = b.budget_limit || totalIncome;
        const pct = cap > 0 ? Math.round((totalExpense / cap) * 100) : 0;
        return { name: b.name, used: Math.min(pct, 100), remaining: Math.max(100 - pct, 0) };
      });
  }, [budgets, budgetIncomeMap, expenses]);

  if (expenses.length === 0 && budgets.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
        No expenses to visualize yet. Add some expenses to see charts!
      </div>
    );
  }

  const formatCurrency = (v: number) => `₹${v.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      {/* Income vs Expenses Comparison by Budget */}
      {budgetComparisonData.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Income vs Expenses by Budget</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetComparisonData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                <YAxis tickFormatter={(v) => `₹${v}`} className="text-xs fill-muted-foreground" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                {budgetComparisonData.some((d) => d.limit) && (
                  <Bar dataKey="limit" name="Budget Limit" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.3} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly Income vs Expenses Trend */}
      {monthlyIncomeVsExpense.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Monthly Income vs Expenses</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyIncomeVsExpense} margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                <YAxis tickFormatter={(v) => `₹${v}`} className="text-xs fill-muted-foreground" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Area type="monotone" dataKey="income" name="Income" stroke="hsl(var(--primary))" fill="url(#incomeGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--accent))" fill="url(#expenseGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Budget Utilization */}
      {budgetUtilizationData.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Budget Utilization (%)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetUtilizationData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs fill-muted-foreground" />
                <YAxis type="category" dataKey="name" width={80} className="text-xs fill-muted-foreground" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend />
                <Bar dataKey="used" name="Used" stackId="a" fill="hsl(var(--accent))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="remaining" name="Remaining" stackId="a" fill="hsl(var(--primary))" opacity={0.3} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category Pie Chart */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Spending by Category</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Member Bar Chart */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Paid by Member</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={memberData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis type="number" tickFormatter={(v) => `₹${v}`} className="text-xs fill-muted-foreground" />
              <YAxis type="category" dataKey="name" width={80} className="text-xs fill-muted-foreground" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Trend */}
      {monthlyData.length > 1 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Monthly Spending Trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                <YAxis tickFormatter={(v) => `₹${v}`} className="text-xs fill-muted-foreground" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
