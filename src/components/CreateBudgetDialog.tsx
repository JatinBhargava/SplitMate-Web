import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Member { id: string; name: string; }

interface Budget {
  id: string; group_id: string; created_by: string; type: string;
  name: string; budget_limit: number | null; member_ids: string[];
  linked_expense_ids: string[]; created_at: string;
}

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  memberId: string;
  members: Member[];
  onCreated: () => void;
  editBudget?: Budget | null;
}

export function CreateBudgetDialog({ open, onOpenChange, groupId, memberId, members, onCreated, editBudget }: CreateBudgetDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<"personal" | "group">("personal");
  const [hasCap, setHasCap] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [date, setDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  const isEditing = !!editBudget;

  useEffect(() => {
    if (editBudget) {
      setName(editBudget.name);
      setType(editBudget.type as "personal" | "group");
      setHasCap(editBudget.budget_limit !== null);
      setBudgetLimit(editBudget.budget_limit?.toString() || "");
      setSelectedMembers(editBudget.member_ids);
      setDate(new Date(editBudget.created_at));
    } else {
      resetForm();
    }
  }, [editBudget, open]);

  const resetForm = () => {
    setName(""); setType("personal"); setHasCap(false);
    setBudgetLimit(""); setSelectedMembers([]); setDate(new Date());
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast({ title: "Please enter a budget name", variant: "destructive" }); return; }
    if (type === "group" && selectedMembers.length === 0) { toast({ title: "Select at least one member", variant: "destructive" }); return; }
    if (hasCap && (!budgetLimit || parseFloat(budgetLimit) <= 0)) { toast({ title: "Enter a valid budget limit", variant: "destructive" }); return; }

    setSaving(true);
    const memberIds = type === "personal" ? [memberId] : selectedMembers;
    const payload = {
      name: name.trim(),
      type,
      budget_limit: hasCap ? parseFloat(budgetLimit) : null,
      member_ids: memberIds,
      created_at: date.toISOString(),
    };

    const { error } = isEditing
      ? await supabase.from("budgets").update(payload).eq("id", editBudget!.id)
      : await supabase.from("budgets").insert({ ...payload, group_id: groupId, created_by: memberId, linked_expense_ids: [] });

    setSaving(false);
    if (error) { toast({ title: `Error ${isEditing ? "updating" : "creating"} budget`, variant: "destructive" }); return; }
    toast({ title: isEditing ? "Budget updated!" : "Budget created!" });
    resetForm();
    onOpenChange(false);
    onCreated();
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Budget" : "Create Budget"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Budget Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trip Budget, Monthly" />
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
            <Label className="mb-2 block">Budget Type</Label>
            <div className="flex gap-2">
              <Button type="button" variant={type === "personal" ? "default" : "outline"} size="sm" onClick={() => setType("personal")} className="flex-1">Personal</Button>
              <Button type="button" variant={type === "group" ? "default" : "outline"} size="sm" onClick={() => setType("group")} className="flex-1">Group</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {type === "personal" ? "Tracks only your expenses." : "Tracks selected members' expenses."}
            </p>
          </div>
          {type === "group" && (
            <div>
              <Label className="mb-2 block">Select Members</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-lg p-2">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                    <Checkbox checked={selectedMembers.includes(m.id)} onCheckedChange={() => toggleMember(m.id)} />
                    <span className="text-sm">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <Label>Set Budget Cap</Label>
              <p className="text-xs text-muted-foreground">Optional spending limit</p>
            </div>
            <Switch checked={hasCap} onCheckedChange={setHasCap} />
          </div>
          {hasCap && (
            <div>
              <Label>Budget Limit (₹)</Label>
              <Input type="number" min="0" step="0.01" value={budgetLimit} onChange={(e) => setBudgetLimit(e.target.value)} placeholder="e.g. 5000" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Budget")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
