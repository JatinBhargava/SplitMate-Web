import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface ShareSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
}

export function ShareSettings({ open, onOpenChange, groupId }: ShareSettingsProps) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      supabase
        .from("expense_groups")
        .select("share_password")
        .eq("id", groupId)
        .single()
        .then(({ data }) => {
          if (data?.share_password) {
            setEnabled(true);
            setPassword(data.share_password);
          } else {
            setEnabled(false);
            setPassword("");
          }
        });
    }
  }, [open, groupId]);

  const handleSave = async () => {
    if (enabled && !password.trim()) {
      toast({ title: "Please set a password", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("expense_groups")
      .update({ share_password: enabled ? password.trim() : null })
      .eq("id", groupId);

    if (error) {
      toast({ title: "Error saving", variant: "destructive" });
    } else {
      toast({ title: enabled ? "Sharing enabled" : "Sharing disabled" });
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Share Expenses</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Allow anyone with the group code and a password to view your expenses (read-only).
          </p>
          <div className="flex items-center justify-between">
            <Label>Enable sharing</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          {enabled && (
            <div>
              <Label>Share Password</Label>
              <Input
                type="text"
                placeholder="Set a password for viewers"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={50}
              />
            </div>
          )}
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
