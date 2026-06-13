import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/categories";

interface Expense {
  id: string;
  group_id: string;
  paid_by: string;
  created_by: string;
  description: string;
  amount: number;
  split_among: string[];
  created_at: string;
  updated_at: string;
  category?: string | null;
}

interface Member {
  id: string;
  name: string;
}

interface ExpenseListProps {
  expenses: Expense[];
  members: Member[];
  currentMemberId: string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  readOnly?: boolean;
}

export function ExpenseList({ expenses, members, currentMemberId, onEdit, onDelete, readOnly }: ExpenseListProps) {
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No expenses yet</p>
        <p className="text-sm">Add your first expense to get started</p>
      </div>
    );
  }

  const totalCount = expenses.length;

  return (
    <div className="space-y-3">
      {expenses.map((expense, index) => {
        const splitNames = (expense.split_among.length > 0 ? expense.split_among : members.map((m) => m.id))
          .map((id) => memberMap.get(id) || "?");
        const cat = EXPENSE_CATEGORIES.find((c) => c.value === expense.category);

        return (
          <Card key={expense.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-xs font-mono text-muted-foreground bg-muted rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">
                  {totalCount - index}
                </span>
                <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {cat && <span title={cat.label}>{cat.icon}</span>}
                  <h3 className="font-semibold truncate">{expense.description || "Untitled"}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Paid by <span className="font-medium text-foreground">{memberMap.get(expense.paid_by) || "?"}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Split: {splitNames.join(", ")}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    {new Date(expense.created_at).toLocaleDateString()}
                  </p>
                  {cat && (
                    <Badge variant="secondary" className="text-xs py-0 px-1.5">
                      {cat.label}
                    </Badge>
                  )}
                </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className="text-lg font-bold font-display text-primary whitespace-nowrap">
                  ₹{expense.amount.toFixed(2)}
                </span>
                {!readOnly && expense.created_by === currentMemberId && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(expense)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(expense)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
