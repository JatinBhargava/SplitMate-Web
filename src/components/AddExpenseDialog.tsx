import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Member { id: string; name: string; }
interface Expense { id: string; paid_by: string; description: string; amount: number; split_among: string[]; category?: string | null; created_at?: string; }

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  memberId: string;
  memberName: string;
  members: Member[];
  editExpense: Expense | null;
  onSaved: () => void;
}

export function AddExpenseDialog({
  open, onOpenChange, groupId, memberId, memberName, members, editExpense, onSaved,
}: AddExpenseDialogProps) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(memberId);
  const [splitAmong, setSplitAmong] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editExpense) {
      setDescription(editExpense.description);
      setAmount(String(editExpense.amount));
      setPaidBy(editExpense.paid_by);
      setSplitAmong(editExpense.split_among.length > 0 ? editExpense.split_among : members.map((m) => m.id));
      setCategory(editExpense.category || "");
      setDate(editExpense.created_at ? new Date(editExpense.created_at) : new Date());
    } else {
      setDescription("");
      setAmount("");
      setPaidBy(memberId);
      setSplitAmong(members.map((m) => m.id));
      setCategory("");
      setDate(new Date());
    }
  }, [editExpense, open, memberId, members]);

  const toggleMember = (id: string) => {
    setSplitAmong((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (splitAmong.length === 0) {
      toast({ title: "Select at least one member to split with", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const expenseData = {
        group_id: groupId,
        paid_by: paidBy,
        description: description.trim() || "Untitled",
        amount: Number(amount),
        split_among: splitAmong,
        category: category || null,
        created_at: date.toISOString(),
      };

      if (editExpense) {
        const { error } = await supabase.from("expenses").update(expenseData).eq("id", editExpense.id);
        if (error) throw error;
        await supabase.from("activity_log").insert({
          group_id: groupId, member_id: memberId, action: "EXPENSE_UPDATED",
          details: `${memberName} updated "${expenseData.description}" to ₹${Number(amount).toFixed(2)}`,
        });
        toast({ title: "Expense updated" });
      } else {
        const { error } = await supabase.from("expenses").insert({ ...expenseData, created_by: memberId });
        if (error) throw error;
        await supabase.from("activity_log").insert({
          group_id: groupId, member_id: memberId, action: "EXPENSE_CREATED",
          details: `${memberName} added "${expenseData.description}" (₹${Number(amount).toFixed(2)})`,
        });
        toast({ title: "Expense added" });
      }

      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({ title: "Error saving expense", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editExpense ? "Edit Expense" : "Add Expense"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              placeholder="e.g. Dinner, Uber, Groceries"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Category <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.icon} {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Paid by</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Split among</Label>
              <div className="flex gap-2">
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => setSplitAmong(members.map((m) => m.id))}>
                  Select All
                </button>
                <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setSplitAmong([])}>
                  None
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors">
                  <Checkbox checked={splitAmong.includes(m.id)} onCheckedChange={() => toggleMember(m.id)} />
                  <span className="text-sm">{m.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {splitAmong.length} of {members.length} selected
            </p>
          </div>
          {splitAmong.length > 0 && amount && Number(amount) > 0 && (
            <p className="text-sm text-muted-foreground">
              Each person pays: <span className="font-semibold text-foreground">₹{(Number(amount) / splitAmong.length).toFixed(2)}</span>
            </p>
          )}
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? "Saving..." : editExpense ? "Update Expense" : "Add Expense"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
