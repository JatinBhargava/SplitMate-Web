import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface IncomeEntry {
  id: string; budget_id: string; added_by: string;
  description: string; amount: number; created_at: string;
}

interface AddIncomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  memberId: string;
  onSaved: () => void;
  editIncome?: IncomeEntry | null;
}

export function AddIncomeDialog({ open, onOpenChange, budgetId, memberId, onSaved, editIncome }: AddIncomeDialogProps) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);
  const isEditing = !!editIncome;

  useEffect(() => {
    if (editIncome) {
      setDescription(editIncome.description);
      setAmount(editIncome.amount.toString());
      setDate(new Date(editIncome.created_at));
    } else {
      setDescription(""); setAmount(""); setDate(new Date());
    }
  }, [editIncome, open]);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" }); return;
    }
    setSaving(true);
    const payload = {
      description: description.trim() || "Income",
      amount: parseFloat(amount),
      created_at: date.toISOString(),
    };
    const { error } = isEditing
      ? await supabase.from("income_entries").update(payload).eq("id", editIncome!.id)
      : await supabase.from("income_entries").insert({ ...payload, budget_id: budgetId, added_by: memberId });
    setSaving(false);
    if (error) { toast({ title: `Error ${isEditing ? "updating" : "adding"} income`, variant: "destructive" }); return; }
    toast({ title: isEditing ? "Income updated!" : "Income added!" });
    setDescription(""); setAmount(""); setDate(new Date());
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Income" : "Add Income"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Salary, Contribution" />
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : (isEditing ? "Save" : "Add Income")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
