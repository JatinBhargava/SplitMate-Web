import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Pencil, Check, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Member { id: string; name: string; user_id?: string | null; }

interface MemberManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: Member[];
  currentMemberId: string;
  onMemberChanged: () => void;
  isCreator?: boolean;
}

export function MemberManagement({ open, onOpenChange, groupId, members, currentMemberId, onMemberChanged, isCreator = false }: MemberManagementProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (member: Member) => {
    setEditingId(member.id);
    setEditName(member.name);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const { error } = await supabase.from("group_members").update({ name: editName.trim() }).eq("id", editingId);
    if (error) {
      toast({ title: "Error updating member", variant: "destructive" });
    } else {
      toast({ title: "Member updated" });
      onMemberChanged();
    }
    setEditingId(null);
  };

  const removeMember = async (member: Member) => {
    // Delete their expenses first, then remove member
    await supabase.from("expenses").delete().eq("group_id", groupId).eq("paid_by", member.id);
    const { error } = await supabase.from("group_members").delete().eq("id", member.id);
    if (error) {
      toast({ title: "Error removing member", variant: "destructive" });
    } else {
      toast({ title: `${member.name} removed from group` });
      onMemberChanged();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Members</DialogTitle>
          <DialogDescription>{isCreator ? "Edit or remove members from the group." : "Group members list."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
              {editingId === m.id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" autoFocus />
                  <Button size="icon" variant="ghost" onClick={saveEdit}><Check className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium text-foreground">
                    {m.name} {m.id === currentMemberId && <span className="text-xs text-muted-foreground">(you)</span>}
                  </span>
                  {isCreator && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => startEdit(m)} title="Rename">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {m.id !== currentMemberId && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="text-destructive" title="Remove">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {m.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove {m.name} and all their expenses from the group.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeMember(m)} className="bg-destructive text-destructive-foreground">
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
